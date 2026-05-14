import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type Persona = Database["public"]["Tables"]["personas"]["Row"] & {
  how_you_help?: string | null;
  icon?: string | null;
};
type PersonaInsert = Database["public"]["Tables"]["personas"]["Insert"] & {
  how_you_help?: string | null;
  icon?: string | null;
};
type PersonaUpdate = Database["public"]["Tables"]["personas"]["Update"] & {
  how_you_help?: string | null;
  icon?: string | null;
};

export type SavePersonaInput = Omit<PersonaInsert, "user_id" | "id" | "created_at"> & {
  id?: string | null;
};

export const MAX_PERSONAS = 3;

export function usePersonas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const queryKey = ["personas", userId] as const;

  const {
    data: personas = [],
    isLoading,
    error,
  } = useQuery<Persona[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personas")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Persona[];
    },
    enabled: !!userId,
  });

  const savePersona = useMutation({
    mutationFn: async (input: SavePersonaInput): Promise<Persona> => {
      if (!userId) throw new Error("Not authenticated");
      const { id, ...payload } = input;
      if (id) {
        const updates: PersonaUpdate = { ...payload };
        const { data, error } = await supabase
          .from("personas")
          .update(updates)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as Persona;
      }
      const { data, error } = await supabase
        .from("personas")
        .insert({ ...payload, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as Persona;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deletePersona = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("personas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { personas, isLoading, error, savePersona, deletePersona };
}
