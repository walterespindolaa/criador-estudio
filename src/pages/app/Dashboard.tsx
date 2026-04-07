import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Lightbulb, FileText, CheckCircle2, TrendingUp, Plus, Sparkles, ArrowRight, Copy, Check, Calendar, ListChecks, Pencil, Trash2, X, AlertTriangle } from "lucide-react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FORMAT_LABELS } from "@/lib/constants";

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

interface Post {
  id: string;
  title: string;
  platform: string;
  format: string;
  status: string;
  scheduled_date: string | null;
  published_at: string | null;
}

interface Pillar {
  id: string;
  name: string;
  color: string;
}

interface HabitLog {
  id: string;
  habit_id: string;
  date: string;
  done: boolean;
}

interface Habit {
  id: string;
  name: string;
}

interface Task {
  id: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
  post_id: string | null;
}

interface PostRef {
  id: string;
  title: string;
  platform: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
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
      // Get unique post refs for tasks with post_id
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

    const weekPosts = posts.filter(p =>
      p.published_at && weekDays.some(d => d.date === p.published_at?.split("T")[0])
    );
    const pillarCounts: Record<string, number> = {};
    publishedPosts.forEach(p => { /* count by platform as proxy */ pillarCounts[p.platform] = (pillarCounts[p.platform] || 0) + 1; });
    const topPillar = Object.entries(pillarCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    getDailyInsight({
      postsThisWeek: weekPosts.length,
      weeklyGoal: profile?.weekly_goal || 3,
      topPillar,
      lastPublished: publishedPosts[publishedPosts.length - 1]?.published_at || "",
    }).then(insight => {
      if (insight) {
        setAiInsight(insight);
        localStorage.setItem(cacheKey, insight);
      }
    }).catch(() => {});
  }, [posts, user, profile]);

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

  // Weekly stats
  const weekPublished = posts.filter(p => p.status === "publicado" && p.published_at &&
    weekDays.some(d => d.date === p.published_at?.split("T")[0]));
  const weekGoal = profile?.weekly_goal || 3;
  const weekProgress = Math.min(100, (weekPublished.length / weekGoal) * 100);
  const goalMet = weekPublished.length >= weekGoal;

  // Monthly stats
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const publishedThisMonth = posts.filter(p => p.status === "publicado" && p.published_at && p.published_at >= monthStart).length;
  const inCreation = posts.filter(p => !["publicado"].includes(p.status || "")).length;
  const habitsToday = habits.length > 0 ? habitLogs.filter(l => l.done).length : 0;

  // Daily hook
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const dailyHook = HOOKS_VIRAL[dayOfYear % HOOKS_VIRAL.length];

  const handleCopyHook = async () => {
    await navigator.clipboard.writeText(dailyHook.text);
    setCopiedHook(true);
    setTimeout(() => setCopiedHook(false), 2000);
  };

  // Posts for selected day in drawer
  const dayPosts = selectedDay ? posts.filter(p => p.scheduled_date === selectedDay) : [];

  const stats = [
    { label: "Ideias guardadas", value: ideaCount, icon: Lightbulb, color: "text-primary" },
    { label: "Em criação", value: inCreation, icon: FileText, color: "text-secondary" },
    { label: "Publicados este mês", value: publishedThisMonth, icon: CheckCircle2, color: "text-secondary" },
    { label: "Hábitos hoje", value: `${habitsToday}/${habits.length}`, icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Greeting */}
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground mb-1">
                {getGreeting(profile?.name || "criador")}
              </h1>
              <p className="text-muted-foreground font-body">
                Sua meta: {weekPublished.length}/{weekGoal} posts esta semana
              </p>
            </div>

            {/* Progress bar */}
            <div className="bg-card rounded-2xl p-5 shadow-[var(--shadow-warm)] border border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-body font-semibold text-foreground">
                  {goalMet ? "Meta batida! 🎉" : "Progresso semanal"}
                </p>
                <span className="text-xs text-muted-foreground font-body">{Math.round(weekProgress)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${goalMet ? "bg-secondary" : "bg-primary"}`}
                  style={{ width: `${weekProgress}%` }}
                />
              </div>
            </div>

            {/* Overdue tasks alert */}
            {tasks.filter(t => t.due_date && t.due_date < today && t.status !== "concluida").length > 0 && (
              <div className="bg-red-50 rounded-2xl p-5 border border-red-200">
                <p className="text-sm font-body font-semibold text-red-700 flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4" /> ⚠️ Tarefas atrasadas
                </p>
                {tasks.filter(t => t.due_date && t.due_date < today && t.status !== "concluida").map(t => (
                  <div key={t.id} className="flex items-center gap-2 py-1">
                    <span className="text-sm font-body text-red-600">{t.title}</span>
                    <span className="text-[10px] text-red-400 font-body ml-auto">{t.due_date}</span>
                  </div>
                ))}
                <button onClick={() => navigate("/app/tarefas")} className="text-xs text-red-600 font-body font-medium hover:underline flex items-center gap-1 mt-2">
                  Ver tarefas <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Today's tasks */}
            {tasks.filter(t => t.due_date === today && t.status !== "concluida").length > 0 && (
              <div className="bg-card rounded-2xl p-5 shadow-[var(--shadow-warm)] border border-border">
                <p className="text-sm font-body font-semibold text-foreground flex items-center gap-2 mb-2">
                  <ListChecks className="h-4 w-4 text-primary" /> Para hoje
                </p>
                {tasks.filter(t => t.due_date === today && t.status !== "concluida").map(t => (
                  <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                    <span className="text-sm font-body text-foreground">{t.title}</span>
                    <span className={`text-[10px] font-body font-semibold px-1.5 py-0.5 rounded ${t.priority === "urgente" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}`}>{t.priority}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Mini week calendar */}
            <div className="bg-card rounded-2xl p-5 shadow-[var(--shadow-warm)] border border-border">
              <p className="text-sm font-body font-semibold text-foreground mb-3">Esta semana</p>
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map(day => {
                  const dayP = posts.filter(p => p.scheduled_date === day.date);
                  return (
                    <button
                      key={day.date}
                      onClick={() => { setSelectedDay(day.date); setDayDrawerOpen(true); }}
                      className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
                        day.isToday ? "border-2 border-primary bg-primary/5" : "border border-border hover:bg-accent"
                      }`}
                    >
                      <span className={`text-[10px] font-body font-semibold ${day.isToday ? "text-primary" : "text-muted-foreground"}`}>
                        {day.name}
                      </span>
                      <span className={`text-sm font-body font-bold ${day.isToday ? "text-primary" : "text-foreground"}`}>
                        {day.dayNum}
                      </span>
                      <div className="flex gap-0.5 mt-1 min-h-[6px]">
                        {dayP.slice(0, 3).map(p => (
                          <span key={p.id} className="w-1.5 h-1.5 rounded-full bg-primary" />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mini Tasks Kanban */}
            <div className="bg-card rounded-2xl p-5 shadow-[var(--shadow-warm)] border border-border">
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
                  { key: "pendente", label: "Pendente" },
                  { key: "em_andamento", label: "Em andamento" },
                  { key: "concluida", label: "Concluída" },
                ].map(col => {
                  const colTasks = tasks.filter(t => t.status === col.key).slice(0, 3);
                  const totalCol = tasks.filter(t => t.status === col.key).length;
                  return (
                    <div key={col.key}>
                      <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2">{col.label} ({totalCol})</p>
                      <div className="space-y-2">
                        {colTasks.map(t => {
                          const isOverdue = t.due_date && t.due_date < today && t.status !== "concluida";
                          const postRef = t.post_id ? taskPosts.find(p => p.id === t.post_id) : null;
                          return (
                            <div key={t.id} className="bg-background rounded-lg p-2.5 border border-border">
                              <p className="text-xs font-body font-medium text-foreground leading-snug">{t.title}</p>
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <span className={`text-[10px] font-body font-semibold px-1.5 py-0.5 rounded ${
                                  t.priority === "urgente" ? "bg-destructive/10 text-destructive" :
                                  t.priority === "alta" ? "bg-primary/10 text-primary" :
                                  "bg-muted text-muted-foreground"
                                }`}>{t.priority}</span>
                                {isOverdue && <span className="text-[10px] text-destructive font-body font-semibold">{t.due_date}</span>}
                                {postRef && (
                                  <span className="text-[10px] text-muted-foreground font-body flex items-center gap-0.5">
                                    <PlatformIcon platform={postRef.platform as any} size="sm" />
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {colTasks.length === 0 && <p className="text-[10px] text-muted-foreground font-body text-center py-3">—</p>}
                        {totalCol > 3 && (
                          <button onClick={() => navigate("/app/tarefas")} className="text-[10px] text-primary font-body hover:underline w-full text-center">
                            +{totalCol - 3} mais
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick capture */}
            <div className="bg-card rounded-2xl p-5 shadow-[var(--shadow-warm)] border border-border">
              <p className="text-sm font-body font-medium text-foreground mb-3">Captura rápida de ideia</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Capturar ideia rápida..."
                  value={quickIdea}
                  onChange={(e) => setQuickIdea(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleQuickCapture()}
                  className="rounded-xl"
                />
                <Button variant="default" onClick={handleQuickCapture} disabled={!quickIdea.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Brand card */}
            <div className="bg-card rounded-2xl p-5 shadow-[var(--shadow-warm)] border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-display font-bold text-lg text-primary">
                      {(profile?.name || "C")[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-body font-semibold text-foreground text-sm">{profile?.name || "Criador"}</p>
                  {profile?.niche && <p className="text-xs text-muted-foreground font-body">{profile.niche}</p>}
                </div>
              </div>

              {pillars.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {pillars.map(p => (
                    <span key={p.id} className="px-2 py-0.5 rounded-lg text-[10px] font-body font-medium text-primary-foreground" style={{ backgroundColor: p.color }}>
                      {p.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Handles */}
              <div className="space-y-1.5 mb-3">
                {profile?.instagram_handle && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
                    <PlatformIcon platform="instagram" size="sm" /> @{profile.instagram_handle}
                  </div>
                )}
                {profile?.tiktok_handle && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
                    <PlatformIcon platform="tiktok" size="sm" /> @{profile.tiktok_handle}
                  </div>
                )}
                {profile?.youtube_handle && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
                    <PlatformIcon platform="youtube" size="sm" /> @{profile.youtube_handle}
                  </div>
                )}
              </div>

              <button onClick={() => navigate("/app/configuracoes")} className="text-xs text-primary font-body font-medium hover:underline flex items-center gap-1">
                Editar marca <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {/* Stat cards 2x2 */}
            <div className="grid grid-cols-2 gap-3">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-card rounded-2xl p-4 shadow-[var(--shadow-warm)] border border-border"
                >
                  <stat.icon className={`h-4 w-4 ${stat.color} mb-1.5`} />
                  <p className="text-xl font-display font-bold text-foreground">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground font-body mt-0.5">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Daily Habits Checklist */}
            <div className="bg-card rounded-2xl p-5 shadow-[var(--shadow-warm)] border border-border">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> Hábitos de hoje
                </p>
                <span className="text-xs text-muted-foreground font-body">
                  {habitLogs.filter(l => l.done).length}/{habits.length}
                </span>
              </div>

              {habits.length === 0 && (
                <p className="text-xs text-muted-foreground font-body mb-3">Nenhum hábito ainda. Adicione abaixo!</p>
              )}

              <div className="space-y-1.5 mb-3">
                {habits.map(habit => {
                  const log = habitLogs.find(l => l.habit_id === habit.id);
                  const isDone = log?.done || false;
                  const isEditing = editingHabitId === habit.id;

                  return (
                    <div key={habit.id} className="flex items-center gap-2 group">
                      <Checkbox
                        checked={isDone}
                        onCheckedChange={() => toggleHabitLog(habit.id)}
                        className="rounded"
                      />
                      {isEditing ? (
                        <Input
                          value={editingHabitName}
                          onChange={e => setEditingHabitName(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && updateHabit(habit.id)}
                          onBlur={() => updateHabit(habit.id)}
                          className="h-7 text-sm rounded-lg flex-1"
                          autoFocus
                        />
                      ) : (
                        <span className={`text-sm font-body flex-1 ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {habit.name}
                        </span>
                      )}
                      <button
                        onClick={() => { setEditingHabitId(habit.id); setEditingHabitName(habit.name); }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded transition-all"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => deleteHabit(habit.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Novo hábito..."
                  value={newHabitName}
                  onChange={e => setNewHabitName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addHabit()}
                  className="h-8 text-xs rounded-xl flex-1"
                />
                <Button variant="ghost" size="sm" onClick={addHabit} disabled={!newHabitName.trim()} className="h-8 px-2">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* AI Insight */}
            {aiInsight && (
              <div className="bg-primary/5 rounded-2xl p-5 border border-primary/10">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-body text-foreground">{aiInsight}</p>
                </div>
              </div>
            )}

            {/* Daily hook inspiration */}
            <div className="bg-card rounded-2xl p-5 shadow-[var(--shadow-warm)] border border-border">
              <p className="text-sm font-body font-semibold text-foreground mb-2 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Inspiração do dia
              </p>
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-body font-semibold bg-primary/10 text-primary mb-2">
                {dailyHook.category}
              </span>
              <p className="text-sm font-body text-foreground italic mb-3">"{dailyHook.text}"</p>
              <button
                onClick={handleCopyHook}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-body font-medium bg-muted hover:bg-accent text-muted-foreground transition-colors"
              >
                {copiedHook ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedHook ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Day drawer */}
      <Sheet open={dayDrawerOpen} onOpenChange={setDayDrawerOpen}>
        <SheetContent className="bg-background">
          <SheetHeader>
            <SheetTitle className="font-display">
              {selectedDay && new Date(selectedDay + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {dayPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground font-body text-center py-8">Nenhum post agendado.</p>
            ) : (
              dayPosts.map(post => (
                <div key={post.id} className="bg-card rounded-xl p-4 border border-border">
                  <p className="font-body font-medium text-sm text-foreground mb-2">{post.title}</p>
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={post.platform as any} size="sm" />
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-body">{FORMAT_LABELS[post.format] || post.format}</span>
                    <span className="text-xs text-muted-foreground font-body ml-auto">{post.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Dashboard;
