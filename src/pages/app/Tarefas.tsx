import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Plus, Calendar, Link2, Trash2, ListTodo, Pencil, Repeat, X, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { hojeBR, parseDateOnly } from "@/lib/date-br";
import { PostPreviewModal } from "@/components/kanban/PostPreviewModal";
import { usePostPreviewIdentity } from "@/hooks/usePostPreviewIdentity";
import { useTasks, type Task } from "@/hooks/useTasks";
import { usePosts, type Post } from "@/hooks/usePosts";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { sanitizeText } from "@/lib/sanitize";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useTarefasExtras, passosDe, ROTULO_REPETICAO,
  type Passo, type Repeticao, type TarefaExtra,
} from "@/hooks/useTarefasExtras";

/* ═══════════════════════════════════════════════════════════════════════════
   TAREFAS COMO BLOCO DO DIA (Walter, 06/11/2026, mockup aprovado)

   A tela abre no dia de hoje, num bloco de checklist pautado com a data na
   cola: marcar é um toque, criar é escrever na última linha e apertar Enter.
   Do lado, post-its: o que atrasou (passar tudo pra hoje ou escolher outro
   dia), os passos de uma tarefa e o resumo da semana. As três colunas de antes
   continuam na visão Semana. No celular: arrastar pro lado conclui, segurar
   abre pra editar.
   ═══════════════════════════════════════════════════════════════════════════ */

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

type Visao = "hoje" | "semana" | "atrasadas" | "feitas";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Segunda e domingo da semana de `hoje` (dias de calendário). */
function semanaDe(hoje: string): { ini: string; fim: string } {
  const d = parseDateOnly(hoje);
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  return { ini: iso(addDays(d, 1 - dow)), fim: iso(addDays(d, 7 - dow)) };
}

function diasEntre(a: string, b: string): number {
  return Math.round((parseDateOnly(b).getTime() - parseDateOnly(a).getTime()) / 86400000);
}

function rotuloAtraso(due: string, hoje: string): string {
  const n = diasEntre(due, hoje);
  return n === 1 ? "ontem" : `${n} dias`;
}

