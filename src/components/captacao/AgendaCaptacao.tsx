import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, CalendarRange, ChevronLeft, ChevronRight, Copy, Check, Clock, FolderOpen, Inbox, Link2, Loader2,
  MapPin, MessageSquareText, Pencil, Plus, Repeat, Sparkles, Trash2, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCrmClients } from "@/hooks/useCrm";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { clientesParaEscolher } from "@/lib/cliente-status";
import { hojeBR } from "@/lib/date-br";
import { PreviaWhatsApp } from "@/components/shared/PreviaWhatsApp";
import {
  CHECKLIST_PADRAO, OPCOES_PADRAO, copiarLinkDoCliente, dataLonga, dataPorExtenso, faixaDeHorario, horaCurta, linkDoCliente,
  livresDoCliente, montarMensagemGrupo, pedidoAtivo,
  useAgendaConta, useConfigAgenda, useDecidirPedido, useLinksCaptacao, usePedidosCaptacao, useSlotsDoMes, useSlotsMutations,
  type NovoSlot, type OpcoesMsg, type PedidoCaptacao, type SlotCaptacao,
} from "@/hooks/useAgendaCaptacao";

/* ═══════════════════════════════════════════════════════════════════════════
   AGENDA DE CAPTAÇÃO v2 (Walter e Gabriela, 19/10/2026; mockup aprovado)

   Feedback da v1: "Montar semana" confundia, não dava pra fazer por dia, a
   mensagem pro grupo era simples demais e o calendário não dizia QUEM marcou.
   Agora:
   1. Dia a dia é o caminho principal: toca nos dias, escolhe horários e pra
      quem no painel ao lado, libera.
   2. Semana padrão vira só um atalho ("Repetir toda semana").
   3. Cada horário mostra o cliente e a situação; tocar abre o detalhe.
   4. Mensagem pro grupo completa, com prévia em bolha de WhatsApp e modelo
      com interruptores + checklist editável.
   ═══════════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (t: string) => (supabase as any).from(t);

const WD = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const WD_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const addMes = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const rotuloMes = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${MESES[m - 1]} ${y}`; };
const diasDoMes = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); };
const isoDia = (ym: string, d: number) => `${ym}-${String(d).padStart(2, "0")}`;
const dowDe = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };
const ordenaHoras = (a: string, b: string) => a.localeCompare(b);
const juntarE = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);
const primeiroNome = (n?: string | null) => (n ?? "").trim().split(/\s+/)[0] ?? "";

type Aba = "calendario" | "pedidos" | "links";
type Cliente = { id: string; name: string; status?: string | null; contract_end_date?: string | null };

function useNomes() {
  const { data: clients = [] } = useCrmClients();
  const nomePorId = useMemo(() => new Map(clients.map((c) => [c.id, c.name as string])), [clients]);
  return { clients: clients as unknown as Cliente[], nomePorId };
}

/** Situação visual do horário: livre, só pra cliente, pedido esperando, confirmada. */
function situacao(s: SlotCaptacao, nomePorId: Map<string, string>) {
  const p = pedidoAtivo(s);
  if (s.status === "confirmado") return { cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200", nome: nomePorId.get(p?.crm_client_id ?? "") ?? "Cliente", sub: "confirmada" };
  if (s.status === "pedido") return { cls: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200", nome: nomePorId.get(p?.crm_client_id ?? "") ?? "Cliente", sub: "esperando você" };
  if (!s.para_todos) return { cls: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200", nome: "livre", sub: `só ${s.clientes.map((c) => primeiroNome(nomePorId.get(c)) || "cliente").join(", ")}` };
  return { cls: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200", nome: "livre", sub: "" };
}

export function AgendaCaptacao({ onVoltar, abaInicial = "calendario", onAbrirPasta }: {
  onVoltar: () => void; abaInicial?: Aba; onAbrirPasta?: (crmClientId: string) => void;
}) {
  const hoje = hojeBR();
  const [ym, setYm] = useState(hoje.slice(0, 7));
  const [aba, setAba] = useState<Aba>(abaInicial);
  const { data: pedidos = [] } = usePedidosCaptacao();
  const pendentes = pedidos.filter((p) => p.status === "pendente");
  // Mensagem mora aqui: abre a partir do calendário e dos pedidos.
  const [msgPedido, setMsgPedido] = useState<{ pedido: PedidoCaptacao | null; slot: SlotCaptacao | null } | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onVoltar} aria-label="Voltar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-display font-extrabold text-foreground">Agenda de captação</h2>
            <p className="text-[12px] font-body text-muted-foreground">Libere os horários, mande o link de cada cliente e confirme os pedidos.</p>
          </div>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {([["calendario", "Calendário", CalendarRange], ["pedidos", `Pedidos${pendentes.length ? ` (${pendentes.length})` : ""}`, Inbox], ["links", "Links dos clientes", Link2]] as const).map(([v, l, Icone]) => (
            <button key={v} type="button" onClick={() => setAba(v)}
              className={cn("shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-body font-bold transition-colors",
                aba === v ? "bg-foreground text-background border-foreground" : "bg-card border-border text-foreground hover:border-blue-300")}>
              <Icone className="h-3.5 w-3.5" /> {l}
              {v === "pedidos" && pendentes.length > 0 && aba !== v && <span className="h-2 w-2 rounded-full bg-amber-500" />}
            </button>
          ))}
        </div>
      </div>

      {aba === "calendario" && (
        <AbaCalendario ym={ym} setYm={setYm} hoje={hoje} onAbrirPasta={onAbrirPasta}
          onMensagem={(pedido, slot) => setMsgPedido({ pedido, slot })} />
      )}
      {aba === "pedidos" && <AbaPedidos pedidos={pedidos} hoje={hoje} onMensagem={(pedido) => setMsgPedido({ pedido, slot: null })} />}
      {aba === "links" && <AbaLinks ym={ym} hoje={hoje} />}

      {msgPedido && <MensagemGrupo pedido={msgPedido.pedido} slot={msgPedido.slot} onFechar={() => setMsgPedido(null)} />}
    </div>
  );
}

/* ─── Calendário ───────────────────────────────────────────────────────────── */

function AbaCalendario({ ym, setYm, hoje, onAbrirPasta, onMensagem }: {
  ym: string; setYm: (v: string) => void; hoje: string;
  onAbrirPasta?: (crmClientId: string) => void;
  onMensagem: (p: PedidoCaptacao | null, s: SlotCaptacao) => void;
}) {
  const { data: slots = [], isLoading } = useSlotsDoMes(ym);
  const { data: slotsAnt = [] } = useSlotsDoMes(addMes(ym, -1));
  const { data: config, salvar } = useConfigAgenda();
  const { adicionar } = useSlotsMutations();
  const { clients, nomePorId } = useNomes();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [editSemana, setEditSemana] = useState(false);

  // Trocar de mês limpa a seleção (os dias são de outro mês).
  useEffect(() => { setSelecionados(new Set()); }, [ym]);

  const semana = config?.semana ?? [];
  const duracaoPadrao = config?.duracao ?? 2;
  const local = config?.local ?? null;
  const temSemana = semana.some((d) => d.horas.length > 0);
  const resumoSemana = temSemana
    ? `${juntarE(semana.filter((d) => d.horas.length).sort((a, b) => a.dow - b.dow).map((d) => WD_CURTO[d.dow]))}, ${juntarE([...new Set(semana.flatMap((d) => d.horas))].sort(ordenaHoras).map(horaCurta))}, ${duracaoPadrao}h`
    : null;

  const porDia = useMemo(() => {
    const m = new Map<string, SlotCaptacao[]>();
    for (const s of slots) m.set(s.dia, [...(m.get(s.dia) ?? []), s]);
    return m;
  }, [slots]);
  const detalhe = detalheId ? slots.find((s) => s.id === detalheId) ?? null : null;

  const alternarDia = (dia: string) => {
    if (dia < hoje) return;
    setSelecionados((p) => { const n = new Set(p); if (n.has(dia)) n.delete(dia); else n.add(dia); return n; });
  };

  const liberarMes = async () => {
    const novos: NovoSlot[] = [];
    for (let d = 1; d <= diasDoMes(ym); d++) {
      const dia = isoDia(ym, d);
      if (dia < hoje) continue;
      const cfg = semana.find((x) => x.dow === dowDe(dia));
      for (const h of cfg?.horas ?? []) {
        if (!porDia.get(dia)?.some((s) => s.hora === h)) novos.push({ dia, hora: h, duracao: duracaoPadrao, local });
      }
    }
    if (!novos.length) { toast.message(`${rotuloMes(ym)} já está com esses horários.`); return; }
    await adicionar.mutateAsync(novos);
    toast.success(`${novos.length} ${novos.length === 1 ? "horário liberado" : "horários liberados"} em ${rotuloMes(ym)}`);
  };

  // Mesma posição na semana: 2ª terça do mês passado vira 2ª terça deste mês.
  const repetirMesPassado = async () => {
    const ant = addMes(ym, -1);
    if (!slotsAnt.length) { toast.message(`Não tinha horário liberado em ${rotuloMes(ant)}.`); return; }
    const novos: NovoSlot[] = [];
    for (const s of slotsAnt) {
      const dAnt = Number(s.dia.slice(8, 10));
      const dow = dowDe(s.dia);
      const ordem = Math.floor((dAnt - 1) / 7);
      const primeiro = [...Array(7)].map((_, i) => i + 1).find((d) => dowDe(isoDia(ym, d)) === dow)!;
      const alvo = primeiro + ordem * 7;
      if (alvo > diasDoMes(ym)) continue;
      const dia = isoDia(ym, alvo);
      if (dia < hoje || porDia.get(dia)?.some((x) => x.hora === s.hora)) continue;
      novos.push({ dia, hora: s.hora, duracao: s.duracao, local: s.local, para_todos: s.para_todos, clientes: s.clientes });
    }
    if (!novos.length) { toast.message("Nada novo pra copiar: esses horários já estão aqui ou já passaram."); return; }
    await adicionar.mutateAsync(novos);
    toast.success(`${novos.length} ${novos.length === 1 ? "horário copiado" : "horários copiados"} de ${rotuloMes(ant)}`);
  };

  const primeiroDow = dowDe(isoDia(ym, 1));
  const celulas: (number | null)[] = [...Array(primeiroDow).fill(null), ...[...Array(diasDoMes(ym))].map((_, i) => i + 1)];

  return (
    <div className="space-y-4">
      {/* Os 3 passos: o que faltava pra entender o fluxo. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {([
          ["1", "Toque nos dias", "Pode marcar vários de uma vez."],
          ["2", "Escolha os horários", "No painel ao lado, e pra quem é."],
          ["3", "Mande o link", "Cada cliente escolhe um. Você confirma."],
        ] as const).map(([n, t, d]) => (
          <div key={n} className="flex items-start gap-2.5 rounded-2xl bg-muted/50 px-3.5 py-2.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-foreground text-background text-[11px] font-bold">{n}</span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-body font-bold text-foreground">{t}</span>
              <span className="block text-[11.5px] font-body text-muted-foreground">{d}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setYm(addMes(ym, -1))} aria-label="Mês anterior"
              className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-display font-bold capitalize">{rotuloMes(ym)}</p>
            <button type="button" onClick={() => setYm(addMes(ym, 1))} aria-label="Próximo mês"
              className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground hover:text-foreground">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {WD.map((w) => <p key={w} className="text-center text-[10px] sm:text-[10.5px] font-body font-bold text-muted-foreground py-1">{w}</p>)}
            {celulas.map((d, i) => {
              if (d == null) return <span key={`v${i}`} />;
              const dia = isoDia(ym, d);
              const passado = dia < hoje;
              const sel = selecionados.has(dia);
              const doDia = porDia.get(dia) ?? [];
              return (
                <div key={dia} role="button" tabIndex={passado ? -1 : 0} aria-pressed={sel} aria-disabled={passado}
                  onClick={() => alternarDia(dia)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alternarDia(dia); } }}
                  className={cn("relative min-h-[64px] sm:min-h-[92px] rounded-xl border-[1.5px] p-1 sm:p-1.5 text-left transition-colors select-none",
                    passado ? "border-transparent bg-muted/30 opacity-60 cursor-default" : "cursor-pointer bg-background border-border hover:border-blue-300",
                    sel && "border-blue-500 bg-blue-50/70 ring-2 ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-500/30",
                    dia === hoje && !sel && "ring-1 ring-blue-400")}>
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] sm:text-[12px] font-body font-bold text-foreground/80">{d}</span>
                    {sel && <span className="grid h-4 w-4 place-items-center rounded-[5px] bg-blue-600"><Check className="h-3 w-3 text-white" /></span>}
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {doDia.slice(0, 3).map((s) => {
                      const si = situacao(s, nomePorId);
                      return (
                        <button key={s.id} type="button" onClick={(e) => { e.stopPropagation(); setDetalheId(s.id); }}
                          className={cn("block w-full truncate rounded-md px-1 py-[2px] text-left text-[9.5px] sm:text-[10.5px] font-body font-bold leading-tight hover:brightness-95", si.cls)}
                          title={`${horaCurta(s.hora)} ${si.nome}${si.sub ? ` · ${si.sub}` : ""}`}>
                          {horaCurta(s.hora)} <span className="hidden sm:inline">{si.nome}</span>
                          {si.sub && <span className="hidden sm:block truncate font-medium opacity-85">{si.sub}</span>}
                        </button>
                      );
                    })}
                    {doDia.length > 3 && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setDetalheId(doDia[3].id); }}
                        className="block text-[9.5px] text-muted-foreground px-1">+{doDia.length - 3}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {isLoading && <p className="text-[12px] text-muted-foreground mt-2">Carregando...</p>}
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-body text-muted-foreground">
            <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-[3px] bg-blue-100 border border-blue-200" /> livre</span>
            <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-[3px] bg-violet-100 border border-violet-200" /> só pra um cliente</span>
            <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-[3px] bg-amber-100 border border-amber-200" /> pedido esperando você</span>
            <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-[3px] bg-emerald-100 border border-emerald-200" /> confirmada</span>
            <span className="w-full">Toque no dia pra selecionar. Toque no horário pra ver quem marcou.</span>
          </div>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4">
          <PainelLiberar dias={[...selecionados].sort()} porDia={porDia} slots={slots} semana={semana}
            duracaoPadrao={duracaoPadrao} local={local} clients={clients}
            onLiberado={() => setSelecionados(new Set())}
            onSalvarSemana={async (dows, horas, dur) => {
              await salvar.mutateAsync({ semana: dows.map((dow) => ({ dow, horas })), duracao: dur });
              toast.success("Pronto: esses horários viram o seu atalho de toda semana");
            }}
            temSemana={temSemana} />

          {/* ATALHO: a semana padrão deixou de ser o caminho principal. */}
          <div className="rounded-2xl border border-border bg-muted/40 p-3.5">
            <div className="flex items-start gap-2.5">
              <Repeat className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-body font-bold text-foreground">Atalho: repetir toda semana</p>
                <p className="text-[12px] font-body text-muted-foreground">
                  {resumoSemana ?? "Escolha dias e horários e toque em \"Usar estes horários toda semana\" no painel acima."}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {temSemana && (
                <Button size="sm" onClick={() => void liberarMes()} disabled={adicionar.isPending}
                  className="rounded-xl h-8 bg-blue-600 hover:bg-blue-700 text-white">
                  {adicionar.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                  Aplicar em {MESES[Number(ym.slice(5, 7)) - 1]}
                </Button>
              )}
              {temSemana && (
                <Button size="sm" variant="outline" onClick={() => setEditSemana(true)} className="rounded-xl h-8 bg-card">
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => void repetirMesPassado()} disabled={adicionar.isPending} className="rounded-xl h-8 text-muted-foreground">
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Repetir o mês passado
              </Button>
            </div>
          </div>
        </div>
      </div>

      {editSemana && <EditarSemana onFechar={() => setEditSemana(false)} />}
      {detalhe && (
        <DetalheHorario slot={detalhe} nomePorId={nomePorId} hoje={hoje}
          onFechar={() => setDetalheId(null)}
          onAbrirPasta={onAbrirPasta}
          onMensagem={(p, s) => { setDetalheId(null); onMensagem(p, s); }} />
      )}
    </div>
  );
}

/* Painel ao lado do calendário: o "como" depois de escolher os dias. */
function PainelLiberar({ dias, porDia, slots, semana, duracaoPadrao, local, clients, onLiberado, onSalvarSemana, temSemana }: {
  dias: string[]; porDia: Map<string, SlotCaptacao[]>; slots: SlotCaptacao[];
  semana: { dow: number; horas: string[] }[]; duracaoPadrao: number; local: string | null; clients: Cliente[];
  onLiberado: () => void; onSalvarSemana: (dows: number[], horas: string[], dur: number) => Promise<void>; temSemana: boolean;
}) {
  const { adicionar } = useSlotsMutations();
  // Sugestões: os horários mais usados (atalho semanal + este mês) e 09h/14h de base.
  const sugeridas = useMemo(() => {
    const cont = new Map<string, number>();
    for (const h of semana.flatMap((d) => d.horas)) cont.set(h, (cont.get(h) ?? 0) + 3);
    for (const s of slots) cont.set(s.hora, (cont.get(s.hora) ?? 0) + 1);
    const top = [...cont.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h).slice(0, 5);
    return [...new Set([...top, "09:00", "14:00"])].slice(0, 6).sort(ordenaHoras);
  }, [semana, slots]);
  const [extras, setExtras] = useState<string[]>([]);
  const [horas, setHoras] = useState<Set<string>>(new Set());
  const [nova, setNova] = useState("");
  const [abrirNova, setAbrirNova] = useState(false);
  const [dur, setDur] = useState(duracaoPadrao);
  const [todos, setTodos] = useState(true);
  const [cli, setCli] = useState<Set<string>>(new Set());
  useEffect(() => { setDur(duracaoPadrao); }, [duracaoPadrao]);

  const chips = [...new Set([...sugeridas, ...extras])].sort(ordenaHoras);
  const listaClientes = clientesParaEscolher(clients);

  const plano = useMemo(() => {
    const novos: NovoSlot[] = [];
    const pulados: string[] = [];
    for (const dia of dias) {
      for (const h of [...horas].sort(ordenaHoras)) {
        if (porDia.get(dia)?.some((s) => s.hora === h)) pulados.push(`dia ${dia.slice(8, 10)} às ${horaCurta(h)}`);
        else novos.push({ dia, hora: h, duracao: dur, local, para_todos: todos, clientes: todos ? [] : [...cli] });
      }
    }
    return { novos, pulados };
  }, [dias, horas, porDia, dur, local, todos, cli]);

  const liberar = async () => {
    if (!horas.size) { toast.message("Escolha pelo menos um horário."); return; }
    if (!todos && cli.size === 0) { toast.message("Escolha pelo menos um cliente, ou deixe pra todos."); return; }
    if (!plano.novos.length) { toast.message("Esses horários já estão liberados nesses dias."); return; }
    await adicionar.mutateAsync(plano.novos);
    toast.success(`${plano.novos.length} ${plano.novos.length === 1 ? "horário liberado" : "horários liberados"}`);
    onLiberado();
  };

  if (!dias.length) {
    return (
      <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 dark:bg-blue-500/5 p-4">
        <p className="text-[13.5px] font-body font-bold text-foreground">Nenhum dia selecionado</p>
        <p className="text-[12.5px] font-body text-muted-foreground mt-1">
          Toque nos dias do calendário em que você pode gravar. Os horários e pra quem é aparecem aqui.
        </p>
      </div>
    );
  }

  const nomesDias = dias.map((d) => `${WD_CURTO[dowDe(d)]} ${d.slice(8, 10)}`);
  return (
    <div className="rounded-2xl border border-blue-200 bg-card p-4">
      <p className="text-[15px] font-display font-extrabold text-foreground">{dias.length} {dias.length === 1 ? "dia selecionado" : "dias selecionados"}</p>
      <p className="text-[12px] font-body text-muted-foreground">{juntarE(nomesDias)} de {MESES[Number(dias[0].slice(5, 7)) - 1]}</p>

      <p className="mt-3 mb-1.5 text-[12px] font-body font-bold text-muted-foreground">Horários</p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((h) => {
          const on = horas.has(h);
          return (
            <button key={h} type="button" aria-pressed={on}
              onClick={() => setHoras((p) => { const n = new Set(p); if (n.has(h)) n.delete(h); else n.add(h); return n; })}
              className={cn("rounded-full border-[1.5px] px-3 py-1.5 text-[12.5px] font-body font-bold transition-colors",
                on ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200" : "border-border bg-background text-foreground hover:border-blue-300")}>
              {horaCurta(h)}
            </button>
          );
        })}
        {!abrirNova && (
          <button type="button" onClick={() => setAbrirNova(true)}
            className="rounded-full border-[1.5px] border-dashed border-border px-3 py-1.5 text-[12.5px] font-body font-bold text-muted-foreground hover:border-blue-300">
            + outro
          </button>
        )}
      </div>
      {abrirNova && (
        <div className="mt-2 flex gap-1.5">
          <Input type="time" value={nova} onChange={(e) => setNova(e.target.value)} className="h-9 rounded-xl text-[13px]" aria-label="Outro horário" autoFocus />
          <Button size="sm" variant="outline" disabled={!/^\d{2}:\d{2}$/.test(nova)} className="h-9 rounded-xl"
            onClick={() => { setExtras((p) => [...new Set([...p, nova])]); setHoras((p) => new Set([...p, nova])); setNova(""); setAbrirNova(false); }}>
            Adicionar
          </Button>
        </div>
      )}

      <p className="mt-3 mb-1.5 text-[12px] font-body font-bold text-muted-foreground">Duração</p>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((h) => (
          <button key={h} type="button" onClick={() => setDur(h)}
            className={cn("rounded-full border-[1.5px] px-3.5 py-1.5 text-[12.5px] font-body font-bold",
              dur === h ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200" : "border-border bg-background text-foreground")}>
            {h}h
          </button>
        ))}
      </div>

      <p className="mt-3 mb-1.5 text-[12px] font-body font-bold text-muted-foreground">Pra quem</p>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {([[true, "Todos os clientes"], [false, "Escolher clientes"]] as const).map(([v, l]) => (
          <button key={String(v)} type="button" onClick={() => setTodos(v)}
            className={cn("rounded-lg py-2 text-[12px] font-body font-bold transition-colors", todos === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
            {l}
          </button>
        ))}
      </div>
      {!todos && (
        <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-border divide-y divide-border/60">
          {listaClientes.map((c) => (
            <button key={c.id} type="button" onClick={() => setCli((p) => { const n = new Set(p); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12.5px]">
              <span className={cn("h-4 w-4 rounded border grid place-items-center shrink-0", cli.has(c.id) ? "bg-violet-600 border-violet-600" : "border-muted-foreground/40")}>
                {cli.has(c.id) && <Check className="h-3 w-3 text-white" />}
              </span>
              <span className="truncate">{c.name}</span>
            </button>
          ))}
          {listaClientes.length === 0 && <p className="px-3 py-2 text-[12px] text-muted-foreground">Nenhum cliente ativo.</p>}
        </div>
      )}

      <Button onClick={() => void liberar()} disabled={adicionar.isPending || !horas.size || plano.novos.length === 0}
        className="mt-4 w-full rounded-xl h-10 bg-blue-600 hover:bg-blue-700 text-white">
        {adicionar.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
        {horas.size ? `Liberar ${plano.novos.length} ${plano.novos.length === 1 ? "horário" : "horários"}` : "Escolha os horários"}
      </Button>
      {plano.pulados.length > 0 && (
        <p className="mt-2 text-[11.5px] font-body text-muted-foreground leading-relaxed">
          Já existem e ficam como estão: {juntarE(plano.pulados)}. Pra tirar um horário, toque nele no calendário.
        </p>
      )}
      {!temSemana && horas.size > 0 && (
        <button type="button" onClick={() => void onSalvarSemana([...new Set(dias.map(dowDe))].sort(), [...horas].sort(ordenaHoras), dur)}
          className="mt-2 w-full text-[12px] font-body font-bold text-blue-700 hover:underline inline-flex items-center justify-center gap-1.5">
          <Repeat className="h-3.5 w-3.5" /> Usar estes horários toda semana
        </button>
      )}
    </div>
  );
}

/* Tocar num horário: quem marcou, quando, ideias, recado e as ações. */
function DetalheHorario({ slot, nomePorId, hoje, onFechar, onAbrirPasta, onMensagem }: {
  slot: SlotCaptacao; nomePorId: Map<string, string>; hoje: string; onFechar: () => void;
  onAbrirPasta?: (crmClientId: string) => void; onMensagem: (p: PedidoCaptacao | null, s: SlotCaptacao) => void;
}) {
  const { remover } = useSlotsMutations();
  const { confirmar } = useDecidirPedido();
  const [praQuem, setPraQuem] = useState(false);
  const [sugerir, setSugerir] = useState(false);
  const p = pedidoAtivo(slot);
  const cliente = p ? nomePorId.get(p.crm_client_id) ?? "Cliente" : null;
  const si = situacao(slot, nomePorId);
  const pedidoCompleto = (): PedidoCaptacao | null => p ? {
    id: p.id, slot_id: slot.id, crm_client_id: p.crm_client_id, ideias: p.ideias, recado: p.recado, status: p.status,
    capture_id: p.capture_id, created_at: p.created_at, decidido_em: null,
    slot: { dia: slot.dia, hora: slot.hora, duracao: slot.duracao, local: slot.local },
  } : null;

  const onConfirmar = async () => {
    if (!p) return;
    const capId = await confirmar.mutateAsync(p.id);
    toast.success("Captação confirmada e colocada na pasta do cliente");
    const pc = pedidoCompleto();
    onMensagem(pc ? { ...pc, status: "confirmado", capture_id: capId ?? pc.capture_id } : null, slot);
  };

  if (praQuem) return <PraQuem slot={slot} onFechar={() => { setPraQuem(false); onFechar(); }} />;
  if (sugerir && p) return <SugerirOutro pedido={pedidoCompleto()!} hoje={hoje} onFechar={onFechar} />;

  const pedidoEm = p ? new Date(p.created_at) : null;
  const rotulo = "text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground pt-0.5";
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span className="truncate">{cliente ?? (slot.para_todos ? "Horário livre" : "Horário reservado")}</span>
            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold", si.cls)}>
              {slot.status === "livre" ? (slot.para_todos ? "livre pra todos" : "livre") : si.sub}
            </span>
          </DialogTitle>
        </DialogHeader>
        <dl className="grid grid-cols-[70px_1fr] gap-x-3 gap-y-2 text-[13px] font-body">
          <dt className={rotulo}>Quando</dt>
          <dd>{dataLonga(slot.dia)} · {faixaDeHorario(slot.hora, slot.duracao)}</dd>
          {slot.local && <><dt className={rotulo}>Local</dt><dd>{slot.local}</dd></>}
          {p?.ideias && <><dt className={rotulo}>Ideias</dt><dd>{p.ideias}</dd></>}
          {p?.recado && <><dt className={rotulo}>Recado</dt><dd>{p.recado}</dd></>}
          {pedidoEm && (
            <><dt className={rotulo}>Pedido</dt>
            <dd>{pedidoEm.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às {pedidoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}, pelo link do cliente</dd></>
          )}
          {!p && !slot.para_todos && (
            <><dt className={rotulo}>Pra quem</dt>
            <dd>{slot.clientes.map((c) => nomePorId.get(c) ?? "Cliente").join(", ")}</dd></>
          )}
        </dl>
        <div className="flex flex-wrap gap-2 pt-1">
          {slot.status === "pedido" && p && (
            <>
              <Button size="sm" onClick={() => void onConfirmar()} disabled={confirmar.isPending} className="rounded-xl h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
                {confirmar.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />} Confirmar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSugerir(true)} className="rounded-xl h-9">Sugerir outro</Button>
            </>
          )}
          {slot.status === "confirmado" && p && (
            <Button size="sm" onClick={() => onMensagem(pedidoCompleto(), slot)} className="rounded-xl h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
              <MessageSquareText className="h-3.5 w-3.5 mr-1.5" /> Mensagem pro grupo
            </Button>
          )}
          {p && onAbrirPasta && (
            <Button size="sm" variant="outline" onClick={() => { onFechar(); onAbrirPasta(p.crm_client_id); }} className="rounded-xl h-9">
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" /> Abrir pasta
            </Button>
          )}
          {slot.status === "livre" && (
            <>
              <Button size="sm" variant="outline" onClick={() => setPraQuem(true)} className="rounded-xl h-9">
                <Users className="h-3.5 w-3.5 mr-1.5" /> Pra quem
              </Button>
              <Button size="sm" variant="outline" disabled={remover.isPending}
                onClick={() => void remover.mutateAsync(slot.id).then(() => { toast.success("Horário removido"); onFechar(); })}
                className="rounded-xl h-9 text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remover
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PraQuem({ slot, onFechar }: { slot: SlotCaptacao; onFechar: () => void }) {
  const { clients } = useNomes();
  const { editar } = useSlotsMutations();
  const [todos, setTodos] = useState(slot.para_todos);
  const [sel, setSel] = useState<Set<string>>(new Set(slot.clientes));
  const lista = clientesParaEscolher(clients);
  const salvar = async () => {
    if (!todos && sel.size === 0) { toast.message("Escolha pelo menos um cliente, ou deixe pra todos."); return; }
    await editar.mutateAsync({ id: slot.id, para_todos: todos, clientes: todos ? [] : [...sel] });
    onFechar();
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader><DialogTitle>Pra quem é {dataLonga(slot.dia)} às {horaCurta(slot.hora)}?</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {([[true, "Todos os clientes", "Aparece no link de todos."], [false, "Só clientes escolhidos", "Aparece só no link deles."]] as const).map(([v, t, d]) => (
            <button key={String(v)} type="button" onClick={() => setTodos(v)}
              className={cn("w-full text-left rounded-xl border px-3 py-2.5", todos === v ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10" : "border-border")}>
              <span className="block text-[13px] font-bold">{t}</span><span className="block text-[11.5px] text-muted-foreground">{d}</span>
            </button>
          ))}
          {!todos && (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border/60">
              {lista.map((c) => (
                <button key={c.id} type="button" onClick={() => setSel((p) => { const n = new Set(p); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-[13px]">
                  <span className={cn("h-4 w-4 rounded border grid place-items-center", sel.has(c.id) ? "bg-blue-600 border-blue-600" : "border-muted-foreground/40")}>
                    {sel.has(c.id) && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={() => void salvar()} disabled={editar.isPending} className="rounded-xl">Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarSemana({ onFechar }: { onFechar: () => void }) {
  const { data: config, salvar } = useConfigAgenda();
  const inicialDias = new Set((config?.semana ?? []).filter((d) => d.horas.length).map((d) => d.dow));
  const inicialHoras = [...new Set((config?.semana ?? []).flatMap((d) => d.horas))].sort(ordenaHoras);
  const [dias, setDias] = useState<Set<number>>(inicialDias);
  const [horas, setHoras] = useState<string[]>(inicialHoras);
  const [nova, setNova] = useState("");
  const [dur, setDur] = useState(config?.duracao ?? 2);
  const [local, setLocal] = useState(config?.local ?? "");

  const gravar = async () => {
    const ligado = dias.size > 0 && horas.length > 0;
    await salvar.mutateAsync({
      semana: ligado ? [...dias].sort().map((dow) => ({ dow, horas })) : [],
      duracao: dur, local: local.trim() || null,
    });
    toast.success(ligado ? "Atalho salvo" : "Atalho desligado");
    onFechar();
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader><DialogTitle>Repetir toda semana</DialogTitle></DialogHeader>
        <p className="text-[12.5px] text-muted-foreground -mt-2">
          É só um atalho: "Aplicar no mês" cria estes horários em todas as semanas do mês. Dá pra ajustar dia a dia depois.
        </p>
        <div className="space-y-4">
          <div>
            <p className="text-[12px] font-bold text-muted-foreground mb-1.5">Dias da semana</p>
            <div className="grid grid-cols-7 gap-1">
              {WD_CURTO.map((w, i) => (
                <button key={w} type="button" onClick={() => setDias((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                  className={cn("rounded-xl border py-2 text-[12px] font-bold", dias.has(i) ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200" : "border-border text-muted-foreground")}>
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[12px] font-bold text-muted-foreground mb-1.5">Horários</p>
            <div className="flex flex-wrap gap-1.5">
              {horas.map((h) => (
                <span key={h} className="inline-flex items-center gap-1 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200 px-2.5 py-1.5 text-[12.5px] font-bold">
                  {horaCurta(h)}
                  <button type="button" onClick={() => setHoras((p) => p.filter((x) => x !== h))} aria-label={`Tirar ${h}`}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              <Input type="time" value={nova} onChange={(e) => setNova(e.target.value)} className="h-9 rounded-xl" />
              <Button size="sm" variant="outline" className="h-9 rounded-xl" disabled={!nova}
                onClick={() => { if (/^\d{2}:\d{2}$/.test(nova) && !horas.includes(nova)) setHoras((p) => [...p, nova].sort(ordenaHoras)); setNova(""); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> horário
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[12px] font-bold text-muted-foreground mb-1.5">Duração</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((h) => (
                  <button key={h} type="button" onClick={() => setDur(h)}
                    className={cn("flex-1 rounded-xl border py-2 text-[12px] font-bold", dur === h ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200" : "border-border text-muted-foreground")}>
                    {h}h
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[12px] font-bold text-muted-foreground mb-1.5">Local padrão (opcional)</p>
              <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: no cliente" className="h-9 rounded-xl" />
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={() => void gravar()} disabled={salvar.isPending} className="rounded-xl">Salvar atalho</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sugerir outro horário ───────────────────────────────────────────────── */

function SugerirOutro({ pedido, hoje, onFechar }: { pedido: PedidoCaptacao; hoje: string; onFechar: () => void }) {
  const { nomePorId } = useNomes();
  const { recusar } = useDecidirPedido();
  const mesAtual = hoje.slice(0, 7);
  const { data: s1 = [] } = useSlotsDoMes(mesAtual);
  const { data: s2 = [] } = useSlotsDoMes(addMes(mesAtual, 1));
  const [texto, setTexto] = useState<string | null>(null);

  const executar = async () => {
    await recusar.mutateAsync(pedido.id);
    const nome = nomePorId.get(pedido.crm_client_id) ?? "";
    const livres = livresDoCliente([...s1, ...s2], pedido.crm_client_id, hoje).filter((s) => s.id !== pedido.slot_id).slice(0, 5);
    const link = await linkDoCliente(pedido.crm_client_id);
    const linhas = [
      `Oi${nome ? `, ${primeiroNome(nome)}` : ""}! Esse horário não vai dar.`,
      livres.length ? "Tenho estes livres:" : "Vou liberar novos horários e te aviso.",
      ...livres.map((s) => `· ${dataPorExtenso(s.dia)}, ${horaCurta(s.hora)}`),
    ];
    setTexto([linhas.join("\n"), link ? `Escolhe pelo link: ${link}` : ""].filter(Boolean).join("\n\n"));
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader><DialogTitle>Sugerir outro horário</DialogTitle></DialogHeader>
        {texto == null ? (
          <>
            <p className="text-[13px] text-muted-foreground">
              O horário de {pedido.slot ? `${dataLonga(pedido.slot.dia)} às ${horaCurta(pedido.slot.hora)}` : "este pedido"} volta a ficar livre
              e eu monto uma mensagem com outros horários livres do cliente.
            </p>
            <DialogFooter>
              <Button onClick={() => void executar()} disabled={recusar.isPending} className="rounded-xl">
                {recusar.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Liberar e montar mensagem
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <BolhaWhatsApp valor={texto} onChange={setTexto} />
            <DialogFooter>
              <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => void navigator.clipboard.writeText(texto).then(() => toast.success("Mensagem copiada"), () => toast.error("Não consegui copiar"))}>
                <Copy className="h-4 w-4 mr-1.5" /> Copiar mensagem
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Pedidos ──────────────────────────────────────────────────────────────── */

function AbaPedidos({ pedidos, hoje, onMensagem }: { pedidos: PedidoCaptacao[]; hoje: string; onMensagem: (p: PedidoCaptacao) => void }) {
  const { nomePorId } = useNomes();
  const { confirmar } = useDecidirPedido();
  const [verDecididos, setVerDecididos] = useState(false);
  const [sugerir, setSugerir] = useState<PedidoCaptacao | null>(null);

  const pendentes = pedidos.filter((p) => p.status === "pendente");
  const decididos = pedidos.filter((p) => p.status !== "pendente");

  const onConfirmar = async (p: PedidoCaptacao) => {
    const capId = await confirmar.mutateAsync(p.id);
    toast.success("Captação confirmada e colocada na pasta do cliente");
    onMensagem({ ...p, status: "confirmado", capture_id: capId ?? p.capture_id });
  };

  return (
    <div className="space-y-3">
      {pendentes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
          <Inbox className="h-6 w-6 mx-auto text-muted-foreground" />
          <p className="mt-2 text-[13px] font-body font-bold">Nenhum pedido esperando você</p>
          <p className="text-[12px] text-muted-foreground">Quando um cliente escolher um horário pelo link, ele aparece aqui e você recebe um aviso.</p>
        </div>
      )}
      {pendentes.map((p) => (
        <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[14px] font-body font-bold truncate">{nomePorId.get(p.crm_client_id) ?? "Cliente"}</p>
              <p className="text-[12.5px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> {p.slot ? `${dataLonga(p.slot.dia)} · ${faixaDeHorario(p.slot.hora, p.slot.duracao)}` : "horário removido"}
              </p>
              {p.slot?.local && <p className="text-[12px] text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.slot.local}</p>}
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200 px-2.5 py-1 text-[10.5px] font-bold">esperando</span>
          </div>
          {p.ideias && <p className="mt-2 text-[13px]"><span className="text-[10.5px] font-bold text-muted-foreground tracking-wider mr-1.5">IDEIAS</span>{p.ideias}</p>}
          {p.recado && <p className="mt-1 text-[13px]"><span className="text-[10.5px] font-bold text-muted-foreground tracking-wider mr-1.5">RECADO</span>{p.recado}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void onConfirmar(p)} disabled={confirmar.isPending || !p.slot}
              className="rounded-xl h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Check className="h-3.5 w-3.5 mr-1.5" /> Confirmar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSugerir(p)} className="rounded-xl h-9">Sugerir outro</Button>
          </div>
        </div>
      ))}

      {decididos.length > 0 && (
        <div className="rounded-2xl border border-border bg-card">
          <button type="button" onClick={() => setVerDecididos((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 text-[13px] font-bold">
            Decididos nos últimos 30 dias <span className="text-muted-foreground font-normal">{decididos.length} · {verDecididos ? "fechar" : "ver"}</span>
          </button>
          {verDecididos && (
            <div className="border-t border-border divide-y divide-border/60">
              {decididos.map((p) => (
                <div key={p.id} className="px-4 py-2.5 flex items-center gap-2 text-[12.5px]">
                  <span className="flex-1 min-w-0 truncate"><b>{nomePorId.get(p.crm_client_id) ?? "Cliente"}</b> · {p.slot ? `${dataLonga(p.slot.dia)} ${horaCurta(p.slot.hora)}` : ""}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", p.status === "confirmado" ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground")}>
                    {p.status === "confirmado" ? "confirmada" : "outro horário"}
                  </span>
                  {p.status === "confirmado" && (
                    <button type="button" onClick={() => onMensagem(p)}
                      className="text-emerald-700 font-bold inline-flex items-center gap-1"><MessageSquareText className="h-3.5 w-3.5" /> Mensagem</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {sugerir && <SugerirOutro pedido={sugerir} hoje={hoje} onFechar={() => setSugerir(null)} />}
    </div>
  );
}

/* ─── Mensagem pro grupo ──────────────────────────────────────────────────── */

function BolhaWhatsApp({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-2xl bg-[#EFE7DE] dark:bg-[#1f2c33] p-3">
      <Textarea value={valor} onChange={(e) => onChange(e.target.value)} rows={Math.min(18, Math.max(8, valor.split("\n").length + 1))}
        aria-label="Mensagem pro grupo (dá pra editar)"
        className="resize-none rounded-xl border-0 bg-[#D9FDD3] dark:bg-[#005c4b] text-[13.5px] leading-relaxed text-[#111b21] dark:text-white shadow-sm focus-visible:ring-1 focus-visible:ring-emerald-400" />
    </div>
  );
}

function MensagemGrupo({ pedido, slot, onFechar }: { pedido: PedidoCaptacao | null; slot: SlotCaptacao | null; onFechar: () => void }) {
  const { nomePorId } = useNomes();
  const { data: config, salvar } = useConfigAgenda();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { teamAccounts, managedAccounts } = useActiveAccount();
  const mgr = useAgendaConta();
  const dia = pedido?.slot?.dia ?? slot?.dia ?? "";
  const hora = pedido?.slot?.hora ?? slot?.hora ?? "";
  const duracao = pedido?.slot?.duracao ?? slot?.duracao ?? 2;
  const local = pedido?.slot?.local ?? slot?.local ?? null;
  const crmId = pedido?.crm_client_id ?? null;
  const cliente = crmId ? nomePorId.get(crmId) ?? "" : "";

  // Títulos dos roteiros ligados a essa captação + link de roteiros do cliente no mês.
  const { data: extra } = useQuery({
    queryKey: ["captacao-msg-extra", pedido?.capture_id ?? null, crmId, dia.slice(0, 7)],
    enabled: !!crmId,
    queryFn: async () => {
      let roteiros: string[] = [];
      if (pedido?.capture_id) {
        const { data } = await sbFrom("capture_scripts").select("title, position").eq("capture_id", pedido.capture_id).order("position");
        roteiros = ((data ?? []) as { title: string | null }[]).map((r) => (r.title ?? "").trim()).filter(Boolean);
      }
      let linkRoteiros: string | null = null;
      const { data: ap } = await sbFrom("script_approvals").select("token, month, created_at")
        .eq("crm_client_id", crmId).order("created_at", { ascending: false }).limit(5);
      const lista = (ap ?? []) as { token: string | null; month: string | null }[];
      const doMes = lista.find((a) => (a.month ?? "").slice(0, 7) === dia.slice(0, 7)) ?? lista[0];
      if (doMes?.token) linkRoteiros = `${window.location.origin}/roteiros/${doMes.token}`;
      return { roteiros, linkRoteiros };
    },
  });

  const contaPropria = mgr === user?.id;
  const nomeConta = contaPropria
    ? (profile?.name ?? "")
    : ([...teamAccounts, ...managedAccounts].find((a) => a.owner_id === mgr)?.name ?? "");
  const quem = primeiroNome(profile?.name);
  const assinatura = contaPropria ? (profile?.name ?? "") : [quem, nomeConta].filter(Boolean).join(" · ");

  const [opcoes, setOpcoes] = useState<OpcoesMsg>(OPCOES_PADRAO);
  const [checklist, setChecklist] = useState(CHECKLIST_PADRAO.join("\n"));
  const [editModelo, setEditModelo] = useState(false);
  const [texto, setTexto] = useState("");
  const [mexeu, setMexeu] = useState(false);
  useEffect(() => {
    if (!config) return;
    setOpcoes({ ...OPCOES_PADRAO, ...(config.msg_opcoes ?? {}) });
    setChecklist((config.checklist?.length ? config.checklist : CHECKLIST_PADRAO).join("\n"));
  }, [config]);

  const gerado = useMemo(() => (dia && hora ? montarMensagemGrupo({
    cliente, dia, hora, duracao, local, ideias: pedido?.ideias, roteiros: extra?.roteiros ?? [],
    linkRoteiros: extra?.linkRoteiros ?? null, checklist: checklist.split("\n"), opcoes, assinatura,
  }) : ""), [cliente, dia, hora, duracao, local, pedido?.ideias, extra, checklist, opcoes, assinatura]);
  // Enquanto ela não editar o texto à mão, ele acompanha o modelo.
  useEffect(() => { if (!mexeu) setTexto(gerado); }, [gerado, mexeu]);

  const salvarModelo = async () => {
    await salvar.mutateAsync({ msg_opcoes: opcoes, checklist: checklist.split("\n").map((x) => x.trim()).filter(Boolean) });
    toast.success("Modelo salvo pras próximas");
    setMexeu(false);
    setEditModelo(false);
  };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); toast.success("Mensagem copiada"); } catch { toast.error("Não consegui copiar"); }
  };

  const ITENS: [keyof OpcoesMsg, string, boolean][] = [
    ["ideias", "Ideias do cliente", true],
    ["roteiros", "Roteiros dessa captação (títulos)", true],
    ["checklist", "Checklist \"pra deixar pronto\"", true],
    ["link_roteiros", "Link dos roteiros pro cliente", !!extra?.linkRoteiros],
    ["assinatura", "Assinatura", true],
  ];

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className={cn("rounded-2xl max-h-[92vh] overflow-y-auto", editModelo ? "max-w-3xl" : "max-w-md")}>
        <DialogHeader>
          <DialogTitle>Mensagem pro grupo{cliente ? ` · ${cliente}` : ""}</DialogTitle>
        </DialogHeader>
        <p className="text-[12.5px] text-muted-foreground -mt-2">Assim que vai ficar no WhatsApp. Pode editar antes de copiar.</p>
        <div className={cn("grid gap-4", editModelo && "md:grid-cols-[1fr_300px]")}>
          <BolhaWhatsApp valor={texto} onChange={(v) => { setTexto(v); setMexeu(true); }} />
          {editModelo && (
            <div className="space-y-1">
              <p className="text-[13px] font-bold">Editar modelo</p>
              <p className="text-[11.5px] text-muted-foreground mb-2">Liga e desliga o que entra. Vale pras próximas mensagens.</p>
              {ITENS.filter(([, , mostra]) => mostra).map(([k, l]) => (
                <div key={k} className="flex items-center justify-between gap-3 py-1.5 border-b border-dashed border-border text-[12.5px]">
                  <span>{l}</span>
                  <button type="button" role="switch" aria-checked={opcoes[k]} aria-label={l}
                    onClick={() => { setOpcoes((o) => ({ ...o, [k]: !o[k] })); setMexeu(false); }}
                    className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", opcoes[k] ? "bg-emerald-600" : "bg-muted-foreground/30")}>
                    <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", opcoes[k] ? "left-[18px]" : "left-0.5")} />
                  </button>
                </div>
              ))}
              <p className="text-[12px] font-bold text-muted-foreground pt-2">Checklist (um por linha)</p>
              <Textarea value={checklist} onChange={(e) => { setChecklist(e.target.value); setMexeu(false); }} rows={4} className="rounded-xl text-[12.5px]" />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {editModelo
            ? <Button variant="outline" className="rounded-xl" onClick={() => void salvarModelo()} disabled={salvar.isPending}>Salvar modelo</Button>
            : <Button variant="outline" className="rounded-xl" onClick={() => setEditModelo(true)}><Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar modelo</Button>}
          <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => void copiar()} disabled={!texto}>
            <Copy className="h-4 w-4 mr-1.5" /> Copiar mensagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Links ────────────────────────────────────────────────────────────────── */

function AbaLinks({ ym, hoje }: { ym: string; hoje: string }) {
  const { clients } = useNomes();
  const { data: links = [] } = useLinksCaptacao();
  const { data: slots = [] } = useSlotsDoMes(ym);
  const qc = useQueryClient();
  const mgr = useAgendaConta();
  const [copiando, setCopiando] = useState<string | null>(null);
  const lista = clientesParaEscolher(clients);
  const temLink = new Set(links.map((l) => l.crm_client_id));
  const livresTodos = slots.filter((s) => s.status === "livre" && s.dia >= hoje && s.para_todos).length;

  const copiar = async (id: string, nome: string) => {
    setCopiando(id);
    await copiarLinkDoCliente(id, nome);
    setCopiando(null);
    qc.invalidateQueries({ queryKey: ["captacao-links", mgr] });
  };

  return (
    <div className="rounded-2xl border border-border bg-card">
      <p className="px-4 pt-4 text-[12.5px] text-muted-foreground">
        Cada cliente tem o link dele: abre com o nome, sem ele digitar nada, e mostra os horários de todos mais os reservados pra ele.
      </p>
      <div className="mt-2 divide-y divide-border/60">
        {lista.map((c) => {
          const exclusivos = slots.filter((s) => s.status === "livre" && s.dia >= hoje && !s.para_todos && s.clientes.includes(c.id)).length;
          return (
            <div key={c.id} className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-bold truncate">{c.name}</p>
                <p className="text-[11.5px] text-muted-foreground">
                  {livresTodos + exclusivos} {livresTodos + exclusivos === 1 ? "horário livre" : "horários livres"} em {MESES[Number(ym.slice(5, 7)) - 1]}
                  {exclusivos > 0 ? ` · ${exclusivos} só dele` : ""}{temLink.has(c.id) ? "" : " · link ainda não criado"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <PreviaWhatsApp obterUrl={() => linkDoCliente(c.id)} />
                <Button size="sm" variant="outline" onClick={() => void copiar(c.id, c.name)} disabled={copiando === c.id} className="rounded-xl h-9">
                  {copiando === c.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />} Copiar
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
