import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, AlertTriangle, Calendar, CheckCircle2, Clock, Link2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PostPreviewModal } from "@/components/kanban/PostPreviewModal";
import { useProfile } from "@/hooks/useProfile";
// ... keep existing code (just cleaning up imports if they are unused)
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  post_id: string | null;
  created_at: string;
}

interface Post {
  id: string;
  title: string;
  scheduled_date: string | null;
  platform: string;
  format: string;
  hook: string | null;
  caption: string | null;
  user_id: string;
  created_at?: string;
}

const PRIORITY_BADGES: Record<string, { label: string; class: string }> = {
  urgente: { label: "Urgente", class: "bg-red-100 text-red-700" },
  alta: { label: "Alta", class: "bg-orange-100 text-orange-700" },
  media: { label: "Média", class: "bg-yellow-100 text-yellow-700" },
  baixa: { label: "Baixa", class: "bg-gray-100 text-gray-500" },
};

const FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "urgente", label: "Urgente" },
  { key: "atrasadas", label: "Atrasadas" },
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Esta semana" },
  { key: "concluidas", label: "Concluídas" },
];

const Tarefas = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState("todas");
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    status: "pendente",
    priority: "media",
    due_date: "",
    post_id: null as string | null,
    notes: ""
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const fetchData = async () => {
    if (!user) return;
    const [tasksRes, postsRes] = await Promise.all([
      supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("posts").select("id, title, scheduled_date, platform, format, hook, caption, user_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setTasks((tasksRes.data as Task[]) || []);
    setPosts((postsRes.data as Post[]) || []);
  };

  useEffect(() => { fetchData(); }, [user]);

  const getWeekEnd = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = 7 - (day === 0 ? 7 : day);
    const end = new Date(d);
    end.setDate(d.getDate() + diff);
    return end.toISOString().split("T")[0];
  };

  const filtered = tasks.filter(t => {
    if (filter === "urgente") return t.priority === "urgente" && t.status !== "concluida";
    if (filter === "atrasadas") return t.due_date && t.due_date < today && t.status !== "concluida";
    if (filter === "hoje") return t.due_date === today && t.status !== "concluida";
    if (filter === "semana") return t.due_date && t.due_date >= today && t.due_date <= getWeekEnd() && t.status !== "concluida";
    if (filter === "concluidas") return t.status === "concluida";
    return true;
  });

  const grouped = {
    pendente: filtered.filter(t => t.status === "pendente"),
    em_andamento: filtered.filter(t => t.status === "em_andamento"),
    concluida: filtered.filter(t => t.status === "concluida"),
  };

  const openNew = () => {
    setNewTask({ title: '', status: 'pendente', priority: 'media', due_date: '', post_id: null, notes: '' });
    setIsNewTaskOpen(true);
  };

  const handleSave = async () => {
    if (!newTask.title.trim() || !user) {
      toast.error("O título é obrigatório");
      return;
    }

    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      title: newTask.title.trim(),
      description: newTask.notes || null,
      priority: newTask.priority,
      status: newTask.status,
      due_date: newTask.due_date || null,
      post_id: newTask.post_id || null,
    } as any);
    
    if (error) {
      console.error("Error saving task:", error);
      toast.error("Erro ao criar tarefa.");
      return;
    }
    
    toast.success("Tarefa criada!");
    setIsNewTaskOpen(false);
    fetchData();
  };

  const toggleComplete = async (task: Task) => {
    const newStatus = task.status === "concluida" ? "pendente" : "concluida";
    await supabase.from("tasks").update({ status: newStatus } as any).eq("id", task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
  };

  const moveToInProgress = async (taskId: string) => {
    await supabase.from("tasks").update({ status: "em_andamento" } as any).eq("id", taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "em_andamento" } : t));
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from("tasks").delete().eq("id", taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    toast.success("Tarefa removida.");
  };

  const isOverdue = (t: Task) => t.due_date && t.due_date < today && t.status !== "concluida";

  const renderTaskCard = (task: Task) => {
    const priority = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.media;
    const overdue = isOverdue(task);
    const linkedPost = posts.find(p => p.id === task.post_id);

    return (
      <motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className={`bg-card rounded-xl p-4 border transition-all group ${overdue ? "border-red-300 bg-red-50/30" : "border-border"}`}>
        <div className="flex items-start gap-3">
          <Checkbox checked={task.status === "concluida"} onCheckedChange={() => toggleComplete(task)} className="mt-0.5 rounded" />
          <div className="flex-1 min-w-0">
            <p className={`font-body font-medium text-sm leading-snug ${task.status === "concluida" ? "line-through text-muted-foreground" : "text-foreground"}`}>{task.title}</p>
            {task.description && <p className="text-xs text-muted-foreground font-body mt-1 line-clamp-2">{task.description}</p>}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-body font-semibold ${priority.class}`}>{priority.label}</span>
              {task.due_date && (
                <span className={`text-[10px] font-body flex items-center gap-0.5 ${overdue ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                  {overdue && <AlertTriangle className="h-3 w-3" />}
                  <Calendar className="h-3 w-3" />
                  {format(parseISO(task.due_date), "dd/MM")}
                </span>
              )}
              {linkedPost && (
                <button
                  onClick={() => {
                    setSelectedPost(linkedPost);
                    setPreviewOpen(true);
                  }}
                  className="text-[10px] font-body text-primary flex items-center gap-0.5 hover:underline decoration-primary text-left"
                >
                  <Link2 className="h-3 w-3" /> {linkedPost.title}
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {task.status === "pendente" && (
              <button onClick={() => moveToInProgress(task.id)} className="p-1 hover:bg-accent rounded-lg" title="Em andamento">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
            <button onClick={() => deleteTask(task.id)} className="p-1 hover:bg-destructive/10 rounded-lg">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  const columnData = [
    { key: "pendente", label: "Pendentes", icon: Clock, tasks: grouped.pendente },
    { key: "em_andamento", label: "Em andamento", icon: Calendar, tasks: grouped.em_andamento },
    { key: "concluida", label: "Concluídas", icon: CheckCircle2, tasks: grouped.concluida },
  ];

  return (
    <div className="max-w-5xl pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Tarefas</h1>
            <p className="text-muted-foreground font-body mt-1">Organize sua rotina de criação.</p>
          </div>
          <Button variant="hero" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Tarefa</Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {columnData.map(col => (
            <div key={col.key}>
              <div className="flex items-center gap-2 mb-3">
                <col.icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-body font-semibold text-sm text-foreground">{col.label}</h3>
                <span className="text-xs text-muted-foreground font-body bg-muted px-1.5 py-0.5 rounded-full">{col.tasks.length}</span>
              </div>
              <div className="space-y-3">
                {col.tasks.map(renderTaskCard)}
                {col.tasks.length === 0 && (
                  <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                    <p className="text-xs text-muted-foreground font-body">Nenhuma tarefa</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* New task sheet */}
      {/* Novo Modal Inline (Correção solicitada) */}
      {isNewTaskOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setIsNewTaskOpen(false)}
        >
          <div 
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-xl font-display font-bold mb-4 text-foreground">Nova Tarefa</h2>
            
            {/* Título */}
            <div className="mb-4">
              <label className="block text-sm font-body font-medium mb-1.5 text-foreground">Título *</label>
              <input
                type="text"
                autoFocus
                value={newTask.title}
                onChange={e => setNewTask({...newTask, title: e.target.value})}
                placeholder="O que precisa ser feito?"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Status */}
              <div>
                <label className="block text-sm font-body font-medium mb-1.5 text-foreground">Status</label>
                <select
                  value={newTask.status}
                  onChange={e => setNewTask({...newTask, status: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluida">Concluída</option>
                </select>
              </div>
              
              {/* Prioridade */}
              <div>
                <label className="block text-sm font-body font-medium mb-1.5 text-foreground">Prioridade</label>
                <select
                  value={newTask.priority}
                  onChange={e => setNewTask({...newTask, priority: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="media">Normal</option>
                  <option value="urgente">Urgente</option>
                  <option value="alta">Alta</option>
                  <option value="baixa">Baixa</option>
                </select>
              </div>
            </div>
            
            {/* Data */}
            <div className="mb-4">
              <label className="block text-sm font-body font-medium mb-1.5 text-foreground">Data de vencimento</label>
              <input
                type="date"
                value={newTask.due_date}
                onChange={e => setNewTask({...newTask, due_date: e.target.value})}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
            
            {/* Post associado */}
            <div className="mb-4">
              <label className="block text-sm font-body font-medium mb-1.5 text-foreground">Post associado (opcional)</label>
              <select
                value={newTask.post_id || ''}
                onChange={e => setNewTask({...newTask, post_id: e.target.value || null})}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              >
                <option value="">Nenhum</option>
                {posts?.map(post => (
                  <option key={post.id} value={post.id}>
                    {post.title} — {post.scheduled_date || post.created_at?.slice(0,10)}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Notas */}
            <div className="mb-6">
              <label className="block text-sm font-body font-medium mb-1.5 text-foreground">Notas</label>
              <textarea
                value={newTask.notes}
                onChange={e => setNewTask({...newTask, notes: e.target.value})}
                placeholder="Observações importantes..."
                rows={3}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
            
            {/* Botões */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsNewTaskOpen(false)}
                className="flex-1 border border-border hover:bg-muted rounded-xl py-2 text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl py-2 text-sm font-medium transition-colors shadow-lg"
              >
                Salvar tarefa
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPost && (
        <PostPreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          title={selectedPost.title}
          hook={selectedPost.hook || ""}
          caption={selectedPost.caption || ""}
          platform={selectedPost.platform}
          format={selectedPost.format}
          userName={profile?.name || user?.email?.split("@")[0] || "Usuário"}
          userHandle={profile?.name?.toLowerCase().replace(/\s/g, "") || "usuario"}
          avatarUrl={profile?.avatar_url || null}
        />
      )}
    </div>
  );
};

export default Tarefas;