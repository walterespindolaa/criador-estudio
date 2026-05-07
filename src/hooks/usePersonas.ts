import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type Persona = Database["public"]["Tables"]["personas"]["Row"];
type PersonaInsert = Database["public"]["Tables"]["personas"]["Insert"];
type PersonaUpdate = Database["public"]["Tables"]["personas"]["Update"];

export type SavePersonaInput = Omit<PersonaInsert, "user_id" | "id" | "created_at">;

export function usePersonas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const queryKey = ["personas", userId] as const;

  const {
    data: persona = null,
    isLoading,
    error,
  } = useQuery<Persona | null>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personas")
        .select("*")
        .eq("user_id", userId!)
        .limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as Persona | null;
    },
    enabled: !!userId,
  });

  const savePersona = useMutation({
    mutationFn: async (input: SavePersonaInput): Promise<Persona> => {
      if (!userId) throw new Error("Not authenticated");
      if (persona) {
        const updates: PersonaUpdate = { ...input };
        const { data, error } = await supabase
          .from("personas")
          .update(updates)
          .eq("id", persona.id)
          .select()
          .single();
        if (error) throw error;
        return data as Persona;
      }
      const { data, error } = await supabase
        .from("personas")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as Persona;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { persona, isLoading, error, savePersona };
}
