import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Plus, X, Video, Loader2, Clock, MapPin, Users, ListChecks, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  useCrmClients, useCrmTasks, useUpdateCrmTask, useCreateCrmTask, useCrmLeads,
  CRM_TASK_PRIORITIES, CRM_TASK_PRIORITY_LABELS, CRM_TASK_STATUSES,
  type CrmTask, type CrmTaskPriority, type CrmTaskStatus,
} from "@/hooks/useCrm";
import {
  useCreations, useAddCreation, useUpdateCreation, useDeleteCreation,
  useCaptures, useAddCapture, useUpdateCapture, useDeleteCapture, useCollaboratorNames, type Capture, type Creation,
} from "@/hooks/useAgenda";
import { hojeBR, parseDateOnly } from "@/lib/date-br";

const WD = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
// Inverso de parseDateOnly: formata um Date de meia-noite LOCAL de volta para YYYY-MM-DD.
// Só usar com Dates construídos via parseDateOnly/mondayOf (aritmética de calendário).
function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function mondayOf(d: Date) { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); x.setHours(0, 0, 0, 0); return x; }
const shortDate = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
// Rótulos singulares pro select de status da tarefa (os do CRM são títulos de coluna, no plural).
const TASK_STATUS_LABELS: Record<CrmTaskStatus, string> = {
  pendente: "Pendente", em_andamento: "Em andamento", concluida: "Concluída",
};
const STATUS: Record<Capture["status"], { label: string; cls: string }> = {
  agendada: { label: "Agendada", cls: "bg-primary/10 text-primary" },
  concluida: { label: "Concluída", cls: "bg-secondary/15 text-secondary" },
  cancelada: { label: "Cancelada", cls: "bg-destructive/10 text-destructive" },
};

