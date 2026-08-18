import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { bestTimes } from "@/lib/bestTimes";
import { toISODateBR } from "@/lib/date-br";
import { toast } from "sonner";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

// Acesso ao HUB CRIA: admin OU módulo hub_cria liberado (module_entitlements).
export function useHasHubCria(): { allowed: boolean; isLoading: boolean } {
  const { agencyOwnerId } = useActiveAccount();
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";
  const q = useQuery<boolean>({
    queryKey: ["hubcria-entitlement", agencyOwnerId],
    enabled: !!agencyOwnerId && !isAdmin,
    queryFn: async () => {
      const { data, error } = await sbFrom("module_entitlements")
        .select("id")
        .eq("manager_id", agencyOwnerId!)
        .eq("module_code", "hub_cria")
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  return { allowed: isAdmin || q.data === true, isLoading: !isAdmin && q.isLoading };
}

export type ScrapeType = "posts" | "reels" | "profile" | "hashtag" | "comments" | "transcription" | "mentions" | "ads";

export type CompetitorScrape = {
  id: string;
  crm_client_id: string | null;
  competitor_id: string | null;
  scrape_type: ScrapeType;
  input_handle: string;
  status: "queued" | "running" | "done" | "error";
  result_summary: Record<string, unknown> | null;
  cost_usd: number | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
};

/* ═══════════════════════════════════════════════════════════════════════════
   O RADAR DE CONCORRENTES

   Antes a social mídia redigitava "@fulano" toda vez, e o sistema não fazia
   ideia de que aquele perfil importava pra aquele cliente. O concorrente virava
   uma string perdida numa linha de histórico.

   Agora ele é um ATIVO da ficha do cliente, igual ao brandbook. É isso que
   permite a única frase que traz a pessoa de volta sozinha:
   "esse concorrente está sem leitura há 31 dias".
   ═══════════════════════════════════════════════════════════════════════════ */
export type Competitor = {
  id: string;
  crm_client_id: string | null;
  handle: string;
  name: string | null;
  followers: number | null;
  avatar: string | null;
  last_read_at: string | null;
  created_at: string;
};

export function useCompetitors(crmClientId?: string) {
  return useQuery<Competitor[]>({
    queryKey: ["hubcria-competitors", crmClientId ?? "avulsa"],
    queryFn: async () => {
      let q = sbFrom("hub_competitors")
        .select("id,crm_client_id,handle,name,followers,avatar,last_read_at,created_at");
      q = crmClientId ? q.eq("crm_client_id", crmClientId) : q.is("crm_client_id", null);
      const { data, error } = await q.order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Competitor[];
    },
  });
}

/** Todos os concorrentes do gestor, pro dashboard do HUB (quem está esfriando). */
export function useAllCompetitors() {
  return useQuery<Competitor[]>({
    queryKey: ["hubcria-competitors-all"],
    queryFn: async () => {
      const { data, error } = await sbFrom("hub_competitors")
        .select("id,crm_client_id,handle,name,followers,avatar,last_read_at,created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Competitor[];
    },
  });
}

export function useAddCompetitor() {
  const qc = useQueryClient();
  const { agencyOwnerId } = useActiveAccount();
  return useMutation({
    mutationFn: async (input: { handle: string; crm_client_id?: string | null; name?: string }) => {
      const handle = input.handle.trim().replace(/^@/, "").replace(/\/+$/, "").split("/").pop() || "";
      if (!handle) throw new Error("Informe o @ do concorrente.");
      const { data, error } = await sbFrom("hub_competitors")
        .insert({
          manager_id: agencyOwnerId!,
          crm_client_id: input.crm_client_id ?? null,
          handle,
          name: input.name?.trim() || null,
        })
        .select("*").single();
      if (error) {
        // A unique (manager, cliente, handle) existe justamente pra isso.
        if (String(error.message).includes("duplicate")) throw new Error("Esse concorrente já está no radar.");
        throw error;
      }
      return data as unknown as Competitor;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["hubcria-competitors", vars.crm_client_id ?? "avulsa"] });
      qc.invalidateQueries({ queryKey: ["hubcria-competitors-all"] });
      toast.success("Concorrente no radar.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não consegui adicionar."),
  });
}

export function useDeleteCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("hub_competitors").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hubcria-competitors"] });
      qc.invalidateQueries({ queryKey: ["hubcria-competitors-all"] });
      toast.success("Tirei do radar. As leituras dele continuam no histórico.");
    },
  });
}

