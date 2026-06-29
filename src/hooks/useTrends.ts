import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type TrendKind = "formato" | "tema" | "gancho" | "data";

export type Trend = {
  id: string;
  kind: TrendKind;
  title: string;
  description: string | null;
  niche: string | null;
  created_at: string;
};

export function useTrends() {
  return useQuery<Trend[]>({
    queryKey: ["content-trends"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await sbFrom("content_trends")
        .select("id,kind,title,description,niche,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Trend[];
    },
  });
}

// Resumo curto das tendências p/ alimentar o Cria Plano.
export function trendsToContext(trends: Trend[], max = 10): string {
  return trends.slice(0, max).map((t) => `[${t.kind}] ${t.title}`).join("; ");
}

export function useRefreshTrends() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ count: number }> => {
      return callAIContextBuilder({ userId: user?.id, operation: "trend-bank-refresh", data: {} });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["content-trends"] });
      toast.success(`Banco atualizado — ${res?.count ?? 0} tendências.`);
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      console.error("trend refresh failed:", e);
      toast.error(msg && !/non-2xx/i.test(msg) ? `Tendências: ${msg}` : "Não consegui atualizar agora. Confirme se o ai-context-builder foi redeployado.");
    },
  });
}
