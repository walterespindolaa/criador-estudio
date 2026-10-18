import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";

export function useAiUsage() {
  const { user } = useAuth();
  const { activeAccountId } = useActiveAccount();
  // Cota da CONTA ABERTA: é ela que o servidor cobra (ai-context-builder).
  const conta = activeAccountId ?? user?.id ?? null;

  const query = useQuery({
    queryKey: ["ai-usage", conta],
    enabled: !!user && !!conta,
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>)("ai_usage_da_conta", { _owner: conta });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as { used?: number; quota?: number } | null;
      return {
        used: Number(row?.used ?? 0),
        quota: Number(row?.quota ?? 0),
      };
    },
  });

  const used = query.data?.used ?? 0;
  const quota = query.data?.quota ?? 0;
  const remaining = Math.max(0, quota - used);
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;

  return { used, quota, remaining, pct, isLoading: query.isLoading };
}