/** Há quantos dias esse concorrente não é lido? null = nunca foi. */
export function diasSemLeitura(c: Competitor): number | null {
  if (!c.last_read_at) return null;
  return Math.floor((Date.now() - new Date(c.last_read_at).getTime()) / 86400000);
}

export type CreativeIdea = {
  id: string;
  crm_client_id: string | null;
  scrape_id: string | null;
  source: string;
  title: string;
  format: string | null;
  rationale: string | null;
  // Colunas novas (ver migration 20260807000001): a ideia manual pode carregar
  // um link de referência, e a convertida guarda PRA ONDE ela foi.
  ref_url: string | null;
  converted_post_id: string | null;
  converted_cronograma_id: string | null;
  status: "novo" | "usar" | "usada" | "descartada";
  created_at: string;
};

// Colunas lidas do banco de ideias (um lugar só, pras 3 queries não divergirem).
const IDEA_COLUMNS =
  "id,crm_client_id,scrape_id,source,title,format,rationale,ref_url,converted_post_id,converted_cronograma_id,status,created_at";

// crmClientId undefined = análise avulsa (crm_client_id null).
export function useScrapes(crmClientId?: string) {
  return useQuery<CompetitorScrape[]>({
    queryKey: ["hubcria-scrapes", crmClientId ?? "avulsa"],
    queryFn: async () => {
      let q = sbFrom("competitor_scrapes")
        .select("id,crm_client_id,competitor_id,scrape_type,input_handle,status,result_summary,cost_usd,error,created_at,finished_at");
      q = crmClientId ? q.eq("crm_client_id", crmClientId) : q.is("crm_client_id", null);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CompetitorScrape[];
    },
  });
}

/**
 * TODAS as pesquisas do gestor, de todos os clientes.
 *
 * O histórico só existia dentro de um cliente. Quem paga pelo módulo queria
 * abrir uma tela e ver TUDO que já pesquisou, inclusive pra achar aquela
 * leitura que ela fez no cliente errado e quer mandar pro certo.
 */
