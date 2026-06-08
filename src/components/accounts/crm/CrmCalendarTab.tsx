import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";
import { useCrmTasks, useCrmLeads, useCrmClients } from "@/hooks/useCrm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Kind = "task" | "lead" | "renewal";
type CalEvent = { id: string; date: string; kind: Kind; title: string; meta: string; done?: boolean };

const KIND_DOT: Record<Kind, string> = { task: "bg-primary", lead: "bg-blue-500", renewal: "bg-amber-500" };
const KIND_CHIP: Record<Kind, string> = {
  task: "bg-primary/10 text-primary",
  lead: "bg-blue-500/10 text-blue-600",
  renewal: "bg-amber-500/10 text-amber-600",
};
const KIND_LABEL: Record<Kind, string> = { task: "Tarefa", lead: "Lead", renewal: "Renovação" };
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ymd = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function CrmCalendarTab() {
  const { data: tasks = [] } = useCrmTasks();
  const { data: leads = [] } = useCrmLeads();
  const { data: clients = [] } = useCrmClients();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selected, setSelected] = useState<string | null>(null);

  const events = useMemo<CalEvent[]>(() => {
    const out: CalEvent[] = [];
    tasks.forEach((t) => { if (t.due_date) out.push({ id: "t-" + t.id, date: t.due_date, kind: "task", title: t.title, meta: KIND_LABEL.task, done: t.status === "concluida" }); });
    leads.forEach((l) => { if (l.next_interaction_date && l.stage !== "fechado" && l.stage !== "perdido") out.push({ id: "l-" + l.id, date: l.next_interaction_date, kind: "lead", title: l.name, meta: "Próxima ação" }); });
    clients.forEach((c) => { if (c.renewal_date && c.active) out.push({ id: "r-" + c.id, date: c.renewal_date, kind: "renewal", title: c.name, meta: "Renovação de contrato" }); });
    return out;
  }, [tasks, leads, clients]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-display font-bold text-foreground flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Calendário</h3>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Tarefa</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Lead</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Renovação</span>
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
                      <div key={e.id} className={cn("text-[10px] px-1.5 py-0.5 rounded truncate flex items-center gap-1", KIND_CHIP[e.kind], e.done && "opacity-50 line-through")}>
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", KIND_DOT[e.kind])} />{e.title}
                      </div>
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
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelected(null)}><X className="h-3.5 w-3.5" /></Button>
            </div>
            {selectedEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nada neste dia</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((e) => (
                  <div key={e.id} className="rounded-xl bg-muted/40 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={cn("w-1.5 h-1.5 rounded-full", KIND_DOT[e.kind])} />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{KIND_LABEL[e.kind]}</span>
                    </div>
                    <p className={cn("text-sm font-medium text-foreground", e.done && "line-through text-muted-foreground")}>{e.title}</p>
                    <p className="text-[11px] text-muted-foreground">{e.meta}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
