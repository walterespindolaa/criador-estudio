import { useState, useEffect } from "react";
import { Plus, Trash2, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
}

interface PostTasksProps {
  postId: string;
  userId: string;
}

export function PostTasks({ postId, userId }: PostTasksProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("media");
  const [newDueDate, setNewDueDate] = useState("");
  const [showForm, setShowForm] = useState(false);

  const fetchTasks = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, priority, status, due_date")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .order("created_at");
    setTasks((data as any[]) || []);
  };

  useEffect(() => { fetchTasks(); }, [postId]);

  const addTask = async () => {
    if (!newTitle.trim()) return;
    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      post_id: postId,
      title: newTitle.trim(),
      priority: newPriority,
      due_date: newDueDate || null,
    });
    if (error) { toast.error("Erro ao criar tarefa."); return; }
    setNewTitle("");
    setNewDueDate("");
    setNewPriority("media");
    setShowForm(false);
    fetchTasks();
  };

  const toggleDone = async (task: Task) => {
    const newStatus = task.status === "concluida" ? "pendente" : "concluida";
    await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
  };

  const deleteTask = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const priorityBadge = (p: string) => {
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

      {tasks.map(task => (
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
          <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 rounded transition-all">
            <Trash2 className="h-3 w-3 text-destructive" />
          </button>
        </div>
      ))}

      {tasks.length === 0 && !showForm && (
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