export function useAllScrapes() {
  return useQuery<CompetitorScrape[]>({
    queryKey: ["hubcria-scrapes-all"],
    queryFn: async () => {
      const { data, error } = await sbFrom("competitor_scrapes")
        .select("id,crm_client_id,competitor_id,scrape_type,input_handle,status,result_summary,cost_usd,error,created_at,finished_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as CompetitorScrape[];
    },
  });
}

// Todas as ideias do gestor (todos os clientes), pro overview do HUB.
export function useAllCreativeIdeas() {
  return useQuery<CreativeIdea[]>({
    queryKey: ["hubcria-ideas-all"],
    queryFn: async () => {
      const { data, error } = await sbFrom("creative_ideas")
        .select(IDEA_COLUMNS)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CreativeIdea[];
    },
  });
}

export function useCreativeIdeas(crmClientId?: string) {
  return useQuery<CreativeIdea[]>({
    queryKey: ["hubcria-ideas", crmClientId ?? "avulsa"],
    queryFn: async () => {
      let q = sbFrom("creative_ideas")
        .select(IDEA_COLUMNS);
      q = crmClientId ? q.eq("crm_client_id", crmClientId) : q.is("crm_client_id", null);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CreativeIdea[];
    },
  });
}

const erroDaEdge = async (error: { message: string; context?: Response }): Promise<string> => {
  let detail = error.message;
  try {
    const ctx = error.context;
    if (ctx?.text) { const raw = await ctx.clone().text(); const b = JSON.parse(raw); detail = b?.message || b?.error || detail; }
  } catch { /* ignore */ }
  return detail;
};

/**
 * RODAR A ANÁLISE agora em duas etapas.
 *
 * Antes era um request só, que ESPERAVA o scrape inteiro terminar. Uma edge
 * function morre em ~150s e transcrever 10 reels leva minutos: a função era
 * cortada no meio, o job ficava "running" pra sempre e a tela não mostrava nada.
 * Esse era o motivo do "não funciona".
 *
 * Agora: `start` dispara e volta na hora; a gente pergunta "já?" a cada 4s até
 * terminar. A pessoa vê o progresso em vez de uma tela morta.
 */
export function useRunScrape() {
  const qc = useQueryClient();
  const { agencyOwnerId } = useActiveAccount();

  return useMutation({
    mutationFn: async (input: { type: ScrapeType; input: string; crm_client_id?: string | null; competitor_id?: string | null; limit?: number; since?: string }) => {
      const { data, error } = await supabase.functions.invoke("apify-scrape", {
        body: {
          action: "start",
          type: input.type, input: input.input,
          crm_client_id: input.crm_client_id ?? null,
          competitor_id: input.competitor_id ?? null,
          limit: input.limit ?? 10, since: input.since, manager_id: agencyOwnerId,
        },
      });
      if (error) throw new Error((await erroDaEdge(error)) || "scrape_failed");
      const err = (data as { error?: string })?.error;
      if (err) throw new Error((data as { message?: string })?.message || err);

      const res = data as { scrape_id: string; status: string; message?: string };
      if (res.status === "error") throw new Error(res.message || "A análise falhou.");

      // Poll. Até 4 minutos: o Apify raramente passa disso, e é melhor errar pra
      // mais do que abandonar um job que ia terminar em 10 segundos.
      const scrapeId = res.scrape_id;
      const ate = Date.now() + 4 * 60 * 1000;
      while (Date.now() < ate) {
        await new Promise((r) => setTimeout(r, 4000));
        const { data: p, error: pollErr } = await supabase.functions.invoke("apify-scrape", {
          body: { action: "poll", scrape_id: scrapeId, manager_id: agencyOwnerId },
        });
        // Se a função de poll cair, `st` ficava undefined e o loop seguia às
        // cegas a cada 4s até o timeout de 4 min. Aborta cedo com o erro real:
        // tanto a falha de transporte (error) quanto o envelope { error } da edge.
        if (pollErr) throw new Error((await erroDaEdge(pollErr)) || "A análise não completou.");
        const pErr = (p as { error?: string })?.error;
        if (pErr) throw new Error((p as { message?: string })?.message || pErr);
        const st = (p as { status?: string })?.status;
        if (st === "done") return { scrape_id: scrapeId, ...(p as object) } as { scrape_id: string; ideas_count: number; cost_usd: number };
        if (st === "error") throw new Error((p as { error?: string })?.error || "A análise não completou.");
      }
      throw new Error("A análise está demorando mais que o normal. Ela continua rodando: recarregue em um minuto e ela aparece no histórico.");
    },

    onSuccess: (res, vars) => {
      const key = vars.crm_client_id ?? "avulsa";
      qc.invalidateQueries({ queryKey: ["hubcria-scrapes", key] });
      qc.invalidateQueries({ queryKey: ["hubcria-ideas", key] });
      qc.invalidateQueries({ queryKey: ["hubcria-ideas-all"] });
      qc.invalidateQueries({ queryKey: ["hubcria-credits"] });
      qc.invalidateQueries({ queryKey: ["hubcria-competitors", key] });
      qc.invalidateQueries({ queryKey: ["hubcria-competitors-all"] });
      const n = (res as { ideas_count?: number })?.ideas_count ?? 0;
      toast.success(n > 0 ? `Análise pronta: ${n} ideias no banco do cliente.` : "Análise pronta.");
    },
    onError: (e) => {
      const m = e instanceof Error ? e.message : "";
      toast.error(m || "Não consegui rodar a análise agora.");
    },
  });
}

/** Saldo de créditos do mês (o HUB tem custo variável: sem cota, o prejuízo é seu). */
export function useHubCredits() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery({
    queryKey: ["hubcria-credits", agencyOwnerId],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("hub_credits_status", { _manager: agencyOwnerId! });
      // FALHA ao ler a cota é diferente de "sem cota". Se devolvêssemos quota 0
      // aqui, o CriativoTab (que só trava quando quota > 0) liberaria análises
      // pagas do Apify sem limite. Sinalizamos error:true pra ele travar a ação
      // paga e pedir pra tentar de novo (fail-closed).
      if (error) return { used: 0, quota: 0, error: true };
      const r = (Array.isArray(data) ? data[0] : data) as { used: number; quota: number } | null;
      return { used: Number(r?.used ?? 0), quota: Number(r?.quota ?? 0), error: false };
    },
  });
}

