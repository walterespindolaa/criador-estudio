import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarRange, ChevronLeft, ChevronRight, Copy, Check, Clock, Inbox, Link2, Loader2, MessageSquareText, Pencil, Plus, Repeat, Sparkles, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useCrmClients } from "@/hooks/useCrm";
import { clientesParaEscolher } from "@/lib/cliente-status";
import { hojeBR } from "@/lib/date-br";
import {
  MODELO_PADRAO, copiarLinkDoCliente, dataLonga, linkDoCliente, livresDoCliente, montarMensagem,
  useAgendaConta, useConfigAgenda, useDecidirPedido, useLinksCaptacao, usePedidosCaptacao, useSlotsDoMes, useSlotsMutations,
  type NovoSlot, type PedidoCaptacao, type SlotCaptacao,
} from "@/hooks/useAgendaCaptacao";

/* ═══════════════════════════════════════════════════════════════════════════
   AGENDA DE CAPTAÇÃO (Gabriela e Walter, 19/10/2026; mockup aprovado)

   "Só deixar mais facilitado como eu vou selecionar os horários disponíveis
   pra não ser um trabalho a mais pra social mídia." Por isso a liberação
   tem três atalhos e nenhum formulário longo:
   1. Semana padrão: marca uma vez os dias e horários; "Liberar o mês" cria tudo.
   2. Tocar no dia: liga e desliga horários ali mesmo.
   3. Repetir o mês passado: copia a grade pela posição na semana.
   ═══════════════════════════════════════════════════════════════════════════ */

const WD = ["D", "S", "T", "Q", "Q", "S", "S"];
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
const horaCurta = (h: string) => (h.endsWith(":00") ? `${h.slice(0, 2)}h` : h.replace(":", "h"));
const ordenaHoras = (a: string, b: string) => a.localeCompare(b);

type Aba = "calendario" | "pedidos" | "links";

export function AgendaCaptacao({ onVoltar, abaInicial = "calendario" }: { onVoltar: () => void; abaInicial?: Aba }) {
  const hoje = hojeBR();
  const [ym, setYm] = useState(hoje.slice(0, 7));
  const [aba, setAba] = useState<Aba>(abaInicial);
  const { data: pedidos = [] } = usePedidosCaptacao();
  const pendentes = pedidos.filter((p) => p.status === "pendente");

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

      {aba === "calendario" && <AbaCalendario ym={ym} setYm={setYm} hoje={hoje} />}
      {aba === "pedidos" && <AbaPedidos pedidos={pedidos} hoje={hoje} />}
      {aba === "links" && <AbaLinks ym={ym} hoje={hoje} />}
    </div>
  );
}

/* ─── Calendário ───────────────────────────────────────────────────────────── */

