import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"] & {
  role?: string | null;
};
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"] & {
  role?: string | null;
};

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const queryKey = ["profile", userId] as const;

  const {
    data: profile = null,
    isLoading,
    error,
    refetch,
  } = useQuery<Profile | null>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .single();
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!userId,
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: ProfileUpdate): Promise<ProfileUpdate> => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update(updates as never)
        .eq("id", userId);
      if (error) throw error;
      return updates;
    },
    onSuccess: (updates) => {
      queryClient.setQueryData<Profile | null>(queryKey, (prev) =>
        prev ? { ...prev, ...updates } : prev
      );
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return { profile, isLoading, error, updateProfile, refetch };
}
