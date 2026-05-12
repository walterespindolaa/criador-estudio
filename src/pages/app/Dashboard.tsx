import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Lightbulb, FileText, CheckCircle2, Sparkles, Copy, Check,
  ListChecks, Pencil, Trash2, Clock, Flame, ArrowRight, TrendingUp, LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getDailyInsight } from "@/lib/ai/claude";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, isWithinInterval, parseISO } from "date-fns";
import { sanitizeText } from "@/lib/sanitize";
import { useIdeas } from "@/hooks/useIdeas";
import { usePosts } from "@/hooks/usePosts";
import { useHabits } from "@/hooks/useHabits";
import { useTasks } from "@/hooks/useTasks";
import { BestTimeToPost } from "@/components/insights/BestTimeToPost";
import { SmartNotificationsCard } from "@/components/notifications/SmartNotificationsCard";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

const HOOKS_VIRAL = [
  { text: "Você sabia que [dado surpreendente]?", category: "curiosidade" },
  { text: "O erro que quase todo mundo comete sem perceber...", category: "problema" },
  { text: "3 coisas que eu faria diferente se começasse hoje", category: "storytelling" },
  { text: "Pare de [ação comum] se quiser [resultado]", category: "contraste" },
  { text: "A verdade que ninguém fala sobre [tema]", category: "polêmica" },
  { text: "Eu gastei [tempo] pra aprender isso — te conto em 60s", category: "curiosidade" },
  { text: "Se você [dor do público], esse vídeo é pra você", category: "identificação" },
  { text: "O segredo que [referência] não te conta", category: "promessa" },
  { text: "Todo mundo fala pra fazer X, mas ninguém fala que...", category: "contraste" },
  { text: "Eu perdi [algo] por não saber disso antes", category: "storytelling" },
  { text: "Você está fazendo [ação] errado. Veja porquê.", category: "problema" },
  { text: "O que [referência] faz que você não faz", category: "curiosidade" },
  { text: "Testei [método] por 30 dias. O resultado me surpreendeu.", category: "storytelling" },
  { text: "5 sinais de que você está [problema]", category: "identificação" },
  { text: "Por que [crença popular] está ERRADO", category: "polêmica" },
  { text: "Antes vs Depois de eu descobrir [solução]", category: "contraste" },
  { text: "Se eu pudesse voltar no tempo, diria isso a mim mesmo...", category: "storytelling" },
  { text: "Você NÃO precisa de [coisa cara] pra [resultado]", category: "promessa" },
  { text: "A fórmula que me ajudou a [resultado] em [tempo]", category: "promessa" },
  { text: "Me julga, mas eu faço [hábito controverso] e funciona", category: "polêmica" },
];

const getGreeting = (name: string) => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return `Bom dia, ${name}! ☀️`;
  if (h >= 12 && h < 18) return `Boa tarde, ${name}! 👋`;
  return `Boa noite, ${name}! 🌙`;
};

const getDaysOfWeek = () => {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const days = [];
  const dayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      name: dayNames[i],
      date: d.toISOString().split("T")[0],
      dayNum: d.getDate(),
      isToday: d.toISOString().split("T")[0] === today.toISOString().split("T")[0],
    });
  }
  return days;
};

type PeriodKey = "tudo" | "hoje" | "semana" | "quinzenal" | "mes" | "ano" | "personalizado";

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "tudo", label: "Tudo" },
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "quinzenal", label: "Quinzenal" },
  { key: "mes", label: "Mês" },
  { key: "ano", label: "Ano" },
  { key: "personalizado", label: "Personalizado" },
];

function getDateRange(period: PeriodKey, customRange?: { from: Date; to: Date }): { start: Date; end: Date } | null {
  const now = new Date();
  switch (period) {
    case "tudo": return null;
    case "hoje": return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: now };
    case "semana": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "quinzenal": return { start: subDays(now, 14), end: now };
    case "mes": return { start: startOfMonth(now), end: endOfMonth(now) };
    case "ano": return { start: startOfYear(now), end: endOfYear(now) };
    case "personalizado": return customRange ? { start: customRange.from, end: customRange.to } : null;
    default: return null;
  }
}

function isInRange(dateStr: string | null, range: { start: Date; end: Date } | null): boolean {
  if (!range || !dateStr) return !range;
  try {
    const d = parseISO(dateStr.split("T")[0]);
    return isWithinInterval(d, { start: range.start, end: range.end });
  } catch { return false; }
}

function DCard({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn("bg-card rounded-xl p-5 shadow-[var(--shadow-warm)] border border-border", className, onClick && "cursor-pointer hover:border-primary/30 transition-all")}
    >
      {children}
    </div>
  );
}

