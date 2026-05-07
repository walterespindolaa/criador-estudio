import { useState, useMemo } from "react";
import { Plus, Trash2, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useTasks, type Task } from "@/hooks/useTasks";

interface PostTasksProps {
  postId: string;
}

export function PostTasks({ postId }: PostTasksProps) {
  const { tasks, createTask, updateTaskStatus, deleteTask } = useTasks();
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("media");
  const [newDueDate, setNewDueDate] = useState("");
  const [showForm, setShowForm] = useState(false);

  const postTasks = useMemo(
    () =>
      tasks
        .filter(t => t.post_id === postId)
        .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "")),
    [tasks, postId],
  );

  const addTask = async () => {
    if (!newTitle.trim()) return;
    try {
      await createTask.mutateAsync({
        title: newTitle.trim(),
        priority: newPriority,
        status: "pendente",
        due_date: newDueDate || null,
        post_id: postId,
        description: null,
      });
      setNewTitle("");
      setNewDueDate("");
      setNewPriority("media");
      setShowForm(false);
    } catch {
      toast.error("Erro ao criar tarefa.");
    }
  };

  const toggleDone = async (task: Task) => {
    const newStatus = task.status === "concluida" ? "pendente" : "concluida";
    try {
      await updateTaskStatus.mutateAsync({ id: task.id, status: newStatus });
    } catch {
      toast.error("Erro ao atualizar tarefa.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTask.mutateAsync(id);
    } catch {
      toast.error("Erro ao remover tarefa.");
    }
  };

  const priorityBadge = (p: string | null) => {
    const cls = p === "urgente" ? "bg-destructive/10 text-destructive" :
      p === "alta" ? "bg-primary/10 text-primary" :
      p === "media" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
      "bg-muted text-muted-foreground";
    return <span className={`text-[10px] font-body font-semibold px-1.5 py-0.5 rounded ${cls}`}>{p}</span>;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
          📋 Tarefas do post
        </p>
        <button onClick={() => setShowForm(!showForm)} className="text-xs text-primary font-body font-medium hover:underline flex items-center gap-1">
          <Plus className="h-3 w-3" /> Adicionar
        </button>
      </div>

      {postTasks.map(task => (
        <div key={task.id} className={`flex items-center gap-2 group ${task.status === "concluida" ? "opacity-50" : ""}`}>
          <Checkbox
            checked={task.status === "concluida"}
            onCheckedChange={() => toggleDone(task)}
            className="rounded"
          />
          <span className={`text-sm font-body flex-1 ${task.status === "concluida" ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {task.title}
          </span>
          {priorityBadge(task.priority)}
          {task.due_date && (
            <span className="text-[10px] text-muted-foreground font-body flex items-center gap-0.5">
              <Calendar className="h-2.5 w-2.5" /> {task.due_date}
            </span>
          )}
          <button onClick={() => handleDelete(task.id)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 rounded transition-all">
            <Trash2 className="h-3 w-3 text-destructive" />
          </button>
        </div>
      ))}

      {postTasks.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground font-body">Nenhuma tarefa vinculada.</p>
      )}

      {showForm && (
        <div className="bg-muted/50 rounded-xl p-3 border border-border space-y-2">
          <Input
            placeholder="Título da tarefa"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTask()}
            className="rounded-lg text-sm h-8"
            autoFocus
          />
          <div className="flex gap-2">
            <Select value={newPriority} onValueChange={setNewPriority}>
              <SelectTrigger className="rounded-lg h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="urgente">Urgente</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={newDueDate}
              onChange={e => setNewDueDate(e.target.value)}
              className="rounded-lg h-8 text-xs flex-1"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={addTask} disabled={!newTitle.trim()} className="h-7 text-xs">Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="h-7 text-xs">Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
