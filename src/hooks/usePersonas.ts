import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";

export interface Persona {
  id: string;
  user_id: string;
  name: string;
  age_range?: string | null;
  gender?: string | null;
  location?: string | null;
  interests?: string[] | null;
  pain_points?: string[] | null;
  desires?: string[] | null;
  platforms?: string[] | null;
  notes?: string | null;
  how_you_help?: string | null;
  icon?: string | null;
  created_at?: string | null;
}

export type SavePersonaInput = Omit<Persona, "id" | "user_id" | "created_at"> & {
  id?: string | null;
};

export const MAX_PERSONAS = 3;

export function usePersonas() {
  const { activeAccountId } = useActiveAccount();
  const queryClient = useQueryClient();
  const userId = activeAccountId;
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
      return (data ?? []) as unknown as Persona[];
    },
    enabled: !!userId,
  });

  const savePersona = useMutation({
    mutationFn: async (input: SavePersonaInput): Promise<Persona> => {
      if (!userId) throw new Error("Not authenticated");
      const { id, ...payload } = input;
      if (id) {
        const { data, error } = await supabase
          .from("personas")
          .update(payload as any)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as Persona;
      }
      const { data, error } = await supabase
        .from("personas")
        .insert({ ...payload, user_id: userId } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Persona;
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
