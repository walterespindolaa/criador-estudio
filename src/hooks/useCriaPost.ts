import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";
import { hojeBR, parseDateOnly, toISODateBR } from "@/lib/date-br";

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
  approval_status: "em_producao" | "pendente" | "ajuste_solicitado" | "aprovado" | "postado" | null;
  scheduled_date: string | null; created_at: string;
  approval_mode: string; script: string | null;
  approval_updated_at: string | null;
  last_comment: string | null; last_comment_role: string | null;
  // Link de ideia/referência (Drive, post, Pinterest...). Coluna nova em posts, ver SQL.
  reference_url: string | null;
  // Link da PASTA do Drive com os materiais do post (distinto da referência/ideia).
  // Coluna nova em posts (ver SQL). Aparece como atalho na aprovação do cliente.
  drive_folder_url: string | null;
  /** Cria Parceiros: quem está produzindo esta peça (designer/editor/copy). */
  assignee_id: string | null;
  producao_status: string | null;
  prazo_producao: string | null;
};
export type ExternalPostInput = { title: string; platform: string; format: string; caption?: string | null; hook?: string | null; script?: string | null; approval_mode?: "fast" | "flow" | "both"; scheduled_date?: string | null; scheduled_time?: string | null; reference_url?: string | null; drive_folder_url?: string | null };

// Colunas usadas no board/card, no calendário e no editor do Cria Post. Trocamos o
// select("*") por esta lista pra NÃO rebaixar todas as colunas (e as futuras) a cada
// refetch. É o suficiente pro editor abrir; mídia pesada já vem por query própria sob
// demanda. Mantém board_order (ordenação), scheduled_time e external_client_id (usados
// via cast pelas telas que consomem estas queries).
const POST_BOARD_COLUMNS =
  "id, title, platform, format, caption, hook, approval_status, scheduled_date, scheduled_time, created_at, approval_mode, script, approval_updated_at, reference_url, drive_folder_url, board_order, external_client_id, assignee_id, producao_status, prazo_producao";

