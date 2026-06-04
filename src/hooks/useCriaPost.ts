import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

const PORTAL_ORIGIN =
  ((import.meta.env as Record<string, string | undefined>).VITE_CRIAPOST_ORIGIN) ?? window.location.origin;

export type ExternalClient = {
  id: string; manager_id: string; name: string; logo_url: string | null;
  instagram_handle: string | null; notes: string | null; active: boolean; created_at: string;
};
export type ExternalClientInput = { name: string; instagram_handle?: string | null; notes?: string | null };

export type ExternalPost = {
  id: string; title: string; platform: string; format: string;
  caption: string | null; hook: string | null;
  approval_status: "pendente" | "ajuste_solicitado" | "aprovado" | null;
  scheduled_date: string | null; created_at: string;
  last_comment: string | null; last_comment_role: string | null;
};
export type ExternalPostInput = { title: string; platform: string; format: string; caption?: string | null; hook?: string | null };

export function useExternalClients() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const clientsQ = useQuery({
    queryKey: ["external-clients", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbFrom("external_clients").select("*").eq("manager_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data as ExternalClient[]) ?? [];
    },
  });

  const pendingQ = useQuery({
    queryKey: ["external-pending", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbFrom("posts").select("external_client_id, approval_status")
        .eq("user_id", user!.id).not("external_client_id", "is", null).in("approval_status", ["pendente", "ajuste_solicitado"]);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of (data as { external_client_id: string }[]) ?? []) map[r.external_client_id] = (map[r.external_client_id] ?? 0) + 1;
      return map;
    },
  });

  const create = useMutation({
    mutationFn: async (input: ExternalClientInput) => {
      const { data, error } = await sbFrom("external_clients").insert({ manager_id: user!.id, ...input }).select().single();
      if (error) throw error; return data as ExternalClient;
    },
    onSuccess: () => { toast.success("Cliente criado!"); qc.invalidateQueries({ queryKey: ["external-clients", user?.id] }); },
    onError: () => toast.error("Erro ao criar cliente."),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: ExternalClientInput & { id: string }) => {
      const { error } = await sbFrom("external_clients").update(input).eq("id", id); if (error) throw error;
    },
    onSuccess: () => { toast.success("Cliente atualizado!"); qc.invalidateQueries({ queryKey: ["external-clients", user?.id] }); },
    onError: () => toast.error("Erro ao atualizar."),
  });

  const setActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await sbFrom("external_clients").update({ active }).eq("id", id); if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["external-clients", user?.id] }),
  });

  const copyLink = async (clientId: string) => {
    const { data: existing, error: e1 } = await sbFrom("approval_tokens")
      .select("token").eq("external_client_id", clientId).eq("active", true).order("created_at", { ascending: false }).limit(1);
    if (e1) { toast.error("Erro ao gerar link."); return; }
    let token = (existing as { token: string }[] | null)?.[0]?.token;
    if (!token) {
      const { data: created, error: e2 } = await sbFrom("approval_tokens").insert({ manager_id: user!.id, external_client_id: clientId }).select("token").single();
      if (e2 || !created) { toast.error("Erro ao gerar link."); return; }
      token = (created as { token: string }).token;
    }
    const url = `${PORTAL_ORIGIN}/aprovar/${token}`;
    try { await navigator.clipboard.writeText(url); toast.success("Link de aprovação copiado!"); }
    catch { toast.message(url); }
  };

  return { clients: clientsQ.data ?? [], isLoading: clientsQ.isLoading, pending: pendingQ.data ?? {}, create, update, setActive, copyLink };
}

export function useExternalPosts(clientId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["cria-posts", clientId];

  const postsQ = useQuery({
    queryKey: key,
    enabled: !!user && !!clientId,
    queryFn: async () => {
      const { data, error } = await sbFrom("posts").select("*").eq("external_client_id", clientId!).order("created_at", { ascending: false });
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
    mutationFn: async (input: ExternalPostInput) => {
      const { error } = await sbFrom("posts").insert({
        user_id: user!.id, external_client_id: clientId, status: "editando", approval_status: "pendente", ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Post enviado pra aprovação!"); qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["external-pending", user?.id] }); },
    onError: () => toast.error("Erro ao criar post."),
  });

  const update = useMutation({
    mutationFn: async ({ id, resend, ...input }: ExternalPostInput & { id: string; resend?: boolean }) => {
      const patch: Record<string, unknown> = { ...input };
      if (resend) { patch.approval_status = "pendente"; patch.approval_updated_at = new Date().toISOString(); }
      const { error } = await sbFrom("posts").update(patch).eq("id", id); if (error) throw error;
    },
    onSuccess: () => { toast.success("Post atualizado!"); qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["external-pending", user?.id] }); },
    onError: () => toast.error("Erro ao atualizar."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await sbFrom("posts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Post removido."); qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["external-pending", user?.id] }); },
  });

  return { posts: postsQ.data ?? [], isLoading: postsQ.isLoading, create, update, remove };
}