export default function AgendaCriacao() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => mondayOf(parseDateOnly(hojeBR())));
  // Visão: semana (padrão) ou mês. O mês usa a MESMA grade arrastável.
  const [view, setView] = useState<"semana" | "mes">(() => {
    try { return (localStorage.getItem("agenda_view") as "semana" | "mes") || "semana"; } catch { return "semana"; }
  });
  const setViewPersist = (v: "semana" | "mes") => {
    setView(v);
    try { localStorage.setItem("agenda_view", v); } catch { /* segue */ }
  };
  // Toggle: mostrar as tarefas dos clientes (CRM) na grade, persistido por dispositivo
  const [showTasks, setShowTasks] = useState(() => {
    try { return localStorage.getItem("agenda_show_tasks") === "1"; } catch { return false; }
  });
  const toggleTasks = (v: boolean) => {
    setShowTasks(v);
    try { localStorage.setItem("agenda_show_tasks", v ? "1" : "0"); } catch { /* segue */ }
  };
  // Semana = 7 dias a partir da segunda. Mês = grade completa (segunda a domingo) cobrindo o mês do anchor.
  const days = useMemo(() => {
    if (view === "semana") {
      return Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
    }
    const first = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
    const gridStart = mondayOf(first);
    const last = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 0);
    const gridEnd = mondayOf(last); gridEnd.setDate(gridEnd.getDate() + 6);
    const n = Math.round((gridEnd.getTime() - gridStart.getTime()) / 86400000) + 1;
    return Array.from({ length: n }, (_, i) => { const d = new Date(gridStart); d.setDate(d.getDate() + i); return d; });
  }, [weekStart, view]);
  const from = ymd(days[0]); const to = ymd(days[days.length - 1]);
  const today = hojeBR();
  const curMonth = weekStart.getMonth();

  const { data: clients = [] } = useCrmClients();
  const { data: leads = [] } = useCrmLeads();
  const createTask = useCreateCrmTask();
  const { data: teamNames = [] } = useCollaboratorNames();
  const { data: creations = [] } = useCreations(from, to);
  const addCreation = useAddCreation();
  const delCreation = useDeleteCreation();
  const { data: captures = [] } = useCaptures();
  const { data: crmTasks = [] } = useCrmTasks();
  const addCapture = useAddCapture();
  const updCapture = useUpdateCapture();
  const delCapture = useDeleteCapture();
  const updCreation = useUpdateCreation();
  const updTask = useUpdateCrmTask();
  const qc = useQueryClient();

  const [addDay, setAddDay] = useState<string | null>(null);
  const [capOpen, setCapOpen] = useState(false);
  const [editCap, setEditCap] = useState<Capture | null>(null);
  const [editTask, setEditTask] = useState<CrmTask | null>(null);
  const [editCreation, setEditCreation] = useState<Creation | null>(null);

  // Arrastar item pra outro dia: atualização otimista no cache + persistência conforme o tipo.
  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    const day = destination.droppableId; // droppableId = YYYY-MM-DD do dia
    const sep = draggableId.indexOf(":");
    const kind = draggableId.slice(0, sep);
    const id = draggableId.slice(sep + 1);
    const dest = parseDateOnly(day);
    const ok = () => toast.success(`Movido para ${WD[(dest.getDay() + 6) % 7].toUpperCase()} ${dest.getDate()}`);
    const fail = () => toast.error("Não consegui mover. Tente de novo.");
    if (kind === "cap") {
      qc.setQueriesData<Capture[]>({ queryKey: ["agenda-captures"] }, (old) => old?.map((c) => (c.id === id ? { ...c, capture_date: day } : c)));
      updCapture.mutate({ id, patch: { capture_date: day } }, { onSuccess: ok, onError: fail, onSettled: () => qc.invalidateQueries({ queryKey: ["agenda-captures"] }) });
    } else if (kind === "task") {
      qc.setQueriesData<CrmTask[]>({ queryKey: ["crm-tasks"] }, (old) => old?.map((t) => (t.id === id ? { ...t, due_date: day } : t)));
      // O hook useUpdateCrmTask já mostra toast de erro; aqui só o sucesso e o invalidate.
      updTask.mutate({ id, due_date: day }, { onSuccess: ok, onSettled: () => qc.invalidateQueries({ queryKey: ["crm-tasks"] }) });
    } else if (kind === "cria") {
      qc.setQueriesData<Creation[]>({ queryKey: ["agenda-creations"] }, (old) => old?.map((c) => (c.id === id ? { ...c, day } : c)));
      updCreation.mutate({ id, patch: { day } }, { onSuccess: ok, onError: fail, onSettled: () => qc.invalidateQueries({ queryKey: ["agenda-creations"] }) });
    }
  };

  const byDay = useMemo(() => {
    const m = new Map<string, typeof creations>();
    for (const c of creations) (m.get(c.day) ?? m.set(c.day, []).get(c.day)!).push(c);
    return m;
  }, [creations]);

  // Captações da semana exibida, indexadas por dia (YYYY-MM-DD), para aparecerem na grade.
  const capturesByDay = useMemo(() => {
    const m = new Map<string, Capture[]>();
    for (const c of captures) {
      if (c.status === "cancelada") continue;
      if (c.capture_date < from || c.capture_date > to) continue;
      (m.get(c.capture_date) ?? m.set(c.capture_date, []).get(c.capture_date)!).push(c);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.capture_time ?? "99:99").localeCompare(b.capture_time ?? "99:99"));
    return m;
  }, [captures, from, to]);

  const nameOf = (crmId: string | null, fallback: string | null) =>
    (crmId ? clients.find((c) => c.id === crmId)?.name : null) || fallback || "Cliente";
  const leadName = (leadId: string | null) => (leadId ? leads.find((l) => l.id === leadId)?.name ?? null : null);

  // Tarefas dos clientes (CRM) com vencimento na semana exibida, por dia.
  // Concluídas ficam de fora: a grade é sobre o que ainda precisa acontecer.
  const tasksByDay = useMemo(() => {
    const m = new Map<string, CrmTask[]>();
    if (!showTasks) return m;
    const prioOrder: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
    for (const t of crmTasks) {
      if (!t.due_date || t.status === "concluida") continue;
      if (t.due_date < from || t.due_date > to) continue;
      (m.get(t.due_date) ?? m.set(t.due_date, []).get(t.due_date)!).push(t);
    }
    for (const arr of m.values()) arr.sort((a, b) => (prioOrder[a.priority] ?? 9) - (prioOrder[b.priority] ?? 9));
    return m;
  }, [crmTasks, from, to, showTasks]);

  const upcoming = useMemo(() => captures.filter((c) => c.status !== "cancelada" && c.capture_date >= today).slice(0, 30), [captures, today]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 grid place-items-center shadow-sm shrink-0">
          <CalendarDays className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Agenda</h1>
          <p className="text-muted-foreground font-body text-sm mt-0.5">Criação semanal e agenda de captações.</p>
        </div>
      </div>

      {/* Agenda de criação */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-sm font-display font-bold text-foreground">Agenda de criação</p>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Switch checked={showTasks} onCheckedChange={toggleTasks} aria-label="Mostrar tarefas dos clientes" />
              <span className="text-xs font-body font-semibold text-muted-foreground">Tarefas dos clientes</span>
            </label>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Semana (padrão) / Mês */}
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              {(["semana", "mes"] as const).map((v) => (
                <button key={v} onClick={() => setViewPersist(v)}
                  className={cn("px-2.5 py-1 text-xs font-body font-semibold transition-colors",
                    view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {v === "semana" ? "Semana" : "Mês"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => setWeekStart((w) => { const n = new Date(w); view === "mes" ? n.setMonth(n.getMonth() - 1) : n.setDate(n.getDate() - 7); return n; })}>‹</Button>
              <span className="text-xs font-body text-muted-foreground px-1">
                {view === "mes"
                  ? weekStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
                  : `${shortDate(days[0])} – ${shortDate(days[6])}`}
              </span>
              <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => setWeekStart(mondayOf(parseDateOnly(hojeBR())))}>Hoje</Button>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => setWeekStart((w) => { const n = new Date(w); view === "mes" ? n.setMonth(n.getMonth() + 1) : n.setDate(n.getDate() + 7); return n; })}>›</Button>
            </div>
          </div>
        </div>
        <DragDropContext onDragEnd={handleDragEnd}>
          {view === "mes" && (
            <div className="hidden lg:grid lg:grid-cols-7 gap-2 mb-1">
              {WD.map((w) => <p key={w} className="text-[10px] uppercase tracking-wider font-body font-semibold text-muted-foreground text-center">{w}</p>)}
            </div>
          )}
          <div className={cn(
            view === "mes"
              ? "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2"
              : "flex gap-2 overflow-x-auto pb-2 lg:grid lg:grid-cols-7 lg:overflow-visible lg:pb-0",
          )}>
            {days.map((d, i) => {
              const iso = ymd(d); const list = byDay.get(iso) ?? []; const caps = capturesByDay.get(iso) ?? []; const dayTasks = tasksByDay.get(iso) ?? []; const isToday = iso === today;
              const outOfMonth = view === "mes" && d.getMonth() !== curMonth;
              return (
                <Droppable droppableId={iso} key={iso}>
                  {(dropProvided, dropSnapshot) => (
                    <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}
                      className={cn("rounded-xl border p-2.5 flex flex-col gap-1.5 transition-shadow",
                        view === "mes" ? "min-h-[110px]" : "w-[170px] shrink-0 lg:w-auto min-h-[220px] lg:min-h-[280px]",
                        isToday ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-background",
                        outOfMonth && "opacity-45",
                        dropSnapshot.isDraggingOver && "ring-2 ring-primary/40 border-primary/60 bg-primary/5")}>
                      <div className="flex items-center justify-between px-0.5">
                        <div>
                          {view === "semana" && <span className={cn("text-[11px] uppercase tracking-wider font-body font-semibold", isToday ? "text-primary" : "text-muted-foreground")}>{WD[i % 7]}</span>}{" "}
                          <span className={cn("text-base font-display font-bold", isToday ? "text-primary" : "text-foreground")}>{d.getDate()}</span>
                        </div>
                        <button onClick={() => setAddDay(iso)} className="text-muted-foreground hover:text-primary" aria-label="Adicionar"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                      {caps.map((c, idx) => (
                        <Draggable key={`cap:${c.id}`} draggableId={`cap:${c.id}`} index={idx}>
                          {(dragProvided, dragSnapshot) => (
                            <button ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}
                              type="button" title={c.location ?? undefined}
                              onClick={() => setEditCap(c)}
                              className={cn("rounded-lg border px-2 py-1.5 text-left transition-colors",
                                c.status === "concluida" ? "border-teal-500/25 bg-teal-500/5 opacity-70" : "border-teal-500/40 bg-teal-500/10 hover:bg-teal-500/15",
                                dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/40")}>
                              <div className="flex items-center gap-1 text-teal-700 dark:text-teal-300">
                                <Video className="h-3 w-3 shrink-0" />
                                <span className="text-[10px] font-body font-bold">{c.capture_time ? c.capture_time.slice(0, 5) : "Captação"}</span>
                              </div>
                              <p className="text-[12px] font-body font-semibold text-foreground leading-tight truncate">{nameOf(c.crm_client_id, c.client_name)}</p>
                            </button>
                          )}
                        </Draggable>
                      ))}
                      {dayTasks.map((t, idx) => {
                        // Tarefa de LEAD é azul; tarefa de CLIENTE é âmbar. A cor diz de quem é.
                        const isLead = !!t.crm_lead_id;
                        const who = isLead ? (leadName(t.crm_lead_id) ?? "Lead") : nameOf(t.crm_client_id, null);
                        return (
                        <Draggable key={`task:${t.id}`} draggableId={`task:${t.id}`} index={caps.length + idx}>
                          {(dragProvided, dragSnapshot) => (
                            <button ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}
                              type="button" title={t.description ?? undefined}
                              onClick={() => setEditTask(t)}
                              className={cn("rounded-lg border px-2 py-1.5 text-left transition-colors",
                                isLead
                                  ? "border-sky-500/45 bg-sky-500/10 hover:bg-sky-500/15"
                                  : t.priority === "urgente" || t.priority === "alta"
                                  ? "border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/20"
                                  : "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10",
                                dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/40")}>
                              <div className={cn("flex items-center gap-1", isLead ? "text-sky-700 dark:text-sky-300" : "text-amber-700 dark:text-amber-300")}>
                                <ListChecks className="h-3 w-3 shrink-0" />
                                <span className="text-[10px] font-body font-bold truncate">{isLead ? `Lead · ${who}` : who}</span>
                              </div>
                              <p className="text-[12px] font-body font-semibold text-foreground leading-tight truncate">{t.title}</p>
                            </button>
                          )}
                        </Draggable>
                        );
                      })}
                      {list.map((c, idx) => (
                        <Draggable key={`cria:${c.id}`} draggableId={`cria:${c.id}`} index={caps.length + dayTasks.length + idx}>
                          {(dragProvided, dragSnapshot) => (
                            <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}
                              role="button" tabIndex={0}
                              onClick={() => setEditCreation(c)}
                              onKeyDown={(e) => { if (e.key === "Enter") setEditCreation(c); }}
                              className={cn("group rounded-lg border border-border bg-card px-2 py-1.5 cursor-pointer hover:bg-muted/40 transition-colors",
                                dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/40")}>
                              <div className="flex items-start gap-1">
                                <p className="text-[12px] font-body font-semibold text-foreground leading-tight flex-1 min-w-0 truncate">{nameOf(c.crm_client_id, c.client_name)}</p>
                                <button onClick={(e) => { e.stopPropagation(); delCreation.mutate(c.id); }} className="text-muted-foreground/50 hover:text-destructive shrink-0" aria-label="Remover"><X className="h-3 w-3" /></button>
                              </div>
                              {c.team && <p className="text-[10px] font-body text-muted-foreground truncate">{c.team}</p>}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {dropProvided.placeholder}
                      {list.length === 0 && caps.length === 0 && dayTasks.length === 0 && <button onClick={() => setAddDay(iso)} className="text-[11px] font-body text-muted-foreground/60 hover:text-primary py-1">+ cliente</button>}
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Captações */}
      <div id="captacoes-section" className="rounded-2xl border border-border bg-card p-4 mt-4 scroll-mt-20">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-display font-bold text-foreground">Captações</p>
          <Button size="sm" className="h-8" onClick={() => setCapOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Nova captação</Button>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-[12px] font-body text-muted-foreground py-4 text-center">Nenhuma captação agendada. Clique em "Nova captação".</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((c) => {
              const st = STATUS[c.status];
              const d = parseDateOnly(c.capture_date);
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border p-3 flex-wrap">
                  <div className="text-center shrink-0 w-11">
                    <p className="text-lg font-display font-extrabold text-foreground leading-none">{d.getDate()}</p>
                    <p className="text-[10px] font-body uppercase text-muted-foreground">{d.toLocaleDateString("pt-BR", { month: "short" })}</p>
                  </div>
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary shrink-0"><Video className="h-4 w-4" /></div>
                  <button type="button" onClick={() => setEditCap(c)} className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-body font-semibold text-foreground truncate">{nameOf(c.crm_client_id, c.client_name)}</p>
                    <div className="flex items-center gap-2 flex-wrap text-[11px] font-body text-muted-foreground">
                      {c.capture_time && <span className="inline-flex items-center gap-0.5"><Clock className="h-3 w-3" />{c.capture_time.slice(0, 5)}</span>}
                      {c.location && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{c.location}</span>}
                      {c.team && <span className="inline-flex items-center gap-0.5"><Users className="h-3 w-3" />{c.team}</span>}
                    </div>
                    {c.note && <p className="text-[11px] font-body text-muted-foreground/80 mt-0.5 truncate italic">{c.note}</p>}
                  </button>
                  <select value={c.status} onChange={(e) => updCapture.mutate({ id: c.id, patch: { status: e.target.value as Capture["status"] } })}
                    className={cn("text-[11px] font-body font-semibold rounded-full px-2 py-1 border-0 outline-none cursor-pointer", st.cls)}>
                    <option value="agendada">Agendada</option>
                    <option value="concluida">Concluída</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                  <button onClick={() => delCapture.mutate(c.id)} className="text-muted-foreground/50 hover:text-destructive shrink-0"><X className="h-4 w-4" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* "+" do dia: escolhe o TIPO (criação / tarefa / captação) antes de preencher. */}
      <AddAnyDialog open={!!addDay} day={addDay} clients={clients} teamNames={teamNames}
        onClose={() => setAddDay(null)}
        onCreation={(crm, name, team, note) => { if (addDay) addCreation.mutate({ day: addDay, crm_client_id: crm, client_name: name, team, note }); setAddDay(null); }}
        onTask={(v) => { createTask.mutate(v, { onSuccess: () => toast.success("Tarefa criada.") }); setAddDay(null); }}
        onCapture={(v) => { addCapture.mutate(v); setAddDay(null); }} />

      {/* Edição de uma criação existente */}
      <AddCreationDialog open={!!editCreation} day={null} initial={editCreation} clients={clients} teamNames={teamNames}
        onClose={() => setEditCreation(null)}
        onSave={(crm, name, team, note) => {
          if (editCreation) {
            updCreation.mutate({ id: editCreation.id, patch: { crm_client_id: crm, client_name: name, team, note } },
              { onSuccess: () => toast.success("Criação atualizada."), onError: () => toast.error("Não consegui salvar.") });
          }
          setEditCreation(null);
        }} />
      <CaptureDialog open={capOpen || !!editCap} initial={editCap} clients={clients} teamNames={teamNames}
        onClose={() => { setCapOpen(false); setEditCap(null); }}
        onSave={(v) => {
          if (editCap) {
            updCapture.mutate({ id: editCap.id, patch: v },
              { onSuccess: () => toast.success("Captação atualizada."), onError: () => toast.error("Não consegui salvar.") });
          } else {
            addCapture.mutate(v);
          }
          setCapOpen(false); setEditCap(null);
        }} pending={addCapture.isPending || updCapture.isPending} />
      <TaskDialog task={editTask} clients={clients}
        onClose={() => setEditTask(null)}
        onOpenCrm={() => { setEditTask(null); navigate("/socialmidia/criacrm/tarefas"); }}
        onSave={(patch) => {
          if (editTask) {
            updTask.mutate({ id: editTask.id, ...patch }, { onSuccess: () => toast.success("Tarefa atualizada.") });
          }
          setEditTask(null);
        }} />
    </motion.div>
  );
}

type Client = { id: string; name: string };

function ClientPicker({ clients, crm, name, onCrm, onName }: { clients: Client[]; crm: string | null; name: string; onCrm: (v: string | null) => void; onName: (v: string) => void }) {
  return (
    <>
      <select value={crm ?? ""} onChange={(e) => onCrm(e.target.value || null)} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-body">
        <option value="">Cliente do CRM</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {!crm && <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="Ou nome livre" className="mt-2" />}
    </>
  );
}

function TeamDatalist({ names }: { names: string[] }) {
  return <datalist id="agenda-team-names">{names.map((n) => <option key={n} value={n} />)}</datalist>;
}

function AddCreationDialog({ open, day, initial, clients, teamNames, onClose, onSave }: { open: boolean; day: string | null; initial?: Creation | null; clients: Client[]; teamNames: string[]; onClose: () => void; onSave: (crm: string | null, name: string | null, team: string | null, note: string | null) => void }) {
  const [crm, setCrm] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [note, setNote] = useState("");
  const seed = open ? `${day ?? ""}:${initial?.id ?? "new"}` : "";
  const [seeded, setSeeded] = useState("");
  if (open && seed !== seeded) { setSeeded(seed); setCrm(initial?.crm_client_id ?? null); setName(initial?.client_name ?? ""); setTeam(initial?.team ?? ""); setNote(initial?.note ?? ""); }
  if (!open && seeded) setSeeded("");
  const valid = !!crm || name.trim();
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">{initial ? "Editar criação" : "Adicionar à criação"}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <ClientPicker clients={clients} crm={crm} name={name} onCrm={setCrm} onName={setName} />
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Equipe (opcional)</p>
            <Input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Ex.: Ana, Bruno" list="agenda-team-names" />
            <TeamDatalist names={teamNames} />
          </div>
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notas (opcional)</p>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: gravar 3 reels, levar tripé…" className="rounded-xl text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(crm, name.trim() || null, team.trim() || null, note.trim() || null)} disabled={!valid}>{initial ? "Salvar" : "Adicionar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// "+" do dia: primeiro escolhe O QUE é (criação / tarefa / captação), depois preenche.
function AddAnyDialog({ open, day, clients, teamNames, onClose, onCreation, onTask, onCapture }: {
  open: boolean; day: string | null; clients: Client[]; teamNames: string[]; onClose: () => void;
  onCreation: (crm: string | null, name: string | null, team: string | null, note: string | null) => void;
  onTask: (v: { title: string; description: string | null; crm_client_id: string | null; priority: CrmTaskPriority; status: CrmTaskStatus; due_date: string }) => void;
  onCapture: (v: { capture_date: string; capture_time?: string | null; location?: string | null; crm_client_id?: string | null; client_name?: string | null; team?: string | null; note?: string | null }) => void;
}) {
  const [kind, setKind] = useState<"criacao" | "tarefa" | "captacao">("criacao");
  const [crm, setCrm] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [prio, setPrio] = useState<CrmTaskPriority>("media");
  const [time, setTime] = useState("");
  const [loc, setLoc] = useState("");
  const [seeded, setSeeded] = useState("");

  if (open && day && seeded !== day) {
    setSeeded(day);
    setKind("criacao"); setCrm(null); setName(""); setTeam(""); setNote(""); setTitle(""); setPrio("media"); setTime(""); setLoc("");
  }
  if (!open && seeded) setSeeded("");

  const hasClient = !!crm || !!name.trim();
  const valid = kind === "tarefa" ? !!title.trim() : hasClient;

  const submit = () => {
    if (!day) return;
    if (kind === "criacao") onCreation(crm, name.trim() || null, team.trim() || null, note.trim() || null);
    else if (kind === "tarefa") onTask({ title: title.trim(), description: note.trim() || null, crm_client_id: crm, priority: prio, status: "pendente", due_date: day });
    else onCapture({ capture_date: day, capture_time: time || null, location: loc.trim() || null, crm_client_id: crm, client_name: name.trim() || null, team: team.trim() || null, note: note.trim() || null });
  };

  const KINDS = [
    { k: "criacao", label: "Criação" },
    { k: "tarefa", label: "Tarefa" },
    { k: "captacao", label: "Captação" },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Adicionar no dia</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {/* Tipo */}
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map(({ k, label }) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                className={cn("rounded-xl border py-2 text-sm font-body font-semibold transition-colors",
                  kind === k ? "border-primary bg-primary/[0.06] text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
                {label}
              </button>
            ))}
          </div>

          {kind === "tarefa" && (
            <div>
              <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Tarefa *</p>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito" />
            </div>
          )}

          <ClientPicker clients={clients} crm={crm} name={name} onCrm={setCrm} onName={setName} />

          {kind === "captacao" && (
            <div className="flex gap-2">
              <div className="w-28"><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Hora</p><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
              <div className="flex-1"><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Local (opcional)</p><Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Ex.: Estúdio" /></div>
            </div>
          )}

          {kind === "tarefa" && (
            <div>
              <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Prioridade</p>
              <select value={prio} onChange={(e) => setPrio(e.target.value as CrmTaskPriority)} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-body">
                {CRM_TASK_PRIORITIES.map((p) => <option key={p} value={p}>{CRM_TASK_PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
          )}

          {kind !== "tarefa" && (
            <div>
              <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Equipe (opcional)</p>
              <Input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Ex.: Ana, Bruno" list="agenda-team-names" />
              <TeamDatalist names={teamNames} />
            </div>
          )}

          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Notas (opcional)</p>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: captação mês de julho, captação de anúncio…" className="rounded-xl text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={!valid}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CaptureDialog({ open, initial, clients, teamNames, onClose, onSave, pending }: { open: boolean; initial?: Capture | null; clients: Client[]; teamNames: string[]; onClose: () => void; onSave: (v: { capture_date: string; capture_time?: string | null; location?: string | null; crm_client_id?: string | null; client_name?: string | null; team?: string | null; note?: string | null; status?: Capture["status"] }) => void; pending: boolean }) {
  const [crm, setCrm] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [loc, setLoc] = useState("");
  const [team, setTeam] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Capture["status"]>("agendada");
  const seed = open ? (initial?.id ?? "new") : "";
  const [seeded, setSeeded] = useState("");
  if (open && seed !== seeded) {
    setSeeded(seed);
    setCrm(initial?.crm_client_id ?? null); setName(initial?.client_name ?? "");
    setDate(initial?.capture_date ?? ""); setTime(initial?.capture_time ? initial.capture_time.slice(0, 5) : "");
    setLoc(initial?.location ?? ""); setTeam(initial?.team ?? ""); setNote(initial?.note ?? ""); setStatus(initial?.status ?? "agendada");
  }
  if (!open && seeded) setSeeded("");
  const valid = date && (!!crm || name.trim());
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">{initial ? "Editar captação" : "Nova captação"}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <ClientPicker clients={clients} crm={crm} name={name} onCrm={setCrm} onName={setName} />
          <div className="flex gap-2">
            <div className="flex-1"><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Data</p><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="w-28"><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Hora</p><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </div>
          <div><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Local (opcional)</p><Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Ex.: Estúdio, coworking, local externo" /></div>
          <div><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Equipe (opcional)</p><Input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Ex.: Ana, Bruno" list="agenda-team-names" /><TeamDatalist names={teamNames} /></div>
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Notas (opcional)</p>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: captação mês de julho, captação de anúncio…" className="rounded-xl text-sm" />
          </div>
          {initial && (
            <div>
              <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Status</p>
              <select value={status} onChange={(e) => setStatus(e.target.value as Capture["status"])} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-body">
                <option value="agendada">Agendada</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({ capture_date: date, capture_time: time || null, location: loc.trim() || null, crm_client_id: crm, client_name: name.trim() || null, team: team.trim() || null, note: note.trim() || null, ...(initial ? { status } : {}) })} disabled={!valid || pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : initial ? "Salvar" : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edição rápida da tarefa do CRM direto da grade, sem sair da Agenda.
function TaskDialog({ task, clients, onClose, onOpenCrm, onSave }: {
  task: CrmTask | null;
  clients: Client[];
  onClose: () => void;
  onOpenCrm: () => void;
  onSave: (patch: { title: string; description: string | null; priority: CrmTaskPriority; status: CrmTaskStatus; due_date: string | null }) => void;
}) {
  const open = !!task;
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [prio, setPrio] = useState<CrmTaskPriority>("media");
  const [status, setStatus] = useState<CrmTaskStatus>("pendente");
  const [due, setDue] = useState("");
  const [seeded, setSeeded] = useState("");
  if (open && task && seeded !== task.id) {
    setSeeded(task.id);
    setTitle(task.title); setDesc(task.description ?? "");
    setPrio(task.priority); setStatus(task.status); setDue(task.due_date ?? "");
  }
  if (!open && seeded) setSeeded("");
  const clientName = task?.crm_client_id ? clients.find((c) => c.id === task.crm_client_id)?.name : null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Editar tarefa</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {clientName && <p className="text-[11px] font-body text-muted-foreground">Cliente: <span className="font-semibold text-foreground">{clientName}</span></p>}
          <div><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Título</p><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito" /></div>
          <div><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Descrição (opcional)</p><Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} className="rounded-xl text-sm" placeholder="Detalhes, contexto..." /></div>
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Prioridade</p>
              <select value={prio} onChange={(e) => setPrio(e.target.value as CrmTaskPriority)} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-body">
                {CRM_TASK_PRIORITIES.map((p) => <option key={p} value={p}>{CRM_TASK_PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Status</p>
              <select value={status} onChange={(e) => setStatus(e.target.value as CrmTaskStatus)} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-body">
                {CRM_TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
          <div><p className="text-[11px] font-body font-semibold text-muted-foreground uppercase mb-1">Vencimento</p><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
          <button type="button" onClick={onOpenCrm} className="inline-flex items-center gap-1 text-[11px] font-body text-muted-foreground hover:text-primary transition-colors">
            <ExternalLink className="h-3 w-3" /> Abrir no CRM
          </button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({ title: title.trim(), description: desc.trim() || null, priority: prio, status, due_date: due || null })} disabled={!title.trim()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