const Tarefas = () => {
  const { user } = useAuth();
  const { tasks: tasksBrutas, isLoading, createTask, updateTask, updateTaskStatus, deleteTask } = useTasks();
  const { temExtras, salvarExtras, alternar, moverPrazo } = useTarefasExtras();
  const tasks = tasksBrutas as TarefaExtra[];
  const { posts } = usePosts();
  const [visao, setVisao] = useState<Visao>("hoje");
  const [soSemana, setSoSemana] = useState(true);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [editando, setEditando] = useState<TarefaExtra | null>(null);
  const [repeticao, setRepeticao] = useState<Repeticao | "">("");
  const [passos, setPassos] = useState<Passo[]>([]);
  const [novoPasso, setNovoPasso] = useState("");
  const [rapida, setRapida] = useState("");
  const [focoId, setFocoId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const previewIdentity = usePostPreviewIdentity(selectedPost?.external_client_id ?? null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", priority: "media", due_date: "", status: "pendente", notes: "", post_id: null },
  });

  const today = hojeBR();
  const { ini, fim } = semanaDe(today);
  const feita = (t: TarefaExtra) => t.status === "concluida";

  // O BLOCO DE HOJE: vence hoje (feitas ou não) e as sem prazo que ainda faltam.
  const doDia = useMemo(() => {
    const lista = tasks.filter((t) => (t.due_date === today) || (!t.due_date && !feita(t)));
    return [...lista].sort((a, b) => Number(feita(a)) - Number(feita(b)));
  }, [tasks, today]);
  const atrasadas = useMemo(() => tasks.filter((t) => t.due_date && t.due_date < today && !feita(t))
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1)), [tasks, today]);
  const daSemana = tasks.filter((t) => t.due_date && t.due_date >= ini && t.due_date <= fim);
  const semanaFeitas = daSemana.filter(feita).length;
  const semanaFaltam = daSemana.length - semanaFeitas;
  const feitasHoje = doDia.filter(feita).length;
  const comPassos = temExtras ? (tasks.find((t) => t.id === focoId) ?? tasks.find((t) => !feita(t) && passosDe(t).length > 0)) : undefined;

  const listaSemana = tasks.filter((t) => !soSemana || !t.due_date || (t.due_date >= ini && t.due_date <= fim) || (t.due_date < today && !feita(t)));
  const grouped = {
    pendente: listaSemana.filter((t) => t.status === "pendente" || !t.status),
    em_andamento: listaSemana.filter((t) => t.status === "em_andamento"),
    concluida: listaSemana.filter((t) => t.status === "concluida"),
  };
  const feitasTodas = tasks.filter(feita).sort((a, b) =>
    (b.concluida_em ?? b.updated_at ?? "") < (a.concluida_em ?? a.updated_at ?? "") ? -1 : 1);

  const openNew = () => {
    setEditando(null);
    reset({ title: "", priority: "media", due_date: today, status: "pendente", notes: "", post_id: null });
    setRepeticao(""); setPassos([]); setNovoPasso("");
    setIsNewTaskOpen(true);
  };

  const openEdit = (task: TarefaExtra) => {
    setEditando(task);
    reset({
      title: task.title,
      priority: (task.priority ?? "media") as TaskFormData["priority"],
      due_date: task.due_date ?? "",
      status: (task.status ?? "pendente") as TaskFormData["status"],
      notes: task.description ?? "",
      post_id: task.post_id ?? null,
    });
    setRepeticao(task.repeticao ?? ""); setPassos(passosDe(task)); setNovoPasso("");
    setIsNewTaskOpen(true);
  };

  const extrasDoForm = () => {
    const extra = novoPasso.trim() ? [...passos, { texto: sanitizeText(novoPasso.trim()), feito: false }] : passos;
    return { repeticao: (repeticao || null) as Repeticao | null, passos: extra };
  };

  const onSubmit = async (data: TaskFormData) => {
    if (!user) return;
    const base = {
      title: sanitizeText(data.title),
      description: data.notes ? sanitizeText(data.notes) : null,
      priority: data.priority,
      status: data.status,
      due_date: data.due_date || null,
      post_id: data.post_id || null,
    };
    try {
      if (editando) {
        await updateTask.mutateAsync({ id: editando.id, ...base });
        if (temExtras) await salvarExtras.mutateAsync({ id: editando.id, ...extrasDoForm() });
        toast.success("Tarefa atualizada!");
      } else {
        const nova = await createTask.mutateAsync(base);
        const ex = extrasDoForm();
        if (temExtras && (ex.repeticao || ex.passos.length)) await salvarExtras.mutateAsync({ id: nova.id, ...ex });
        toast.success("Tarefa criada!");
      }
      setIsNewTaskOpen(false);
      setEditando(null);
    } catch {
      toast.error("Erro ao salvar a tarefa.");
    }
  };

  const criarRapida = async () => {
    const titulo = rapida.trim();
    if (!titulo || !user) return;
    setRapida("");
    try {
      await createTask.mutateAsync({
        title: sanitizeText(titulo).slice(0, 100), description: null, priority: "media",
        status: "pendente", due_date: today, post_id: null,
      });
    } catch {
      setRapida(titulo);
      toast.error("Erro ao criar tarefa.");
    }
  };

  const toggleComplete = async (task: TarefaExtra) => {
    try {
      const r = await alternar.mutateAsync(task);
      if (r.proxima) toast.success(`Feita. A próxima já está marcada pra ${format(parseDateOnly(r.proxima), "dd/MM")}.`);
    } catch {
      toast.error("Erro ao atualizar tarefa.");
    }
  };

  const moverPara = async (task: Task, status: "pendente" | "em_andamento") => {
    try { await updateTaskStatus.mutateAsync({ id: task.id, status }); }
    catch { toast.error("Erro ao mover a tarefa."); }
  };

  const passarPra = async (ids: string[], due: string) => {
    try {
      await moverPrazo.mutateAsync({ ids, due });
      toast.success(ids.length > 1 ? `${ids.length} tarefas passaram pra ${due === today ? "hoje" : format(parseDateOnly(due), "dd/MM")}.` : "Prazo atualizado.");
    } catch { toast.error("Erro ao mudar o prazo."); }
  };

  const alternarPasso = async (t: TarefaExtra, i: number) => {
    const lista = passosDe(t).map((p, k) => (k === i ? { ...p, feito: !p.feito } : p));
    try { await salvarExtras.mutateAsync({ id: t.id, passos: lista }); }
    catch { toast.error("Erro ao marcar o passo."); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Excluir esta tarefa?")) return;
    try {
      await deleteTask.mutateAsync(id);
      toast.success("Tarefa removida.");
      setIsNewTaskOpen(false); setEditando(null);
    } catch { toast.error("Erro ao remover tarefa."); }
  };

  const handlePostPreview = (postId: string) => {
    const p = posts.find((post) => post.id === postId);
    if (p) { setSelectedPost(p); setPreviewOpen(true); }
  };

  const abas: { key: Visao; label: string }[] = [
    { key: "hoje", label: "Hoje" },
    { key: "semana", label: "Semana" },
    { key: "atrasadas", label: atrasadas.length ? `Atrasadas · ${atrasadas.length}` : "Atrasadas" },
    { key: "feitas", label: "Feitas" },
  ];

  const dataCola = format(parseDateOnly(today), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 md:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-sm shrink-0">
              <ListTodo className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
            <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Tarefas</h1>
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none order-3 md:order-none w-full md:w-auto">
            {abas.map((a) => (
              <button key={a.key} type="button" onClick={() => setVisao(a.key)}
                className={cn("px-3.5 h-9 rounded-full text-sm font-body font-bold whitespace-nowrap border-2 transition-colors",
                  visao === a.key ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-foreground/80 hover:bg-muted",
                  a.key === "atrasadas" && atrasadas.length > 0 && visao !== a.key && "text-destructive")}>
                {a.label}
              </button>
            ))}
          </div>
          <Button data-tour="tarefas-nova" variant="hero" onClick={openNew} className="md:ml-auto"><Plus className="h-4 w-4 mr-2" /> Nova tarefa</Button>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6">
            <div className="h-80 rounded-2xl bg-muted animate-pulse" />
            <div className="space-y-4"><div className="h-36 rounded-xl bg-muted animate-pulse" /><div className="h-36 rounded-xl bg-muted animate-pulse" /></div>
          </div>
        )}

        {!isLoading && tasks.length === 0 && visao !== "hoje" && (
          <EmptyState
            icon={ListTodo}
            cor="verde"
            title="O que falta pra esse post sair?"
            description="Tarefa aqui não é lista de afazeres da vida. É o que emperra a produção: gravar, editar, escrever a legenda, mandar pro cliente aprovar. Você vê o que trava e destrava."
            examples={["gravar o reel dos bastidores", "escrever a legenda do carrossel de segunda", "cobrar a aprovação da Gabi"]}
            action={{ label: "Criar minha primeira tarefa", onClick: openNew }}
          />
        )}

        {/* HOJE: o bloco do dia e os post-its */}
        {!isLoading && visao === "hoje" && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6 items-start">
            <div className="rounded-[18px] border-2 border-foreground bg-[#FFFCF3] dark:bg-card shadow-[6px_6px_0_hsl(var(--foreground))] overflow-hidden">
              <div className="bg-[#EB4918] text-white px-5 py-2 font-body font-extrabold text-[12px] uppercase tracking-wider">{dataCola}</div>
              <div className="px-4 sm:px-5 pt-4 pb-5"
                style={{ backgroundImage: "repeating-linear-gradient(transparent 0 51px, rgba(201,182,150,.35) 51px 52px)", backgroundPosition: "0 44px" }}>
                <p className="font-display font-extrabold text-[22px] leading-none">
                  O que sai hoje{" "}
                  <span className="text-[13px] font-body font-semibold text-muted-foreground">{feitasHoje} de {doDia.length} {doDia.length === 1 ? "feita" : "feitas"}</span>
                </p>
                <div className="mt-3">
                  {doDia.map((t) => (
                    <LinhaTarefa key={t.id} t={t} hoje={today}
                      onToggle={() => void toggleComplete(t)} onEditar={() => openEdit(t)}
                      onFoco={() => setFocoId(t.id)} onPost={handlePostPreview} />
                  ))}
                  {/* Criar rápido: escreve na última linha e aperta Enter. */}
                  <div className="flex items-center gap-3 h-[52px]">
                    <span className="h-5 w-5 rounded-[5px] border-2 border-dashed border-foreground/40 shrink-0" />
                    <input value={rapida} onChange={(e) => setRapida(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void criarRapida(); } }}
                      placeholder="Escreva e aperte Enter"
                      aria-label="Nova tarefa pra hoje"
                      className="flex-1 min-w-0 bg-transparent outline-none text-[15px] font-body placeholder:text-muted-foreground" />
                  </div>
                </div>
                {doDia.length > 0 && (
                  <div className="mt-3 h-2 rounded-full border-2 border-foreground bg-background overflow-hidden">
                    <div className="h-full bg-[#00A652] transition-all" style={{ width: `${Math.round((feitasHoje / doDia.length) * 100)}%` }} />
                  </div>
                )}
                <p className="md:hidden mt-3 text-center text-[11.5px] font-body text-muted-foreground">Arraste pro lado pra concluir, segure pra editar</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Post-it das atrasadas */}
              {atrasadas.length > 0 && (
                <div className="bg-[#FFCF03] text-[#1d1b18] rounded-[4px] p-4 -rotate-[0.6deg] shadow-[3px_4px_0_rgba(0,0,0,.14)]">
                  <p className="font-display font-extrabold text-[16px]">Atrasadas · {atrasadas.length}</p>
                  <div className="mt-2 space-y-1.5">
                    {atrasadas.slice(0, 6).map((t) => (
                      <div key={t.id} className="flex items-center gap-2.5">
                        <Checkbox checked={false} onCheckedChange={() => void toggleComplete(t)} className="bg-white border-[#1d1b18]" />
                        <button type="button" onClick={() => openEdit(t)} className="flex-1 min-w-0 text-left text-[14px] font-body truncate">{t.title}</button>
                        <span className="text-[11.5px] font-body font-bold text-[#B42318] shrink-0">{rotuloAtraso(t.due_date!, today)}</span>
                        <OutroDia onEscolher={(d) => void passarPra([t.id], d)} />
                      </div>
                    ))}
                    {atrasadas.length > 6 && <p className="text-[12px] font-body">e mais {atrasadas.length - 6}</p>}
                  </div>
                  <button type="button" onClick={() => void passarPra(atrasadas.map((t) => t.id), today)}
                    className="mt-3 text-[13px] font-body font-extrabold underline underline-offset-2">
                    Passar tudo pra hoje
                  </button>
                </div>
              )}

              {/* Post-it dos passos */}
              {comPassos && passosDe(comPassos).length > 0 && (
                <div className="bg-[#FF77B9]/35 dark:bg-[#FF77B9]/20 rounded-[4px] p-4 rotate-[0.5deg] shadow-[3px_4px_0_rgba(0,0,0,.12)]">
                  <button type="button" onClick={() => openEdit(comPassos)} className="font-display font-extrabold text-[16px] text-left">{comPassos.title}</button>
                  <div className="mt-2 space-y-1.5">
                    {passosDe(comPassos).map((p, i) => (
                      <label key={i} className="flex items-center gap-2.5 text-[14px] font-body cursor-pointer">
                        <Checkbox checked={p.feito} onCheckedChange={() => void alternarPasso(comPassos, i)} className="bg-white" />
                        <span className={cn(p.feito && "line-through text-muted-foreground")}>{p.texto}</span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-[11.5px] font-body text-foreground/70">
                    {passosDe(comPassos).filter((p) => p.feito).length} de {passosDe(comPassos).length} passos
                  </p>
                </div>
              )}

              {/* Post-it da semana */}
              <button type="button" onClick={() => setVisao("semana")}
                className="block w-full text-left bg-[#00A652]/20 dark:bg-[#00A652]/15 rounded-[4px] p-4 -rotate-[0.4deg] shadow-[3px_4px_0_rgba(0,0,0,.12)]">
                <p className="font-display font-extrabold text-[16px]">Semana</p>
                <p className="font-display font-extrabold text-[24px] text-[#00753A] leading-tight mt-1">
                  {semanaFeitas} {semanaFeitas === 1 ? "feita" : "feitas"}, {semanaFaltam} {semanaFaltam === 1 ? "falta" : "faltam"}
                </p>
                <p className="text-[12px] font-body text-foreground/70 mt-1">Toque pra ver a semana em colunas.</p>
              </button>
            </div>
          </div>
        )}

        {/* SEMANA: as três colunas de antes */}
        {!isLoading && visao === "semana" && tasks.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-4 text-[13px] font-body">
              <button type="button" onClick={() => setSoSemana(true)} className={cn("px-3 h-8 rounded-full border", soSemana ? "bg-foreground text-background border-foreground" : "border-border")}>Esta semana</button>
              <button type="button" onClick={() => setSoSemana(false)} className={cn("px-3 h-8 rounded-full border", !soSemana ? "bg-foreground text-background border-foreground" : "border-border")}>Todas</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(["pendente", "em_andamento", "concluida"] as const).map((status) => (
                <div key={status} className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-display font-semibold text-foreground">{status === "pendente" ? "Pendente" : status === "em_andamento" ? "Em andamento" : "Concluída"}</h3>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-body">{grouped[status].length}</span>
                  </div>
                  {grouped[status].map((t) => (
                    <CartaoTarefa key={t.id} t={t} hoje={today} onToggle={() => void toggleComplete(t)}
                      onEditar={() => openEdit(t)} onExcluir={() => void handleDelete(t.id)} onPost={handlePostPreview}
                      onMover={t.status !== "concluida" ? () => void moverPara(t, t.status === "em_andamento" ? "pendente" : "em_andamento") : undefined} />
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ATRASADAS e FEITAS: lista simples */}
        {!isLoading && (visao === "atrasadas" || visao === "feitas") && tasks.length > 0 && (
          <div className="max-w-2xl space-y-3">
            {visao === "atrasadas" && atrasadas.length > 0 && (
              <Button variant="outline" onClick={() => void passarPra(atrasadas.map((t) => t.id), today)}>Passar tudo pra hoje</Button>
            )}
            {(visao === "atrasadas" ? atrasadas : feitasTodas).map((t) => (
              <CartaoTarefa key={t.id} t={t} hoje={today} onToggle={() => void toggleComplete(t)}
                onEditar={() => openEdit(t)} onExcluir={() => void handleDelete(t.id)} onPost={handlePostPreview}
                extra={visao === "atrasadas" ? <OutroDia onEscolher={(d) => void passarPra([t.id], d)} rotulo /> : undefined} />
            ))}
            {(visao === "atrasadas" ? atrasadas : feitasTodas).length === 0 && (
              <p className="text-sm font-body text-muted-foreground py-10 text-center">
                {visao === "atrasadas" ? "Nada atrasado. Bom sinal." : "Nenhuma tarefa feita ainda."}
              </p>
            )}
          </div>
        )}
      </motion.div>

      <Dialog open={isNewTaskOpen} onOpenChange={(o) => { setIsNewTaskOpen(o); if (!o) setEditando(null); }}>
        <DialogContent className="sm:max-w-md bg-background rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-6 space-y-5 overflow-y-auto min-h-0 flex-1">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">{editando ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label className="font-body text-sm">O que precisa ser feito?</Label>
                <Input placeholder="Ex: Gravar reels de moda" {...register("title")} className="rounded-xl h-11" />
                {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-body text-sm">Prioridade</Label>
                  <select {...register("priority")} className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Prazo</Label>
                  <Input type="date" {...register("due_date")} className="rounded-xl h-11" />
                </div>
              </div>

              {temExtras && (
                <div className="space-y-2">
                  <Label className="font-body text-sm">Repetir</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {([["", "Não repete"], ["dia", "Todo dia"], ["semana", "Toda semana"], ["mes", "Todo mês"]] as const).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setRepeticao(v)}
                        className={cn("px-3 h-8 rounded-full border text-xs font-body font-bold", repeticao === v ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground")}>{l}</button>
                    ))}
                  </div>
                  {repeticao && <p className="text-[11.5px] font-body text-muted-foreground">Quando você marcar como feita, a próxima já nasce com o prazo certo.</p>}
                </div>
              )}

              {temExtras && (
                <div className="space-y-2">
                  <Label className="font-body text-sm">Passos</Label>
                  <div className="space-y-1.5">
                    {passos.map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Checkbox checked={p.feito} onCheckedChange={() => setPassos((l) => l.map((x, k) => (k === i ? { ...x, feito: !x.feito } : x)))} />
                        <span className={cn("flex-1 text-sm font-body", p.feito && "line-through text-muted-foreground")}>{p.texto}</span>
                        <button type="button" aria-label="Tirar passo" onClick={() => setPassos((l) => l.filter((_, k) => k !== i))} className="p-1 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    <input value={novoPasso} onChange={(e) => setNovoPasso(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const v = novoPasso.trim();
                          if (v) { setPassos((l) => [...l, { texto: sanitizeText(v), feito: false }]); setNovoPasso(""); }
                        }
                      }}
                      placeholder="Novo passo e Enter"
                      className="w-full h-9 rounded-xl border border-dashed border-border bg-background px-3 text-sm font-body outline-none focus:border-primary" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="font-body text-sm">Vincular a um post (opcional)</Label>
                <select value={watch("post_id") ?? ""} onChange={(e) => setValue("post_id", e.target.value || null)}
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Nenhum</option>
                  {posts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="font-body text-sm">Notas</Label>
                <Textarea placeholder="Detalhes da tarefa..." {...register("notes")} className="rounded-xl min-h-[70px]" />
                {errors.notes && <p className="text-xs text-destructive mt-1">{errors.notes.message}</p>}
              </div>

              <div className="pt-2 flex gap-3">
                {editando && (
                  <Button type="button" variant="outline" size="icon" aria-label="Excluir tarefa" onClick={() => void handleDelete(editando.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setIsNewTaskOpen(false); setEditando(null); }}>Cancelar</Button>
                <Button type="submit" variant="hero" className="flex-1" disabled={createTask.isPending || updateTask.isPending || salvarExtras.isPending}>
                  {createTask.isPending || updateTask.isPending ? "Salvando…" : editando ? "Salvar tarefa" : "Criar tarefa"}
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

/* Etiquetas da linha: prioridade alta/urgente, post ligado, repetição, atraso. */
function Etiquetas({ t, hoje, onPost }: { t: TarefaExtra; hoje: string; onPost: (id: string) => void }) {
  const atrasada = t.due_date && t.due_date < hoje && t.status !== "concluida";
  return (
    <span className="flex items-center gap-1.5 shrink-0">
      {(t.priority === "alta" || t.priority === "urgente") && (
        <span className={cn("text-[10.5px] font-body font-bold px-2 py-0.5 rounded-full border border-foreground/70", t.priority === "urgente" ? "bg-[#FF77B9]/60" : "bg-[#FFCF03]")}>
          {t.priority === "urgente" ? "urgente" : "alta"}
        </span>
      )}
      {t.post_id && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onPost(t.post_id!); }}
          className="text-[10.5px] font-body font-bold px-2 py-0.5 rounded-full border border-foreground/70 bg-[#00A652]/20">post</button>
      )}
      {t.repeticao && (
        <span className="inline-flex items-center gap-0.5 text-[10.5px] font-body font-bold text-[#0061EE]">
          <Repeat className="h-3 w-3" />{ROTULO_REPETICAO[t.repeticao]}
        </span>
      )}
      {atrasada && <span className="text-[10.5px] font-body font-bold text-destructive">{rotuloAtraso(t.due_date!, hoje)}</span>}
      {!t.due_date && t.status !== "concluida" && <span className="text-[10.5px] font-body text-muted-foreground">sem prazo</span>}
    </span>
  );
}

/* UMA LINHA DO BLOCO. No celular: arrastar pra direita conclui, segurar abre. */
function LinhaTarefa({ t, hoje, onToggle, onEditar, onFoco, onPost }: {
  t: TarefaExtra; hoje: string; onToggle: () => void; onEditar: () => void; onFoco: () => void; onPost: (id: string) => void;
}) {
  const [dx, setDx] = useState(0);
  const ini = useRef<{ x: number; y: number; segurou: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const feita = t.status === "concluida";
  const qtdPassos = passosDe(t).length;

  const soltar = () => { if (timer.current) clearTimeout(timer.current); };
  return (
    <div className="relative h-[52px] overflow-hidden">
      {dx > 0 && (
        <div className="absolute inset-0 flex items-center pl-3 bg-[#00A652]/20 text-[#00753A] text-xs font-body font-bold rounded-md">
          {feita ? "desmarcar" : "concluir"}
        </div>
      )}
      <div className="relative h-full flex items-center gap-3 bg-transparent touch-pan-y select-none"
        style={{ transform: `translateX(${dx}px)`, transition: ini.current ? "none" : "transform .2s" }}
        onPointerDown={(e) => {
          if (e.pointerType !== "touch") return;
          ini.current = { x: e.clientX, y: e.clientY, segurou: false };
          timer.current = setTimeout(() => { if (ini.current) { ini.current.segurou = true; navigator.vibrate?.(15); onEditar(); } }, 550);
        }}
        onPointerMove={(e) => {
          const s = ini.current; if (!s) return;
          const mx = e.clientX - s.x, my = e.clientY - s.y;
          if (Math.abs(mx) > 8 || Math.abs(my) > 8) soltar();
          if (mx > 0 && Math.abs(mx) > Math.abs(my)) setDx(Math.min(mx, 140));
        }}
        onPointerUp={() => {
          soltar();
          const passou = dx > 90;
          ini.current = null; setDx(0);
          if (passou) onToggle();
        }}
        onPointerCancel={() => { soltar(); ini.current = null; setDx(0); }}
      >
        <Checkbox checked={feita} onCheckedChange={onToggle} aria-label={feita ? "Desmarcar" : "Concluir"}
          className="h-5 w-5 rounded-[5px] border-2 border-foreground data-[state=checked]:bg-[#00A652] data-[state=checked]:border-foreground" />
        <button type="button" onClick={() => { onFoco(); onEditar(); }}
          className={cn("flex-1 min-w-0 text-left text-[15px] font-body truncate", feita && "line-through text-muted-foreground")}>
          {t.title}
          {qtdPassos > 0 && <span className="ml-1.5 text-[11px] text-muted-foreground no-underline">· {passosDe(t).filter((p) => p.feito).length}/{qtdPassos}</span>}
        </button>
        <Etiquetas t={t} hoje={hoje} onPost={onPost} />
      </div>
    </div>
  );
}

/* CARTÃO das visões Semana, Atrasadas e Feitas (o card de antes, com as etiquetas novas). */
function CartaoTarefa({ t, hoje, onToggle, onEditar, onExcluir, onPost, onMover, extra }: {
  t: TarefaExtra; hoje: string; onToggle: () => void; onEditar: () => void; onExcluir: () => void;
  onPost: (id: string) => void; onMover?: () => void; extra?: React.ReactNode;
}) {
  const badge = PRIORITY_BADGES[t.priority ?? "media"] || PRIORITY_BADGES.media;
  const isOverdue = t.due_date && t.due_date < hoje && t.status !== "concluida";
  return (
    <motion.div layout className="bg-card rounded-xl p-4 shadow-warm border border-border group hover:border-primary/30 transition-all">
      <div className="flex items-start gap-3">
        <Checkbox checked={t.status === "concluida"} onCheckedChange={onToggle} className="mt-1" />
        <div className="flex-1 min-w-0">
          <p className={cn("font-body font-medium text-foreground leading-tight mb-2", t.status === "concluida" && "line-through text-muted-foreground")}>{t.title}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md", badge.class)}>{badge.label}</span>
            {t.due_date && (
              <span className={cn("text-[10px] font-medium flex items-center gap-1", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                <Calendar className="h-2.5 w-2.5" />
                {format(parseDateOnly(t.due_date), "dd MMM", { locale: ptBR })}
              </span>
            )}
            {t.repeticao && (
              <span className="text-[10px] font-medium flex items-center gap-1 text-[#0061EE]"><Repeat className="h-2.5 w-2.5" />{ROTULO_REPETICAO[t.repeticao]}</span>
            )}
            {passosDe(t).length > 0 && (
              <span className="text-[10px] font-medium text-muted-foreground">{passosDe(t).filter((p) => p.feito).length}/{passosDe(t).length} passos</span>
            )}
            {t.description && <span className="block w-full text-[11px] font-body text-muted-foreground line-clamp-2 mt-0.5">{t.description}</span>}
            {onMover && (
              <button onClick={onMover} className="text-[10px] font-medium text-primary hover:underline">
                {t.status === "em_andamento" ? "voltar pra pendente" : "mover pra em andamento"}
              </button>
            )}
            {t.post_id && (
              <button onClick={() => onPost(t.post_id!)} className="text-[10px] font-medium text-primary hover:underline flex items-center gap-1">
                <Link2 className="h-2.5 w-2.5" /> Ver post
              </button>
            )}
            {extra}
          </div>
        </div>
        <button aria-label="Editar tarefa" onClick={onEditar} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 hover:bg-primary/10 rounded transition-all">
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button aria-label="Excluir tarefa" onClick={onExcluir} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 hover:bg-destructive/10 rounded transition-all">
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </button>
      </div>
    </motion.div>
  );
}

/* "Escolher outro dia": um seletor de data nativo escondido atrás de um ícone. */
function OutroDia({ onEscolher, rotulo }: { onEscolher: (d: string) => void; rotulo?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <span className="relative inline-flex shrink-0">
      <button type="button" aria-label="Escolher outro dia" title="Escolher outro dia"
        onClick={() => { const el = ref.current; if (!el) return; if (typeof el.showPicker === "function") el.showPicker(); else el.click(); }}
        className={cn("inline-flex items-center gap-1 text-[11px] font-body font-bold", rotulo ? "text-primary hover:underline" : "p-1 rounded hover:bg-black/10")}>
        <CalendarClock className="h-3.5 w-3.5" />{rotulo && "Escolher outro dia"}
      </button>
      <input ref={ref} type="date" tabIndex={-1} aria-hidden className="absolute inset-0 opacity-0 pointer-events-none"
        min={hojeBR()} onChange={(e) => { if (e.target.value) onEscolher(e.target.value); e.target.value = ""; }} />
    </span>
  );
}

export default Tarefas;
