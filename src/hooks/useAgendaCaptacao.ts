import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useAuth } from "@/contexts/AuthContext";

/* ═══════════════════════════════════════════════════════════════════════════
   AGENDA DE CAPTAÇÃO (Gabriela e Walter, 19/10/2026; mockup aprovado)

   A social mídia libera horários, cada cliente tem um link próprio
   (/agendar/:token) e pede um horário. Tabelas: captacao_slots,
   captacao_pedidos, captacao_links, captacao_agenda_config. O cliente nunca
   lê tabela: só as RPCs agenda_publica e pedir_horario.
   ═══════════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (t: string) => (supabase as any).from(t);
type AnyRpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
const sbRpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;

export type SlotCaptacao = {
  id: string; manager_id: string; dia: string; hora: string; duracao: number; local: string | null;
  para_todos: boolean; clientes: string[]; status: "livre" | "pedido" | "confirmado"; criado_por: string | null;
};
export type PedidoCaptacao = {
  id: string; slot_id: string; crm_client_id: string; ideias: string | null; recado: string | null;
  status: "pendente" | "confirmado" | "recusado"; capture_id: string | null; created_at: string; decidido_em: string | null;
  slot: { dia: string; hora: string; duracao: number; local: string | null } | null;
};
export type DiaSemanaPadrao = { dow: number; horas: string[] };
export type ConfigAgenda = { semana: DiaSemanaPadrao[]; duracao: number; local: string | null; modelo_msg: string | null };

export const MODELO_PADRAO = `Captação confirmada
{data}, às {hora} ({duracao})
Local: {local}
Ideias do cliente: {ideias}
Qualquer mudança, avisa aqui.`;

const WD_LONGO = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function dataLonga(dia: string): string {
  const [y, m, d] = dia.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WD_LONGO[dt.getDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** Monta a mensagem do grupo a partir do modelo. Linha com campo vazio some. */
export function montarMensagem(modelo: string, v: { cliente: string; dia: string; hora: string; duracao: number; local?: string | null; ideias?: string | null }): string {
  const mapa: Record<string, string> = {
    cliente: v.cliente, data: dataLonga(v.dia), hora: v.hora.replace(":00", "h").replace(":", "h"),
    duracao: `${v.duracao}h`, local: (v.local ?? "").trim(), ideias: (v.ideias ?? "").trim(),
  };
  return modelo.split("\n")
    // Linha com local ou ideias vazio some, em vez de sair "Local: ".
    .filter((linha) => !(/\{local\}/.test(linha) && !mapa.local) && !(/\{ideias\}/.test(linha) && !mapa.ideias))
    .map((linha) => linha.replace(/\{(\w+)\}/g, (_, k: string) => mapa[k] ?? `{${k}}`))
    .join("\n").trim();
}

export function linkDoAgendamento(token: string) {
  return `${window.location.origin}/agendar/${token}`;
}

function intervaloDoMes(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const fim = new Date(y, m, 0).getDate();
  return { de: `${ym}-01`, ate: `${ym}-${String(fim).padStart(2, "0")}` };
}

export function useAgendaConta() {
  const { agencyOwnerId } = useActiveAccount();
  return agencyOwnerId ?? null;
}

export function useSlotsDoMes(ym: string) {
  const mgr = useAgendaConta();
  return useQuery<SlotCaptacao[]>({
    queryKey: ["captacao-slots", mgr, ym],
    enabled: !!mgr,
    queryFn: async () => {
      const { de, ate } = intervaloDoMes(ym);
      const { data, error } = await sbFrom("captacao_slots").select("*")
        .eq("manager_id", mgr).gte("dia", de).lte("dia", ate).order("dia").order("hora");
      if (error) throw error;
      return (data ?? []) as SlotCaptacao[];
    },
  });
}

