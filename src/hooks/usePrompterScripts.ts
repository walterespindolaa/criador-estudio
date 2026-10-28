import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

/* Tabela nova (prompter_scripts) fora do types.ts gerado o types.ts é
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
  folder: string | null;
  /* fila "Pra gravar" (25/10/2026): roteiro novo nasce na fila; "Já gravei"
     marca gravado_em e ele vai pra "Já gravados". */
  na_fila?: boolean;
  gravado_em?: string | null;
  created_at: string;
  updated_at: string;
};

export function usePrompterScripts() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  return useQuery<PrompterScript[]>({
    queryKey: ["prompter-scripts", userId],
    enabled: !!userId,
    /* O global usa refetchOnMount:false (anti-pisca), mas roteiro é criado no
       CELULAR e gravado no PC (ou vice-versa): sem revalidar ao entrar na tela,
       o outro aparelho nunca vê o roteiro novo. "always" mostra o cache na hora
       e busca por trás sem esqueleto, sem dado velho. */
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
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
    refetchOnMount: "always",
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
    mutationFn: async (input: { id?: string; title: string; script: string; folder?: string | null; source?: PrompterScript["source"]; source_id?: string | null }) => {
      if (!userId) throw new Error("Not authenticated");
      if (input.id) {
        const { error } = await sbFrom("prompter_scripts")
          .update({ title: input.title, script: input.script, folder: input.folder ?? null, updated_at: new Date().toISOString() } as never)
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
          folder: input.folder ?? null,
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

/* ── Pastas ──────────────────────────────────────────────────────────────────
   Pasta é um rótulo (coluna text), não uma tabela: os chips derivam dos
   roteiros existentes. Renomear/excluir = update em massa no rótulo.
   Pasta vazia não existe mesmo comportamento do protótipo, sem schema extra. */

export function useRenamePrompterFolder() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { from: string; to: string }) => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await sbFrom("prompter_scripts")
        .update({ folder: input.to } as never)
        .eq("user_id", userId)
        .eq("folder", input.from);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompter-scripts"] }),
    onError: (e: Error) => toast.error("Não consegui renomear a pasta: " + e.message),
  });
}

export function useDeletePrompterFolder() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (folder: string) => {
      if (!userId) throw new Error("Not authenticated");
      /* roteiros não somem: voltam pra "Todos" (folder null), igual no protótipo */
      const { error } = await sbFrom("prompter_scripts")
        .update({ folder: null } as never)
        .eq("user_id", userId)
        .eq("folder", folder);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompter-scripts"] }),
    onError: (e: Error) => toast.error("Não consegui excluir a pasta: " + e.message),
  });
}

/* ── Post (Criando) → Prompter ───────────────────────────────────────────────
   Um post na fase Produzindo vira roteiro com 1 toque. Se já foi enviado
   antes (source_id igual), ATUALIZA o texto em vez de duplicar assim o
   roteiro chega sempre na versão mais recente do post. */

export function useSendPostToPrompter() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; title: string; script: string; source?: "criando" | "stories" }) => {
      if (!userId) throw new Error("Not authenticated");
      /* Story do Cria Stories entra como "stories": o player abre no modo
         story (só a fala rola, câmera ligada). Antes tudo entrava "criando". */
      const source = input.source ?? "criando";
      const { data: achados, error: findErr } = await sbFrom("prompter_scripts")
        .select("id")
        .eq("user_id", userId)
        .in("source", ["criando", "stories"])
        .eq("source_id", input.postId)
        .limit(1);
      if (findErr) throw findErr;
      const existing = (achados as unknown as Array<{ id: string }> | null)?.[0];
      if (existing) {
        const id = existing.id;
        const { error } = await sbFrom("prompter_scripts")
          .update({ title: input.title, script: input.script, source, updated_at: new Date().toISOString() } as never)
          .eq("id", id)
          .eq("user_id", userId);
        if (error) throw error;
        return id;
      }
      const { data, error } = await sbFrom("prompter_scripts")
        .insert({ user_id: userId, title: input.title, script: input.script, source, source_id: input.postId } as never)
        .select("id")
        .single();
      if (error) throw error;
      return (data as unknown as { id: string }).id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompter-scripts"] }),
    onError: (e: Error) => toast.error("Não consegui enviar o post pro prompter: " + e.message),
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

/* Fila do Prompter: mandar pra gravar, marcar como gravado, desfazer. */
export function useFilaPrompterScript() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; na_fila: boolean; gravado_em: string | null }) => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await sbFrom("prompter_scripts")
        .update({ na_fila: input.na_fila, gravado_em: input.gravado_em } as never)
        .eq("id", input.id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompter-scripts"] }),
    onError: (e: Error) => toast.error("Não consegui atualizar o roteiro: " + e.message),
  });
}
