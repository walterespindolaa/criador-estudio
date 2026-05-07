import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type Reflection = Database["public"]["Tables"]["monthly_reflections"]["Row"];
type ReflectionInsert = Database["public"]["Tables"]["monthly_reflections"]["Insert"];
type ReflectionUpdate = Database["public"]["Tables"]["monthly_reflections"]["Update"];

export type SaveReflectionInput = Omit<
  ReflectionInsert,
  "user_id" | "id" | "month" | "created_at" | "updated_at"
>;

export function useReflections(month: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const queryKey = ["reflection", userId, month] as const;

  const {
    data: reflection = null,
    isLoading,
    error,
  } = useQuery<Reflection | null>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_reflections")
        .select("*")
        .eq("user_id", userId!)
        .eq("month", month)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Reflection | null;
    },
    enabled: !!userId && !!month,
  });

  const saveReflection = useMutation({
    mutationFn: async (input: SaveReflectionInput): Promise<Reflection> => {
      if (!userId) throw new Error("Not authenticated");
      if (reflection) {
        const updates: ReflectionUpdate = { ...input, updated_at: new Date().toISOString() };
        const { data, error } = await supabase
          .from("monthly_reflections")
          .update(updates)
          .eq("id", reflection.id)
          .select()
          .single();
        if (error) throw error;
        return data as Reflection;
      }
      const { data, error } = await supabase
        .from("monthly_reflections")
        .insert({ ...input, user_id: userId, month })
        .select()
        .single();
      if (error) throw error;
      return data as Reflection;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { reflection, isLoading, error, saveReflection };
}
