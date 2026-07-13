import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

const PORTAL_ORIGIN =
  ((import.meta.env as Record<string, string | undefined>).VITE_CRIAPOST_ORIGIN) ?? window.location.origin;

// Abas extras do portal do cliente. O portal já sabe renderizar as duas;
// isto aqui é o interruptor que a gestora liga por cliente.
export type PortalSettings = { show_calendar?: boolean; show_report?: boolean };

export type ExternalClient = {
  id: string; manager_id: string; name: string; logo_url: string | null;
  instagram_handle: string | null; notes: string | null; active: boolean; created_at: string;
  color: string | null; crm_client_id: string | null; brand_color: string | null;
  portal_settings: PortalSettings | null;
};
// crm_client_id: vincular a um cliente já existente no cadastro central.
// Se vier null/undefined, criamos um novo cliente central automaticamente.
// logo_url + brand_color personalizam o portal público de aprovação do cliente.
// portal_settings decide se o link do cliente mostra Calendário e Relatório.
export type ExternalClientInput = { name: string; instagram_handle?: string | null; notes?: string | null; color?: string | null; crm_client_id?: string | null; logo_url?: string | null; brand_color?: string | null; portal_settings?: PortalSettings | null };

export type ExternalPost = {
  id: string; title: string; platform: string; format: string;
  caption: string | null; hook: string | null;
  approval_status: "pendente" | "ajuste_solicitado" | "aprovado" | null;
  scheduled_date: string | null; created_at: string;
  approval_mode: string; script: string | null;
  approval_updated_at: string | null;
  last_comment: string | null; last_comment_role: string | null;
};
export type ExternalPostInput = { title: string; platform: string; format: string; caption?: string | null; hook?: string | null; script?: string | null; approval_mode?: "fast" | "flow" | "both"; scheduled_date?: string | null; scheduled_time?: string | null };

export function useExternalClients() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();

  const clientsQ = useQuery({
    queryKey: ["external-clients", agencyOwnerId],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("external_clients").select("*").eq("manager_id", agencyOwnerId!).order("created_at", { ascending: false });
      if (error) throw error;
      return (data as ExternalClient[]) ?? [];
    },
  });

  const pendingQ = useQuery({
    queryKey: ["external-pending", agencyOwnerId],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("posts").select("external_client_id, approval_status")
        .eq("user_id", agencyOwnerId!).not("external_client_id", "is", null).in("approval_status", ["pendente", "ajuste_solicitado"]);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of (data as { external_client_id: string }[]) ?? []) map[r.external_client_id] = (map[r.external_client_id] ?? 0) + 1;
      return map;
    },
  });

  const create = useMutation({
    mutationFn: async (input: ExternalClientInput) => {
      const { crm_client_id: linkId, ...rest } = input;
      // Vincula a um cliente central existente ou cria um novo no hub (crm_clients).
      let crmId = linkId ?? null;
      if (!crmId) {
        const { data: crm, error: e0 } = await sbFrom("crm_clients").insert({
          manager_id: agencyOwnerId!, name: rest.name,
          instagram: rest.instagram_handle ?? null, notes: rest.notes ?? null,
        }).select("id").single();
        if (e0) throw e0;
        crmId = (crm as { id: string }).id;
      }
      const { data, error } = await sbFrom("external_clients")
        .insert({ manager_id: agencyOwnerId!, ...rest, crm_client_id: crmId }).select().single();
      if (error) throw error; return data as ExternalClient;
    },
    onSuccess: () => {
      toast.success("Cliente criado!");
      qc.invalidateQueries({ queryKey: ["external-clients", agencyOwnerId] });
      qc.invalidateQueries({ queryKey: ["crm-clients", agencyOwnerId] });
    },
    onError: () => toast.error("Erro ao criar cliente."),
  });

  const update = useMutation({
    mutationFn: async ({ id, crm_client_id: linkId, ...input }: ExternalClientInput & { id: string }) => {
      const { error } = await sbFrom("external_clients").update({ ...input, crm_client_id: linkId ?? null }).eq("id", id);
      if (error) throw error;
      // Mantém o cadastro central em sincronia com o básico.
      if (linkId) {
        await sbFrom("crm_clients").update({
          name: input.name, instagram: input.instagram_handle ?? null, notes: input.notes ?? null,
        }).eq("id", linkId);
      }
    },
    onSuccess: () => {
      toast.success("Cliente atualizado!");
      qc.invalidateQueries({ queryKey: ["external-clients", agencyOwnerId] });
      qc.invalidateQueries({ queryKey: ["crm-clients", agencyOwnerId] });
    },
    onError: () => toast.error("Erro ao atualizar."),
  });

  const setActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await sbFrom("external_clients").update({ active }).eq("id", id); if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["external-clients", agencyOwnerId] }),
  });

  // Link de aprovação. Sem período = manda TUDO (comportamento padrão).
  // Com período = gera um link novo que só mostra os posts daquele intervalo.
  // Retorna a URL pra quem quiser abrir o portal em nova aba além de copiar.
  const copyLink = async (clientId: string, period?: { start: string; end: string } | null): Promise<string | undefined> => {
    let token: string | undefined;
    if (period?.start && period?.end) {
      const { data: created, error } = await sbFrom("approval_tokens")
        .insert({ manager_id: agencyOwnerId!, external_client_id: clientId, period_start: period.start, period_end: period.end })
        .select("token").single();
      if (error || !created) { toast.error("Erro ao gerar o link do período."); return; }
      token = (created as { token: string }).token;
    } else {
      const { data: existing, error: e1 } = await sbFrom("approval_tokens")
        .select("token").eq("external_client_id", clientId).eq("active", true)
        .is("period_start", null).order("created_at", { ascending: false }).limit(1);
      if (e1) { toast.error("Erro ao gerar link."); return; }
      token = (existing as { token: string }[] | null)?.[0]?.token;
      if (!token) {
        const { data: created, error: e2 } = await sbFrom("approval_tokens").insert({ manager_id: agencyOwnerId!, external_client_id: clientId }).select("token").single();
        if (e2 || !created) { toast.error("Erro ao gerar link."); return; }
        token = (created as { token: string }).token;
      }
    }
    const url = `${PORTAL_ORIGIN}/aprovar/${token}`;
    try { await navigator.clipboard.writeText(url); toast.success(period ? "Link do período copiado!" : "Link de aprovação copiado!"); }
    catch { toast.message(url); }
    return url;
  };

  return { clients: clientsQ.data ?? [], isLoading: clientsQ.isLoading, pending: pendingQ.data ?? {}, create, update, setActive, copyLink };
}