export function useConfigAgenda() {
  const mgr = useAgendaConta();
  const qc = useQueryClient();
  const q = useQuery<ConfigAgenda>({
    queryKey: ["captacao-config", mgr],
    enabled: !!mgr,
    queryFn: async () => {
      const { data } = await sbFrom("captacao_agenda_config").select("semana, duracao, local, modelo_msg").eq("manager_id", mgr).maybeSingle();
      const c = data as Partial<ConfigAgenda> | null;
      return { semana: (c?.semana as DiaSemanaPadrao[]) ?? [], duracao: c?.duracao ?? 2, local: c?.local ?? null, modelo_msg: c?.modelo_msg ?? null };
    },
  });
  const salvar = useMutation({
    mutationFn: async (patch: Partial<ConfigAgenda>) => {
      const atual = q.data ?? { semana: [], duracao: 2, local: null, modelo_msg: null };
      const { error } = await sbFrom("captacao_agenda_config").upsert({ manager_id: mgr, ...atual, ...patch, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["captacao-config", mgr] }),
    onError: () => toast.error("Não consegui salvar. Tenta de novo."),
  });
  return { ...q, salvar };
}

export type NovoSlot = { dia: string; hora: string; duracao: number; local?: string | null; para_todos?: boolean; clientes?: string[] };

export function useSlotsMutations() {
  const mgr = useAgendaConta();
  const { user } = useAuth();
  const qc = useQueryClient();
  const recarregar = () => qc.invalidateQueries({ queryKey: ["captacao-slots", mgr] });
  const adicionar = useMutation({
    mutationFn: async (lista: NovoSlot[]) => {
      if (!lista.length) return 0;
      const rows = lista.map((s) => ({
        manager_id: mgr, dia: s.dia, hora: s.hora, duracao: s.duracao, local: s.local ?? null,
        para_todos: s.para_todos ?? true, clientes: s.clientes ?? [], criado_por: user?.id ?? null,
      }));
      // Horário que já existe naquele dia fica como está (não duplica nem sobrescreve).
      const { error } = await sbFrom("captacao_slots").upsert(rows, { onConflict: "manager_id,dia,hora", ignoreDuplicates: true });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: recarregar,
    onError: () => toast.error("Não consegui liberar os horários. Tenta de novo."),
  });
  const remover = useMutation({
    mutationFn: async (id: string) => {
      // Só sai horário LIVRE: com pedido ou confirmado, trata o pedido antes.
      const { error } = await sbFrom("captacao_slots").delete().eq("id", id).eq("status", "livre");
      if (error) throw error;
    },
    onSuccess: recarregar,
    onError: () => toast.error("Não consegui tirar esse horário."),
  });
  const editar = useMutation({
    mutationFn: async (v: { id: string; para_todos: boolean; clientes: string[] }) => {
      const { error } = await sbFrom("captacao_slots").update({ para_todos: v.para_todos, clientes: v.clientes }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: recarregar,
  });
  return { adicionar, remover, editar };
}

export function usePedidosCaptacao() {
  const mgr = useAgendaConta();
  return useQuery<PedidoCaptacao[]>({
    queryKey: ["captacao-pedidos", mgr],
    enabled: !!mgr,
    refetchInterval: 60_000,
    queryFn: async () => {
      const desde = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data, error } = await sbFrom("captacao_pedidos")
        .select("*, slot:captacao_slots(dia, hora, duracao, local)")
        .eq("manager_id", mgr)
        .or(`status.eq.pendente,created_at.gte.${desde}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PedidoCaptacao[];
    },
  });
}

export function useDecidirPedido() {
  const mgr = useAgendaConta();
  const qc = useQueryClient();
  const depois = () => {
    qc.invalidateQueries({ queryKey: ["captacao-pedidos", mgr] });
    qc.invalidateQueries({ queryKey: ["captacao-slots", mgr] });
    qc.invalidateQueries({ queryKey: ["agenda-captures"] });
    qc.invalidateQueries({ queryKey: ["captures"] });
  };
  const confirmar = useMutation({
    mutationFn: async (pedidoId: string) => {
      const { data, error } = await sbRpc("confirmar_pedido_captacao", { _pedido: pedidoId });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: depois,
    onError: () => toast.error("Não consegui confirmar. Tenta de novo."),
  });
  const recusar = useMutation({
    mutationFn: async (pedidoId: string) => {
      const { error } = await sbRpc("recusar_pedido_captacao", { _pedido: pedidoId });
      if (error) throw new Error(error.message);
    },
    onSuccess: depois,
    onError: () => toast.error("Não consegui liberar o horário. Tenta de novo."),
  });
  return { confirmar, recusar };
}

export function useLinksCaptacao() {
  const mgr = useAgendaConta();
  return useQuery<{ crm_client_id: string; token: string }[]>({
    queryKey: ["captacao-links", mgr],
    enabled: !!mgr,
    queryFn: async () => {
      const { data, error } = await sbFrom("captacao_links").select("crm_client_id, token").eq("manager_id", mgr).eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as { crm_client_id: string; token: string }[];
    },
  });
}

/** Pega (ou cria) o link do cliente, sem copiar. */
export async function linkDoCliente(crmClientId: string): Promise<string | null> {
  const { data, error } = await sbRpc("captacao_link_cliente", { _client: crmClientId });
  if (error || !data) return null;
  return linkDoAgendamento(String(data));
}

/** Pega (ou cria) o link do cliente e copia. */
export async function copiarLinkDoCliente(crmClientId: string, nome?: string): Promise<string | null> {
  const url = await linkDoCliente(crmClientId);
  if (!url) { toast.error("Não consegui gerar o link desse cliente."); return null; }
  try { await navigator.clipboard.writeText(url); toast.success(nome ? `Link de ${nome} copiado` : "Link copiado"); }
  catch { toast.message(url); }
  return url;
}

/** Horários livres que um cliente enxerga (pra montar a mensagem de "sugerir outro"). */
export function livresDoCliente(slots: SlotCaptacao[], crmClientId: string, hoje: string): SlotCaptacao[] {
  return slots.filter((s) => s.status === "livre" && s.dia >= hoje && (s.para_todos || s.clientes.includes(crmClientId)));
}
