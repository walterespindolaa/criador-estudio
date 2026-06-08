import { useMemo, useState } from "react";
import { Plus, Trash2, CheckCircle2, Circle, AlertTriangle, ListTodo, Pencil } from "lucide-react";
import {
  useCrmTasks, useCreateCrmTask, useUpdateCrmTask, useDeleteCrmTask,
  CRM_TASK_PRIORITY_LABELS, type CrmTask, type CrmTaskInput, type CrmTaskStatus, type CrmTaskPriority,
} from "@/hooks/useCrm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PRIO_CLASS: Record<CrmTaskPriority, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-secondary text-secondary-foreground",
  alta: "bg-primary/10 text-primary",
  urgente: "bg-destructive/10 text-destructive",
};
const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export function ClientTasks({ clientId }: { clientId: string }) {
  const { data: all = [] } = useCrmTasks();
  const createTask = useCreateCrmTask();
  const updateTask = useUpdateCrmTask();
  const delTask = useDeleteCrmTask();

  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [editing, setEditing] = useState<CrmTask | null>(null);
  const today = new Date().toISOString().split("T")[0];

  const tasks = useMemo(() => {
    return all.filter((t) => t.crm_client_id === clientId).sort((a, b) => {
      const ad = a.status === "concluida" ? 1 : 0, bd = b.status === "concluida" ? 1 : 0;
      if (ad !== bd) return ad - bd;
      return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
    });
  }, [all, clientId]);

  const pend = tasks.filter((t) => t.status !== "concluida").length;
  const late = tasks.filter((t) => t.status !== "concluida" && t.due_date && t.due_date < today).length;

  const add = async () => {
    if (!title.trim()) return;
    await createTask.mutateAsync({ title: title.trim(), crm_client_id: clientId, due_date: due || null });
    setTitle(""); setDue("");
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2.5"><ListTodo className="h-[18px] w-[18px] text-primary" /> Tarefas do cliente</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{pend} pendente{pend === 1 ? "" : "s"}</span>
          {late > 0 && <Badge className="text-[10px] h-5 bg-destructive/10 text-destructive gap-0.5"><AlertTriangle className="h-2.5 w-2.5" />{late} atrasada{late === 1 ? "" : "s"}</Badge>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nova tarefa..." className="rounded-xl h-10 text-sm" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-xl h-10 text-sm w-40" />
        <Button onClick={add} disabled={!title.trim() || createTask.isPending}><Plus className="h-4 w-4" /></Button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tarefa ainda.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => {
            const overdue = t.status !== "concluida" && !!t.due_date && t.due_date < today;
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                <button type="button" onClick={() => updateTask.mutate({ id: t.id, status: t.status === "concluida" ? "pendente" : "concluida" })} className="shrink-0 text-muted-foreground hover:text-primary">
                  {t.status === "concluida" ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium text-foreground truncate", t.status === "concluida" && "line-through text-muted-foreground")}>{t.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge className={cn("text-[10px] h-4", PRIO_CLASS[t.priority])}>{CRM_TASK_PRIORITY_LABELS[t.priority]}</Badge>
                    {t.due_date && <span className={cn("text-[11px]", overdue ? "text-destructive font-semibold" : "text-muted-foreground")}>{fmt(t.due_date)}</span>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => { if (confirm("Excluir esta tarefa?")) delTask.mutate(t.id); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <ClientTaskDialog
          task={editing}
          saving={updateTask.isPending}
          onClose={() => setEditing(null)}
          onSave={async (id, u) => { await updateTask.mutateAsync({ id, ...u }); toast.success("Tarefa atualizada!"); setEditing(null); }}
        />
      )}
    </div>
  );
}

function ClientTaskDialog({ task, saving, onClose, onSave }: {
  task: CrmTask; saving: boolean; onClose: () => void; onSave: (id: string, u: Partial<CrmTaskInput>) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState<CrmTaskPriority>(task.priority);
  const [status, setStatus] = useState<CrmTaskStatus>(task.status);
  const [due, setDue] = useState(task.due_date ?? "");
  const [desc, setDesc] = useState(task.description ?? "");
  const submit = () => {
    if (!title.trim()) { toast.error("Título é obrigatório."); return; }
    onSave(task.id, { title: title.trim(), priority, status, due_date: due || null, description: desc.trim() || null });
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">Editar tarefa</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="space-y-1.5"><Label className="text-xs">Título *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" /></div>
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
        <div className="flex justify-end gap-2 mt-5"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={!title.trim() || saving}>Salvar</Button></div>
      </DialogContent>
    </Dialog>
  );
}