export function useExternalPosts(clientId: string | null) {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  const key = ["cria-posts", clientId];

  const postsQ = useQuery({
    queryKey: key,
    enabled: !!agencyOwnerId && !!clientId,
    queryFn: async () => {
      // Rascunhos (is_draft) NÃO aparecem no kanban/calendário nem vão pro cliente.
      const { data, error } = await sbFrom("posts").select("*").eq("external_client_id", clientId!)
        .not("is_draft", "is", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const posts = (data as ExternalPost[]) ?? [];
      const ids = posts.map((p) => p.id);
      const comments: Record<string, { content: string; author_role: string }> = {};
      if (ids.length) {
        const { data: cdata } = await sbFrom("post_approval_comments").select("post_id, content, author_role, created_at").in("post_id", ids).order("created_at", { ascending: false });
        for (const c of (cdata as { post_id: string; content: string; author_role: string }[]) ?? []) if (!comments[c.post_id]) comments[c.post_id] = { content: c.content, author_role: c.author_role };
      }
      return posts.map((p) => ({ ...p, last_comment: comments[p.id]?.content ?? null, last_comment_role: comments[p.id]?.author_role ?? null }));
    },
  });

  const create = useMutation({
    mutationFn: async (input: ExternalPostInput): Promise<ExternalPost> => {
      const { approval_mode, ...rest } = input;
      const { data, error } = await sbFrom("posts").insert({
        user_id: agencyOwnerId!, external_client_id: clientId, status: "editando",
        approval_status: "pendente", approval_mode: approval_mode ?? "fast", ...rest,
      }).select().single();
      if (error) throw error;
      return data as unknown as ExternalPost;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["external-pending", agencyOwnerId] }); },
    onError: () => toast.error("Erro ao criar post."),
  });

  // Rascunho: cria o post JÁ ao abrir o "Novo post", pra liberar o upload de mídia na hora
  // (o storage precisa do post.id). Se o usuário cancelar, o rascunho é apagado.
  const createDraft = useMutation({
    mutationFn: async (input: Partial<ExternalPostInput> & { scheduled_date?: string | null }): Promise<ExternalPost> => {
      // external_client_id fica NULL no rascunho: assim ele não aparece no kanban nem
      // no portal do cliente. O vínculo só acontece quando o post é publicado.
      const { data, error } = await sbFrom("posts").insert({
        user_id: agencyOwnerId!, external_client_id: null, status: "editando",
        approval_status: "pendente", approval_mode: "fast", is_draft: true,
        title: "", platform: "instagram", format: "reels",
        scheduled_date: input.scheduled_date ?? null,
      }).select().single();
      if (error) throw error;
      return data as unknown as ExternalPost;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key, refetchType: "none" }),
    onError: () => toast.error("Não consegui abrir o post."),
  });

  const update = useMutation({
    mutationFn: async ({ id, resend, publish, ...input }: ExternalPostInput & { id: string; resend?: boolean; publish?: boolean }) => {
      const patch: Record<string, unknown> = { ...input };
      if (resend) { patch.approval_status = "pendente"; patch.approval_updated_at = new Date().toISOString(); }
      // publish = sai de rascunho, VINCULA o cliente e entra na fila de aprovação dele.
      if (publish) {
        patch.is_draft = false;
        patch.external_client_id = clientId;
        patch.approval_status = "pendente";
        patch.approval_updated_at = new Date().toISOString();
      }
      const { error } = await sbFrom("posts").update(patch).eq("id", id); if (error) throw error;
    },
    onSuccess: () => { toast.success("Post atualizado!"); qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["external-pending", agencyOwnerId] }); },
    onError: () => toast.error("Erro ao atualizar."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await sbFrom("posts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Post removido."); qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["external-pending", agencyOwnerId] }); },
    onError: () => toast.error("Erro ao remover o post."),
  });

  // Move o status de aprovação manualmente (gestora arrastando no kanban).
  const moveStatus = useMutation({
    mutationFn: async ({ id, approval_status }: { id: string; approval_status: ExternalPost["approval_status"] }) => {
      const { error } = await sbFrom("posts")
        .update({ approval_status, approval_updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["external-pending", agencyOwnerId] }); },
    onError: () => toast.error("Erro ao mover o post."),
  });

  // Muda a DATA do post (arrastar no calendário / escolher no card). Otimista pra ser instantâneo.
  const setDate = useMutation({
    mutationFn: async ({ id, scheduled_date }: { id: string; scheduled_date: string | null }) => {
      const { error } = await sbFrom("posts").update({ scheduled_date }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, scheduled_date }: { id: string; scheduled_date: string | null }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ExternalPost[]>(key);
      qc.setQueryData<ExternalPost[]>(key, (old) =>
        Array.isArray(old) ? old.map((p) => (p.id === id ? { ...p, scheduled_date } : p)) : old);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      const c = ctx as { prev?: ExternalPost[] } | undefined;
      if (c?.prev) qc.setQueryData(key, c.prev);
      toast.error("Não consegui mudar a data.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key, refetchType: "none" }),
  });

  return { posts: postsQ.data ?? [], isLoading: postsQ.isLoading, create, createDraft, update, remove, moveStatus, setDate };
}

// Todos os posts de aprovação por link, de todos os clientes externos, num query só.
// Alimenta o painel de aprovações do Cria Post (visão do fluxo por status).
export type ExternalPostWithClient = ExternalPost & { external_client_id: string };
export function useAllExternalPosts() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery({
    queryKey: ["external-posts-all", agencyOwnerId],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("posts").select("*")
        .eq("user_id", agencyOwnerId!)
        .not("external_client_id", "is", null)
        .not("is_draft", "is", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const posts = (data as ExternalPostWithClient[]) ?? [];
      // Último comentário só pros posts em ajuste (é o que a gestora precisa ver de cara).
      const ids = posts.filter((p) => p.approval_status === "ajuste_solicitado").map((p) => p.id);
      const comments: Record<string, { content: string; author_role: string }> = {};
      if (ids.length) {
        const { data: cdata } = await sbFrom("post_approval_comments").select("post_id, content, author_role, created_at").in("post_id", ids).order("created_at", { ascending: false });
        for (const c of (cdata as { post_id: string; content: string; author_role: string }[]) ?? []) if (!comments[c.post_id]) comments[c.post_id] = { content: c.content, author_role: c.author_role };
      }
      return posts.map((p) => ({ ...p, last_comment: comments[p.id]?.content ?? p.last_comment ?? null, last_comment_role: comments[p.id]?.author_role ?? p.last_comment_role ?? null }));
    },
  });
}

// Última vez que o cliente abriu o portal de aprovação (last_viewed_at do token ativo).
export function usePortalActivity(clientId: string | null) {
  return useQuery({
    queryKey: ["portal-activity", clientId],
    enabled: !!clientId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await sbFrom("approval_tokens")
        .select("last_viewed_at")
        .eq("external_client_id", clientId!)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = (data as { last_viewed_at: string | null }[] | null)?.[0];
      return row?.last_viewed_at ?? null;
    },
  });
}