function AbaCalendario({ ym, setYm, hoje }: { ym: string; setYm: (v: string) => void; hoje: string }) {
  const { data: slots = [], isLoading } = useSlotsDoMes(ym);
  const { data: slotsAnt = [] } = useSlotsDoMes(addMes(ym, -1));
  const { data: config } = useConfigAgenda();
  const { adicionar } = useSlotsMutations();
  const { data: clients = [] } = useCrmClients();
  const nomePorId = useMemo(() => new Map(clients.map((c) => [c.id, c.name as string])), [clients]);
  const [editSemana, setEditSemana] = useState(false);
  // Fica aqui (e não dentro do popover do dia): o diálogo fecharia o popover e sumiria junto.
  const [praQuem, setPraQuem] = useState<SlotCaptacao | null>(null);

  const semana = config?.semana ?? [];
  const duracao = config?.duracao ?? 2;
  const local = config?.local ?? null;
  const temSemana = semana.some((d) => d.horas.length > 0);
  const resumoSemana = temSemana
    ? `${semana.filter((d) => d.horas.length).sort((a, b) => a.dow - b.dow).map((d) => WD_CURTO[d.dow]).join(", ")} · ${[...new Set(semana.flatMap((d) => d.horas))].sort(ordenaHoras).map(horaCurta).join(", ")} · ${duracao}h`
    : null;

  const porDia = useMemo(() => {
    const m = new Map<string, SlotCaptacao[]>();
    for (const s of slots) m.set(s.dia, [...(m.get(s.dia) ?? []), s]);
    return m;
  }, [slots]);

  const liberarMes = async () => {
    const novos: NovoSlot[] = [];
    for (let d = 1; d <= diasDoMes(ym); d++) {
      const dia = isoDia(ym, d);
      if (dia < hoje) continue;
      const cfg = semana.find((x) => x.dow === dowDe(dia));
      for (const h of cfg?.horas ?? []) {
        if (!porDia.get(dia)?.some((s) => s.hora === h)) novos.push({ dia, hora: h, duracao, local });
      }
    }
    if (!novos.length) { toast.message("Esse mês já está com a sua semana padrão liberada."); return; }
    await adicionar.mutateAsync(novos);
    toast.success(`${novos.length} ${novos.length === 1 ? "horário liberado" : "horários liberados"} em ${rotuloMes(ym)}`);
  };

  // Mesma posição na semana: 2ª terça do mês passado vira 2ª terça deste mês.
  const repetirMesPassado = async () => {
    const ant = addMes(ym, -1);
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
    if (!slotsAnt.length) { toast.message(`Não tinha horário liberado em ${rotuloMes(ant)}.`); return; }
    if (!novos.length) { toast.message("Nada novo pra copiar: esses horários já estão aqui ou já passaram."); return; }
    await adicionar.mutateAsync(novos);
    toast.success(`${novos.length} ${novos.length === 1 ? "horário copiado" : "horários copiados"} de ${rotuloMes(ant)}`);
  };

  const primeiroDow = dowDe(isoDia(ym, 1));
  const celulas: (number | null)[] = [...Array(primeiroDow).fill(null), ...[...Array(diasDoMes(ym))].map((_, i) => i + 1)];

  return (
    <div className="space-y-4">
      {/* SEMANA PADRÃO: o atalho que tira o trabalho repetido. */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/60 dark:bg-blue-500/10 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-body font-bold text-foreground flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5 text-blue-600" /> Sua semana padrão
            </p>
            <p className="text-[12.5px] font-body text-muted-foreground mt-0.5">
              {resumoSemana ?? "Marque uma vez os dias e horários em que você costuma gravar. Depois é um toque por mês."}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditSemana(true)} className="rounded-xl h-9 bg-card">
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> {temSemana ? "Editar" : "Montar semana"}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void liberarMes()} disabled={!temSemana || adicionar.isPending}
            className="rounded-xl h-9 bg-blue-600 hover:bg-blue-700 text-white">
            {adicionar.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
            Liberar {MESES[Number(ym.slice(5, 7)) - 1]}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void repetirMesPassado()} disabled={adicionar.isPending} className="rounded-xl h-9 bg-card">
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Repetir o mês passado
          </Button>
        </div>
      </div>

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
        <div className="grid grid-cols-7 gap-1">
          {WD.map((w, i) => <p key={i} className="text-center text-[10.5px] font-body font-bold text-muted-foreground py-1">{w}</p>)}
          {celulas.map((d, i) => d == null
            ? <span key={`v${i}`} />
            : <CelulaDia key={d} dia={isoDia(ym, d)} n={d} hoje={hoje} slots={porDia.get(isoDia(ym, d)) ?? []}
                semana={semana} duracao={duracao} local={local} nomePorId={nomePorId} onPraQuem={setPraQuem} />)}
        </div>
        {isLoading && <p className="text-[12px] text-muted-foreground mt-2">Carregando...</p>}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-body text-muted-foreground">
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-[3px] bg-blue-100 border border-blue-200" /> livre</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-[3px] bg-violet-100 border border-violet-200" /> só pra um cliente</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-[3px] bg-amber-100 border border-amber-200" /> pedido esperando você</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-[3px] bg-emerald-100 border border-emerald-200" /> confirmada</span>
          <span className="w-full">Toque num dia pra ligar ou desligar horários.</span>
        </div>
      </div>

      {editSemana && <EditarSemana onFechar={() => setEditSemana(false)} />}
      {praQuem && <PraQuem slot={praQuem} onFechar={() => setPraQuem(null)} />}
    </div>
  );
}

function corDoSlot(s: SlotCaptacao) {
  if (s.status === "confirmado") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200";
  if (s.status === "pedido") return "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200";
  if (!s.para_todos) return "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200";
  return "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200";
}

