import { useEffect, useMemo, useState } from "react";
import { Plus, Calendar as CalendarIcon, CalendarDays, AlertTriangle, Trash2, ListTodo, CheckCircle2, Circle, X, ChevronDown } from "lucide-react";
import {
  useCrmTasks, useCreateCrmTask, useUpdateCrmTask, useDeleteCrmTask,
  useCrmClients, useCrmLeads, CRM_TASK_PRIORITY_LABELS,
  type CrmTask, type CrmTaskInput, type CrmTaskStatus, type CrmTaskPriority,
} from "@/hooks/useCrm";
import { ViewToggle, type BoardView } from "@/components/shared/ViewToggle";
import { corDaTarefa } from "@/lib/cores-agenda";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { confirmar } from "@/components/shared/Confirm";
import { hojeBR, parseDateOnly } from "@/lib/date-br";

const COLUMNS: { key: CrmTaskStatus; label: string }[] = [
  { key: "pendente", label: "Pendentes" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "concluida", label: "Concluídas" },
];
const PRIO_CLASS: Record<CrmTaskPriority, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-secondary text-secondary-foreground",
  alta: "bg-primary/10 text-primary",
  urgente: "bg-destructive/10 text-destructive",
};
const shortDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
type ViewFilter = "todas" | "atrasadas" | "hoje" | "semana" | "concluidas";

// ── Filtro por PERÍODO (due_date). Complementa os chips Todas/Atrasadas/Hoje/etc:
// aqui a pessoa recorta uma JANELA de prazo (próximos N dias ou intervalo de/até).
// Persiste por dispositivo pra voltar do jeito que ficou, até limpar.
const PERIODO_KEY = "criagestao_tarefas_periodo";
const PERIODO_DIAS: Record<string, number> = { "7": 7, "15": 15, "30": 30 };
type PeriodoFilter = {
  preset: "all" | "7" | "15" | "30" | "custom"; // "próximos N dias" ou intervalo
  from: string; // YYYY-MM-DD (só quando preset = custom)
  to: string;   // YYYY-MM-DD (só quando preset = custom)
};
const PERIODO_DEFAULT: PeriodoFilter = { preset: "all", from: "", to: "" };

