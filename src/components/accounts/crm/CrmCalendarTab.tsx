import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Check, RotateCcw, X } from "lucide-react";
import {
  useCrmTasks, useCrmLeads, useCrmClients, useUpdateCrmTask,
  CRM_TASK_PRIORITY_LABELS, type CrmTask,
} from "@/hooks/useCrm";
import { clienteInativo } from "@/lib/cliente-status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* O calendário do Cria Gestão estava mudo (Walter, 30/08): item sem dizer de
   QUAL cliente era, clique que não abria nada, e tudo na cor padrão. Agora o
   evento carrega o cliente e a COR DA FICHA (mesmo padrão da agenda), e
   clicar numa tarefa abre o popup com o conteúdo e o botão de concluir. */

type Kind = "task" | "lead" | "renewal" | "birthday";
type CalEvent = {
  id: string; date: string; kind: Kind; title: string; meta: string; done?: boolean;
  cliente?: string | null; cor?: string | null; taskId?: string;
};

const KIND_DOT: Record<Kind, string> = { task: "bg-primary", lead: "bg-blue-500", renewal: "bg-amber-500", birthday: "bg-pink-500" };
const KIND_CHIP: Record<Kind, string> = {
  task: "bg-primary/10 text-primary",
  lead: "bg-blue-500/10 text-blue-600",
  renewal: "bg-amber-500/10 text-amber-600",
  birthday: "bg-pink-500/10 text-pink-600",
};
const KIND_LABEL: Record<Kind, string> = { task: "Tarefa", lead: "Lead", renewal: "Renovação", birthday: "Aniversário" };
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ymd = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Estilo do chip: a cor do cliente pinta fundo/texto; sem cor, o padrão do tipo. */
const chipStyle = (e: CalEvent) =>
  e.cor ? { background: `${e.cor}1f`, color: e.cor } : undefined;