function CelulaDia({ dia, n, hoje, slots, semana, duracao, local, nomePorId, onPraQuem }: {
  dia: string; n: number; hoje: string; slots: SlotCaptacao[];
  semana: { dow: number; horas: string[] }[]; duracao: number; local: string | null; nomePorId: Map<string, string>;
  onPraQuem: (s: SlotCaptacao) => void;
}) {
  const passado = dia < hoje;
  const [aberto, setAberto] = useState(false);
  const conteudo = (
    <div className={cn("min-h-[54px] sm:min-h-[72px] rounded-xl border p-1 text-left transition-colors",
      passado ? "border-transparent bg-muted/30 opacity-60" : "border-border bg-background hover:border-blue-300",
      dia === hoje && "ring-1 ring-blue-400")}>
      <p className="text-[11px] font-body font-bold text-foreground/80 px-0.5">{n}</p>
      <div className="mt-0.5 space-y-0.5">
        {slots.slice(0, 3).map((s) => (
          <span key={s.id} className={cn("block truncate rounded-md px-1 py-[1px] text-[9.5px] sm:text-[10.5px] font-body font-bold", corDoSlot(s))}>
            {horaCurta(s.hora)}<span className="hidden sm:inline">{!s.para_todos && s.status === "livre" ? ` só ${(nomePorId.get(s.clientes[0]) ?? "").split(" ")[0]}` : ""}</span>
          </span>
        ))}
        {slots.length > 3 && <span className="block text-[9.5px] text-muted-foreground px-1">+{slots.length - 3}</span>}
      </div>
    </div>
  );
  if (passado) return conteudo;
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild><button type="button" className="w-full">{conteudo}</button></PopoverTrigger>
      <PopoverContent align="center" className="w-72 p-3 rounded-2xl">
        {aberto && <EditorDoDia dia={dia} slots={slots} semana={semana} duracao={duracao} local={local} nomePorId={nomePorId}
          onPraQuem={(s) => { setAberto(false); onPraQuem(s); }} />}
      </PopoverContent>
    </Popover>
  );
}