// Invalida TODAS as queries que renderizam um mesmo post externo em telas diferentes.
// O mesmo post aparece no kanban do cliente (cria-posts), na Agenda + painel de
// Aprovacoes (external-posts-all), no badge de pendentes (external-pending), na home
// copiloto (operation-posts) e no calendario do gestor (manager-calendar). Cada mutation
// de post externo (criar/editar/mover/aprovar/excluir/importar/converter) deve chamar
// isto pra que a UICP reflita na hora em todas elas, sem depender de reload.
// clientId: se vier, mira so o kanban daquele cliente (["cria-posts", clientId]); se nao
// vier, invalida todos os kanbans (["cria-posts"]). manager-calendar vai sem id de
// proposito: a chave real usa o user.id do gestor, entao invalidamos o prefixo inteiro.
export function invalidatePostsEverywhere(
  qc: QueryClient,
  agencyOwnerId: string | null | undefined,
  clientId?: string | null,
) {
  qc.invalidateQueries({ queryKey: clientId ? ["cria-posts", clientId] : ["cria-posts"] });
  qc.invalidateQueries({ queryKey: ["external-posts-all", agencyOwnerId] });
  qc.invalidateQueries({ queryKey: ["external-pending", agencyOwnerId] });
  qc.invalidateQueries({ queryKey: ["operation-posts", agencyOwnerId] });
  qc.invalidateQueries({ queryKey: ["manager-calendar"] });
}

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
    staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true,
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
      // DEDUP: se esse cliente já tem vínculo no Cria Post, REUSA (não cria outra
      // linha). Sem isso, "Ativar Cria Post" 2x criava "2 Anna" e o conteúdo antigo
      // sumia (o .find pegava a linha nova).
      if (crmId) {
        const { data: existing } = await sbFrom("external_clients")
          .select("*").eq("manager_id", agencyOwnerId!).eq("crm_client_id", crmId)
          .order("created_at", { ascending: true }).limit(1).maybeSingle();
        if (existing) {
          // Garante que está ativo de novo (caso tenha sido desativado).
          if (!(existing as ExternalClient).active) {
            await sbFrom("external_clients").update({ active: true }).eq("id", (existing as ExternalClient).id);
          }
          return existing as ExternalClient;
        }
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
      // COR: crm_clients.color é a FONTE DE VERDADE (a agenda, a lista, o kanban e o
      // cockpit leem de lá). Editar a cor por aqui grava lá também, senão o cliente
      // ficaria com duas cores diferentes ao mesmo tempo. O caminho de volta (mudou na
      // ficha, espelha no external) é um gatilho no banco, que não depende de tela aberta.
      if (linkId) {
        await sbFrom("crm_clients").update({
          name: input.name, instagram: input.instagram_handle ?? null, notes: input.notes ?? null,
          color: input.color ?? null,
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

  // EXCLUI o cliente do Cria Post (portal/link de aprovação) MANTENDO a ficha
  // no Cria Gestão. A função no banco (excluir_cliente_do_portal, ver migration)
  // apaga numa transação só: posts do portal (com comentários e mídias), links
  // de aprovação e cronogramas; os materiais só perdem o vínculo. Devolve a
  // contagem do que saiu. Não tem lixeira: as queries/RPCs públicas do portal
  // não filtram deleted_at, então soft delete deixaria o portal meio vivo.
  const removeFromPost = useMutation({
    mutationFn: async (id: string) => {
      // types.ts é travado (não regenerar): cast do rpc, mesmo padrão do sbFrom.
      const rpc = supabase.rpc.bind(supabase) as unknown as (
        fn: string, args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await rpc("excluir_cliente_do_portal", { _external_client_id: id });
      if (error) throw error;
      return data as { posts: number; links_de_aprovacao: number; cronogramas: number; materiais_desvinculados: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["external-clients", agencyOwnerId] });
      qc.invalidateQueries({ queryKey: ["crm-clients", agencyOwnerId] });
      // Tira os posts do portal de TODAS as telas que os mostram (agenda, home...).
      invalidatePostsEverywhere(qc, agencyOwnerId);
    },
    onError: () => toast.error("Não consegui excluir o cliente do Cria Post."),
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

  return { clients: clientsQ.data ?? [], isLoading: clientsQ.isLoading, pending: pendingQ.data ?? {}, create, update, setActive, removeFromPost, copyLink };
}

export function useExternalPosts(clientId: string | null) {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  const key = ["cria-posts", clientId];

  const postsQ = useQuery({
    queryKey: key,
    enabled: !!agencyOwnerId && !!clientId,
    // Revalida ao focar (cliente aprova por link e o kanban precisa refletir), mas com
    // janela de 30s pra não rebaixar tudo a cada montagem/foco. As mutações já invalidam
    // quando algo muda de verdade. refetchOnMount:true (respeita o staleTime de 30s):
    // abrir a tela busca de novo se o dado tiver >30s, pra o celular (PWA, onde o
    // "focus" quase nao dispara) nao ficar preso num dado velho de outra sessao/aparelho.
    staleTime: 30_000, refetchOnWindowFocus: true, refetchOnMount: true,
    queryFn: async () => {
      // Rascunhos (is_draft) NÃO aparecem no kanban/calendário nem vão pro cliente.
      const { data, error } = await sbFrom("posts").select(POST_BOARD_COLUMNS).eq("external_client_id", clientId!)
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
      return posts.map((p) => ({ ...p, last_comment: comments[p.id]?.content ?? null, last_comment_role: comments[p.id]?.author_role ?? null }))
        // Ordem manual do kanban (board_order asc); created_at desc como desempate.
        .sort((a, b) => {
          const ao = (a as { board_order?: number }).board_order ?? 0;
          const bo = (b as { board_order?: number }).board_order ?? 0;
          if (ao !== bo) return ao - bo;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    },
  });

  const create = useMutation({
    mutationFn: async (input: ExternalPostInput): Promise<ExternalPost> => {
      const { approval_mode, ...rest } = input;
      const { data, error } = await sbFrom("posts").insert({
        user_id: agencyOwnerId!, external_client_id: clientId, status: "editando",
        approval_status: "em_producao", approval_mode: approval_mode ?? "fast", ...rest,
      }).select().single();
      if (error) throw error;
      return data as unknown as ExternalPost;
    },
    onSuccess: () => { invalidatePostsEverywhere(qc, agencyOwnerId, clientId); },
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
      // publish = sai de rascunho e VINCULA o cliente, mas nasce EM PRODUÇÃO
      // (não vai pro cliente ainda). A social mídia libera pro "Aguardando cliente".
      if (publish) {
        patch.is_draft = false;
        patch.external_client_id = clientId;
        patch.approval_status = "em_producao";
        patch.approval_updated_at = new Date().toISOString();
      }
      const { error } = await sbFrom("posts").update(patch).eq("id", id); if (error) throw error;
      // Reenvio após ajuste: grava um evento no histórico de aprovação pra não perder
      // o "vai e volta" com o cliente (cada pedido de ajuste dele + cada reenvio nosso
      // ficam registrados em post_approval_comments). Best-effort: se falhar, não trava
      // o save do post. author_role "social_media" = nós (o card do cliente é "cliente_externo").
      if (resend) {
        await sbFrom("post_approval_comments").insert({
          post_id: id, author_id: agencyOwnerId, author_role: "social_media",
          content: "Ajustado e reenviado pro cliente.",
        } as never).then(undefined, () => undefined);
      }
    },
    onSuccess: (_d, vars) => {
      toast.success("Post atualizado!");
      invalidatePostsEverywhere(qc, agencyOwnerId, clientId);
      // Atualiza o histórico aberto no editor (a aba de Histórico lê essa chave).
      qc.invalidateQueries({ queryKey: ["approval-comments", vars.id] });
    },
    onError: () => toast.error("Erro ao atualizar."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await sbFrom("posts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Post removido."); invalidatePostsEverywhere(qc, agencyOwnerId, clientId); },
    onError: () => toast.error("Erro ao remover o post."),
  });

  // Move o status de aprovação manualmente (gestora arrastando no kanban).
  // ANTES: só invalidava no onSuccess. O card voltava pra coluna de origem e
  // "pulava" pra nova depois do round-trip + refetch. No 4G isso são segundos.
  // AGORA: update otimista, o card fica onde a pessoa soltou, na hora.
  const moveStatus = useMutation({
    mutationFn: async ({ id, approval_status }: { id: string; approval_status: ExternalPost["approval_status"] }) => {
      const { error } = await sbFrom("posts")
        .update({ approval_status, approval_updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, approval_status }) => {
      await qc.cancelQueries({ queryKey: key });
      const anterior = qc.getQueryData<ExternalPost[]>(key);
      qc.setQueryData<ExternalPost[]>(key, (old) =>
        (old ?? []).map((p) => (p.id === id ? { ...p, approval_status } : p)),
      );
      return { anterior };
    },
    onError: (_e, _v, ctx) => {
      // Deu errado? Devolve o card pra onde estava, em vez de mentir pra pessoa.
      if (ctx?.anterior) qc.setQueryData(key, ctx.anterior);
      toast.error("Erro ao mover o post.");
    },
    onSettled: () => {
      // Mantem o card onde a pessoa soltou (o cache otimista ja bate com o servidor),
      // e propaga pro resto das telas. cria-posts refaz sem "pular" porque o valor
      // otimista e o do banco sao iguais apos o sucesso.
      invalidatePostsEverywhere(qc, agencyOwnerId, clientId);
    },
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
    onSettled: () => invalidatePostsEverywhere(qc, agencyOwnerId, clientId),
  });

  // Reorder OTIMISTA do kanban do Cria Post (dentro da coluna e entre colunas):
  // move o card na hora (patch + re-sort do cache) e persiste em segundo plano.
  const reorderExternalPosts = async (changes: { id: string; board_order: number; approval_status?: string; approval_updated_at?: string }[]): Promise<boolean> => {
    if (!changes.length) return true;
    const byId = new Map(changes.map((c) => [c.id, c]));
    // Snapshot pra rollback. O client do Supabase NÃO rejeita a promise em erro (devolve
    // { error }), então o .catch nunca rodava: numa falha o card ficava movido na tela
    // mas não persistia, sumindo no próximo refetch sem aviso. Agora checamos cada erro.
    const snapshot = qc.getQueryData<ExternalPost[]>(key);
    qc.setQueryData<ExternalPost[]>(key, (old) => {
      if (!Array.isArray(old)) return old;
      const next = old.map((p) => {
        const c = byId.get(p.id);
        return c ? ({ ...p, board_order: c.board_order, ...(c.approval_status ? { approval_status: c.approval_status } : {}), ...(c.approval_updated_at ? { approval_updated_at: c.approval_updated_at } : {}) } as ExternalPost) : p;
      });
      next.sort((a, b) => {
        const ao = (a as { board_order?: number }).board_order ?? 0;
        const bo = (b as { board_order?: number }).board_order ?? 0;
        if (ao !== bo) return ao - bo;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      return next;
    });
    const results = await Promise.all(changes.map((c) =>
      sbFrom("posts").update({ board_order: c.board_order, ...(c.approval_status ? { approval_status: c.approval_status } : {}), ...(c.approval_updated_at ? { approval_updated_at: c.approval_updated_at } : {}) } as never).eq("id", c.id),
    ));
    const failed = results.find((r) => (r as { error?: unknown }).error);
    if (failed) {
      // Reverte pro estado de antes e avisa, em vez de deixar o card "voltar" calado.
      if (snapshot) qc.setQueryData(key, snapshot);
      toast.error("Não consegui salvar a ordem. Tente de novo.");
      qc.invalidateQueries({ queryKey: key });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["external-pending", agencyOwnerId] });
    return true;
  };

  return { posts: postsQ.data ?? [], isLoading: postsQ.isLoading, create, createDraft, update, remove, moveStatus, setDate, reorderExternalPosts };
}

// Todos os posts de aprovação por link, de todos os clientes externos, num query só.
// Alimenta o painel de aprovações do Cria Post (visão do fluxo por status).
export type ExternalPostWithClient = ExternalPost & { external_client_id: string };
export function useAllExternalPosts() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery({
    queryKey: ["external-posts-all", agencyOwnerId],
    enabled: !!agencyOwnerId,
    // O cliente aprova por link; revalida ao focar pra o painel sair do "pendente",
    // mas com janela de 30s pra não rebaixar todos os posts a cada montagem/foco.
    // refetchOnMount:true: abrir a Agenda busca de novo se o dado tiver >30s (o
    // "focus" da PWA mobile e instavel; senao a agenda fica presa num dado velho).
    staleTime: 30_000, refetchOnWindowFocus: true, refetchOnMount: true,
    queryFn: async () => {
      const { data, error } = await sbFrom("posts").select(POST_BOARD_COLUMNS)
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

// Posts ENXUTOS pro motor de sinais da home (useOperationSignals). Diferente do
// useAllExternalPosts (que alimenta o board/painel e precisa de TODOS os posts com
// as colunas do card), aqui buscamos só o que os sinais leem e só a janela que
// importa pra "precisa de você hoje", pra não crescer com o histórico:
//  - external_client_id: agrupar posts por cliente
//  - approval_status: sinais de aprovação parada / ajuste pendente
//  - approval_updated_at (+ created_at de fallback): idade do sinal
//  - scheduled_date: silêncio (sem post agendado nos próximos 7 dias)
// Janela: pega TODOS os pendentes/em ajuste (independe de data) + qualquer post
// agendado/criado nos últimos 60 dias (o que também cobre os agendados futuros,
// que são >= hoje). Nenhum sinal atual varre "post antigo há muito tempo", então
// a janela não quebra nada. Se surgir um sinal desse tipo, ampliar a janela aqui.
export type OperationPost = {
  external_client_id: string;
  approval_status: ExternalPost["approval_status"];
  approval_updated_at: string | null;
  created_at: string;
  scheduled_date: string | null;
};
const OPERATION_POST_COLUMNS =
  "external_client_id, approval_status, approval_updated_at, created_at, scheduled_date";
export function useOperationPosts() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery({
    queryKey: ["operation-posts", agencyOwnerId],
    enabled: !!agencyOwnerId,
    // Mesma cadência do painel: cliente aprova por link, revalida ao focar, com janela
    // de 30s pra não rebaixar tudo a cada montagem/foco.
    // refetchOnMount:true (respeita staleTime 30s): abrir a home busca de novo se
    // o dado tiver >30s, pra o celular nao ficar com sinais velhos.
    staleTime: 30_000, refetchOnWindowFocus: true, refetchOnMount: true,
    queryFn: async () => {
      // Corte da janela: hoje menos 60 dias, no fuso BR.
      const cutoffDate = parseDateOnly(hojeBR());
      cutoffDate.setDate(cutoffDate.getDate() - 60);
      const cutoff = toISODateBR(cutoffDate);
      const { data, error } = await sbFrom("posts").select(OPERATION_POST_COLUMNS)
        .eq("user_id", agencyOwnerId!)
        .not("external_client_id", "is", null)
        .not("is_draft", "is", true)
        .or(`approval_status.in.(pendente,ajuste_solicitado),scheduled_date.gte.${cutoff},created_at.gte.${cutoff}`)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data as OperationPost[]) ?? [];
    },
  });
}

// Capa (primeira mídia) de VÁRIOS posts numa ÚNICA query, pra mostrar no card da
// agenda estilo Trello sem cair em N+1 (uma query por card seria pesado na grade).
// Recebe os ids dos posts VISÍVEIS e devolve um mapa post_id -> primeira mídia
// (menor position). Quem consome monta a URL exibível com getThumbnailUrl.
export type PostCoverMedia = {
  post_id: string; provider: string | null; external_file_id: string | null;
  file_type: string | null; file_name: string | null;
  view_url: string | null; thumbnail_url: string | null; bunny_video_id: string | null;
};
export function useExternalPostCovers(postIds: string[]) {
  const { agencyOwnerId } = useActiveAccount();
  // Chave estável: ids ordenados (a ordem de entrada varia por dia/render).
  const idsKey = [...postIds].sort();
  return useQuery({
    queryKey: ["external-post-covers", agencyOwnerId, idsKey],
    enabled: !!agencyOwnerId && idsKey.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sbFrom("external_media_refs")
        .select("post_id, provider, external_file_id, file_type, file_name, view_url, thumbnail_url, bunny_video_id, position")
        .in("post_id", idsKey)
        .order("position", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      const map = new Map<string, PostCoverMedia>();
      for (const row of (data as (PostCoverMedia & { position: number | null })[]) ?? []) {
        // Como vem ordenado por position asc, a PRIMEIRA linha de cada post é a capa.
        if (!map.has(row.post_id)) map.set(row.post_id, row);
      }
      return map;
    },
  });
}

// Edita campos de um post (de qualquer cliente) direto da Agenda, sem navegar.
export function useUpdateExternalPost() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await sbFrom("posts").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidatePostsEverywhere(qc, agencyOwnerId);
    },
    onError: () => toast.error("Não consegui salvar o post."),
  });
}

// Move a data de um post (de qualquer cliente) usado na Agenda ao arrastar.
// Reprograma no Cria Post e reflete no kanban/calendário do cliente.
export function useMoveExternalPostDate() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, scheduled_date }: { id: string; scheduled_date: string | null }) => {
      const { error } = await sbFrom("posts").update({ scheduled_date }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidatePostsEverywhere(qc, agencyOwnerId);
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
