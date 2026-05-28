import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useAiUsage() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["ai-usage"],
    enabled: !!user,
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ai_usage_this_month");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
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