function EditorDoDia({ dia, slots, semana, duracao, local, nomePorId, onPraQuem }: {
  dia: string; slots: SlotCaptacao[]; semana: { dow: number; horas: string[] }[]; duracao: number; local: string | null; nomePorId: Map<string, string>;
  onPraQuem: (s: SlotCaptacao) => void;
}) {
  const { adicionar, remover } = useSlotsMutations();
  const [nova, setNova] = useState("");
  const daSemana = semana.find((d) => d.dow === dowDe(dia))?.horas ?? [];
  const sugeridas = [...new Set([...daSemana, ...semana.flatMap((d) => d.horas), "09:00", "14:00"])].sort(ordenaHoras).slice(0, 6);
  const existentes = new Map(slots.map((s) => [s.hora, s]));
  const chips = [...new Set([...sugeridas, ...slots.map((s) => s.hora)])].sort(ordenaHoras);

  const alternar = (h: string) => {
    const s = existentes.get(h);
    if (!s) { adicionar.mutate([{ dia, hora: h, duracao, local }]); return; }
    if (s.status !== "livre") { toast.message("Esse horário tem pedido. Resolve na aba Pedidos."); return; }
    remover.mutate(s.id);
  };
  const addNova = () => {
    if (!/^\d{2}:\d{2}$/.test(nova)) return;
    if (!existentes.has(nova)) adicionar.mutate([{ dia, hora: nova, duracao, local }]);
    setNova("");
  };

  return (
    <div>
      <p className="text-[13px] font-body font-bold mb-2">{dataLonga(dia)}</p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((h) => {
          const s = existentes.get(h);
          return (
            <button key={h} type="button" onClick={() => alternar(h)}
              className={cn("inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[12.5px] font-body font-bold transition-colors",
                s ? cn("border-transparent", corDoSlot(s)) : "border-dashed border-border text-muted-foreground hover:border-blue-300")}>
              {s ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}{horaCurta(h)}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5">
        <Input type="time" value={nova} onChange={(e) => setNova(e.target.value)} className="h-9 rounded-xl text-[13px]" aria-label="Outro horário" />
        <Button size="sm" variant="outline" onClick={addNova} disabled={!nova} className="h-9 rounded-xl">+ horário</Button>
      </div>
      {slots.length > 0 && (
        <div className="mt-3 border-t border-border pt-2 space-y-1.5">
          {slots.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-[12px] font-body">
              <span className="font-bold w-10">{horaCurta(s.hora)}</span>
              <span className="flex-1 truncate text-muted-foreground">
                {s.status === "confirmado" ? "confirmada" : s.status === "pedido" ? "pedido esperando"
                  : s.para_todos ? "todos os clientes" : `só ${s.clientes.map((c) => (nomePorId.get(c) ?? "?").split(" ")[0]).join(", ")}`}
              </span>
              {s.status === "livre" && (
                <>
                  <button type="button" onClick={() => onPraQuem(s)} className="text-blue-600 font-bold" title="Pra quem é esse horário">
                    <Users className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => remover.mutate(s.id)} className="text-muted-foreground hover:text-destructive" aria-label="Tirar horário">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PraQuem({ slot, onFechar }: { slot: SlotCaptacao; onFechar: () => void }) {
  const { data: clients = [] } = useCrmClients();
  const { editar } = useSlotsMutations();
  const [todos, setTodos] = useState(slot.para_todos);
  const [sel, setSel] = useState<Set<string>>(new Set(slot.clientes));
  const lista = clientesParaEscolher(clients as { id: string; name: string; status?: string | null; contract_end_date?: string | null }[]);
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
  const [dias, setDias] = useState<Set<number>>(inicialDias.size ? inicialDias : new Set([2, 4]));
  const [horas, setHoras] = useState<string[]>(inicialHoras.length ? inicialHoras : ["09:00", "14:00"]);
  const [nova, setNova] = useState("");
  const [dur, setDur] = useState(config?.duracao ?? 2);
  const [local, setLocal] = useState(config?.local ?? "");

  const gravar = async () => {
    if (!dias.size || !horas.length) { toast.message("Escolha pelo menos um dia e um horário."); return; }
    await salvar.mutateAsync({ semana: [...dias].sort().map((dow) => ({ dow, horas })), duracao: dur, local: local.trim() || null });
    toast.success("Semana padrão salva");
    onFechar();
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader><DialogTitle>Sua semana padrão</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-[12px] font-bold text-muted-foreground mb-1.5">Dias em que você grava</p>
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
                + horário
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
          <p className="text-[11.5px] text-muted-foreground">Depois, "Liberar o mês" cria todos esses horários de uma vez. Dá pra ajustar dia a dia tocando no calendário.</p>
        </div>
        <DialogFooter><Button onClick={() => void gravar()} disabled={salvar.isPending} className="rounded-xl">Salvar semana</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Pedidos ──────────────────────────────────────────────────────────────── */

function AbaPedidos({ pedidos, hoje }: { pedidos: PedidoCaptacao[]; hoje: string }) {
  const { data: clients = [] } = useCrmClients();
  const nomePorId = useMemo(() => new Map(clients.map((c) => [c.id, c.name as string])), [clients]);
  const { confirmar, recusar } = useDecidirPedido();
  const { data: config, salvar } = useConfigAgenda();
  const mesAtual = hoje.slice(0, 7);
  const { data: s1 = [] } = useSlotsDoMes(mesAtual);
  const { data: s2 = [] } = useSlotsDoMes(addMes(mesAtual, 1));
  const [msg, setMsg] = useState<{ titulo: string; texto: string; editaModelo?: boolean } | null>(null);
  const [verDecididos, setVerDecididos] = useState(false);

  const pendentes = pedidos.filter((p) => p.status === "pendente");
  const decididos = pedidos.filter((p) => p.status !== "pendente");
  const modelo = config?.modelo_msg || MODELO_PADRAO;

  const textoConfirmacao = (p: PedidoCaptacao) => montarMensagem(modelo, {
    cliente: nomePorId.get(p.crm_client_id) ?? "", dia: p.slot?.dia ?? hoje, hora: p.slot?.hora ?? "",
    duracao: p.slot?.duracao ?? 2, local: p.slot?.local, ideias: p.ideias,
  });

  const onConfirmar = async (p: PedidoCaptacao) => {
    await confirmar.mutateAsync(p.id);
    toast.success("Captação confirmada e colocada na pasta do cliente");
    setMsg({ titulo: "Mensagem pro grupo", texto: textoConfirmacao(p), editaModelo: true });
  };
  const onSugerir = async (p: PedidoCaptacao) => {
    await recusar.mutateAsync(p.id);
    const nome = nomePorId.get(p.crm_client_id) ?? "";
    const livres = livresDoCliente([...s1, ...s2], p.crm_client_id, hoje).filter((s) => s.id !== p.slot_id).slice(0, 5);
    const link = await linkDoCliente(p.crm_client_id);
    const linhas = livres.map((s) => `- ${dataLonga(s.dia)} às ${horaCurta(s.hora)}`);
    const texto = [
      `Oi${nome ? `, ${nome.split(" ")[0]}` : ""}! Esse horário não vai dar.`,
      livres.length ? "Tenho estes livres:" : "Vou liberar novos horários e te aviso.",
      ...linhas,
      link ? `Escolhe pelo link: ${link}` : "",
    ].filter(Boolean).join("\n");
    setMsg({ titulo: "Sugerir outro horário", texto });
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
                <Clock className="h-3 w-3" /> {p.slot ? `${dataLonga(p.slot.dia)} · ${horaCurta(p.slot.hora)} · ${p.slot.duracao}h` : "horário removido"}
              </p>
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
            <Button size="sm" variant="outline" onClick={() => void onSugerir(p)} disabled={recusar.isPending} className="rounded-xl h-9">
              Sugerir outro
            </Button>
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
                    <button type="button" onClick={() => setMsg({ titulo: "Mensagem pro grupo", texto: textoConfirmacao(p), editaModelo: true })}
                      className="text-emerald-700 font-bold inline-flex items-center gap-1"><MessageSquareText className="h-3.5 w-3.5" /> Mensagem</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {msg && (
        <MensagemPronta titulo={msg.titulo} texto={msg.texto} onFechar={() => setMsg(null)}
          modelo={msg.editaModelo ? modelo : null}
          onSalvarModelo={msg.editaModelo ? async (m) => { await salvar.mutateAsync({ modelo_msg: m }); toast.success("Modelo salvo"); } : undefined} />
      )}
    </div>
  );
}

function MensagemPronta({ titulo, texto, modelo, onFechar, onSalvarModelo }: {
  titulo: string; texto: string; modelo: string | null; onFechar: () => void; onSalvarModelo?: (m: string) => Promise<void>;
}) {
  const [valor, setValor] = useState(texto);
  const [editModelo, setEditModelo] = useState(false);
  const [mod, setMod] = useState(modelo ?? MODELO_PADRAO);
  useEffect(() => setValor(texto), [texto]);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(valor); toast.success("Mensagem copiada"); } catch { toast.error("Não consegui copiar"); }
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>
        {!editModelo ? (
          <Textarea value={valor} onChange={(e) => setValor(e.target.value)} rows={7}
            className="rounded-xl bg-emerald-50/60 dark:bg-emerald-500/10 border-emerald-200 text-[13.5px]" />
        ) : (
          <div className="space-y-2">
            <Textarea value={mod} onChange={(e) => setMod(e.target.value)} rows={7} className="rounded-xl text-[13px] font-mono" />
            <p className="text-[11.5px] text-muted-foreground">Use {"{cliente} {data} {hora} {duracao} {local} {ideias}"}. Linha com local ou ideias vazio some sozinha.</p>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          {modelo != null && onSalvarModelo && (
            editModelo
              ? <Button variant="outline" className="rounded-xl" onClick={() => void onSalvarModelo(mod).then(() => setEditModelo(false))}>Salvar modelo</Button>
              : <Button variant="outline" className="rounded-xl" onClick={() => setEditModelo(true)}>Editar modelo</Button>
          )}
          {!editModelo && <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => void copiar()}><Copy className="h-4 w-4 mr-1.5" /> Copiar mensagem</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Links ────────────────────────────────────────────────────────────────── */

function AbaLinks({ ym, hoje }: { ym: string; hoje: string }) {
  const { data: clients = [] } = useCrmClients();
  const { data: links = [] } = useLinksCaptacao();
  const { data: slots = [] } = useSlotsDoMes(ym);
  const qc = useQueryClient();
  const mgr = useAgendaConta();
  const [copiando, setCopiando] = useState<string | null>(null);
  const lista = clientesParaEscolher(clients as { id: string; name: string; status?: string | null; contract_end_date?: string | null }[]);
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
            <div key={c.id} className="px-4 py-2.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-bold truncate">{c.name}</p>
                <p className="text-[11.5px] text-muted-foreground">
                  {livresTodos + exclusivos} {livresTodos + exclusivos === 1 ? "horário livre" : "horários livres"} em {MESES[Number(ym.slice(5, 7)) - 1]}
                  {exclusivos > 0 ? ` · ${exclusivos} só dele` : ""}{temLink.has(c.id) ? "" : " · link ainda não criado"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void copiar(c.id, c.name)} disabled={copiando === c.id} className="rounded-xl h-9">
                {copiando === c.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />} Copiar
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