const Dashboard = () => {
  const { user } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const navigate = useNavigate();

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const weekDays = useMemo(() => getDaysOfWeek(), []);

  const { ideas, createIdea } = useIdeas();
  const { posts } = usePosts();
  const {
    habits,
    habitLogs,
    createHabit,
    updateHabit: updateHabitMutation,
    deleteHabit,
    toggleHabitLog,
  } = useHabits({ date: today });
  const { tasks } = useTasks();

  const [period, setPeriod] = useState<PeriodKey>("semana");
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date }>({ from: new Date(), to: new Date() });
  const [, setCustomOpen] = useState(false);

  const dateRange = useMemo(() => getDateRange(period, customRange), [period, customRange]);

  const [quickIdea, setQuickIdea] = useState("");
  const [, setAiInsight] = useState<string | null>(null);
  const [copiedHook, setCopiedHook] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editingHabitName, setEditingHabitName] = useState("");

  useEffect(() => {
    if (!user || !posts.length) return;
    const publishedPosts = posts.filter(p => p.status === "publicado");
    if (publishedPosts.length < 3) return;
    const cacheKey = `daily-insight-${user.id}-${today}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) { setAiInsight(cached); return; }
    const weekPosts = posts.filter(p => p.published_at && weekDays.some(d => d.date === p.published_at?.split("T")[0]));
    const pillarCounts: Record<string, number> = {};
    publishedPosts.forEach(p => { pillarCounts[p.platform] = (pillarCounts[p.platform] || 0) + 1; });
    const topPillar = Object.entries(pillarCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    getDailyInsight({
      postsThisWeek: weekPosts.length,
      weeklyGoal: profile?.weekly_goal || 3,
      topPillar,
      lastPublished: publishedPosts[publishedPosts.length - 1]?.published_at || "",
    }, user?.id)
      .then(insight => { if (insight) { setAiInsight(insight); localStorage.setItem(cacheKey, insight); } })
      .catch(() => { /* noop */ });
  }, [posts, user, profile, today, weekDays]);

  const handleQuickCapture = async () => {
    const sanitized = sanitizeText(quickIdea);
    if (!sanitized || !user) return;
    try {
      await createIdea.mutateAsync({ title: sanitized });
      toast.success("Ideia capturada!");
      setQuickIdea("");
    } catch {
      toast.error("Erro ao salvar ideia.");
    }
  };

  const handleToggleHabit = async (habitId: string) => {
    try {
      await toggleHabitLog.mutateAsync({ habitId, date: today });
    } catch {
      toast.error("Erro ao atualizar hábito.");
    }
  };

  const addHabit = async () => {
    const sanitized = sanitizeText(newHabitName);
    if (!sanitized) return;
    try {
      await createHabit.mutateAsync({ name: sanitized });
      setNewHabitName("");
      toast.success("Hábito adicionado!");
    } catch {
      toast.error("Erro ao adicionar hábito.");
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    try {
      await deleteHabit.mutateAsync(habitId);
      toast.success("Hábito removido.");
    } catch {
      toast.error("Erro ao remover hábito.");
    }
  };

  const handleUpdateHabit = async (habitId: string) => {
    const sanitized = sanitizeText(editingHabitName);
    if (!sanitized) return;
    try {
      await updateHabitMutation.mutateAsync({ id: habitId, name: sanitized });
      setEditingHabitId(null);
      setEditingHabitName("");
    } catch {
      toast.error("Erro ao atualizar hábito.");
    }
  };

  const handleCopyHook = async () => {
    await navigator.clipboard.writeText(dailyHook.text);
    setCopiedHook(true);
    setTimeout(() => setCopiedHook(false), 2000);
  };

  const filteredPosts = useMemo(() => {
    if (!dateRange) return posts;
    return posts.filter(p => isInRange(p.scheduled_date, dateRange) || isInRange(p.published_at, dateRange));
  }, [posts, dateRange]);

  const filteredTasks = useMemo(() => {
    if (!dateRange) return tasks;
    return tasks.filter(t => isInRange(t.due_date, dateRange));
  }, [tasks, dateRange]);

  const publishedFiltered = filteredPosts.filter(p => p.status === "publicado");
  const inCreationFiltered = filteredPosts.filter(p => p.status !== "publicado");
  const scheduledFiltered = filteredPosts.filter(p => p.scheduled_date && p.status !== "publicado");
  const pendingTasks = filteredTasks.filter(t => t.status === "pendente");
  const inProgressTasks = filteredTasks.filter(t => t.status === "em_andamento");

  const weekPublished = posts.filter(p => p.status === "publicado" && p.published_at && weekDays.some(d => d.date === p.published_at?.split("T")[0]));
  const weekGoal = profile?.weekly_goal || 3;

  const habitsToday = habitLogs.filter(l => l.done).length;

  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const dailyHook = HOOKS_VIRAL[dayOfYear % HOOKS_VIRAL.length];

  const stats = [
    { label: "Ideias", value: ideas.length, icon: Lightbulb, bg: "from-violet-500/15 to-purple-500/5", iconBg: "bg-violet-500", iconColor: "text-white", link: "/app/ideias" },
    { label: "Em criação", value: inCreationFiltered.length, icon: FileText, bg: "from-blue-500/15 to-sky-500/5", iconBg: "bg-blue-500", iconColor: "text-white", link: "/app/criando" },
    { label: "Publicados", value: publishedFiltered.length, icon: CheckCircle2, bg: "from-emerald-500/15 to-teal-500/5", iconBg: "bg-emerald-500", iconColor: "text-white", link: "/app/historico" },
    { label: "Agendados", value: scheduledFiltered.length, icon: Clock, bg: "from-amber-500/15 to-yellow-500/5", iconBg: "bg-amber-500", iconColor: "text-white", link: "/app/plano" },
    { label: "Tarefas abertas", value: pendingTasks.length + inProgressTasks.length, icon: ListChecks, bg: "from-pink-500/15 to-rose-500/5", iconBg: "bg-pink-500", iconColor: "text-white", link: "/app/tarefas" },
    { label: "Hábitos hoje", value: `${habitsToday}/${habits.length}`, icon: Flame, bg: "from-orange-500/15 to-red-500/5", iconBg: "bg-orange-500", iconColor: "text-white", link: "/app/plano" },
  ];

  if (profileLoading) {
    return (
      <div className="pb-20 md:pb-0">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-sm shrink-0">
              <LayoutDashboard className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-extrabold text-foreground tracking-tight mb-0.5">
                {getGreeting(profile?.name || "criador")}
              </h1>
              <p className="text-sm text-muted-foreground font-body flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                Sua meta: <span className="font-semibold text-foreground">{weekPublished.length}/{weekGoal}</span> posts esta semana
              </p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 bg-muted/50 rounded-full p-1 flex-wrap">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => {
                  setPeriod(opt.key);
                  if (opt.key === "personalizado") setCustomOpen(true);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all duration-200",
                  period === opt.key
                    ? "bg-card text-foreground shadow-warm-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          <div className="lg:col-span-8 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {stats.map((s, i) => (
                <motion.button
                  key={i}
                  onClick={() => navigate(s.link)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    "relative overflow-hidden bg-gradient-to-br p-5 rounded-2xl border border-border/50",
                    "hover:shadow-warm-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200",
                    "text-left w-full group cursor-pointer",
                    s.bg
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-sm", s.iconBg)}>
                    <s.icon className={cn("h-5 w-5", s.iconColor)} strokeWidth={1.75} />
                  </div>
                  <p className="text-3xl font-display font-extrabold text-foreground tracking-tight">{s.value}</p>
                  <p className="text-[11px] uppercase tracking-wider font-body font-semibold text-muted-foreground mt-0.5">{s.label}</p>
                  <ArrowRight className="absolute top-4 right-4 h-4 w-4 text-muted-foreground/30 group-hover:text-foreground/50 group-hover:translate-x-0.5 transition-all" />
                </motion.button>
              ))}
            </div>

            <DCard className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/10 border-primary/15 group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Sparkles className="h-24 w-24 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" /> Captura Rápida
              </h3>
              <div className="flex gap-2">
                <Input
                  placeholder="O que você está pensando?"
                  className="rounded-xl border-border bg-background/50 h-11"
                  value={quickIdea}
                  onChange={(e) => setQuickIdea(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleQuickCapture()}
                />
                <Button onClick={handleQuickCapture} variant="hero" size="lg">Capturar</Button>
              </div>
            </DCard>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <SmartNotificationsCard />
             <DCard>
              <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" /> Hábitos de Criação
              </h3>
              <div className="space-y-3">
                {habits.map(h => {
                  const done = habitLogs.some(l => l.habit_id === h.id && l.done);
                  return (
                    <div key={h.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={done} onCheckedChange={() => handleToggleHabit(h.id)} />
                        {editingHabitId === h.id ? (
                          <Input
                            value={editingHabitName}
                            onChange={(e) => setEditingHabitName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleUpdateHabit(h.id)}
                            onBlur={() => setEditingHabitId(null)}
                            className="h-8 text-sm py-0 rounded-lg"
                            autoFocus
                          />
                        ) : (
                          <span className={cn("text-sm font-body", done && "line-through text-muted-foreground")}>{h.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingHabitId(h.id); setEditingHabitName(h.name); }} className="p-1 hover:bg-accent rounded text-muted-foreground"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => handleDeleteHabit(h.id)} className="p-1 hover:bg-destructive/10 rounded text-destructive"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2">
                  <Input
                    placeholder="Novo hábito..."
                    className="h-9 text-xs rounded-xl"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addHabit()}
                  />
                </div>
              </div>
            </DCard>

            <BestTimeToPost posts={posts} />

            <DCard className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/50 dark:from-amber-500/10 dark:to-orange-500/5 dark:border-amber-500/20">
              <h3 className="text-sm font-display font-bold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-amber-500 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                Gancho do Dia
              </h3>
              <p className="text-sm font-body text-foreground italic mb-4 leading-relaxed">
                "{dailyHook.text}"
              </p>
              <Button variant="outline" size="sm" onClick={handleCopyHook} className="w-full bg-white/60 dark:bg-background/40 border-amber-300/40 hover:bg-white text-amber-700 dark:text-amber-300">
                {copiedHook ? <><Check className="h-3.5 w-3.5 mr-2" /> Copiado</> : <><Copy className="h-3.5 w-3.5 mr-2" /> Copiar hook</>}
              </Button>
            </DCard>
          </div>

        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
