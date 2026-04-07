import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Lightbulb, FileText, CheckCircle2, TrendingUp, Plus, Sparkles, ArrowRight, Copy, Check,
  Calendar, ListChecks, Pencil, Trash2, AlertTriangle, Clock, Eye, Send, BarChart3, Flame, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { getDailyInsight } from "@/lib/ai/claude";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { FORMAT_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Viral hooks ───
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

// ─── Period filter helpers ───
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

// ─── Types ───
interface Post { id: string; title: string; platform: string; format: string; status: string; scheduled_date: string | null; published_at: string | null; }
interface Pillar { id: string; name: string; color: string; }
interface HabitLog { id: string; habit_id: string; date: string; done: boolean; }
interface Habit { id: string; name: string; }
interface Task { id: string; title: string; priority: string; status: string; due_date: string | null; post_id: string | null; }
interface PostRef { id: string; title: string; platform: string; }

// ─── Dashboard Card wrapper ───
function DCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card rounded-2xl p-5 shadow-[var(--shadow-warm)] border border-border", className)}>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════
const Dashboard = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  // Period filter
  const [period, setPeriod] = useState<PeriodKey>("semana");
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date }>({ from: new Date(), to: new Date() });
  const [customOpen, setCustomOpen] = useState(false);

  const dateRange = useMemo(() => getDateRange(period, customRange), [period, customRange]);

  // Data
  const [ideaCount, setIdeaCount] = useState(0);
  const [posts, setPosts] = useState<Post[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [quickIdea, setQuickIdea] = useState("");
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [copiedHook, setCopiedHook] = useState(false);
  const [dayDrawerOpen, setDayDrawerOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [newHabitName, setNewHabitName] = useState("");
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editingHabitName, setEditingHabitName] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskPosts, setTaskPosts] = useState<PostRef[]>([]);

  const weekDays = useMemo(() => getDaysOfWeek(), []);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const [ideasRes, postsRes, pillarsRes, habitsRes, logsRes, tasksRes] = await Promise.all([
        supabase.from("ideas").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("posts").select("id, title, platform, format, status, scheduled_date, published_at").eq("user_id", user.id),
        supabase.from("pillars").select("*").eq("user_id", user.id).order("position"),
        supabase.from("habits").select("id, name").eq("user_id", user.id).order("position"),
        supabase.from("habit_logs").select("*").eq("user_id", user.id).eq("date", today),
        supabase.from("tasks").select("id, title, priority, status, due_date, post_id").eq("user_id", user.id),
      ]);
      setIdeaCount(ideasRes.count || 0);
      setPosts(postsRes.data || []);
      setPillars(pillarsRes.data || []);
      setHabits(habitsRes.data || []);
      setHabitLogs(logsRes.data || []);
      const allTasks = (tasksRes.data as any[]) || [];
      setTasks(allTasks);
      const postIds = [...new Set(allTasks.filter(t => t.post_id).map(t => t.post_id))];
      if (postIds.length > 0) {
        const { data: postRefs } = await supabase.from("posts").select("id, title, platform").in("id", postIds);
        setTaskPosts((postRefs as any[]) || []);
      }
    };
    fetchAll();
  }, [user]);

  // AI insight
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
    getDailyInsight({ postsThisWeek: weekPosts.length, weeklyGoal: profile?.weekly_goal || 3, topPillar, lastPublished: publishedPosts[publishedPosts.length - 1]?.published_at || "" }, user?.id)
      .then(insight => { if (insight) { setAiInsight(insight); localStorage.setItem(cacheKey, insight); } }).catch(() => {});
  }, [posts, user, profile]);

  // ─── Handlers ───
  const handleQuickCapture = async () => {
    if (!quickIdea.trim() || !user) return;
    const { error } = await supabase.from("ideas").insert({ user_id: user.id, title: quickIdea.trim() });
    if (error) { toast.error("Erro ao salvar ideia."); return; }
    toast.success("Ideia capturada!");
    setQuickIdea("");
    setIdeaCount(prev => prev + 1);
  };

  const toggleHabitLog = async (habitId: string) => {
    if (!user) return;
    const existing = habitLogs.find(l => l.habit_id === habitId && l.date === today);
    if (existing) {
      await supabase.from("habit_logs").update({ done: !existing.done }).eq("id", existing.id);
      setHabitLogs(prev => prev.map(l => l.id === existing.id ? { ...l, done: !l.done } : l));
    } else {
      const { data } = await supabase.from("habit_logs").insert({ user_id: user.id, habit_id: habitId, date: today, done: true }).select().single();
      if (data) setHabitLogs(prev => [...prev, data]);
    }
  };

  const addHabit = async () => {
    if (!newHabitName.trim() || !user) return;
    const { data, error } = await supabase.from("habits").insert({ user_id: user.id, name: newHabitName.trim(), position: habits.length }).select().single();
    if (error) { toast.error("Erro ao adicionar hábito."); return; }
    if (data) setHabits(prev => [...prev, data]);
    setNewHabitName("");
    toast.success("Hábito adicionado!");
  };

  const deleteHabit = async (habitId: string) => {
    await supabase.from("habit_logs").delete().eq("habit_id", habitId);
    await supabase.from("habits").delete().eq("id", habitId);
    setHabits(prev => prev.filter(h => h.id !== habitId));
    setHabitLogs(prev => prev.filter(l => l.habit_id !== habitId));
    toast.success("Hábito removido.");
  };

  const updateHabit = async (habitId: string) => {
    if (!editingHabitName.trim()) return;
    await supabase.from("habits").update({ name: editingHabitName.trim() }).eq("id", habitId);
    setHabits(prev => prev.map(h => h.id === habitId ? { ...h, name: editingHabitName.trim() } : h));
    setEditingHabitId(null);
    setEditingHabitName("");
  };

  const handleCopyHook = async () => {
    await navigator.clipboard.writeText(dailyHook.text);
    setCopiedHook(true);
    setTimeout(() => setCopiedHook(false), 2000);
  };

  // ─── Filtered data ───
  const filteredPosts = useMemo(() => {
    if (!dateRange) return posts;
    return posts.filter(p => isInRange(p.scheduled_date, dateRange) || isInRange(p.published_at, dateRange));
  }, [posts, dateRange]);

  const filteredTasks = useMemo(() => {
    if (!dateRange) return tasks;
    return tasks.filter(t => isInRange(t.due_date, dateRange));
  }, [tasks, dateRange]);

  // ─── Computed stats from filtered data ───
  const weekGoal = profile?.weekly_goal || 3;
  const publishedFiltered = filteredPosts.filter(p => p.status === "publicado");
  const inCreationFiltered = filteredPosts.filter(p => p.status !== "publicado");
  const scheduledFiltered = filteredPosts.filter(p => p.scheduled_date && p.status !== "publicado");
  const overdueTasks = filteredTasks.filter(t => t.due_date && t.due_date < today && t.status !== "concluida");
  const todayTasks = tasks.filter(t => t.due_date === today && t.status !== "concluida");
  const pendingTasks = filteredTasks.filter(t => t.status === "pendente");
  const inProgressTasks = filteredTasks.filter(t => t.status === "em_andamento");
  const doneTasks = filteredTasks.filter(t => t.status === "concluida");

  // Weekly progress (always based on actual week)
  const weekPublished = posts.filter(p => p.status === "publicado" && p.published_at && weekDays.some(d => d.date === p.published_at?.split("T")[0]));
  const weekProgress = Math.min(100, (weekPublished.length / weekGoal) * 100);
  const goalMet = weekPublished.length >= weekGoal;

  const habitsToday = habitLogs.filter(l => l.done).length;

  // Daily hook
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const dailyHook = HOOKS_VIRAL[dayOfYear % HOOKS_VIRAL.length];

  // Posts per platform
  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredPosts.forEach(p => { counts[p.platform] = (counts[p.platform] || 0) + 1; });
    return counts;
  }, [filteredPosts]);

  // Status pipeline
  const statusPipeline = useMemo(() => {
    const statuses = ["ideia", "rascunho", "em_producao", "pronto", "agendado", "publicado"];
    return statuses.map(s => ({ key: s, label: s === "em_producao" ? "Produção" : s.charAt(0).toUpperCase() + s.slice(1), count: filteredPosts.filter(p => p.status === s).length }));
  }, [filteredPosts]);

  // Day posts for dialog
  const dayPosts = selectedDay ? posts.filter(p => p.scheduled_date === selectedDay) : [];

  // Stats cards
  const stats = [
    { label: "Ideias", value: ideaCount, icon: Lightbulb, color: "text-primary", link: "/app/ideias" },
    { label: "Em criação", value: inCreationFiltered.length, icon: FileText, color: "text-muted-foreground", link: "/app/criando" },
    { label: "Publicados", value: publishedFiltered.length, icon: CheckCircle2, color: "text-primary", link: "/app/historico" },
    { label: "Agendados", value: scheduledFiltered.length, icon: Clock, color: "text-muted-foreground", link: "/app/plano" },
    { label: "Tarefas abertas", value: pendingTasks.length + inProgressTasks.length, icon: ListChecks, color: "text-primary", link: "/app/tarefas" },
    { label: "Hábitos hoje", value: `${habitsToday}/${habits.length}`, icon: Flame, color: "text-primary", link: "/app/plano" },
  ];

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* ─── Header row: greeting + period filter ─── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-0.5">
              {getGreeting(profile?.name || "criador")}
            </h1>
            <p className="text-sm text-muted-foreground font-body">
              Sua meta: {weekPublished.length}/{weekGoal} posts esta semana
            </p>
          </div>

          {/* Period filter */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 flex-wrap">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => {
                  setPeriod(opt.key);
                  if (opt.key === "personalizado") setCustomOpen(true);
                }}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-body font-medium transition-all",
                  period === opt.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date picker dialog */}
        <Dialog open={customOpen} onOpenChange={setCustomOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle className="font-display">Período personalizado</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs text-muted-foreground font-body mb-1">De</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left text-sm rounded-xl">
                      <Calendar className="h-4 w-4 mr-2" />
                      {format(customRange.from, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker mode="single" selected={customRange.from} onSelect={(d) => d && setCustomRange(prev => ({ ...prev, from: d }))} className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-body mb-1">Até</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left text-sm rounded-xl">
                      <Calendar className="h-4 w-4 mr-2" />
                      {format(customRange.to, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker mode="single" selected={customRange.to} onSelect={(d) => d && setCustomRange(prev => ({ ...prev, to: d }))} className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={() => setCustomOpen(false)} className="rounded-xl">Aplicar</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ─── Stats row ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <button onClick={() => navigate(stat.link)} className="w-full text-left">
                <DCard className="p-4 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex items-center gap-2 mb-1">
                    <stat.icon className={cn("h-4 w-4", stat.color, "group-hover:text-primary transition-colors")} />
                    <p className="text-[10px] text-muted-foreground font-body uppercase tracking-wider">{stat.label}</p>
                  </div>
                  <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
                </DCard>
              </button>
            </motion.div>
          ))}
        </div>

        {/* ─── Main grid ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT COLUMN (8 cols) */}
          <div className="lg:col-span-8 space-y-5">

            {/* Weekly progress */}
            <DCard>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-body font-semibold text-foreground">
                  {goalMet ? "Meta batida! 🎉" : "Progresso semanal"}
                </p>
                <span className="text-xs text-muted-foreground font-body">{weekPublished.length}/{weekGoal} — {Math.round(weekProgress)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div className={cn("h-2.5 rounded-full transition-all duration-500", goalMet ? "bg-secondary" : "bg-primary")} style={{ width: `${weekProgress}%` }} />
              </div>
            </DCard>

            {/* Alerts row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Overdue tasks */}
              {overdueTasks.length > 0 && (
                <DCard className="border-destructive/20 bg-destructive/5">
                  <p className="text-sm font-body font-semibold text-destructive flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4" /> {overdueTasks.length} tarefa{overdueTasks.length > 1 ? "s" : ""} atrasada{overdueTasks.length > 1 ? "s" : ""}
                  </p>
                  {overdueTasks.slice(0, 3).map(t => (
                    <div key={t.id} className="flex items-center gap-2 py-1">
                      <span className="text-sm font-body text-destructive truncate flex-1">{t.title}</span>
                      <span className="text-[10px] text-destructive/70 font-body flex-shrink-0">{t.due_date}</span>
                    </div>
                  ))}
                  <button onClick={() => navigate("/app/tarefas")} className="text-xs text-destructive font-body font-medium hover:underline flex items-center gap-1 mt-2">
                    Ver tarefas <ArrowRight className="h-3 w-3" />
                  </button>
                </DCard>
              )}

              {/* Today's tasks */}
              {todayTasks.length > 0 && (
                <DCard>
                  <p className="text-sm font-body font-semibold text-foreground flex items-center gap-2 mb-2">
                    <ListChecks className="h-4 w-4 text-primary" /> Para hoje ({todayTasks.length})
                  </p>
                  {todayTasks.slice(0, 4).map(t => (
                    <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                      <span className="text-sm font-body text-foreground truncate flex-1">{t.title}</span>
                      <span className={cn("text-[10px] font-body font-semibold px-1.5 py-0.5 rounded",
                        t.priority === "urgente" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                      )}>{t.priority}</span>
                    </div>
                  ))}
                </DCard>
              )}
            </div>

            {/* Pipeline de status */}
            <DCard>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Pipeline de conteúdo
                </p>
                <span className="text-[10px] text-muted-foreground font-body">{filteredPosts.length} posts no período</span>
              </div>
              <div className="flex gap-1 h-8 rounded-xl overflow-hidden bg-muted">
                {statusPipeline.filter(s => s.count > 0).map(s => (
                  <div
                    key={s.key}
                    className={cn(
                      "h-full flex items-center justify-center text-[10px] font-body font-semibold transition-all",
                      s.key === "publicado" ? "bg-secondary text-secondary-foreground" : "bg-primary/20 text-primary"
                    )}
                    style={{ width: `${Math.max(12, (s.count / Math.max(filteredPosts.length, 1)) * 100)}%` }}
                    title={`${s.label}: ${s.count}`}
                  >
                    {s.count > 0 && <span>{s.count}</span>}
                  </div>
                ))}
                {filteredPosts.length === 0 && (
                  <div className="w-full flex items-center justify-center text-[10px] text-muted-foreground font-body">Sem posts no período</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {statusPipeline.filter(s => s.count > 0).map(s => (
                  <span key={s.key} className="text-[10px] text-muted-foreground font-body flex items-center gap-1">
                    <span className={cn("w-2 h-2 rounded-full", s.key === "publicado" ? "bg-secondary" : "bg-primary/40")} />
                    {s.label} ({s.count})
                  </span>
                ))}
              </div>
            </DCard>

            {/* Mini week calendar */}
            <DCard>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-body font-semibold text-foreground">Esta semana</p>
                <button onClick={() => navigate("/app/plano")} className="text-xs text-primary font-body font-medium hover:underline flex items-center gap-1">
                  Ver plano <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map(day => {
                  const dayP = posts.filter(p => p.scheduled_date === day.date);
                  return (
                    <button
                      key={day.date}
                      onClick={() => { setSelectedDay(day.date); setDayDrawerOpen(true); }}
                      className={cn("flex flex-col items-center p-2 rounded-xl transition-colors",
                        day.isToday ? "border-2 border-primary bg-primary/5" : "border border-border hover:bg-accent"
                      )}
                    >
                      <span className={cn("text-[10px] font-body font-semibold", day.isToday ? "text-primary" : "text-muted-foreground")}>{day.name}</span>
                      <span className={cn("text-sm font-body font-bold", day.isToday ? "text-primary" : "text-foreground")}>{day.dayNum}</span>
                      <div className="flex gap-0.5 mt-1 min-h-[6px]">
                        {dayP.slice(0, 3).map(p => (<span key={p.id} className="w-1.5 h-1.5 rounded-full bg-primary" />))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </DCard>

            {/* Tasks kanban mini */}
            <DCard>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
                  <ListChecks className="h-4 w-4" /> Minhas Tarefas
                </p>
                <button onClick={() => navigate("/app/tarefas")} className="text-xs text-primary font-body font-medium hover:underline flex items-center gap-1">
                  Ver todas <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "pendente", label: "Pendente", items: pendingTasks },
                  { key: "em_andamento", label: "Em andamento", items: inProgressTasks },
                  { key: "concluida", label: "Concluída", items: doneTasks },
                ].map(col => (
                  <div key={col.key}>
                    <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2">{col.label} ({col.items.length})</p>
                    <div className="space-y-2">
                      {col.items.slice(0, 3).map(t => {
                        const isOverdue = t.due_date && t.due_date < today && t.status !== "concluida";
                        const postRef = t.post_id ? taskPosts.find(p => p.id === t.post_id) : null;
                        return (
                          <div key={t.id} className="bg-background rounded-lg p-2.5 border border-border">
                            <p className="text-xs font-body font-medium text-foreground leading-snug">{t.title}</p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span className={cn("text-[10px] font-body font-semibold px-1.5 py-0.5 rounded",
                                t.priority === "urgente" ? "bg-destructive/10 text-destructive" :
                                t.priority === "alta" ? "bg-primary/10 text-primary" :
                                "bg-muted text-muted-foreground"
                              )}>{t.priority}</span>
                              {isOverdue && <span className="text-[10px] text-destructive font-body font-semibold">{t.due_date}</span>}
                              {postRef && <PlatformIcon platform={postRef.platform as any} size="sm" />}
                            </div>
                          </div>
                        );
                      })}
                      {col.items.length === 0 && <p className="text-[10px] text-muted-foreground font-body text-center py-3">—</p>}
                      {col.items.length > 3 && (
                        <button onClick={() => navigate("/app/tarefas")} className="text-[10px] text-primary font-body hover:underline w-full text-center">
                          +{col.items.length - 3} mais
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </DCard>

            {/* Quick capture */}
            <DCard>
              <p className="text-sm font-body font-medium text-foreground mb-3">💡 Captura rápida de ideia</p>
              <div className="flex gap-2">
                <Input placeholder="Capturar ideia rápida..." value={quickIdea} onChange={(e) => setQuickIdea(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleQuickCapture()} className="rounded-xl" />
                <Button variant="default" onClick={handleQuickCapture} disabled={!quickIdea.trim()}><Plus className="h-4 w-4" /></Button>
              </div>
            </DCard>
          </div>

          {/* RIGHT COLUMN (4 cols) */}
          <div className="lg:col-span-4 space-y-5">

            {/* Inspiration card — PROMINENT */}
            <DCard className="bg-primary/5 border-primary/10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-body font-semibold text-foreground">Inspiração do dia</p>
                  <span className="text-[10px] font-body font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{dailyHook.category}</span>
                </div>
              </div>
              <p className="text-base font-body text-foreground italic leading-relaxed mb-3">"{dailyHook.text}"</p>
              <button
                onClick={handleCopyHook}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-body font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
              >
                {copiedHook ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedHook ? "Copiado!" : "Copiar hook"}
              </button>
            </DCard>

            {/* Brand card */}
            <DCard>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-display font-bold text-lg text-primary">{(profile?.name || "C")[0].toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-body font-semibold text-foreground text-sm truncate">{profile?.name || "Criador"}</p>
                  {profile?.niche && <p className="text-xs text-muted-foreground font-body truncate">{profile.niche}</p>}
                </div>
              </div>
              {pillars.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {pillars.map(p => (
                    <span key={p.id} className="px-2 py-0.5 rounded-lg text-[10px] font-body font-medium text-primary-foreground" style={{ backgroundColor: p.color }}>{p.name}</span>
                  ))}
                </div>
              )}
              <div className="space-y-1 mb-3">
                {profile?.instagram_handle && <div className="flex items-center gap-2 text-xs text-muted-foreground font-body"><PlatformIcon platform="instagram" size="sm" /> @{profile.instagram_handle}</div>}
                {profile?.tiktok_handle && <div className="flex items-center gap-2 text-xs text-muted-foreground font-body"><PlatformIcon platform="tiktok" size="sm" /> @{profile.tiktok_handle}</div>}
                {profile?.youtube_handle && <div className="flex items-center gap-2 text-xs text-muted-foreground font-body"><PlatformIcon platform="youtube" size="sm" /> @{profile.youtube_handle}</div>}
              </div>
              <button onClick={() => navigate("/app/brandbook")} className="text-xs text-primary font-body font-medium hover:underline flex items-center gap-1">
                Ver brandbook <ArrowRight className="h-3 w-3" />
              </button>
            </DCard>

            {/* Platform distribution */}
            {Object.keys(platformCounts).length > 0 && (
              <DCard>
                <p className="text-sm font-body font-semibold text-foreground mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Posts por plataforma
                </p>
                <div className="space-y-2">
                  {Object.entries(platformCounts).sort((a, b) => b[1] - a[1]).map(([platform, count]) => (
                    <div key={platform} className="flex items-center gap-2">
                      <PlatformIcon platform={platform as any} size="sm" />
                      <span className="text-xs font-body text-foreground flex-1 capitalize">{platform}</span>
                      <div className="w-24 bg-muted rounded-full h-1.5">
                        <div className="bg-primary h-1.5 rounded-full" style={{ width: `${(count / Math.max(...Object.values(platformCounts))) * 100}%` }} />
                      </div>
                      <span className="text-xs font-body text-muted-foreground w-6 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </DCard>
            )}

            {/* Daily Habits Checklist */}
            <DCard>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
                  <Flame className="h-4 w-4 text-primary" /> Hábitos de hoje
                </p>
                <span className="text-xs text-muted-foreground font-body">{habitsToday}/{habits.length}</span>
              </div>
              {habits.length === 0 && <p className="text-xs text-muted-foreground font-body mb-3">Nenhum hábito ainda. Adicione abaixo!</p>}
              <div className="space-y-1.5 mb-3">
                {habits.map(habit => {
                  const log = habitLogs.find(l => l.habit_id === habit.id);
                  const isDone = log?.done || false;
                  const isEditing = editingHabitId === habit.id;
                  return (
                    <div key={habit.id} className="flex items-center gap-2 group">
                      <Checkbox checked={isDone} onCheckedChange={() => toggleHabitLog(habit.id)} className="rounded" />
                      {isEditing ? (
                        <Input value={editingHabitName} onChange={e => setEditingHabitName(e.target.value)} onKeyDown={e => e.key === "Enter" && updateHabit(habit.id)} onBlur={() => updateHabit(habit.id)} className="h-7 text-sm rounded-lg flex-1" autoFocus />
                      ) : (
                        <span className={cn("text-sm font-body flex-1", isDone ? "line-through text-muted-foreground" : "text-foreground")}>{habit.name}</span>
                      )}
                      <button onClick={() => { setEditingHabitId(habit.id); setEditingHabitName(habit.name); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded transition-all"><Pencil className="h-3 w-3 text-muted-foreground" /></button>
                      <button onClick={() => deleteHabit(habit.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"><Trash2 className="h-3 w-3 text-destructive" /></button>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Novo hábito..." value={newHabitName} onChange={e => setNewHabitName(e.target.value)} onKeyDown={e => e.key === "Enter" && addHabit()} className="h-8 text-xs rounded-xl flex-1" />
                <Button variant="ghost" size="sm" onClick={addHabit} disabled={!newHabitName.trim()} className="h-8 px-2"><Plus className="h-3.5 w-3.5" /></Button>
              </div>
            </DCard>

            {/* AI Insight */}
            {aiInsight && (
              <DCard className="bg-primary/5 border-primary/10">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-primary font-body font-semibold uppercase tracking-wider mb-1">Insight da IA</p>
                    <p className="text-sm font-body text-foreground">{aiInsight}</p>
                  </div>
                </div>
              </DCard>
            )}
          </div>
        </div>
      </motion.div>

      {/* Day posts dialog */}
      <Dialog open={dayDrawerOpen} onOpenChange={setDayDrawerOpen}>
        <DialogContent className="sm:max-w-md bg-background rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="font-display text-lg">
              {selectedDay && new Date(selectedDay + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </DialogTitle>
            <p className="text-xs text-muted-foreground font-body">{dayPosts.length} {dayPosts.length === 1 ? "post agendado" : "posts agendados"}</p>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-2 max-h-[60vh] overflow-y-auto">
            {dayPosts.length === 0 ? (
              <div className="text-center py-10">
                <Calendar className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground font-body">Nenhum post agendado para este dia.</p>
                <Button variant="outline" size="sm" className="mt-3 rounded-xl text-xs" onClick={() => { setDayDrawerOpen(false); navigate("/app/criando"); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Criar post
                </Button>
              </div>
            ) : (
              dayPosts.map(post => (
                <button
                  key={post.id}
                  onClick={() => { setDayDrawerOpen(false); navigate("/app/criando"); }}
                  className="w-full text-left bg-card hover:bg-accent/50 rounded-xl p-4 border border-border transition-colors group cursor-pointer"
                >
                  <p className="font-body font-medium text-sm text-foreground mb-2 group-hover:text-primary transition-colors">{post.title}</p>
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={post.platform as any} size="sm" />
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-body">{FORMAT_LABELS[post.format] || post.format}</span>
                    <span className={cn("text-xs font-body ml-auto px-1.5 py-0.5 rounded",
                      post.status === "publicado" ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"
                    )}>{post.status}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
