import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";

/* ═══════════════════════════════════════════════════════════════════════════
   LINHAS EDITORIAIS (por cliente do Cria Post)

   A linha editorial deixa de ser texto na estratégia e vira entidade: a
   social mídia cadastra (Autoridade, Bastidores, Venda...), etiqueta cada
   post e o cliente vê a linha no link do cronograma. Cadastro mora na
   estratégia do cliente (Brandbook > Estratégia); o uso mora no editor de
   post e no cronograma.
   ═══════════════════════════════════════════════════════════════════════════ */

// Tabela nova, ainda fora dos tipos gerados; mesmo padrão dos outros hooks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (t: string) => (supabase as any).from(t);

export type EditorialLine = {
  id: string;
  manager_id: string;
  external_client_id: string;
  name: string;
  color: string;
  descricao: string | null;
  sort_order: number;
};

/** Migration ainda não rodou: lista vazia em vez de tela quebrada. */
const faltaMigration = (e: { code?: string; message?: string } | null) =>
  !!e && /42P01|42703|PGRST204|PGRST205/.test(e.code ?? "") || /does not exist|schema cache/i.test(e?.message ?? "");

export const CORES_LINHA = ["#EA4918", "#0061EE", "#01A652", "#E0195A", "#7C3AED", "#B45309"] as const;

export function useEditorialLines(externalClientId: string | null) {
  return useQuery<EditorialLine[]>({
    queryKey: ["editorial-lines", externalClientId],
    enabled: !!externalClientId,
    queryFn: async () => {
      const { data, error } = await sbFrom("editorial_lines")
        .select("id, manager_id, external_client_id, name, color, descricao, sort_order")
        .eq("external_client_id", externalClientId!)
        .order("sort_order").order("created_at");
      if (error) {
        if (faltaMigration(error)) return [];
        throw error;
      }
      return (data ?? []) as EditorialLine[];
    },
  });
}

/** Pela FICHA do CRM (o editor de estratégia conhece o crm_client_id, não o
 *  external): resolve o cliente do Cria Post vinculado e devolve as linhas
 *  dele. Sem vínculo, devolve externalId null e a UI explica o porquê. */
export function useEditorialLinesByCrm(crmClientId: string | null) {
  const { agencyOwnerId } = useActiveAccount();
  const externalQ = useQuery<string | null>({
    queryKey: ["editorial-lines-external", crmClientId, agencyOwnerId],
    enabled: !!crmClientId && !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("external_clients")
        .select("id").eq("crm_client_id", crmClientId!).eq("manager_id", agencyOwnerId!)
        .limit(1).maybeSingle();
      if (error) return null;
      return (data as { id: string } | null)?.id ?? null;
    },
  });
  const externalId = externalQ.data ?? null;
  const linesQ = useEditorialLines(externalId);
  return { externalId, resolvendo: externalQ.isLoading, lines: linesQ.data ?? [], carregando: linesQ.isLoading };
}

export function useEditorialLineActions(externalClientId: string | null) {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  const invalidar = () => void qc.invalidateQueries({ queryKey: ["editorial-lines", externalClientId] });

  const criar = useMutation({
    mutationFn: async (v: { name: string; color: string; ordem: number }) => {
      const { error } = await sbFrom("editorial_lines").insert({
        manager_id: agencyOwnerId, external_client_id: externalClientId,
        name: v.name.trim(), color: v.color, sort_order: v.ordem,
      } as never);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message || "Não consegui criar a linha."),
  });

  const atualizar = useMutation({
    mutationFn: async (v: { id: string; name?: string; color?: string }) => {
      const patch: Record<string, string> = {};
      if (v.name !== undefined) patch.name = v.name.trim();
      if (v.color !== undefined) patch.color = v.color;
      const { error } = await sbFrom("editorial_lines").update(patch as never).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message || "Não consegui salvar a linha."),
  });

  const excluir = useMutation({
    // on delete set null: os posts que usavam a linha ficam sem etiqueta, não somem.
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("editorial_lines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message || "Não consegui excluir a linha."),
  });

  return { criar, atualizar, excluir };
}
