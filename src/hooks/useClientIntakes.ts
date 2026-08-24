import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (table: string) => (supabase as any).from(table);
type AnyRpc = (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

/* ═══════════════════════════════════════════════════════════════════════════
   O LINK DE CADASTRO DO CLIENTE

   A agência gera, o cliente preenche, a agência aplica na ficha. As respostas
   ficam numa tabela à parte até alguém confirmar: cliente digitando a razão
   social de um jeito diferente não pode sobrescrever calado o que já foi
   ajustado na mão.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ClientIntake = {
  id: string;
  manager_id: string;
  crm_client_id: string | null;
  token: string;
  status: "aberto" | "enviado" | "aplicado";
  answers: Record<string, string> | null;
  created_at: string;
  submitted_at: string | null;
  applied_at: string | null;
};

const tabelaFaltando = (msg: string) => /does not exist|schema cache|could not find/i.test(msg ?? "");

export function useClientIntakes(crmClientId?: string | null) {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery({
    queryKey: ["client-intakes", agencyOwnerId, crmClientId ?? ""],
    enabled: !!agencyOwnerId && !!crmClientId,
    // O cliente responde fora do app: servir cache aqui é mostrar "aguardando"
    // depois da resposta já ter chegado.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<ClientIntake[]> => {
      const { data, error } = await sbFrom("client_intakes")
        .select("*")
        .eq("manager_id", agencyOwnerId)
        .eq("crm_client_id", crmClientId)
        .order("created_at", { ascending: false });
      if (error) {
        if (tabelaFaltando(error.message)) return [];
        throw error;
      }
      return (data ?? []) as ClientIntake[];
    },
  });
}

export function useCreateClientIntake() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (crmClientId: string) => {
      const { data, error } = await sbFrom("client_intakes")
        .insert({ manager_id: agencyOwnerId, crm_client_id: crmClientId })
        .select("*")
        .single();
      if (error) throw error;
      return data as ClientIntake;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["client-intakes"] }); },
    onError: (e: Error) =>
      toast.error(tabelaFaltando(e.message)
        ? "Rode a migration do link de cadastro (20260824000001) pra liberar isso."
        : "Não consegui gerar o link agora."),
  });
}

/** Joga as respostas na ficha. Por padrão só preenche o que está vazio. */
export function useApplyClientIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sobrescrever }: { id: string; sobrescrever?: boolean }) => {
      const { data, error } = await sbRpc("apply_intake", { _intake_id: id, _sobrescrever: !!sobrescrever });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["client-intakes"] });
      void qc.invalidateQueries({ queryKey: ["crm-clients"] });
      void qc.invalidateQueries({ queryKey: ["crm-client"] });
      toast.success("Respostas aplicadas na ficha!");
    },
    onError: () => toast.error("Não consegui aplicar as respostas."),
  });
}

export function useDeleteClientIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("client_intakes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["client-intakes"] }); },
    onError: () => toast.error("Não consegui excluir este formulário."),
  });
}
