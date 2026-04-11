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
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { sanitizeText } from "@/lib/sanitize";

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

interface Post { id: string; title: string; platform: string; format: string; status: string; scheduled_date: string | null; published_at: string | null; }
interface Pillar { id: string; name: string; color: string; }
interface HabitLog { id: string; habit_id: string; date: string; done: boolean; }
interface Habit { id: string; name: string; }
interface Task { id: string; title: string; priority: string; status: string; due_date: string | null; post_id: string | null; }
interface PostRef { id: string; title: string; platform: string; }

function DCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card rounded-2xl p-5 shadow-[var(--shadow-warm)] border border-border", className)}>
      {children}
    </div>
  );
}

const Dashboard = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const [period, setPeriod] = useState<PeriodKey>("semana");
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date }>({ from: new Date(), to: new Date() });
  const [customOpen, setCustomOpen] = useState(false);

  const dateRange = useMemo(() => getDateRange(period, customRange), [period, customRange]);

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
  }, [user, today]);

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
  }, [posts, user, profile, today, weekDays]);

  const handleQuickCapture = async () => {
    const sanitized = sanitizeText(quickIdea);
    if (!sanitized || !user) return;
    const { error } = await supabase.from("ideas").insert({ user_id: user.id, title: sanitized });
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
    const sanitized = sanitizeText(newHabitName);
    if (!sanitized || !user) return;
    const { data, error } = await supabase.from("habits").insert({ user_id: user.id, name: sanitized, position: habits.length }).select().single();
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
    const sanitized = sanitizeText(editingHabitName);
    if (!sanitized) return;
    await supabase.from("habits").update({ name: sanitized }).eq("id", habitId);
    setHabits(prev => prev.map(h => h.id === habitId ? { ...h, name: sanitized } : h));
    setEditingHabitId(null);
    setEditingHabitName("");
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

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-0.5">
              {getGreeting(profile?.name || "criador")}
            </h1>
            <p className="text-sm text-muted-foreground font-body">
              Sua meta: {weekPublished.length}/{weekGoal} posts esta semana
            </p>
          </div>

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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <div className="lg:col-span-8 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {stats.map((s, i) => (
                <DCard key={i} className="flex flex-col justify-between hover:border-primary/30 transition-all cursor-pointer" onClick={() => navigate(s.link)}>
                  <div className="flex items-center justify-between mb-3">
                    <div className={cn("p-2 rounded-xl bg-card border border-border", s.color)}>
                      <s.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <p className="text-2xl font-display font-bold text-foreground">{s.value}</p>
                    <p className="text-[10px] uppercase tracking-wider font-body font-semibold text-muted-foreground">{s.label}</p>
                  </div>
                </DCard>
              ))}
            </div>

            <DCard className="relative overflow-hidden group">
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
                        <Checkbox checked={done} onCheckedChange={() => toggleHabitLog(h.id)} />
                        {editingHabitId === h.id ? (
                          <Input 
                            value={editingHabitName} 
                            onChange={(e) => setEditingHabitName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && updateHabit(h.id)}
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
                        <button onClick={() => deleteHabit(h.id)} className="p-1 hover:bg-destructive/10 rounded text-destructive"><Trash2 className="h-3 w-3" /></button>
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

            <DCard className="bg-primary/5 border-primary/20">
              <h3 className="text-sm font-display font-bold text-primary mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Gancho do Dia
              </h3>
              <p className="text-sm font-body text-foreground italic mb-4 leading-relaxed">
                "{dailyHook.text}"
              </p>
              <Button variant="outline" size="sm" onClick={handleCopyHook} className="w-full bg-background border-primary/20 hover:bg-primary/5 text-primary">
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
