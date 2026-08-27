import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";

/* ═══════════════════════════════════════════════════════════════════════════
   DATA COMEMORATIVA CADASTRADA NA AGENDA

   Antes, a única porta de entrada era o cronograma, dentro de UM cliente. Só
   que "Dia Mundial da Fisioterapia" não é assunto de um cliente: é assunto de
   todos os fisioterapeutas da carteira. Cadastrar cliente por cliente é onde a
   data se perde, porque basta esquecer um.

   Aqui a data nasce uma vez e ela escolhe de quem aquilo é assunto. O que cada
   cliente decide continua no cronograma dele: salvar aqui empurra a data pro
   cronograma vivo de cada um, e o cliente aprova no link como sempre.
   ═══════════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (t: string) => (supabase as any).from(t);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbRpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args);

export type AgendaData = {
  id: string;
  manager_id: string;
  label: string;
  /** "YYYY-MM-DD". Quando repete_anual, só o dia e o mês importam. */
  dia: string;
  repete_anual: boolean;
  cor: string | null;
  nota: string | null;
  clientes: { crmClientId: string; nome: string; aprovada: boolean }[];
};

const tabelaFaltando = (msg?: string) => /does not exist|schema cache|could not find/i.test(msg ?? "");
const AVISO = "Rode a migration das datas da agenda (20260827000001) no Supabase pra liberar isso.";

export function useAgendaDatas() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  const chave = ["agenda-datas", agencyOwnerId] as const;

  const list = useQuery<AgendaData[]>({
    queryKey: chave,
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("agenda_datas")
        .select("*, agenda_data_clientes(crm_client_id, cronograma_data_id, crm_clients(name), cronograma_datas(selected))")
        .eq("manager_id", agencyOwnerId!)
        .order("dia", { ascending: true });
      if (error) {
        // Enquanto a migration não roda, a tela abre vazia em vez de quebrar.
        if (tabelaFaltando(error.message)) return [];
        throw error;
      }

      type Linha = {
        id: string; manager_id: string; label: string; dia: string;
        repete_anual: boolean; cor: string | null; nota: string | null;
        agenda_data_clientes?: {
          crm_client_id: string;
          crm_clients?: { name?: string | null } | null;
          cronograma_datas?: { selected?: boolean | null } | null;
        }[];
      };

      return ((data ?? []) as Linha[]).map((r) => ({
        id: r.id, manager_id: r.manager_id, label: r.label, dia: r.dia,
        repete_anual: r.repete_anual, cor: r.cor, nota: r.nota,
        clientes: (r.agenda_data_clientes ?? []).map((c) => ({
          crmClientId: c.crm_client_id,
          nome: (c.crm_clients?.name ?? "").trim() || "cliente",
          // Aprovada = o cliente marcou no link do cronograma dele.
          aprovada: !!c.cronograma_datas?.selected,
        })),
      }));
    },
  });

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ["agenda-datas"] });
    // A data entra no cronograma dos clientes, então a agenda que lê de lá
    // também precisa saber que mudou.
    void qc.invalidateQueries({ queryKey: ["cronograma-datas-todas"] });
    void qc.invalidateQueries({ queryKey: ["cronograma-datas"] });
  };

  type Entrada = {
    label: string; dia: string; repete_anual: boolean;
    cor: string | null; nota: string | null; clientes: string[];
  };

  /** Grava os vínculos e empurra pro cronograma vivo de cada cliente. */
  const ligarClientes = async (dataId: string, clientes: string[]) => {
    // Troca a lista inteira: é mais simples e mais previsível que calcular o
    // que entrou e o que saiu, e a lista é sempre pequena.
    await sbFrom("agenda_data_clientes").delete().eq("agenda_data_id", dataId);
    if (clientes.length > 0) {
      const { error } = await sbFrom("agenda_data_clientes")
        .insert(clientes.map((crm_client_id) => ({ agenda_data_id: dataId, crm_client_id })) as never);
      if (error) throw error;
    }
    // Best-effort: se o espelho falhar, a data continua na agenda dela. Perder
    // a data por causa do cronograma seria pior que o cronograma ficar atrás.
    const { error: erroEspelho } = await sbRpc("agenda_data_para_cronogramas", { _agenda_data_id: dataId });
    if (erroEspelho) console.error("[agenda-datas] não consegui levar pro cronograma:", erroEspelho);
  };

  const criar = useMutation({
    mutationFn: async (v: Entrada) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      if (!v.label.trim()) throw new Error("Dê um nome pra data.");
      const { data, error } = await sbFrom("agenda_datas").insert({
        manager_id: agencyOwnerId,
        label: v.label.trim().slice(0, 160),
        dia: v.dia,
        repete_anual: v.repete_anual,
        cor: v.cor,
        nota: v.nota?.trim() || null,
      } as never).select("id").single();
      if (error) throw error;
      await ligarClientes((data as { id: string }).id, v.clientes);
    },
    onSuccess: (_d, v) => {
      invalidar();
      toast.success(v.clientes.length > 0
        ? `Data criada e enviada pro cronograma de ${v.clientes.length} cliente(s).`
        : "Data criada.");
    },
    onError: (e: Error) => toast.error(tabelaFaltando(e.message) ? AVISO : (e.message || "Não consegui salvar a data.")),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, ...v }: Entrada & { id: string }) => {
      if (!v.label.trim()) throw new Error("Dê um nome pra data.");
      const { data, error } = await sbFrom("agenda_datas").update({
        label: v.label.trim().slice(0, 160),
        dia: v.dia,
        repete_anual: v.repete_anual,
        cor: v.cor,
        nota: v.nota?.trim() || null,
        updated_at: new Date().toISOString(),
      } as never).eq("id", id).select("id").maybeSingle();
      if (error) throw error;
      // .select() de propósito: bloqueio de permissão volta zero linhas SEM
      // erro, e a tela diria "salvo" sem ter salvo.
      if (!data) throw new Error("Não consegui salvar. Recarregue e tente de novo.");
      await ligarClientes(id, v.clientes);
    },
    onSuccess: () => { invalidar(); toast.success("Data atualizada."); },
    onError: (e: Error) => toast.error(e.message || "Não consegui salvar."),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("agenda_datas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      // A linha some do cronograma junto? Não: o cliente pode já ter aprovado e
      // planejado em cima dela. Apagar de lá seria decidir pelo cliente.
      toast.success("Data removida da agenda. O que já foi pro cronograma continua lá.");
    },
    onError: () => toast.error("Não consegui excluir."),
  });

  return { datas: list.data ?? [], isLoading: list.isLoading, criar, atualizar, excluir };
}