/** Quanto cada análise custa em créditos. Espelha o CREDITOS da edge function. */
export const CREDITOS_POR_TIPO: Record<string, number> = {
  posts: 1, reels: 1, profile: 1, hashtag: 1, comments: 1, mentions: 1,
  ads: 2,
  transcription: 3,
};

// "Gerar plano a partir da análise": transforma as ideias marcadas "usar" em posts
// no cronograma do cliente (Cria Post) e marca as ideias como "usada".
export function useGeneratePlanFromIdeas() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { externalClientId: string; ideas: CreativeIdea[]; nicho?: string }): Promise<number> => {
      if (!agencyOwnerId) throw new Error("Not authenticated");
      const ideas = input.ideas.filter((i) => i.status === "usar");
      if (ideas.length === 0) throw new Error("Marque ao menos uma ideia como 'Usar' primeiro.");
      const slots = bestTimes("instagram", input.nicho).slots;
      const start = new Date();
      const rows = ideas.map((idea, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + 1 + Math.floor((i * 21) / Math.max(1, ideas.length)));
        return {
          user_id: agencyOwnerId,
          external_client_id: input.externalClientId,
          status: "editando",
          approval_status: "pendente",
          approval_mode: "fast",
          platform: "instagram",
          title: idea.title.slice(0, 200),
          caption: idea.rationale ?? null,
          format: (idea.format || "reels").toLowerCase(),
          scheduled_date: toISODateBR(d),
          scheduled_time: slots[i % slots.length],
        };
      });
      const { error } = await sbFrom("posts").insert(rows as never);
      if (error) throw new Error(error.message || "insert_failed");
      const ids = ideas.map((i) => i.id);
      const { error: updErr } = await sbFrom("creative_ideas").update({ status: "usada", updated_at: new Date().toISOString() } as never).in("id", ids);
      if (updErr) throw new Error(updErr.message);
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["hubcria-ideas"] });
      qc.invalidateQueries({ queryKey: ["external-posts"] });
      qc.invalidateQueries({ queryKey: ["external-pending"] });
      toast.success(`${n} posts criados na aba Posts, monte e envie pra aprovação do cliente.`);
    },
    onError: (e) => {
      const m = e instanceof Error ? e.message : "";
      toast.error(m || "Não consegui gerar o cronograma.");
    },
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   IDEIAS MANUAIS + CONVERSÃO (cockpit do cliente)

   A Gabriela anota a ideia no meio do dia ("Na aba do cliente tem como colocar
   ideias?") e depois decide o destino: virar post no Cria Post ou entrar num
   cronograma. A ideia convertida NÃO some: vira "usada" e guarda o link do
   destino (converted_post_id / converted_cronograma_id), que é o histórico do
   que já virou conteúdo.
   ═══════════════════════════════════════════════════════════════════════════ */

// Captura rápida: a ideia digitada na mão entra na MESMA creative_ideas do HUB,
// com source 'manual'. Tabela nova pra isso seria dívida: o banco de ideias do
// cliente é um só.
export function useAddManualIdea() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { crm_client_id: string; title: string; rationale?: string | null; ref_url?: string | null }) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const title = input.title.trim();
      if (!title) throw new Error("Escreva a ideia primeiro.");
      const ref = input.ref_url?.trim() || null;
      if (ref && !/^https?:\/\//i.test(ref)) throw new Error("O link de referência precisa ser completo (https://…).");
      const { error } = await sbFrom("creative_ideas").insert({
        manager_id: agencyOwnerId,
        crm_client_id: input.crm_client_id,
        source: "manual",
        title: title.slice(0, 500),
        rationale: input.rationale?.trim() || null,
        ref_url: ref,
      } as never);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["hubcria-ideas", vars.crm_client_id] });
      qc.invalidateQueries({ queryKey: ["hubcria-ideas-all"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não consegui salvar a ideia."),
  });
}

