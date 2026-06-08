import { useMemo, useState } from "react";
import { Plus, Calendar as CalendarIcon, AlertTriangle, Trash2, ListTodo, CheckCircle2, Circle } from "lucide-react";
import {
  useCrmTasks, useCreateCrmTask, useUpdateCrmTask, useDeleteCrmTask,
  useCrmClients, useCrmLeads, CRM_TASK_PRIORITY_LABELS,
  type CrmTask, type CrmTaskInput, type CrmTaskStatus, type CrmTaskPriority,
} from "@/hooks/useCrm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

export function TasksTab() {
  const { data: tasks = [], isLoading } = useCrmTasks();
  const { data: clients = [] } = useCrmClients();
  const { data: leads = [] } = useCrmLeads();
  const updateTask = useUpdateCrmTask();
  const createTask = useCreateCrmTask();
  const delTask = useDeleteCrmTask();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CrmTask | null>(null);
  const [view, setView] = useState<ViewFilter>("todas");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [dragId, setDragId] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const nameFor = (t: CrmTask) => {
    if (t.crm_client_id) return clients.find((c) => c.id === t.crm_client_id)?.name ?? "Cliente";
    if (t.crm_lead_id) return leads.find((l) => l.id === t.crm_lead_id)?.name ?? "Lead";
    return null;
  };
  const isLead = (t: CrmTask) => !t.crm_client_id && !!t.crm_lead_id;

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      switch (view) {
        case "atrasadas": if (t.status === "concluida" || !t.due_date || t.due_date >= today) return false; break;
        case "hoje": if (t.status === "concluida" || t.due_date !== today) return false; break;
        case "semana": if (t.status === "concluida" || !t.due_date || t.due_date < today || t.due_date > weekEnd) return false; break;
        case "concluidas": if (t.status !== "concluida") return false; break;
      }
      if (clientFilter !== "all" && t.crm_client_id !== clientFilter) return false;
      return true;
    });
  }, [tasks, view, today, weekEnd, clientFilter]);

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
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="h-3.5 w-3.5 mr-1.5" /> Nova tarefa</Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-muted/50 rounded-full p-0.5">
          {pills.map((p) => (
            <button key={p.v} onClick={() => setView(p.v)}
              className={cn("px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all", view === p.v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {p.label}{counts[p.v] > 0 && <span className="ml-1 opacity-70">{counts[p.v]}</span>}
            </button>
          ))}
        </div>
        <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="h-8 rounded-full border border-input bg-background px-3 text-xs">
          <option value="all">Todos os clientes</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)}</div>
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
                          <button type="button" onClick={(e) => { e.stopPropagation(); updateTask.mutate({ id: t.id, status: t.status === "concluida" ? "pendente" : "concluida" }); }} className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary">
                            {t.status === "concluida" ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4" />}
                          </button>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <p className={cn("text-sm font-medium text-foreground", t.status === "concluida" && "line-through text-muted-foreground")}>{t.title}</p>
                            {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge className={cn("text-[10px] h-5", PRIO_CLASS[t.priority])}>{CRM_TASK_PRIORITY_LABELS[t.priority]}</Badge>
                              {nm && <Badge variant="outline" className="text-[10px] h-5">{isLead(t) ? "Lead: " : ""}{nm}</Badge>}
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
          key={editing?.id ?? "new"}
          task={editing}
          clients={clients}
          saving={createTask.isPending || updateTask.isPending}
          onClose={() => { setDialogOpen(false); setEditing(null); }}
          onCreate={async (input) => { await createTask.mutateAsync(input); setDialogOpen(false); }}
          onUpdate={async (id, u) => { await updateTask.mutateAsync({ id, ...u }); toast.success("Tarefa atualizada!"); setDialogOpen(false); setEditing(null); }}
          onDelete={async (id) => { if (confirm("Excluir esta tarefa?")) { await delTask.mutateAsync(id); setDialogOpen(false); setEditing(null); } }}
        />
      )}
    </div>
  );
}

function TaskDialog({ task, clients, saving, onClose, onCreate, onUpdate, onDelete }: {
  task: CrmTask | null;
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
  const [due, setDue] = useState(task?.due_date ?? "");
  const [desc, setDesc] = useState(task?.description ?? "");

  const submit = () => {
    if (!title.trim()) { toast.error("Título é obrigatório."); return; }
    const base: CrmTaskInput = {
      title: title.trim(), crm_client_id: clientId || null, priority, status,
      due_date: due || null, description: desc.trim() || null,
    };
    if (task) onUpdate(task.id, base); else onCreate(base);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="space-y-1.5"><Label className="text-xs">Título *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Gravar reels de quinta" className="rounded-xl" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Cliente</Label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="">— Sem cliente —</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Prioridade</Label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as CrmTaskPriority)} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
              </select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Status</Label>
              <select value={status} onChange={(e) => setStatus(e.target.value as CrmTaskStatus)} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Prazo</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-xl" /></div>
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
