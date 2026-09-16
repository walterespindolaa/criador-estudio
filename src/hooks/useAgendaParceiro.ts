import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { aindaNaoExisteNoBanco, mensagemHumana } from "@/hooks/useParceiro";

/* ═══════════════════════════════════════════════════════════════════════════
   A AGENDA DO PARCEIRO (circuito 11, 16/09/2026)

   Fila é "o que me mandaram". Agenda é "como eu organizo o meu dia". O parceiro
   tinha a primeira e não tinha a segunda, então usava o Cria pra consultar e
   outro app pra viver.

   Três fontes se juntam na tela:
     1. as ENTREGAS com prazo, que vêm do useFilaDoParceiro (nada novo aqui);
     2. as TAREFAS e COMPROMISSOS dela, que moram em parceiro_agenda_itens;
     3. os DIAS DE GRAVAÇÃO em que a social mídia escalou ela.

   Migration: 20260916000001_agenda_do_parceiro.sql
   ═══════════════════════════════════════════════════════════════════════════ */

// Mesmo padrão dos outros hooks de parceiro: o types.ts gerado não conhece as
// tabelas e funções novas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbRpc = (fn: string, args?: Record<string, unknown>) => (supabase as any).rpc(fn, args);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (t: string) => (supabase as any).from(t);

export type TipoDeItem = "tarefa" | "compromisso";

export type ItemDaAgenda = {
  id: string;
  tipo: TipoDeItem;
  titulo: string;
  data: string | null;
  hora: string | null;
  local: string | null;
  nota: string | null;
  prioridade: "urgente" | "alta" | "media" | "baixa";
  feito: boolean;
  feito_em: string | null;
  post_id: string | null;
  agencia_id: string | null;
  created_at: string;
};

export type GravacaoDoParceiro = {
  captura_id: string;
  dia: string;
  hora: string | null;
  duracao_horas: number | null;
  local: string | null;
  cliente_nome: string;
  agencia_id: string;
  agencia_nome: string;
  status: string | null;
  nota: string | null;
  roteiros: number;
};

export const ROTULO_PRIORIDADE: Record<string, { txt: string; cls: string }> = {
  urgente: { txt: "Urgente", cls: "bg-red-100 text-red-700" },
  alta: { txt: "Alta", cls: "bg-orange-100 text-orange-700" },
  media: { txt: "Média", cls: "bg-yellow-100 text-yellow-700" },
  baixa: { txt: "Quando der", cls: "bg-gray-100 text-gray-600" },
};

/* ── OS ITENS DELA ────────────────────────────────────────────────────────
   Puxa o mês inteiro MAIS as tarefas sem data: tarefa sem prazo é justamente a
   que some se a consulta filtrar por período, e some da vista é como ela vira
   trabalho esquecido. */
export function useItensDaAgenda(de: string, ate: string) {
  const { user } = useAuth();
  return useQuery<ItemDaAgenda[]>({
    queryKey: ["parceiro-agenda-itens", user?.id, de, ate],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbFrom("parceiro_agenda_itens")
        .select("*")
        // O `eq` é redundante com a RLS de propósito: ele faz a consulta usar o
        // índice (parceiro_id, data) em vez de varrer e filtrar depois.
        .eq("parceiro_id", user?.id)
        .or(`and(data.gte.${de},data.lte.${ate}),data.is.null`)
        .order("data", { ascending: true, nullsFirst: false })
        .order("hora", { ascending: true, nullsFirst: true });
      if (error) {
        if (aindaNaoExisteNoBanco(error.message)) return [];
        throw error;
      }
      return (data ?? []) as ItemDaAgenda[];
    },
  });
}

/* ── AS GRAVAÇÕES EM QUE ELA FOI ESCALADA ─────────────────────────────── */
export function useMinhasGravacoes(de: string, ate: string) {
  const { user } = useAuth();
  return useQuery<GravacaoDoParceiro[]>({
    queryKey: ["parceiro-gravacoes", user?.id, de, ate],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbRpc("parceiro_minhas_gravacoes", { _de: de, _ate: ate });
      if (error) {
        if (aindaNaoExisteNoBanco(error.message)) return [];
        throw error;
      }
      return (data ?? []) as GravacaoDoParceiro[];
    },
  });
}

/* ── O NOME DAS PEÇAS AMARRADAS ───────────────────────────────────────────
   A tarefa guarda só o id da peça. O nome vem por função, porque o parceiro não
   lê `posts` direto (decisão da fase 1). */
