import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import type { Database } from "@/integrations/supabase/types";

export type Pillar = Database["public"]["Tables"]["pillars"]["Row"];
type PillarInsert = Database["public"]["Tables"]["pillars"]["Insert"];

export type CreatePillarInput = Pick<PillarInsert, "name" | "color"> & {
  position?: number;
};

export function usePillars() {
  const { activeAccountId } = useActiveAccount();
  const queryClient = useQueryClient();
  const userId = activeAccountId;
  const queryKey = ["pillars", userId] as const;

  const {
    data: pillars = [],
    isLoading,
    error,
  } = useQuery<Pillar[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pillars")
        .select("*")
        .eq("user_id", userId!)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Pillar[];
    },
    enabled: !!userId,
  });

  const createPillar = useMutation({
    mutationFn: async (input: CreatePillarInput): Promise<Pillar> => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("pillars")
        .insert({
          name: input.name,
          color: input.color,
          position: input.position ?? pillars.length,
          user_id: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Pillar;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updatePillar = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }): Promise<Pillar> => {
      const { data, error } = await supabase
        .from("pillars")
        .update({ name })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Pillar;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deletePillar = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("pillars").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { pillars, isLoading, error, createPillar, updatePillar, deletePillar };
}
