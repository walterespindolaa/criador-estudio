import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { bestTimes } from "@/lib/bestTimes";
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

export type ScrapeType = "posts" | "reels" | "profile" | "hashtag" | "comments" | "transcription" | "stories" | "mentions" | "ads";

export type CompetitorScrape = {
  id: string;
  crm_client_id: string | null;
  scrape_type: ScrapeType;
  input_handle: string;
  status: "queued" | "running" | "done" | "error";
  result_summary: Record<string, unknown> | null;
  cost_usd: number | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
};

export type CreativeIdea = {
  id: string;
  crm_client_id: string | null;
  scrape_id: string | null;
  source: string;
  title: string;
  format: string | null;
  rationale: string | null;
  status: "novo" | "usar" | "usada" | "descartada";
  created_at: string;
};

// crmClientId undefined = análise avulsa (crm_client_id null).
export function useScrapes(crmClientId?: string) {
  return useQuery<CompetitorScrape[]>({
    queryKey: ["hubcria-scrapes", crmClientId ?? "avulsa"],
    queryFn: async () => {
      let q = sbFrom("competitor_scrapes")
        .select("id,crm_client_id,scrape_type,input_handle,status,result_summary,cost_usd,error,created_at,finished_at");
      q = crmClientId ? q.eq("crm_client_id", crmClientId) : q.is("crm_client_id", null);
      const { data, error } = await q.order("created_at", { ascending: false });
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
        .select("id,crm_client_id,scrape_id,source,title,format,rationale,status,created_at")
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
        .select("id,crm_client_id,scrape_id,source,title,format,rationale,status,created_at");
      q = crmClientId ? q.eq("crm_client_id", crmClientId) : q.is("crm_client_id", null);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CreativeIdea[];
    },
  });
}

export function useRunScrape() {
  const qc = useQueryClient();
  const { agencyOwnerId } = useActiveAccount();
  return useMutation({
    mutationFn: async (input: { type: ScrapeType; input: string; crm_client_id?: string | null; limit?: number; since?: string }) => {
      const { data, error } = await supabase.functions.invoke("apify-scrape", {
        body: { type: input.type, input: input.input, crm_client_id: input.crm_client_id ?? null, limit: input.limit ?? 10, since: input.since, manager_id: agencyOwnerId },
      });
      if (error) {
        // tenta extrair a mensagem real do corpo
        let detail = error.message;
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx?.text) { const raw = await ctx.clone().text(); const b = JSON.parse(raw); detail = b?.message || b?.error || detail; }
        } catch { /* ignore */ }
        throw new Error(detail || "scrape_failed");
      }
      const err = (data as { error?: string })?.error;
      if (err) throw new Error((data as { message?: string })?.message || err);
      return data as { scrape_id: string; ideas_count: number; cost_usd: number };
    },
    onSuccess: (res, vars) => {
      const key = vars.crm_client_id ?? "avulsa";
      qc.invalidateQueries({ queryKey: ["hubcria-scrapes", key] });
      qc.invalidateQueries({ queryKey: ["hubcria-ideas", key] });
      qc.invalidateQueries({ queryKey: ["hubcria-ideas-all"] });
      toast.success(`Análise pronta, ${res.ideas_count} ideias geradas.`);
    },
    onError: (e) => {
      const m = e instanceof Error ? e.message : "";
      toast.error(m ? `Falha: ${m}` : "Não consegui rodar a análise agora.");
    },
  });
}

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
          scheduled_date: d.toISOString().slice(0, 10),
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
