import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

/* Tabela nova (prompter_scripts) fora do types.ts gerado — o types.ts é
   travado, então o acesso segue o mesmo padrão do useStoryPlan: sbFrom + cast. */
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type PrompterScript = {
  id: string;
  user_id: string;
  title: string;
  script: string;
  source: "manual" | "criando" | "stories" | "ia";
  source_id: string | null;
  created_at: string;
  updated_at: string;
};

export function usePrompterScripts() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  return useQuery<PrompterScript[]>({
    queryKey: ["prompter-scripts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await sbFrom("prompter_scripts")
        .select("*")
        .eq("user_id", userId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PrompterScript[];
    },
  });
}

export function usePrompterScript(id: string | undefined) {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  return useQuery<PrompterScript | null>({
    queryKey: ["prompter-script", id],
    enabled: !!userId && !!id,
    queryFn: async () => {
      const { data, error } = await sbFrom("prompter_scripts")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as PrompterScript | null;
    },
  });
}

export function useSavePrompterScript() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; title: string; script: string; source?: PrompterScript["source"]; source_id?: string | null }) => {
      if (!userId) throw new Error("Not authenticated");
      if (input.id) {
        const { error } = await sbFrom("prompter_scripts")
          .update({ title: input.title, script: input.script, updated_at: new Date().toISOString() } as never)
          .eq("id", input.id)
          .eq("user_id", userId);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await sbFrom("prompter_scripts")
        .insert({
          user_id: userId,
          title: input.title,
          script: input.script,
          source: input.source ?? "manual",
          source_id: input.source_id ?? null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      return (data as unknown as { id: string }).id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prompter-scripts"] });
      qc.invalidateQueries({ queryKey: ["prompter-script"] });
    },
    onError: (e: Error) => toast.error("Não consegui salvar o roteiro: " + e.message),
  });
}

export function useDeletePrompterScript() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await sbFrom("prompter_scripts").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompter-scripts"] }),
    onError: (e: Error) => toast.error("Não consegui excluir: " + e.message),
  });
}
