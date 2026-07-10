import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type StoryTrend = {
  id: string;
  format: string;
  title: string;
  description: string | null;
  example: string | null;
  why_trending: string | null;
  created_at: string;
};

// Banco compartilhado de tendências de stories (só leitura pro usuário).
export function useStoryTrends() {
  return useQuery<StoryTrend[]>({
    queryKey: ["story-trends"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await sbFrom("story_trends")
        .select("id,format,title,description,example,why_trending,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as StoryTrend[];
    },
  });
}

// Resumo curto pra alimentar a geração do plano.
export function storyTrendsToContext(trends: StoryTrend[], max = 10): string {
  return trends
    .slice(0, max)
    .map((t) => `[${t.format}] ${t.title}${t.description ? `, ${t.description}` : ""}`)
    .join("; ");
}

// Admin: reprocessa o banco via Perplexity.
export function useRefreshStoryTrends() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ count: number }> => {
      return callAIContextBuilder({ userId: user?.id, operation: "story-trend-refresh", data: {} });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["story-trends"] });
      toast.success(`Banco de stories atualizado, ${res?.count ?? 0} tendências.`);
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      console.error("story trend refresh failed:", e);
      toast.error(msg && !/non-2xx/i.test(msg) ? `Stories: ${msg}` : "Não consegui atualizar agora. Confirme se o ai-context-builder foi redeployado.");
    },
  });
}
