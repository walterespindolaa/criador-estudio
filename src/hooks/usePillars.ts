import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import type { Database } from "@/integrations/supabase/types";

/* `descricao` entrou na migration 20260916000003 e o types.ts gerado ainda não
   a conhece (o arquivo é regenerado pelo Lovable, não por nós). O campo é
   opcional aqui de propósito: antes da migration rodar ele chega undefined e a
   tela só não mostra descrição nenhuma, em vez de quebrar. */
export type Pillar = Database["public"]["Tables"]["pillars"]["Row"] & {
  descricao?: string | null;
};
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

  /* Atualiza NOME e/ou DESCRIÇÃO. Só manda o que veio: sem isso, salvar a
     descrição apagaria o nome, e vice-versa. */
  const updatePillar = useMutation({
    mutationFn: async ({ id, name, descricao }: { id: string; name?: string; descricao?: string }): Promise<Pillar> => {
      const patch: Record<string, unknown> = {};
      if (name !== undefined) patch.name = name;
      if (descricao !== undefined) patch.descricao = descricao.trim() || null;
      const { data, error } = await supabase
        .from("pillars")
        .update(patch as never)
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
