import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

// Acesso ao HUB CRIA: admin OU módulo hub_cria liberado (module_entitlements).
export function useHasHubCria(): { allowed: boolean; isLoading: boolean } {
  const { user } = useAuth();
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";
  const q = useQuery<boolean>({
    queryKey: ["hubcria-entitlement", user?.id],
    enabled: !!user?.id && !isAdmin,
    queryFn: async () => {
      const { data, error } = await sbFrom("module_entitlements")
        .select("id")
        .eq("manager_id", user!.id)
        .eq("module_code", "hub_cria")
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  return { allowed: isAdmin || q.data === true, isLoading: !isAdmin && q.isLoading };
}

export type ScrapeType = "posts" | "reels" | "profile" | "hashtag" | "comments";

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

export function useScrapes(crmClientId?: string) {
  return useQuery<CompetitorScrape[]>({
    queryKey: ["hubcria-scrapes", crmClientId],
    enabled: !!crmClientId,
    queryFn: async () => {
      const { data, error } = await sbFrom("competitor_scrapes")
        .select("id,crm_client_id,scrape_type,input_handle,status,result_summary,cost_usd,error,created_at,finished_at")
        .eq("crm_client_id", crmClientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CompetitorScrape[];
    },
  });
}

// Todas as ideias do gestor (todos os clientes) — pro overview do HUB.
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
    queryKey: ["hubcria-ideas", crmClientId],
    enabled: !!crmClientId,
    queryFn: async () => {
      const { data, error } = await sbFrom("creative_ideas")
        .select("id,crm_client_id,scrape_id,source,title,format,rationale,status,created_at")
        .eq("crm_client_id", crmClientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CreativeIdea[];
    },
  });
}

export function useRunScrape() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { type: ScrapeType; input: string; crm_client_id: string; limit?: number }) => {
      const { data, error } = await supabase.functions.invoke("apify-scrape", {
        body: { type: input.type, input: input.input, crm_client_id: input.crm_client_id, limit: input.limit ?? 10 },
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
      qc.invalidateQueries({ queryKey: ["hubcria-scrapes", vars.crm_client_id] });
      qc.invalidateQueries({ queryKey: ["hubcria-ideas", vars.crm_client_id] });
      toast.success(`Análise pronta — ${res.ideas_count} ideias geradas.`);
    },
    onError: (e) => {
      const m = e instanceof Error ? e.message : "";
      toast.error(m ? `Falha: ${m}` : "Não consegui rodar a análise agora.");
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
