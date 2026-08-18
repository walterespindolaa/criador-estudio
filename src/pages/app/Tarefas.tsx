import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Plus, Calendar, Link2, Trash2, ListTodo, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { hojeBR, toISODateBR } from "@/lib/date-br";
import { PostPreviewModal } from "@/components/kanban/PostPreviewModal";
import { usePostPreviewIdentity } from "@/hooks/usePostPreviewIdentity";
import { useTasks, type Task } from "@/hooks/useTasks";
import { usePosts, type Post } from "@/hooks/usePosts";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { sanitizeText } from "@/lib/sanitize";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const taskSchema = z.object({
  title: z.string().min(1, "Título é obrigatório").max(100, "Máximo 100 caracteres").trim(),
  priority: z.string(),
  due_date: z.string().optional().or(z.literal("")),
  status: z.string(),
  notes: z.string().max(500, "Máximo 500 caracteres").optional().or(z.literal("")),
  post_id: z.string().optional().nullable(),
});

type TaskFormData = z.infer<typeof taskSchema>;

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
  const { tasks, isLoading, createTask, updateTask, updateTaskStatus, deleteTask } = useTasks();
  const { posts } = usePosts();
  const [filter, setFilter] = useState("todas");
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  // Tarefa em edição: o mesmo formulário serve pra criar e pra editar (antes
  // não existia edição nenhuma, só apagar e recriar).
  const [editando, setEditando] = useState<Task | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  // Prévia mostra o DONO do post: cliente do Cria Post (external_client_id) →
  // conta ativa → neutro. Nunca automaticamente o usuário logado.
  const previewIdentity = usePostPreviewIdentity(selectedPost?.external_client_id ?? null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      priority: "media",
      due_date: "",
      status: "pendente",
      notes: "",
      post_id: null,
    }
  });

  const today = hojeBR();

  const getWeekEnd = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = 7 - (day === 0 ? 7 : day);
    const end = new Date(d);
    end.setDate(d.getDate() + diff);
    return toISODateBR(end);
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
    setEditando(null);
    reset();
    setIsNewTaskOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditando(task);
    reset({
      title: task.title,
      priority: task.priority as TaskFormData["priority"],
      due_date: task.due_date ?? "",
      status: task.status as TaskFormData["status"],
      notes: task.description ?? "",
      post_id: task.post_id ?? null,
    });
    setIsNewTaskOpen(true);
  };

  const onSubmit = async (data: TaskFormData) => {
    if (!user) return;
    if (editando) {
      try {
        await updateTask.mutateAsync({
          id: editando.id,
          title: sanitizeText(data.title),
          description: data.notes ? sanitizeText(data.notes) : null,
          priority: data.priority,
          status: data.status,
          due_date: data.due_date || null,
          post_id: data.post_id || null,
        });
        toast.success("Tarefa atualizada!");
        setIsNewTaskOpen(false);
        setEditando(null);
      } catch {
        toast.error("Erro ao salvar a tarefa.");
      }
      return;
    }
    try {
      await createTask.mutateAsync({
        title: sanitizeText(data.title),
        description: data.notes ? sanitizeText(data.notes) : null,
        priority: data.priority,
        status: data.status,
        due_date: data.due_date || null,
        post_id: data.post_id || null,
      });
      toast.success("Tarefa criada!");
      setIsNewTaskOpen(false);
    } catch {
      toast.error("Erro ao criar tarefa.");
    }
  };

  const toggleComplete = async (task: Task) => {
    const newStatus = task.status === "concluida" ? "pendente" : "concluida";
    try {
      await updateTaskStatus.mutateAsync({ id: task.id, status: newStatus });
    } catch {
      toast.error("Erro ao atualizar tarefa.");
    }
  };

  // A coluna "em andamento" existia no board mas NÃO havia caminho pra ela: o
  // checkbox só alternava pendente/concluída. Agora o card tem o atalho.
  const moverPara = async (task: Task, status: "pendente" | "em_andamento") => {
    try {
      await updateTaskStatus.mutateAsync({ id: task.id, status });
    } catch {
      toast.error("Erro ao mover a tarefa.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Excluir esta tarefa?")) return;
    try {
      await deleteTask.mutateAsync(id);
      toast.success("Tarefa removida.");
    } catch {
      toast.error("Erro ao remover tarefa.");
    }
  };

  const handlePostPreview = (postId: string) => {
    const p = posts.find(post => post.id === postId);
    if (p) {
      setSelectedPost(p);
      setPreviewOpen(true);
    }
  };

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-3 min-w-0 md:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-sm shrink-0">
              <ListTodo className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Central de Tarefas</h1>
              <p className="text-muted-foreground font-body mt-0.5 text-sm">Tudo o que você precisa executar.</p>
            </div>
          </div>
          <Button data-tour="tarefas-nova" variant="hero" onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nova Tarefa</Button>
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-body font-medium transition-all whitespace-nowrap border",
                filter === f.key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Três colunas vazias não ensinam nada parecem um sistema que não
            carregou. Aqui a tela diz o que ela É antes de pedir a primeira tarefa. */}
        {/* Enquanto busca, esqueleto. Antes a tela caía no estado vazio
            ("crie sua primeira tarefa") mesmo pra quem já tinha tarefas, porque
            no primeiro render a lista ainda chega vazia. */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-3">
                <div className="h-5 w-28 rounded bg-muted animate-pulse" />
                <div className="h-24 rounded-xl bg-muted animate-pulse" />
                <div className="h-24 rounded-xl bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && tasks.length === 0 && (
          <EmptyState
            icon={ListTodo}
            cor="verde"
            title="O que falta pra esse post sair?"
            description="Tarefa aqui não é lista de afazeres da vida. É o que emperra a produção: gravar, editar, escrever a legenda, mandar pro cliente aprovar. Você vê o que trava e destrava."
            examples={[
              "gravar o reel dos bastidores",
              "escrever a legenda do carrossel de segunda",
              "cobrar a aprovação da Gabi",
            ]}
            action={{ label: "Criar minha primeira tarefa", onClick: openNew }}
          />
        )}

        <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-6", (isLoading || tasks.length === 0) && "hidden")}>
          {(["pendente", "em_andamento", "concluida"] as const).map(status => (
            <div key={status} className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-display font-semibold text-foreground capitalize">
                  {status.replace("_", " ")}
                </h3>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-body">
                  {grouped[status].length}
                </span>
              </div>

              <div className="space-y-3">
                {grouped[status].map(task => {
                  const badge = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.media;
                  const isOverdue = task.due_date && task.due_date < today && task.status !== "concluida";

                  return (
                    <motion.div
                      layout
                      key={task.id}
                      className="bg-card rounded-xl p-4 shadow-warm border border-border group hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={task.status === "concluida"}
                          onCheckedChange={() => toggleComplete(task)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-body font-medium text-foreground leading-tight mb-2",
                            task.status === "concluida" && "line-through text-muted-foreground"
                          )}>
                            {task.title}
                          </p>
                          
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md", badge.class)}>
                              {badge.label}
                            </span>
                            
                            {task.due_date && (
                              <span className={cn(
                                "text-[10px] font-medium flex items-center gap-1",
                                isOverdue ? "text-destructive" : "text-muted-foreground"
                              )}>
                                <Calendar className="h-2.5 w-2.5" />
                                {format(parseISO(task.due_date), "dd MMM", { locale: ptBR })}
                              </span>
                            )}

                            {/* A nota era gravada e nunca aparecia no card. */}
                            {task.description && (
                              <span className="block w-full text-[11px] font-body text-muted-foreground line-clamp-2 mt-0.5">{task.description}</span>
                            )}

                            {task.status !== "concluida" && (
                              <button
                                onClick={() => moverPara(task, task.status === "em_andamento" ? "pendente" : "em_andamento")}
                                className="text-[10px] font-medium text-primary hover:underline">
                                {task.status === "em_andamento" ? "voltar pra pendente" : "mover pra em andamento"}
                              </button>
                            )}

                            {task.post_id && (
                              <button
                                onClick={() => handlePostPreview(task.post_id!)}
                                className="text-[10px] font-medium text-primary hover:underline flex items-center gap-1"
                              >
                                <Link2 className="h-2.5 w-2.5" />
                                Ver post
                              </button>
                            )}
                          </div>
                        </div>
                        <button
                          aria-label="Editar tarefa"
                          onClick={() => openEdit(task)}
                          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 hover:bg-primary/10 rounded transition-all"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          aria-label="Excluir tarefa"
                          onClick={() => handleDelete(task.id)}
                          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 hover:bg-destructive/10 rounded transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <Dialog open={isNewTaskOpen} onOpenChange={(o) => { setIsNewTaskOpen(o); if (!o) setEditando(null); }}>
        <DialogContent className="sm:max-w-md bg-background rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-6 space-y-5">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">{editando ? "Editar tarefa" : "Nova Tarefa"}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label className="font-body text-sm">O que precisa ser feito?</Label>
                <Input
                  placeholder="Ex: Gravar reels de moda"
                  {...register("title")}
                  className="rounded-xl h-11"
                />
                {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-body text-sm">Prioridade</Label>
                  <select
                    {...register("priority")}
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Prazo (opcional)</Label>
                  <Input
                    type="date"
                    {...register("due_date")}
                    className="rounded-xl h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-body text-sm">Vincular a um post (opcional)</Label>
                <select
                  onChange={(e) => setValue("post_id", e.target.value || null)}
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Nenhum</option>
                  {posts.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="font-body text-sm">Notas</Label>
                <Textarea
                  placeholder="Detalhes da tarefa..."
                  {...register("notes")}
                  className="rounded-xl min-h-[80px]"
                />
                {errors.notes && <p className="text-xs text-destructive mt-1">{errors.notes.message}</p>}
              </div>

              <div className="pt-2 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setIsNewTaskOpen(false); setEditando(null); }}>
                  Cancelar
                </Button>
                <Button type="submit" variant="hero" className="flex-1" disabled={createTask.isPending || updateTask.isPending}>
                  {createTask.isPending || updateTask.isPending ? "Salvando…" : editando ? "Salvar tarefa" : "Criar Tarefa"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {selectedPost && (
        <PostPreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          title={selectedPost.title}
          hook={selectedPost.hook || ""}
          caption={selectedPost.caption || ""}
          platform={selectedPost.platform}
          format={selectedPost.format}
          userName={previewIdentity.name}
          userHandle={previewIdentity.handle}
          avatarUrl={previewIdentity.avatarUrl}
        />
      )}
    </div>
  );
};

export default Tarefas;