// "Virar post": cria o post no kanban do cliente pelo MESMO caminho do "Novo
// post" da Produção (nasce Em produção, não vai pro cliente antes da hora) e
// marca a ideia como usada apontando pro post.
export function useIdeaToPost() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { idea: CreativeIdea; externalClientId: string }): Promise<string> => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const { data, error } = await sbFrom("posts").insert({
        user_id: agencyOwnerId,
        external_client_id: input.externalClientId,
        status: "editando",
        approval_status: "em_producao",
        approval_mode: "fast",
        platform: "instagram",
        format: (input.idea.format || "reels").toLowerCase(),
        title: input.idea.title.slice(0, 200),
        caption: input.idea.rationale ?? null,
        reference_url: input.idea.ref_url ?? null,
      } as never).select("id").single();
      if (error) throw new Error(error.message);
      const postId = (data as { id: string }).id;
      const { error: upErr } = await sbFrom("creative_ideas")
        .update({ status: "usada", converted_post_id: postId, updated_at: new Date().toISOString() } as never)
        .eq("id", input.idea.id);
      if (upErr) throw new Error(upErr.message);
      return postId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hubcria-ideas"] });
      qc.invalidateQueries({ queryKey: ["hubcria-ideas-all"] });
      // O post novo aparece em todas as telas que listam posts do portal.
      qc.invalidateQueries({ queryKey: ["cria-posts"] });
      qc.invalidateQueries({ queryKey: ["external-posts-all"] });
      qc.invalidateQueries({ queryKey: ["external-pending"] });
      qc.invalidateQueries({ queryKey: ["operation-posts"] });
      qc.invalidateQueries({ queryKey: ["manager-calendar"] });
      toast.success("Post criado em Produção. Monte a arte e a legenda por lá.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não consegui criar o post."),
  });
}

// "Mandar pro cronograma": entra como item no fim do cronograma escolhido e
// marca a ideia como usada apontando pro cronograma.
export function useIdeaToCronograma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { idea: CreativeIdea; cronogramaId: string }) => {
      // sort_order no fim da lista atual (só o count, sem baixar os itens).
      const { count, error: cntErr } = await sbFrom("cronograma_items")
        .select("id", { count: "exact", head: true })
        .eq("cronograma_id", input.cronogramaId);
      if (cntErr) throw new Error(cntErr.message);
      const { error } = await sbFrom("cronograma_items").insert({
        cronograma_id: input.cronogramaId,
        sort_order: count ?? 0,
        title: input.idea.title.slice(0, 200),
        description: input.idea.rationale ?? null,
        ref_url: input.idea.ref_url ?? null,
      } as never);
      if (error) throw new Error(error.message);
      const { error: upErr } = await sbFrom("creative_ideas")
        .update({ status: "usada", converted_cronograma_id: input.cronogramaId, updated_at: new Date().toISOString() } as never)
        .eq("id", input.idea.id);
      if (upErr) throw new Error(upErr.message);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["hubcria-ideas"] });
      qc.invalidateQueries({ queryKey: ["hubcria-ideas-all"] });
      qc.invalidateQueries({ queryKey: ["cronograma-items", vars.cronogramaId] });
      toast.success("Ideia enviada pro cronograma.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não consegui mandar pro cronograma."),
  });
}

export function useUpdateIdeaStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CreativeIdea["status"] }) => {
      const { error } = await sbFrom("creative_ideas")
        .update({ status, updated_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hubcria-ideas"] }),
    onError: () => toast.error("Não consegui atualizar."),
  });
}

export function useDeleteIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("creative_ideas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hubcria-ideas"] }),
    onError: () => toast.error("Não consegui excluir."),
  });
}

// Exclui uma análise (scrape) do concorrente.
export function useDeleteScrape() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("competitor_scrapes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hubcria-scrapes"] }); toast.success("Análise excluída."); },
    onError: () => toast.error("Não consegui excluir a análise."),
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   MOVER, DUPLICAR E APROVEITAR UMA PESQUISA

   A leitura custa crédito e demora. Ela não pode ficar presa no cliente onde
   foi feita. Três situações reais da Gabriela:

   1. Ela pesquisou avulso ("só pra dar uma espiada") e o perfil virou cliente:
      a pesquisa tem que ir junto.
   2. Dois clientes disputam o MESMO concorrente. A leitura serve pros dois, e
      pagar duas vezes pelo mesmo dado é jogar dinheiro fora.
   3. Ela achou um reel bom no meio da leitura e quer transformar AQUELE post
      em ideia do cliente, sem esperar a IA sugerir.

   Nada disso precisou de tabela nova nem de SQL: as políticas de time já
   permitem update e insert nas duas tabelas. O que faltava era a ação.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Move a pesquisa (e as pautas que ela gerou) pra outro cliente. */