export function CrmCalendarTab() {
  const { data: tasks = [] } = useCrmTasks();
  const { data: leads = [] } = useCrmLeads();
  const { data: clients = [] } = useCrmClients();
  const updateTask = useUpdateCrmTask();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selected, setSelected] = useState<string | null>(null);
  const [tarefaAberta, setTarefaAberta] = useState<CrmTask | null>(null);

  const events = useMemo<CalEvent[]>(() => {
    const out: CalEvent[] = [];
    tasks.forEach((t) => {
      if (!t.due_date) return;
      const cli = t.crm_client_id ? clients.find((c) => c.id === t.crm_client_id) : null;
      const lead = !cli && t.crm_lead_id ? leads.find((l) => l.id === t.crm_lead_id) : null;
      out.push({
        id: "t-" + t.id, taskId: t.id, date: t.due_date, kind: "task", title: t.title,
        meta: KIND_LABEL.task, done: t.status === "concluida",
        cliente: cli?.name ?? (lead ? `Lead: ${lead.name}` : null),
        // A tarefa pode ter cor própria (agenda); senão, herda a cor da FICHA
        // do cliente, o mesmo padrão da agenda de criação.
        cor: t.color ?? cli?.color ?? null,
      });
    });
    leads.forEach((l) => { if (l.next_interaction_date && l.stage !== "fechado" && l.stage !== "perdido") out.push({ id: "l-" + l.id, date: l.next_interaction_date, kind: "lead", title: l.name, meta: "Próxima ação" }); });
    clients.forEach((c) => { if (c.renewal_date && c.active) out.push({ id: "r-" + c.id, date: c.renewal_date, kind: "renewal", title: c.name, meta: "Renovação de contrato", cor: c.color ?? null }); });
    // Aniversário do cliente: repete todo ano, projeta no ano que o calendário está mostrando.
    // clienteInativo: encerramento agendado pro futuro ainda conta como ativo.
    clients.forEach((c) => {
      if (!c.birthday || clienteInativo(c)) return;
      const [, mm, dd] = c.birthday.split("-");
      if (!mm || !dd) return;
      out.push({ id: "b-" + c.id, date: `${cursor.y}-${mm}-${dd}`, kind: "birthday", title: c.name, meta: "Aniversário 🎂", cor: c.color ?? null });
    });
    return out;
  }, [tasks, leads, clients, cursor.y]);

  const byDate = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    events.forEach((e) => { const a = m.get(e.date) ?? []; a.push(e); m.set(e.date, a); });
    return m;
  }, [events]);

  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const firstDow = new Date(cursor.y, cursor.m, 1).getDay();
  const todayStr = new Date().toISOString().split("T")[0];

  const go = (delta: number) => {
    setSelected(null);
    setCursor((c) => { const d = new Date(c.y, c.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  };
  const goToday = () => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }); setSelected(null); };

  const selectedEvents = selected ? (byDate.get(selected) ?? []) : [];

  /** Tarefa clicada (na grade ou no painel do dia) abre o popup. */
  const abrirEvento = (e: CalEvent) => {
    if (e.kind !== "task" || !e.taskId) return;
    const t = tasks.find((x) => x.id === e.taskId);
    if (t) setTarefaAberta(t);
  };

  const clienteDaTarefa = (t: CrmTask) => {
    const cli = t.crm_client_id ? clients.find((c) => c.id === t.crm_client_id) : null;
    if (cli) return { nome: cli.name, cor: cli.color ?? null, lead: false };
    const lead = t.crm_lead_id ? leads.find((l) => l.id === t.crm_lead_id) : null;
    return lead ? { nome: lead.name, cor: null, lead: true } : null;
  };

  const alternarConclusao = async (t: CrmTask) => {
    const novo = t.status === "concluida" ? "pendente" : "concluida";
    await updateTask.mutateAsync({ id: t.id, status: novo });
    setTarefaAberta({ ...t, status: novo });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-display font-bold text-foreground flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Calendário</h3>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Tarefa</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Lead</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Renovação</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500" /> Aniversário</span>
            <span className="hidden md:inline text-muted-foreground/70">· item na cor da ficha do cliente</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>Hoje</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => go(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-medium text-sm min-w-[150px] text-center">{MONTHS[cursor.m]} {cursor.y}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => go(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex gap-4 flex-col lg:flex-row">
        <div className="flex-1 rounded-2xl border border-border bg-card p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DOW.map((d) => <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1.5">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDow }).map((_, i) => <div key={"e" + i} className="min-h-[84px] rounded-lg bg-muted/20" />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const ds = ymd(cursor.y, cursor.m, day);
              const evs = byDate.get(ds) ?? [];
              const isToday = ds === todayStr;
              const isSel = selected === ds;
              return (
                <button key={day} onClick={() => setSelected(isSel ? null : ds)}
                  className={cn("min-h-[84px] p-1.5 rounded-lg border text-left transition-all", isSel ? "border-primary bg-primary/5 ring-1 ring-primary/20" : isToday ? "border-primary/50 bg-primary/5" : "border-transparent hover:bg-muted/30")}>
                  <span className={cn("text-[11px] font-medium", isToday && "text-primary")}>{day}</span>
                  <div className="mt-0.5 space-y-0.5">
                    {evs.slice(0, 2).map((e) => (
                      // span clicável DENTRO do botão do dia: tarefa abre o
                      // popup direto; os outros tipos selecionam o dia.
                      <span key={e.id} role="button" tabIndex={0}
                        onClick={(ev) => { if (e.kind === "task") { ev.stopPropagation(); abrirEvento(e); } }}
                        onKeyDown={(ev) => { if (ev.key === "Enter" && e.kind === "task") { ev.stopPropagation(); abrirEvento(e); } }}
                        className={cn("text-[10px] px-1.5 py-0.5 rounded truncate flex items-center gap-1",
                          !e.cor && KIND_CHIP[e.kind], e.done && "opacity-50 line-through",
                          e.kind === "task" && "hover:ring-1 hover:ring-primary/30")}
                        style={chipStyle(e)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", !e.cor && KIND_DOT[e.kind])}
                          style={e.cor ? { background: e.cor } : undefined} />
                        <span className="truncate">
                          {e.title}
                          {e.cliente && <span className="opacity-70"> · {e.cliente}</span>}
                        </span>
                      </span>
                    ))}
                    {evs.length > 2 && <Badge variant="secondary" className="text-[9px] h-4 w-full justify-center">+{evs.length - 2}</Badge>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selected && (
          <div className="w-full lg:w-72 shrink-0 rounded-2xl border border-border bg-card p-4 self-start">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-display font-bold text-foreground">{new Date(selected + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}</p>
              <Button variant="ghost" size="icon" className="h-9 w-9 md:h-6 md:w-6" onClick={() => setSelected(null)}><X className="h-4 w-4 md:h-3.5 md:w-3.5" /></Button>
            </div>
            {selectedEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nada neste dia</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((e) => (
                  <button key={e.id} type="button" onClick={() => abrirEvento(e)}
                    className={cn("w-full text-left rounded-xl bg-muted/40 p-3 transition-colors",
                      e.kind === "task" && "hover:bg-muted/70 cursor-pointer")}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={cn("w-1.5 h-1.5 rounded-full", !e.cor && KIND_DOT[e.kind])}
                        style={e.cor ? { background: e.cor } : undefined} />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{KIND_LABEL[e.kind]}</span>
                      {e.cliente && (
                        <span className="ml-auto text-[10px] font-semibold truncate max-w-[120px]"
                          style={e.cor ? { color: e.cor } : undefined}>{e.cliente}</span>
                      )}
                    </div>
                    <p className={cn("text-sm font-medium text-foreground", e.done && "line-through text-muted-foreground")}>{e.title}</p>
                    <p className="text-[11px] text-muted-foreground">{e.kind === "task" ? "toque pra abrir" : e.meta}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── O POPUP DA TAREFA: o "o que é essa pendência?" respondido no clique ── */}
      <Dialog open={!!tarefaAberta} onOpenChange={(v) => !v && setTarefaAberta(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          {tarefaAberta && (() => {
            const quem = clienteDaTarefa(tarefaAberta);
            const concluida = tarefaAberta.status === "concluida";
            return (
              <div>
                <DialogTitle className={cn("font-display text-lg font-extrabold leading-tight pr-6", concluida && "line-through text-muted-foreground")}>
                  {tarefaAberta.title}
                </DialogTitle>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <Badge variant="secondary" className="text-[10px] h-5">{CRM_TASK_PRIORITY_LABELS[tarefaAberta.priority]}</Badge>
                  {quem && (
                    <Badge variant="outline" className="text-[10px] h-5 gap-1"
                      style={quem.cor ? { borderColor: `${quem.cor}66`, background: `${quem.cor}14`, color: quem.cor } : undefined}>
                      {quem.cor && <span className="w-1.5 h-1.5 rounded-full" style={{ background: quem.cor }} />}
                      {quem.lead ? "Lead: " : ""}{quem.nome}
                    </Badge>
                  )}
                  {tarefaAberta.due_date && (
                    <span className="text-[11px] text-muted-foreground">
                      {tarefaAberta.due_date.split("-").reverse().join("/")}
                      {tarefaAberta.due_time ? ` · ${tarefaAberta.due_time.slice(0, 5)}` : ""}
                    </span>
                  )}
                </div>
                {tarefaAberta.description?.trim() && (
                  <p className="text-[13px] font-body text-muted-foreground mt-3 whitespace-pre-line leading-relaxed bg-muted/40 border border-border rounded-xl px-3 py-2.5">
                    {tarefaAberta.description}
                  </p>
                )}
                <div className="flex gap-2 mt-4">
                  <Button className={cn("flex-1 rounded-xl", !concluida && "bg-green-600 hover:bg-green-700")}
                    variant={concluida ? "outline" : "default"}
                    disabled={updateTask.isPending}
                    onClick={() => void alternarConclusao(tarefaAberta)}>
                    {concluida ? <><RotateCcw className="h-4 w-4 mr-1.5" /> Reabrir</> : <><Check className="h-4 w-4 mr-1.5" /> Concluir</>}
                  </Button>
                </div>
                <p className="text-[10.5px] font-body text-muted-foreground mt-2">
                  Pra editar título, data ou cliente, use a aba Tarefas.
                </p>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
