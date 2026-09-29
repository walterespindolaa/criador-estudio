// Terceiros do Cria Caixa (aba Empresa > Terceiros).
//
// Um "terceiro" é quem a agência paga por serviço: o parceiro com conta no Cria
// (designer, editor, filmmaker... vem de manager_members) ou alguém cadastrado à
// mão, sem conta (fin_terceiros.member_id null). A ficha (nota do combinado,
// fechamento, forma de pagamento) mora em fin_terceiros; pro parceiro com conta,
// ela nasce na primeira vez que alguém salva o combinado.
//
// Os VALORES são linhas de fin_records (despesa PJ):
//   - cachê de peça entregue: nasce sozinho (gatilho lancar_cache_parceiro), assignee_id
//   - avulso (diária, deslocamento): lançado aqui, assignee_id (parceiro) ou terceiro_id (manual)
//
// Quem vê: o dono e o colaborador com o módulo cria_caixa (nunca parceiro).
// Quem paga: só o dono. A trava está no banco (gatilho fin_terceiro_guarda),
// a tela só esconde o botão.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import type { Fechamento } from "@/lib/fechamento";

// types.ts é travado (não regenera): tabelas/colunas novas passam por aqui.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (t: string) => (supabase as any).from(t);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbRpc = (fn: string, args?: Record<string, unknown>) => (supabase as any).rpc(fn, args);

const naoExiste = (msg?: string) =>
  !!msg && /does not exist|could not find|schema cache|terceiro_id|pago_em/i.test(msg);

export type Terceiro = {
  /** id da ficha em fin_terceiros (null = parceiro com conta que ainda não tem ficha) */
  terceiro_id: string | null;
  /** usuário do Cria (null = cadastrado à mão) */
  member_id: string | null;
  nome: string;
  papel: string;
  nota: string;
  fechamento: Fechamento;
  pagamento: string;
  no_cria: boolean;
};

/** Chave estável pra selecionar na lista. */
export const chaveTerceiro = (t: Pick<Terceiro, "terceiro_id" | "member_id">) =>
  t.member_id ? `m:${t.member_id}` : `t:${t.terceiro_id}`;

export type LinhaTerceiro = {
  id: string;
  date: string;
  pago_em: string | null;
  description: string;
  amount: number;
  status: "pago" | "pendente" | "atrasado";
  crm_client_id: string | null;
  post_id: string | null;
  assignee_id: string | null;
  terceiro_id: string | null;
};

export const ROTULO_PAPEL_TERCEIRO: Record<string, string> = {
  designer: "Designer",
  editor_video: "Editor de vídeo",
  copy: "Copy",
  trafego: "Tráfego",
  filmmaker: "Filmmaker",
  fotografo: "Fotógrafo",
  outro: "Outro",
};

/** Categoria da despesa pelo papel (mesma regra do gatilho do cachê). */
export const CATEGORIA_POR_PAPEL: Record<string, string> = {
  designer: "Design",
  editor_video: "Edição de vídeo",
  copy: "Copy",
  trafego: "Tráfego pago",
  filmmaker: "Captação",
  fotografo: "Fotografia",
};

export function useTerceiros() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<Terceiro[]>({
    queryKey: ["terceiros", agencyOwnerId],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbRpc("terceiros_da_agencia", { _manager: agencyOwnerId });
      if (error) {
        if (naoExiste(error.message)) return [];
        throw error;
      }
      return (data ?? []) as Terceiro[];
    },
  });
}

/** Todas as linhas de terceiros da agência (cachês + avulsos). */
export function useLinhasTerceiros() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<LinhaTerceiro[]>({
    queryKey: ["fin-records", agencyOwnerId, "terceiros"],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("fin_records")
        .select("id, date, pago_em, description, amount, status, crm_client_id, post_id, assignee_id, terceiro_id")
        .eq("manager_id", agencyOwnerId)
        .eq("type", "despesa")
        .or("assignee_id.not.is.null,terceiro_id.not.is.null")
        .order("date", { ascending: false })
        .limit(2000);
      if (error) {
        if (naoExiste(error.message)) return [];
        throw error;
      }
      return (data ?? []).map((r: LinhaTerceiro) => ({ ...r, amount: Number(r.amount) }));
    },
  });
}

function useInvalidar() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["terceiros", agencyOwnerId] });
    // prefixo ["fin-records", owner]: pega o Caixa inteiro, a home e esta aba
    qc.invalidateQueries({ queryKey: ["fin-records", agencyOwnerId], refetchType: "all" });
    qc.invalidateQueries({ queryKey: ["caches-parceiros", agencyOwnerId] });
  };
}

export type FichaInput = {
  nome?: string;
  papel?: string;
  nota?: string;
  fechamento?: Fechamento;
  pagamento?: string;
};

/**
 * Salva a ficha. Parceiro com conta sem ficha: cria (member_id preenchido).
 * Manual novo: cria (member_id null). Com ficha: atualiza.
 * Devolve o id da ficha.
 */
export function useSalvarFicha() {
  const { agencyOwnerId } = useActiveAccount();
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({ terceiro_id, member_id, ...campos }: FichaInput & { terceiro_id: string | null; member_id: string | null }) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      if (terceiro_id) {
        const { error } = await sbFrom("fin_terceiros")
          .update({ ...campos, updated_at: new Date().toISOString() })
          .eq("id", terceiro_id);
        if (error) throw error;
        return terceiro_id;
      }
      const { data, error } = await sbFrom("fin_terceiros")
        .insert({ manager_id: agencyOwnerId, member_id, ...campos })
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: invalidar,
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Não consegui salvar a ficha."),
  });
}

export function useArquivarTerceiro() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (terceiro_id: string) => {
      const { error } = await sbFrom("fin_terceiros").update({ ativo: false, updated_at: new Date().toISOString() }).eq("id", terceiro_id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Não consegui arquivar."),
  });
}

export type AvulsoInput = {
  terceiro: Terceiro;
  description: string;
  amount: number;
  date: string;
  crm_client_id: string | null;
};

export function useLancarAvulso() {
  const { agencyOwnerId } = useActiveAccount();
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({ terceiro, description, amount, date, crm_client_id }: AvulsoInput) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const { error } = await sbFrom("fin_records").insert({
        manager_id: agencyOwnerId,
        context: "pj",
        type: "despesa",
        status: "pendente",
        category: CATEGORIA_POR_PAPEL[terceiro.papel] ?? "Freelancer",
        description: `${terceiro.nome}: ${description}`,
        amount,
        date,
        crm_client_id,
        // Parceiro com conta: assignee_id faz o valor aparecer em "Meus cachês" dele.
        assignee_id: terceiro.member_id,
        terceiro_id: terceiro.member_id ? null : terceiro.terceiro_id,
      });
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Não consegui lançar."),
  });
}

/** Marca como pagas as linhas que estão na tela. Só o dono (o banco recusa o resto). */
export function usePagarFechamento() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({ ids, pago_em }: { ids: string[]; pago_em: string }) => {
      if (ids.length === 0) return;
      const { error } = await sbFrom("fin_records")
        .update({ status: "pago", pago_em })
        .in("id", ids)
        .neq("status", "pago");
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Não consegui registrar o pagamento."),
  });
}