export function useTitulosDasPecas(ids: string[]) {
  const { user } = useAuth();
  const chave = [...new Set(ids)].sort();
  return useQuery<Record<string, { titulo: string; cliente: string }>>({
    queryKey: ["parceiro-titulos-pecas", user?.id, chave.join(",")],
    enabled: !!user && chave.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await sbRpc("parceiro_titulos_das_pecas", { _ids: chave });
      if (error) {
        if (aindaNaoExisteNoBanco(error.message)) return {};
        throw error;
      }
      const mapa: Record<string, { titulo: string; cliente: string }> = {};
      for (const l of (data ?? []) as { post_id: string; titulo: string; cliente_nome: string }[]) {
        mapa[l.post_id] = { titulo: l.titulo, cliente: l.cliente_nome };
      }
      return mapa;
    },
  });
}

export type NovoItem = {
  tipo: TipoDeItem;
  titulo: string;
  data?: string | null;
  hora?: string | null;
  local?: string | null;
  nota?: string | null;
  prioridade?: string;
  post_id?: string | null;
  agencia_id?: string | null;
};

/* ── CRIAR, EDITAR, CONCLUIR, APAGAR ──────────────────────────────────────
   Uma invalidação só pra todas as ações: a chave carrega o período, e depois de
   mexer num item o mês inteiro pode ter mudado (mover de dia, por exemplo). */
export function useAcoesDaAgenda() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const recarregar = () => qc.invalidateQueries({ queryKey: ["parceiro-agenda-itens", user?.id] });

  const criar = useMutation({
    mutationFn: async (item: NovoItem) => {
      // Sem dono, a linha nasce com parceiro_id nulo e o banco recusa com um
      // erro que não diz nada. Melhor falhar aqui, em português.
      if (!user?.id) throw new Error("Sua sessão expirou. Entre de novo pra salvar.");
      const titulo = item.titulo.trim();
      if (!titulo) throw new Error("Escreva o que é, mesmo que curto.");
      if (item.tipo === "compromisso" && !item.data) {
        throw new Error("Compromisso precisa de dia. Sem dia ele não entra no calendário.");
      }
      const { error } = await sbFrom("parceiro_agenda_itens").insert({
        parceiro_id: user?.id,
        tipo: item.tipo,
        titulo: titulo.slice(0, 140),
        data: item.data || null,
        hora: item.hora || null,
        local: item.local?.trim() || null,
        nota: item.nota?.trim().slice(0, 600) || null,
        prioridade: item.prioridade || "media",
        post_id: item.post_id || null,
        agencia_id: item.agencia_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { recarregar(); toast.success("Anotado na sua agenda."); },
    onError: (e) => toast.error(mensagemHumana(e, "Não consegui salvar agora. Tente de novo.")),
  });

  const editar = useMutation({
    mutationFn: async ({ id, ...campos }: Partial<NovoItem> & { id: string }) => {
      const patch: Record<string, unknown> = {};
      if (campos.titulo !== undefined) patch.titulo = campos.titulo.trim().slice(0, 140);
      if (campos.data !== undefined) patch.data = campos.data || null;
      if (campos.hora !== undefined) patch.hora = campos.hora || null;
      if (campos.local !== undefined) patch.local = campos.local?.trim() || null;
      if (campos.nota !== undefined) patch.nota = campos.nota?.trim().slice(0, 600) || null;
      if (campos.prioridade !== undefined) patch.prioridade = campos.prioridade;
      if (campos.post_id !== undefined) patch.post_id = campos.post_id || null;
      if (campos.agencia_id !== undefined) patch.agencia_id = campos.agencia_id || null;
      const { error } = await sbFrom("parceiro_agenda_itens").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { recarregar(); toast.success("Atualizado."); },
    onError: (e) => toast.error(mensagemHumana(e, "Não consegui atualizar agora.")),
  });

  /* Marcar e desmarcar é o gesto mais repetido da tela, e é o que mais sofre
     com espera: o item some da lista de abertos meio segundo depois do toque.
     Por isso ele muda na hora no cache e só então vai ao banco. */
  const concluir = useMutation({
    mutationFn: async ({ id, feito }: { id: string; feito: boolean }) => {
      const { error } = await sbFrom("parceiro_agenda_itens").update({ feito }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, feito }) => {
      await qc.cancelQueries({ queryKey: ["parceiro-agenda-itens", user?.id] });
      const antes = qc.getQueriesData<ItemDaAgenda[]>({ queryKey: ["parceiro-agenda-itens", user?.id] });
      for (const [chave, lista] of antes) {
        if (!lista) continue;
        qc.setQueryData(chave, lista.map((i) => (i.id === id ? { ...i, feito } : i)));
      }
      return { antes };
    },
    onError: (e, _v, ctx) => {
      for (const [chave, lista] of ctx?.antes ?? []) qc.setQueryData(chave, lista);
      toast.error(mensagemHumana(e, "Não consegui marcar agora."));
    },
    onSettled: () => recarregar(),
  });

  const apagar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("parceiro_agenda_itens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { recarregar(); toast.success("Apagado."); },
    onError: (e) => toast.error(mensagemHumana(e, "Não consegui apagar agora.")),
  });

  return { criar, editar, concluir, apagar };
}