// Soma dias a uma data YYYY-MM-DD e devolve outra YYYY-MM-DD (sem passar por UTC).
function isoAddDays(base: string, days: number): string {
  const d = parseDateOnly(base);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Lê o período salvo, validando o preset pra não quebrar com lixo no localStorage.
function loadPeriodo(): PeriodoFilter {
  try {
    const raw = localStorage.getItem(PERIODO_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<PeriodoFilter>;
      const presets = ["all", "7", "15", "30", "custom"];
      return {
        preset: (presets.includes(p.preset as string) ? p.preset : "all") as PeriodoFilter["preset"],
        from: typeof p.from === "string" ? p.from : "",
        to: typeof p.to === "string" ? p.to : "",
      };
    }
  } catch { /* segue */ }
  return { ...PERIODO_DEFAULT };
}

// Intervalo efetivo (YYYY-MM-DD) do período. "Próximos N dias" = janela inclusiva
// começando hoje (fuso BR). null = sem limite naquela ponta.
function periodoRange(f: PeriodoFilter): { from: string | null; to: string | null } {
  if (f.preset === "all") return { from: null, to: null };
  if (f.preset === "custom") return { from: f.from || null, to: f.to || null };
  const n = PERIODO_DIAS[f.preset] ?? 0;
  const from = hojeBR();
  return { from, to: isoAddDays(from, n - 1) };
}

// DD/MM só pra rótulo do chip. A string já é YYYY-MM-DD, dá pra fatiar direto.
function ddmm(iso: string): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// DD/MM/AAAA pra mostrar no gatilho do campo de data.
function ddmmyyyy(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Date -> YYYY-MM-DD montando pelos componentes locais (dia de calendário, sem UTC).
function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Visão de CALENDÁRIO (mesmo padrão do Cria Post: navegação de mês, célula do
// dia com "+" pra criar direto naquele dia, arrastar pra mudar o prazo).
const VIEW_KEY = "criagestao_tarefas_view";
const CAL_WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
// Semana começa no DOMINGO (padrão do iPhone/calendários BR).
function calWeekStart(d: Date) { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0, 0, 0, 0); return x; }
// Mês cheio estoura a célula no celular: só os primeiros aparecem, o resto vira "+N mais".
const MAX_POR_DIA = 3;
const PRIO_ORDER: Record<CrmTaskPriority, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
// Ordem dentro do dia: horário primeiro (tarefa com hora manda), depois prioridade.
function ordenaDoDia(a: CrmTask, b: CrmTask): number {
  const ta = a.due_time ?? "99:99", tb = b.due_time ?? "99:99";
  if (ta !== tb) return ta.localeCompare(tb);
  return (PRIO_ORDER[a.priority] ?? 9) - (PRIO_ORDER[b.priority] ?? 9);
}

// Campo de data visual: clica no campo -> abre o calendário shadcn num popover;
// seleciona o dia -> fecha e guarda como string YYYY-MM-DD (fuso BR, dia de calendário).
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseDateOnly(value) : undefined;
  return (
    <div className="flex-1 min-w-0">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-10 w-full items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm transition-colors hover:border-primary/50",
              value ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{value ? ddmmyyyy(value) : "dd/mm/aaaa"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(dt) => { if (dt) { onChange(isoFromDate(dt)); setOpen(false); } }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Rótulo do gatilho do popover conforme o período ativo.
function periodoLabel(f: PeriodoFilter): string {
  if (f.preset === "custom" && (f.from || f.to)) return `${ddmm(f.from) || "…"} – ${ddmm(f.to) || "…"}`;
  if (f.preset === "7") return "Próx. 7 dias";
  if (f.preset === "15") return "Próx. 15 dias";
  if (f.preset === "30") return "Próx. 30 dias";
  return "Período";
}

export function TasksTab() {
  const { data: tasks = [], isLoading } = useCrmTasks();
  const { data: clients = [] } = useCrmClients();
  const { data: leads = [] } = useCrmLeads();
  const updateTask = useUpdateCrmTask();
  const createTask = useCreateCrmTask();
  const delTask = useDeleteCrmTask();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CrmTask | null>(null);
  // Prazo já preenchido quando a tarefa nasce do "+" de um dia do calendário.
  const [novaDue, setNovaDue] = useState<string>("");
  const [view, setView] = useState<ViewFilter>("todas");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [periodo, setPeriodo] = useState<PeriodoFilter>(() => loadPeriodo());
  const [dragId, setDragId] = useState<string | null>(null);
  // Kanban (padrão) ou Calendário, igual ao Cria Post. Preferência salva por dispositivo.
  const [board, setBoard] = useState<BoardView>(() => {
    try { return (localStorage.getItem(VIEW_KEY) as BoardView) || "kanban"; } catch { return "kanban"; }
  });
  const setBoardPersist = (v: BoardView) => {
    setBoard(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* segue */ }
  };

  // Reaplica o período salvo no F5 até a pessoa limpar.
  useEffect(() => {
    try { localStorage.setItem(PERIODO_KEY, JSON.stringify(periodo)); } catch { /* segue */ }
  }, [periodo]);

  const today = hojeBR();
  const weekEnd = isoAddDays(today, 7);
  const range = periodoRange(periodo);
  const periodoAtivo = periodo.preset !== "all";

  const nameFor = (t: CrmTask) => {
    if (t.crm_client_id) return clients.find((c) => c.id === t.crm_client_id)?.name ?? "Cliente";
    if (t.crm_lead_id) return leads.find((l) => l.id === t.crm_lead_id)?.name ?? "Lead";
    return null;
  };
  /* A cor da FICHA do cliente pinta o chip do nome: bate o olho na lista e
     sabe de quem é cada tarefa, igual na agenda. Lead fica neutro (cor de
     lead é o item #105 do backlog). */
  const colorFor = (t: CrmTask) =>
    t.crm_client_id ? (clients.find((c) => c.id === t.crm_client_id)?.color ?? null) : null;
  const isLead = (t: CrmTask) => !t.crm_client_id && !!t.crm_lead_id;

  // Os chips (Todas/Atrasadas/Hoje/Esta semana/Concluídas) e o seletor de cliente valem
  // nas DUAS visões: ficam visíveis o tempo todo, então o recorte nunca é silencioso.
  // Já o PERÍODO é uma janela de datas, e no calendário quem manda nisso é a navegação
  // de mês; ele fica escondido e sem efeito lá (com um aviso, pra ninguém achar que sumiu).
  const { filtered, calendarTasks } = useMemo(() => {
    const base = tasks.filter((t) => {
      switch (view) {
        case "atrasadas": if (t.status === "concluida" || !t.due_date || t.due_date >= today) return false; break;
        case "hoje": if (t.status === "concluida" || t.due_date !== today) return false; break;
        case "semana": if (t.status === "concluida" || !t.due_date || t.due_date < today || t.due_date > weekEnd) return false; break;
        case "concluidas": if (t.status !== "concluida") return false; break;
      }
      if (clientFilter !== "all" && t.crm_client_id !== clientFilter) return false;
      return true;
    });
    const comPeriodo = (range.from || range.to)
      // Período (due_date): tarefa sem prazo não entra numa janela de datas.
      ? base.filter((t) => {
        if (!t.due_date) return false;
        if (range.from && t.due_date < range.from) return false;
        if (range.to && t.due_date > range.to) return false;
        return true;
      })
      : base;
    return { filtered: comPeriodo, calendarTasks: base };
  }, [tasks, view, today, weekEnd, clientFilter, range.from, range.to]);

  const counts = useMemo(() => ({
    todas: tasks.length,
    atrasadas: tasks.filter((t) => t.status !== "concluida" && t.due_date && t.due_date < today).length,
    hoje: tasks.filter((t) => t.status !== "concluida" && t.due_date === today).length,
    semana: tasks.filter((t) => t.status !== "concluida" && t.due_date && t.due_date >= today && t.due_date <= weekEnd).length,
    concluidas: tasks.filter((t) => t.status === "concluida").length,
  }), [tasks, today, weekEnd]);

  const pills: { v: ViewFilter; label: string }[] = [
    { v: "todas", label: "Todas" }, { v: "atrasadas", label: "Atrasadas" },
    { v: "hoje", label: "Hoje" }, { v: "semana", label: "Esta semana" }, { v: "concluidas", label: "Concluídas" },
  ];

  const handleDrop = async (status: CrmTaskStatus) => {
    const id = dragId; setDragId(null);
    if (!id) return;
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    await updateTask.mutateAsync({ id, status });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-display font-bold text-foreground flex items-center gap-2"><ListTodo className="h-4 w-4 text-primary" /> Tarefas dos clientes</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Kanban (padrão) / Calendário: as duas visões conversam, mudar o prazo reflete no card. */}
          <ViewToggle value={board} onChange={setBoardPersist} />
          <Button size="sm" onClick={() => { setEditing(null); setNovaDue(""); setDialogOpen(true); }}><Plus className="h-3.5 w-3.5 mr-1.5" /> Nova tarefa</Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Mobile: a barra de 5 chips não cabe em 390px; rola na horizontal em vez de estourar. */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-full p-0.5 max-w-full overflow-x-auto scrollbar-none">
          {pills.map((p) => (
            <button key={p.v} onClick={() => setView(p.v)}
              className={cn("px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all", view === p.v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {p.label}{counts[p.v] > 0 && <span className="ml-1 opacity-70">{counts[p.v]}</span>}
            </button>
          ))}
        </div>
        <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="h-8 rounded-full border border-input bg-card px-3 text-xs">
          <option value="all">Todos os clientes</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {/* Filtro por período do prazo (due_date). Fica num popover pra não estourar
            a linha no mobile: presets "próximos N dias" + intervalo específico.
            No calendário some: lá a janela de datas é o mês que está aberto. */}
        {board === "kanban" && (
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn("inline-flex items-center gap-1 h-8 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors", periodoAtivo ? "bg-primary text-primary-foreground border-primary" : "border-input bg-card text-muted-foreground hover:text-foreground")}>
              <CalendarDays className="h-3.5 w-3.5" />
              {periodoLabel(periodo)}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <p className="text-xs font-semibold text-foreground mb-2">Filtrar por prazo</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {([["7", "Próximos 7 dias"], ["15", "Próximos 15 dias"], ["30", "Próximos 30 dias"]] as [PeriodoFilter["preset"], string][]).map(([v, label]) => (
                <button key={v} onClick={() => setPeriodo((prev) => ({ ...prev, preset: v }))}
                  className={cn("text-xs font-medium px-2.5 py-1 rounded-full border transition-colors", periodo.preset === v ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs font-semibold text-foreground mb-2">Período específico</p>
            <div className="flex gap-2">
              <DateField label="De" value={periodo.from} onChange={(iso) => setPeriodo((prev) => ({ ...prev, from: iso, preset: "custom" }))} />
              <DateField label="Até" value={periodo.to} onChange={(iso) => setPeriodo((prev) => ({ ...prev, to: iso, preset: "custom" }))} />
            </div>
            {periodoAtivo && (
              <button onClick={() => setPeriodo({ ...PERIODO_DEFAULT })}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-3.5 w-3.5" /> Limpar período
              </button>
            )}
          </PopoverContent>
        </Popover>
        )}
        {/* O período continua salvo, só não vale aqui: melhor avisar do que a pessoa
            achar que o filtro sumiu (ou que o calendário está mostrando demais). */}
        {board === "calendario" && periodoAtivo && (
          <span className="text-[11px] text-muted-foreground">O filtro de período vale no kanban; aqui o recorte é o mês.</span>
        )}
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : board === "calendario" ? (
        <TasksCalendar
          tasks={calendarTasks}
          today={today}
          corDe={(t) => corDaTarefa(t, clients, leads)}
          nomeDe={nameFor}
          onOpen={(t) => { setEditing(t); setDialogOpen(true); }}
          onNewAt={(day) => { setEditing(null); setNovaDue(day); setDialogOpen(true); }}
          onMove={(id, day) => { const t = tasks.find((x) => x.id === id); if (t && t.due_date !== day) updateTask.mutate({ id, due_date: day }); }}
        />
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.key);
            return (
              <div key={col.key} onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(col.key)}>
                <div className="flex items-center gap-2 px-1 mb-2">
                  <h4 className="text-sm font-medium text-foreground">{col.label}</h4>
                  <Badge variant="secondary" className="text-[10px] h-5">{colTasks.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[120px] bg-muted/20 rounded-2xl p-2">
                  {colTasks.map((t) => {
                    const overdue = t.status !== "concluida" && !!t.due_date && t.due_date < today;
                    const nm = nameFor(t);
                    return (
                      <div key={t.id} draggable onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)}
                        onClick={() => { setEditing(t); setDialogOpen(true); }}
                        className={cn("rounded-xl border border-border bg-card p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all", dragId === t.id && "opacity-40")}>
                        <div className="flex items-start gap-2">
                          {/* Alvo de toque ~36px no mobile (margem negativa mantém o card compacto). */}
                          <button type="button" onClick={(e) => { e.stopPropagation(); updateTask.mutate({ id: t.id, status: t.status === "concluida" ? "pendente" : "concluida" }); }} className="-m-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors md:-m-0.5 md:h-6 md:w-6">
                            {t.status === "concluida" ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4" />}
                          </button>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <p className={cn("text-sm font-medium text-foreground", t.status === "concluida" && "line-through text-muted-foreground")}>{t.title}</p>
                            {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge className={cn("text-[10px] h-5", PRIO_CLASS[t.priority])}>{CRM_TASK_PRIORITY_LABELS[t.priority]}</Badge>
                              {nm && (
                                <Badge variant="outline" className="text-[10px] h-5 gap-1"
                                  style={colorFor(t) ? { borderColor: `${colorFor(t)}66`, background: `${colorFor(t)}14`, color: colorFor(t)! } : undefined}>
                                  {colorFor(t) && <span className="w-1.5 h-1.5 rounded-full" style={{ background: colorFor(t)! }} />}
                                  {isLead(t) ? "Lead: " : ""}{nm}
                                </Badge>
                              )}
                              {overdue && <Badge className="text-[10px] h-5 bg-destructive/10 text-destructive gap-0.5"><AlertTriangle className="h-2.5 w-2.5" />Atrasada</Badge>}
                            </div>
                            {t.due_date && <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><CalendarIcon className="h-3 w-3" />{shortDate(t.due_date)}</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {colTasks.length === 0 && <p className="text-center text-muted-foreground/50 text-xs py-8">Arraste tarefas aqui</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dialogOpen && (
        <TaskDialog
          key={editing?.id ?? `new:${novaDue}`}
          task={editing}
          defaultDue={novaDue}
          clients={clients}
          saving={createTask.isPending || updateTask.isPending}
          onClose={() => { setDialogOpen(false); setEditing(null); }}
          onCreate={async (input) => { await createTask.mutateAsync(input); setDialogOpen(false); }}
          onUpdate={async (id, u) => { await updateTask.mutateAsync({ id, ...u }); toast.success("Tarefa atualizada!"); setDialogOpen(false); setEditing(null); }}
          onDelete={async (id) => { if (await confirmar({ titulo: "Excluir esta tarefa?" })) { await delTask.mutateAsync(id); setDialogOpen(false); setEditing(null); } }}
        />
      )}
    </div>
  );
}

function TaskDialog({ task, defaultDue, clients, saving, onClose, onCreate, onUpdate, onDelete }: {
  task: CrmTask | null;
  // Prazo já preenchido quando a tarefa nasce do "+" de um dia do calendário.
  defaultDue?: string;
  clients: { id: string; name: string }[];
  saving: boolean;
  onClose: () => void;
  onCreate: (i: CrmTaskInput) => void;
  onUpdate: (id: string, u: Partial<CrmTaskInput>) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [clientId, setClientId] = useState(task?.crm_client_id ?? "");
  const [priority, setPriority] = useState<CrmTaskPriority>(task?.priority ?? "media");
  const [status, setStatus] = useState<CrmTaskStatus>(task?.status ?? "pendente");
  const [due, setDue] = useState(task?.due_date ?? defaultDue ?? "");
  // Horário existia na agenda mas não aqui, então tarefa criada ou editada
  // por esta aba nunca ganhava hora. Mesmo campo, mesma coluna (due_time).
  const [dueTime, setDueTime] = useState(task?.due_time ? task.due_time.slice(0, 5) : "");
  const [desc, setDesc] = useState(task?.description ?? "");

  const submit = () => {
    if (!title.trim()) { toast.error("Título é obrigatório."); return; }
    const base: CrmTaskInput = {
      title: title.trim(), crm_client_id: clientId || null, priority, status,
      due_date: due || null, due_time: dueTime || null, description: desc.trim() || null,
    };
    if (task) onUpdate(task.id, base); else onCreate(base);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display">{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="space-y-1.5"><Label className="text-xs">Título *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Gravar reels de quinta" className="rounded-xl" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Cliente</Label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm">
              <option value="">Sem cliente</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Prioridade</Label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as CrmTaskPriority)} className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm">
                <option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
              </select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Status</Label>
              <select value={status} onChange={(e) => setStatus(e.target.value as CrmTaskStatus)} className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm">
                <option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Prazo</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-xl" /></div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label className="text-xs">Horário</Label>
                {/* O input de hora do navegador não tem como esvaziar. */}
                {dueTime && <button type="button" onClick={() => setDueTime("")} className="text-[11px] font-body text-muted-foreground hover:text-destructive transition-colors">Limpar</button>}
              </div>
              <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Descrição</Label><Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} className="rounded-xl text-sm" /></div>
        </div>
        <div className="flex items-center justify-between gap-2 mt-5">
          {task ? <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(task.id)}><Trash2 className="h-4 w-4 mr-1.5" /> Excluir</Button> : <span />}
          <div className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={!title.trim() || saving}>{task ? "Salvar" : "Criar"}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Cartãozinho da tarefa dentro do calendário. Três estados bem diferentes entre si:
//   atrasada (vencida e não concluída) = borda/fundo vermelhos, é o que mais importa ver;
//   concluída = apagada e riscada;
//   pendente/em andamento = cartão normal.
// A faixa colorida da esquerda é a COR DA TAREFA (regra de @/lib/cores-agenda).
function CalTaskChip({ t, cor, nome, today, dragging, onDragStart, onDragEnd, onClick }: {
  t: CrmTask;
  cor: string;
  nome: string | null;
  today: string;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const done = t.status === "concluida";
  const atrasada = !done && !!t.due_date && t.due_date < today;
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{ borderLeftColor: cor }}
      className={cn(
        "w-full min-w-0 rounded-lg border border-l-[3px] px-1.5 py-1 text-left transition-shadow cursor-grab active:cursor-grabbing",
        atrasada ? "border-destructive/40 bg-destructive/5" : "border-border bg-card hover:bg-muted/40",
        done && "opacity-60",
        dragging && "opacity-50 shadow-lg",
      )}
    >
      <p className={cn("text-[11px] font-body font-semibold leading-tight truncate", done ? "line-through text-muted-foreground" : "text-foreground")}>
        {t.due_time ? `${t.due_time.slice(0, 5)} · ` : ""}{t.title}
      </p>
      <span className="mt-0.5 flex items-center gap-1 text-[9px] font-body text-muted-foreground">
        {done && <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-primary" />}
        {atrasada && <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-destructive" />}
        {atrasada && <span className="font-bold text-destructive shrink-0">Atrasada</span>}
        {nome && <span className="truncate">{nome}</span>}
      </span>
    </button>
  );
}

// Visão de CALENDÁRIO das tarefas, no mesmo padrão do Cria Post: navegação de mês
// (‹ mês ano › Hoje), célula do dia com "+" pra criar direto naquele dia e arraste
// pra mudar o prazo. A tarefa cai no dia do VENCIMENTO (due_date), o mesmo campo que
// o card do kanban mostra com o ícone de calendário.
function TasksCalendar({ tasks, today, corDe, nomeDe, onOpen, onNewAt, onMove }: {
  tasks: CrmTask[];
  today: string;
  corDe: (t: CrmTask) => string;
  nomeDe: (t: CrmTask) => string | null;
  onOpen: (t: CrmTask) => void;
  onNewAt: (day: string) => void;
  onMove: (id: string, day: string) => void;
}) {
  const [anchor, setAnchor] = useState(() => new Date());
  // Drag nativo (HTML5): mesma escolha do calendário do Cria Post.
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  // Tarefas sem prazo: contador discreto, abre pra ver e arrastar pra um dia.
  const [semDataOpen, setSemDataOpen] = useState(false);
  // Dia aberto pelo "+N mais" (célula não estoura no celular).
  const [dayModal, setDayModal] = useState<string | null>(null);

  const days = (() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = calWeekStart(first);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const end = calWeekStart(last); end.setDate(end.getDate() + 6);
    const n = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    return Array.from({ length: n }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  })();

  const byDay = new Map<string, CrmTask[]>();
  const semData: CrmTask[] = [];
  for (const t of tasks) {
    if (!t.due_date) { semData.push(t); continue; }
    const arr = byDay.get(t.due_date) ?? [];
    arr.push(t); byDay.set(t.due_date, arr);
  }
  for (const arr of byDay.values()) arr.sort(ordenaDoDia);

  const dropOn = (day: string) => { if (dragId) onMove(dragId, day); setDragId(null); setOverDay(null); };
  const chipProps = (t: CrmTask) => ({
    t, cor: corDe(t), nome: nomeDe(t), today,
    dragging: dragId === t.id,
    onDragStart: () => setDragId(t.id),
    onDragEnd: () => { setDragId(null); setOverDay(null); },
  });
  const doDia = dayModal ? (byDay.get(dayModal) ?? []) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setAnchor((a) => { const n = new Date(a); n.setMonth(n.getMonth() - 1); return n; })} aria-label="Mês anterior">‹</Button>
          <span className="text-sm font-display font-bold text-foreground px-2 capitalize">{anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setAnchor((a) => { const n = new Date(a); n.setMonth(n.getMonth() + 1); return n; })} aria-label="Próximo mês">›</Button>
          <Button variant="outline" size="sm" className="h-8 px-2 text-xs ml-1" onClick={() => setAnchor(new Date())}>Hoje</Button>
        </div>
      </div>

      <div className="hidden lg:grid lg:grid-cols-7 gap-2 mb-1">
        {CAL_WD.map((w) => <p key={w} className="text-[10px] uppercase tracking-wider font-body font-semibold text-muted-foreground text-center">{w}</p>)}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {days.map((d) => {
          const iso = isoFromDate(d);
          const list = byDay.get(iso) ?? [];
          const visiveis = list.slice(0, MAX_POR_DIA);
          const resto = list.length - visiveis.length;
          const isToday = iso === today;
          const outMonth = d.getMonth() !== anchor.getMonth();
          return (
            <div key={iso}
              onDragOver={(e) => { e.preventDefault(); if (overDay !== iso) setOverDay(iso); }}
              onDragLeave={() => setOverDay((o) => (o === iso ? null : o))}
              onDrop={() => dropOn(iso)}
              className={cn(
                "min-h-[104px] rounded-xl border p-2 flex flex-col gap-1.5 transition-colors",
                isToday ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-background",
                outMonth && "opacity-45",
                overDay === iso && "ring-2 ring-primary/40 border-primary/60 bg-primary/5",
              )}>
              <div className="flex items-center justify-between">
                <span className="flex items-baseline gap-1">
                  <span className={cn("text-sm font-display font-bold", isToday ? "text-primary" : "text-foreground")}>{d.getDate()}</span>
                  {/* No celular a grade tem 2 colunas, então o dia da semana ajuda a se localizar. */}
                  <span className="lg:hidden text-[9px] uppercase font-body text-muted-foreground">{CAL_WD[d.getDay()]}</span>
                </span>
                <button type="button" onClick={() => onNewAt(iso)} className="-m-1 grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors" aria-label="Nova tarefa neste dia"><Plus className="h-3.5 w-3.5" /></button>
              </div>
              {visiveis.map((t) => <CalTaskChip key={t.id} {...chipProps(t)} onClick={() => onOpen(t)} />)}
              {resto > 0 && (
                <button type="button" onClick={() => setDayModal(iso)} className="text-[10px] font-body font-semibold text-primary hover:underline text-left">
                  +{resto} mais
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Tarefa sem prazo não tem dia onde aparecer. Em vez de sumir calada, fica aqui
          o contador: abre a lista e dá pra arrastar pra um dia (ou clicar e editar). */}
      {semData.length > 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-border p-3">
          <button type="button" onClick={() => setSemDataOpen((o) => !o)} className="flex items-center gap-1.5 text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !semDataOpen && "-rotate-90")} />
            Sem data ({semData.length})
            <span className="normal-case tracking-normal font-normal">· arraste pra um dia</span>
          </button>
          {semDataOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
              {semData.map((t) => <CalTaskChip key={t.id} {...chipProps(t)} onClick={() => onOpen(t)} />)}
            </div>
          )}
        </div>
      )}

      {/* Dia cheio: a célula mostra os primeiros e o resto abre aqui. */}
      <Dialog open={!!dayModal} onOpenChange={(o) => { if (!o) setDayModal(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display capitalize">
              {dayModal ? parseDateOnly(dayModal).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-[12px] font-body text-muted-foreground -mt-2">{doDia.length} tarefa(s) · clique pra editar</p>
          <div className="space-y-1.5 mt-1 max-h-[60vh] overflow-y-auto">
            {doDia.map((t) => (
              <CalTaskChip key={t.id} {...chipProps(t)} onClick={() => { setDayModal(null); onOpen(t); }} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