export function useMoveScrape() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; para: string | null }) => {
      const { error } = await sbFrom("competitor_scrapes")
        .update({ crm_client_id: input.para } as never)
        .eq("id", input.id);
      if (error) throw error;
      // As pautas seguem a pesquisa. Se ficassem no cliente antigo, apareceriam
      // órfãs numa ficha e sumiriam da outra: pior que não mover.
      const { error: iErr } = await sbFrom("creative_ideas")
        .update({ crm_client_id: input.para, updated_at: new Date().toISOString() } as never)
        .eq("scrape_id", input.id);
      if (iErr) throw iErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hubcria-scrapes"] });
      qc.invalidateQueries({ queryKey: ["hubcria-scrapes-all"] });
      qc.invalidateQueries({ queryKey: ["hubcria-ideas"] });
      qc.invalidateQueries({ queryKey: ["hubcria-ideas-all"] });
      toast.success("Pesquisa movida.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não consegui mover a pesquisa."),
  });
}

/**
 * Copia a pesquisa pra outro cliente SEM gastar crédito de novo: o resultado
 * já está no banco, é o mesmo dado. As pautas vão junto, zeradas em "novo",
 * porque o que o outro cliente vai aproveitar é decisão dele.
 */
export function useCopyScrapeToClient() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { scrape: CompetitorScrape; para: string | null; ideas?: CreativeIdea[] }) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const { data, error } = await sbFrom("competitor_scrapes").insert({
        manager_id: agencyOwnerId,
        crm_client_id: input.para,
        // O concorrente é um ativo DO cliente de origem: não faz sentido apontar
        // pro radar do outro. A cópia guarda só a leitura.
        competitor_id: null,
        scrape_type: input.scrape.scrape_type,
        input_handle: input.scrape.input_handle,
        status: "done",
        result_summary: input.scrape.result_summary,
        // Custo zero: essa cópia não passou pelo Apify.
        cost_usd: 0,
        finished_at: new Date().toISOString(),
      } as never).select("id").single();
      if (error) throw error;
      const novoId = (data as { id: string }).id;

      const pautas = input.ideas ?? [];
      if (pautas.length > 0) {
        const { error: iErr } = await sbFrom("creative_ideas").insert(
          pautas.map((i) => ({
            manager_id: agencyOwnerId,
            crm_client_id: input.para,
            scrape_id: novoId,
            source: i.source,
            title: i.title,
            format: i.format,
            rationale: i.rationale,
            ref_url: i.ref_url,
            status: "novo",
          })) as never,
        );
        if (iErr) throw iErr;
      }
      return novoId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hubcria-scrapes"] });
      qc.invalidateQueries({ queryKey: ["hubcria-scrapes-all"] });
      qc.invalidateQueries({ queryKey: ["hubcria-ideas"] });
      qc.invalidateQueries({ queryKey: ["hubcria-ideas-all"] });
      toast.success("Pesquisa copiada pro outro cliente. Não gastou crédito.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não consegui copiar a pesquisa."),
  });
}

/**
 * "Peguei essa referência, quero fazer parecido": um post/anúncio/comentário da
 * leitura vira ideia no banco do cliente, com o link salvo. Sem isso a pessoa
 * copiava o link na mão e colava numa nota fora do CRIA.
 */
export function useIdeaFromReference() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      crm_client_id: string | null;
      scrape_id?: string | null;
      title: string;
      rationale?: string | null;
      ref_url?: string | null;
      format?: string | null;
    }) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const title = input.title.trim();
      if (!title) throw new Error("Essa referência não tem texto pra virar ideia.");
      const ref = input.ref_url?.trim() || null;
      const { error } = await sbFrom("creative_ideas").insert({
        manager_id: agencyOwnerId,
        crm_client_id: input.crm_client_id,
        scrape_id: input.scrape_id ?? null,
        source: "referencia",
        title: title.slice(0, 500),
        rationale: input.rationale?.slice(0, 1000) || null,
        ref_url: ref && /^https?:\/\//i.test(ref) ? ref : null,
        format: input.format || null,
        status: "usar",
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hubcria-ideas"] });
      qc.invalidateQueries({ queryKey: ["hubcria-ideas-all"] });
      toast.success("Referência salva como pauta, já marcada como \u201cusar\u201d.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não consegui salvar a referência."),
  });
}
