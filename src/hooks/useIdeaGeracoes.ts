import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Tabela nova (fora dos tipos gerados, que são travados): cast padrão.
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type StatusGeracao = "nova" | "virou_post" | "guardada" | "descartada";
export type GeracaoDaFolha = {
  id: string;
  idea_id: string;
  formato: string;
  sugestao: Record<string, unknown>;
  base_texto: string | null;
  status: StatusGeracao;
  post_id: string | null;
  created_at: string;
};

/** O que a Cria IA já tirou de uma folha (ideia), mais recente primeiro. */
export function useIdeaGeracoes(ideaId: string | null) {
  const qc = useQueryClient();
  const chave = ["idea-geracoes", ideaId];
  const q = useQuery<GeracaoDaFolha[]>({
    queryKey: chave,
    enabled: !!ideaId,
    queryFn: async () => {
      const { data, error } = await sbFrom("idea_geracoes")
        .select("id,idea_id,formato,sugestao,base_texto,status,post_id,created_at")
        .eq("idea_id", ideaId)
        .order("created_at", { ascending: false })
        .limit(60);
      // Tabela ainda não criada (SQL não rodou): a folha funciona sem histórico.
      if (error) return [];
      return (data as unknown as GeracaoDaFolha[]) ?? [];
    },
  });

  const guardar = useMutation({
    mutationFn: async (linhas: { user_id: string; formato: string; sugestao: Record<string, unknown>; base_texto: string }[]) => {
      if (!ideaId || linhas.length === 0) return [];
      const { data, error } = await sbFrom("idea_geracoes")
        .insert(linhas.map((l) => ({ ...l, idea_id: ideaId })) as never)
        .select("id,idea_id,formato,sugestao,base_texto,status,post_id,created_at");
      if (error) throw new Error(error.message);
      return (data as unknown as GeracaoDaFolha[]) ?? [];
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: chave }); qc.invalidateQueries({ queryKey: ["idea-geracoes-contagem"] }); },
  });

  const marcar = useMutation({
    mutationFn: async ({ id, status, post_id }: { id: string; status: StatusGeracao; post_id?: string | null }) => {
      const { error } = await sbFrom("idea_geracoes").update({ status, ...(post_id ? { post_id } : {}) } as never).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: chave }); qc.invalidateQueries({ queryKey: ["idea-geracoes-contagem"] }); },
  });

  return { geracoes: q.data ?? [], carregando: q.isLoading, guardar, marcar };
}

/** Quantas ideias a Cria IA já tirou de cada folha (pro cartão da lista). */
export function useContagemGeracoes(ideaIds: string[]) {
  return useQuery<Record<string, number>>({
    queryKey: ["idea-geracoes-contagem", ideaIds.join(",")],
    enabled: ideaIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sbFrom("idea_geracoes")
        .select("idea_id")
        .in("idea_id", ideaIds)
        .neq("status", "descartada");
      if (error) return {};
      const m: Record<string, number> = {};
      for (const r of (data as unknown as { idea_id: string }[]) ?? []) m[r.idea_id] = (m[r.idea_id] ?? 0) + 1;
      return m;
    },
  });
}
