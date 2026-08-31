import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";

/* ═══════════════════════════════════════════════════════════════════════════
   PASTAS DE IDEIAS (31/08)

   Pedido do Walter: organizar as ideias em pastas, igual aos salvos do
   Instagram. A pasta é só organização: excluir a pasta devolve as ideias
   pra "Todas" (folder_id vira null no banco, on delete set null).
   ═══════════════════════════════════════════════════════════════════════════ */

// Tabela/coluna novas, ainda fora dos tipos gerados; mesmo padrão dos outros hooks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (t: string) => (supabase as any).from(t);

export type IdeaFolder = {
  id: string;
  user_id: string;
  name: string;
  color: string;
};

/** Migration ainda não rodou: lista vazia em vez de tela quebrada. */
const faltaMigration = (e: { code?: string; message?: string } | null) =>
  !!e && /42P01|42703|PGRST204|PGRST205/.test(e.code ?? "") || /does not exist|schema cache/i.test(e?.message ?? "");

export const CORES_PASTA = ["#EA4918", "#0061EE", "#01A652", "#E0195A", "#7C3AED", "#B45309"] as const;

export function useIdeaFolders() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  const qc = useQueryClient();
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ["idea-folders", userId] });
    // As ideias carregam folder_id junto: mover/excluir pasta muda a listagem.
    void qc.invalidateQueries({ queryKey: ["ideas", userId] });
  };

  const foldersQ = useQuery<IdeaFolder[]>({
    queryKey: ["idea-folders", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await sbFrom("idea_folders")
        .select("id, user_id, name, color")
        .eq("user_id", userId!)
        .order("created_at");
      if (error) {
        if (faltaMigration(error)) return [];
        throw error;
      }
      return (data ?? []) as IdeaFolder[];
    },
  });

  const criar = useMutation({
    mutationFn: async (v: { name: string; color: string }): Promise<IdeaFolder> => {
      const { data, error } = await sbFrom("idea_folders")
        .insert({ user_id: userId, name: v.name.trim(), color: v.color } as never)
        .select("id, user_id, name, color")
        .single();
      if (error) throw error;
      return data as IdeaFolder;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message || "Não consegui criar a pasta."),
  });

  const renomear = useMutation({
    mutationFn: async (v: { id: string; name?: string; color?: string }) => {
      const patch: Record<string, string> = {};
      if (v.name !== undefined) patch.name = v.name.trim();
      if (v.color !== undefined) patch.color = v.color;
      const { error } = await sbFrom("idea_folders").update(patch as never).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message || "Não consegui salvar a pasta."),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("idea_folders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message || "Não consegui excluir a pasta."),
  });

  /* Fora do updateIdea de propósito: folder_id ainda não existe nos tipos
     gerados do Supabase, então mover pela rota tipada não compila. */
  const moverIdeia = useMutation({
    mutationFn: async (v: { ideaId: string; folderId: string | null }) => {
      const { error } = await sbFrom("ideas").update({ folder_id: v.folderId } as never).eq("id", v.ideaId);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ideas", userId] }),
    onError: (e: Error) => toast.error(e.message || "Não consegui mover a ideia."),
  });

  return { folders: foldersQ.data ?? [], carregando: foldersQ.isLoading, criar, renomear, excluir, moverIdeia };
}

/** folder_id de uma ideia sem depender dos tipos gerados. */
export function folderIdDaIdeia(idea: unknown): string | null {
  return (idea as { folder_id?: string | null }).folder_id ?? null;
}
