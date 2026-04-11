import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Trash2, CalendarDays, Target, BarChart3, Check, ChevronLeft, ChevronRight,
  Clock, Flag, TrendingUp, ListChecks, Save, Eye, Milestone,
} from "lucide-react";
import { FORMAT_LABELS, STATUS_OPTIONS } from "@/lib/constants";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { PostDrawer } from "@/components/kanban/PostDrawer";
import { InfoTooltip } from "@/components/shared/InfoTooltip";

// ─── Types ───────────────────────────────────────────────
interface Post {
  id: string;
  title: string;
  platform: string;
  format: string;
  pillar_id: string | null;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  hook: string | null;
  script: string | null;
  caption: string | null;
  cta: string | null;
  published_at: string | null;
  notes: string | null;
  result_views: number | null;
  result_saves: number | null;
  result_comments: number | null;
  archive_summary: string | null;
  content_blocks: any;
  user_id: string;
}

interface Pillar { id: string; name: string; color: string; }
interface Habit { id: string; name: string; position: number; }
interface HabitLog { id: string; habit_id: string; date: string; done: boolean; }

interface StructuredGoal {
  id: string;
  title: string;
  category: string;
  period: string | null;
  current_value: number | null;
  target_value: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  observation: string | null;
}

interface MilestoneItem {
  id: string;
  goal_id: string;
  name: string;
  completed: boolean;
  completed_at: string | null;
  position: number;
}

interface MonthlyReflection {
  id: string;
  month: string;
  biz_worked: string | null;
  biz_blocked: string | null;
  content_best: string | null;
  content_rhythm: string | null;
  focus_execution: string | null;
  focus_lessons: string | null;
}

// ─── Helpers ─────────────────────────────────────────────
const getDaysOfWeek = (offset = 0) => {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7);
  const days = [];
  const dayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      name: dayNames[i],
      date: d.toISOString().split("T")[0],
      dayNum: d.getDate(),
      label: d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }),
    });
  }
  return days;
};

const getMonthDays = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const days: (string | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d).toISOString().split("T")[0]);
  }
  return days;
};

const GOAL_CATEGORIES = [
  { value: "seguidores", label: "Seguidores" },
  { value: "posts", label: "Posts" },
  { value: "vendas", label: "Vendas" },
  { value: "engajamento", label: "Engajamento" },
  { value: "receita", label: "Receita" },
  { value: "geral", label: "Geral" },
];

const STATUS_GOAL = [
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluída" },
  { value: "pausada", label: "Pausada" },
];

// ─── Component ───────────────────────────────────────────
const Plano = () => {
  const { user } = useAuth();
  const { profile } = useProfile();

  // Shared
  const [posts, setPosts] = useState<Post[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);

  // Week
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [newHabit, setNewHabit] = useState("");

  // Month
  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedMonthDay, setSelectedMonthDay] = useState<string | null>(null);

  // Goals
  const [goals, setGoals] = useState<StructuredGoal[]>([]);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [reflection, setReflection] = useState<MonthlyReflection | null>(null);
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [newGoalForm, setNewGoalForm] = useState({ title: "", category: "geral", target_value: "", observation: "", due_date: "" });
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  // Post drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // Reflection form
  const [reflectionForm, setReflectionForm] = useState({
    biz_worked: "", biz_blocked: "", content_best: "", content_rhythm: "", focus_execution: "", focus_lessons: "",
  });

  const today = new Date().toISOString().split("T")[0];
  const weekDays = getDaysOfWeek(weekOffset);
  const monthDays = getMonthDays(monthDate.getFullYear(), monthDate.getMonth());

  // ─── Fetch data ──────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!user) return;
    const currentMonth = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}-01`;

    const [postsRes, pillarsRes, habitsRes, logsRes, goalsRes, milestonesRes, reflectionRes] = await Promise.all([
      supabase.from("posts").select("*").eq("user_id", user.id),
      supabase.from("pillars").select("*").eq("user_id", user.id).order("position"),
      supabase.from("habits").select("*").eq("user_id", user.id).order("position"),
      supabase.from("habit_logs").select("*").eq("user_id", user.id).gte("date", weekDays[0].date).lte("date", weekDays[6].date),
      supabase.from("structured_goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("milestones").select("*").eq("user_id", user.id).order("position"),
      supabase.from("monthly_reflections").select("*").eq("user_id", user.id).eq("month", currentMonth).maybeSingle(),
    ]);

    setPosts((postsRes.data || []) as Post[]);
    setPillars(pillarsRes.data || []);
    setHabits(habitsRes.data || []);
    setHabitLogs(logsRes.data || []);
    setGoals((goalsRes.data || []) as StructuredGoal[]);
    setMilestones((milestonesRes.data || []) as MilestoneItem[]);

    const ref = reflectionRes.data as MonthlyReflection | null;
    setReflection(ref);
    if (ref) {
      setReflectionForm({
        biz_worked: ref.biz_worked || "", biz_blocked: ref.biz_blocked || "",
        content_best: ref.content_best || "", content_rhythm: ref.content_rhythm || "",
        focus_execution: ref.focus_execution || "", focus_lessons: ref.focus_lessons || "",
      });
    }
  }, [user, weekDays[0]?.date, monthDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Initialize selected day
  useEffect(() => {
    if (!selectedDay && weekOffset === 0) setSelectedDay(today);
  }, [today, weekOffset, selectedDay]);

  // ─── Habit logic ─────────────────────────────────────
  const toggleHabitLog = async (habitId: string, date: string) => {
    if (!user) return;
    const existing = habitLogs.find(l => l.habit_id === habitId && l.date === date);
    if (existing) {
      await supabase.from("habit_logs").update({ done: !existing.done }).eq("id", existing.id);
    } else {
      await supabase.from("habit_logs").insert({ user_id: user.id, habit_id: habitId, date, done: true });
    }
    fetchData();
  };

  const isHabitDone = (habitId: string, date: string) =>
    habitLogs.find(l => l.habit_id === habitId && l.date === date)?.done || false;

  const addHabit = async () => {
    if (!newHabit.trim() || !user) return;
    await supabase.from("habits").insert({ user_id: user.id, name: newHabit.trim(), position: habits.length });
    setNewHabit("");
    fetchData();
  };

  const deleteHabit = async (id: string) => {
    await supabase.from("habits").delete().eq("id", id);
    fetchData();
  };

  // ─── Goals logic ─────────────────────────────────────
  const createGoal = async () => {
    if (!newGoalForm.title.trim() || !user) return;
    await supabase.from("structured_goals").insert({
      user_id: user.id,
      title: newGoalForm.title.trim(),
      category: newGoalForm.category,
      target_value: newGoalForm.target_value ? parseFloat(newGoalForm.target_value) : 0,
      observation: newGoalForm.observation || null,
      end_date: newGoalForm.due_date || null,
    });
    setNewGoalForm({ title: "", category: "geral", target_value: "", observation: "", due_date: "" });
    setShowNewGoal(false);
    fetchData();
    toast.success("Meta criada!");
  };

  const updateGoalValue = async (goalId: string, value: number) => {
    await supabase.from("structured_goals").update({ current_value: value }).eq("id", goalId);
    fetchData();
  };

  const updateGoalStatus = async (goalId: string, status: string) => {
    await supabase.from("structured_goals").update({ status }).eq("id", goalId);
    fetchData();
    toast.success("Status atualizado!");
  };

  const deleteGoal = async (goalId: string) => {
    await supabase.from("milestones").delete().eq("goal_id", goalId);
    await supabase.from("structured_goals").delete().eq("id", goalId);
    fetchData();
    toast.success("Meta removida.");
  };

  const addMilestone = async (goalId: string) => {
    if (!newMilestoneName.trim() || !user) return;
    const goalMilestones = milestones.filter(m => m.goal_id === goalId);
    await supabase.from("milestones").insert({
      user_id: user.id,
      goal_id: goalId,
      name: newMilestoneName.trim(),
      position: goalMilestones.length,
    });
    setNewMilestoneName("");
    fetchData();
  };

  const toggleMilestone = async (milestoneId: string, completed: boolean) => {
    await supabase.from("milestones").update({
      completed: !completed,
      completed_at: !completed ? new Date().toISOString() : null,
    }).eq("id", milestoneId);
    fetchData();
  };

  const deleteMilestone = async (id: string) => {
    await supabase.from("milestones").delete().eq("id", id);
    fetchData();
  };

  // ─── Reflection ──────────────────────────────────────
  const saveReflection = async () => {
    if (!user) return;
    const currentMonth = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}-01`;
    const data = { user_id: user.id, month: currentMonth, ...reflectionForm };
    if (reflection) {
      await supabase.from("monthly_reflections").update(data).eq("id", reflection.id);
    } else {
      await supabase.from("monthly_reflections").insert(data);
    }
    toast.success("Reflexão salva!");
    fetchData();
  };

  // ─── Post interaction ────────────────────────────────
  const openPost = async (postId: string) => {
    const { data } = await supabase.from("posts").select("*").eq("id", postId).single();
    if (data) {
      setSelectedPost(data as Post);
      setDrawerOpen(true);
    }
  };

  // ─── Derived data ────────────────────────────────────
  const weekPublished = posts.filter(p =>
    p.status === "publicado" && p.scheduled_date && weekDays.some(d => d.date === p.scheduled_date)
  );
  const weekGoal = profile?.weekly_goal || 3;
  const weekProgress = Math.min(100, Math.round((weekPublished.length / weekGoal) * 100));

  const selectedDayPosts = posts.filter(p => p.scheduled_date === selectedDay);
  const selectedMonthDayPosts = posts.filter(p => p.scheduled_date === selectedMonthDay);

  const getPillarColor = (pillarId: string | null) => {
    if (!pillarId) return undefined;
    return pillars.find(p => p.id === pillarId)?.color;
  };

  const getPillarName = (pillarId: string | null) => {
    if (!pillarId) return null;
    return pillars.find(p => p.id === pillarId)?.name;
  };

  // ─── Post card component ────────────────────────────
  const PostCard = ({ post }: { post: Post }) => {
    const pillarColor = getPillarColor(post.pillar_id);
    const pillarName = getPillarName(post.pillar_id);
    const statusLabel = STATUS_OPTIONS.find(s => s.key === post.status)?.label || post.status;

    return (
      <button
        onClick={() => openPost(post.id)}
        className="w-full text-left bg-background rounded-xl p-3 border border-border hover:border-primary/40 hover:shadow-sm transition-all group"
      >
        <div className="flex items-start gap-2">
          <PlatformIcon platform={post.platform as any} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-body font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {post.title}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] font-body px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {FORMAT_LABELS[post.format] || post.format}
              </span>
              <span className={`text-[10px] font-body px-1.5 py-0.5 rounded ${
                post.status === "publicado" ? "bg-secondary/20 text-secondary" : "bg-accent text-accent-foreground"
              }`}>
                {statusLabel}
              </span>
              {pillarName && (
                <span className="text-[10px] font-body px-1.5 py-0.5 rounded" style={{ backgroundColor: `${pillarColor}20`, color: pillarColor }}>
                  {pillarName}
                </span>
              )}
              {post.scheduled_time && (
                <span className="text-[10px] font-body text-muted-foreground flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" /> {post.scheduled_time}
                </span>
              )}
            </div>
          </div>
          <Eye className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
        </div>
      </button>
    );
  };

  // ─── Week label ──────────────────────────────────────
  const weekLabel = (() => {
    const start = new Date(weekDays[0].date + "T12:00:00");
    const end = new Date(weekDays[6].date + "T12:00:00");
    return `${start.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} — ${end.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`;
  })();

  return (
    <div className="max-w-5xl pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Meu Plano</h1>
        <p className="text-muted-foreground font-body mb-6">Planeje, acompanhe e reflita sobre sua produção.</p>

        <Tabs defaultValue="semana">
          <TabsList className="bg-card border border-border rounded-xl mb-6">
            <TabsTrigger value="semana" className="rounded-lg font-medium text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <CalendarDays className="h-4 w-4 mr-1.5" /> Semana
            </TabsTrigger>
            <TabsTrigger value="mes" className="rounded-lg font-medium text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <BarChart3 className="h-4 w-4 mr-1.5" /> Mês
            </TabsTrigger>
            <TabsTrigger value="metas" className="rounded-lg font-medium text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Target className="h-4 w-4 mr-1.5" /> Metas
            </TabsTrigger>
          </TabsList>

          {/* ═══════════ TAB: SEMANA ═══════════ */}
          <TabsContent value="semana">
            <div className="space-y-6">
              {/* Week navigation + progress */}
              <Card className="border-border">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setWeekOffset(w => w - 1); setSelectedDay(null); }}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-body font-medium text-foreground">{weekLabel}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setWeekOffset(w => w + 1); setSelectedDay(null); }}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      {weekOffset !== 0 && (
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setWeekOffset(0); setSelectedDay(today); }}>
                          Hoje
                        </Button>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground font-body">{weekPublished.length}/{weekGoal} posts</p>
                      <Progress value={weekProgress} className="w-24 h-1.5 mt-1" />
                    </div>
                  </div>

                  {/* Day selector */}
                  <div className="grid grid-cols-7 gap-2">
                    {weekDays.map(day => {
                      const dayPosts = posts.filter(p => p.scheduled_date === day.date);
                      const isToday = day.date === today;
                      const isSelected = day.date === selectedDay;
                      return (
                        <button
                          key={day.date}
                          onClick={() => setSelectedDay(day.date)}
                          className={`rounded-xl p-3 text-center transition-all border ${
                            isSelected
                              ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                              : isToday
                              ? "border-primary/40 bg-primary/5"
                              : "border-border bg-card hover:border-primary/20"
                          }`}
                        >
                          <p className={`text-xs font-body font-semibold ${isSelected || isToday ? "text-primary" : "text-foreground"}`}>
                            {day.name}
                          </p>
                          <p className="text-sm font-body font-normal text-foreground">{day.dayNum}</p>
                          {dayPosts.length > 0 && (
                            <div className="flex justify-center gap-0.5 mt-1">
                              {dayPosts.slice(0, 3).map(p => (
                                <span key={p.id} className="w-1.5 h-1.5 rounded-full bg-primary" />
                              ))}
                              {dayPosts.length > 3 && <span className="text-[8px] text-muted-foreground">+{dayPosts.length - 3}</span>}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Selected day posts */}
              {selectedDay && (
                <Card className="border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {new Date(selectedDay + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                      <span className="ml-auto text-xs text-muted-foreground font-normal">
                        {selectedDayPosts.length} {selectedDayPosts.length === 1 ? "post" : "posts"}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedDayPosts.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground font-body">Nenhum post agendado para este dia.</p>
                        <p className="text-xs text-muted-foreground font-body mt-1">Crie um post em "Criando" e agende para esta data.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedDayPosts.map(post => <PostCard key={post.id} post={post} />)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Habits */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-body font-semibold text-foreground">Hábitos diários <InfoTooltip text="Acompanhamento semanal dos seus hábitos de criação. Marque os dias que cumpriu cada hábito." /></CardTitle>
                </CardHeader>
                <CardContent>
                  {habits.length === 0 ? (
                    <p className="text-sm text-muted-foreground font-body mb-3">
                      Adicione hábitos como "Filmei hoje?", "Postei?", "Respondi comentários?"
                    </p>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {habits.map(habit => (
                        <div key={habit.id} className="flex items-center justify-between">
                          <span className="font-body text-sm text-foreground flex-1">{habit.name}</span>
                          <div className="flex items-center gap-1">
                            {weekDays.map(day => (
                              <button
                                key={day.date}
                                onClick={() => toggleHabitLog(habit.id, day.date)}
                                className={`w-7 h-7 rounded-lg text-xs font-body flex items-center justify-center transition-colors ${
                                  isHabitDone(habit.id, day.date)
                                    ? "bg-secondary text-secondary-foreground"
                                    : "bg-muted text-muted-foreground hover:bg-accent"
                                }`}
                                title={day.name}
                              >
                                {isHabitDone(habit.id, day.date) ? <Check className="h-3 w-3" /> : day.name[0]}
                              </button>
                            ))}
                            <button onClick={() => deleteHabit(habit.id)} className="p-1 ml-1 hover:bg-destructive/10 rounded">
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input placeholder="Novo hábito..." value={newHabit} onChange={(e) => setNewHabit(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addHabit()} className="rounded-xl text-sm" />
                    <Button variant="outline" size="sm" onClick={addHabit} disabled={!newHabit.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══════════ TAB: MÊS ═══════════ */}
          <TabsContent value="mes">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calendar */}
              <div className="lg:col-span-2">
                <Card className="border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <CardTitle className="text-base font-body font-semibold text-foreground capitalize">
                          {monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                        </CardTitle>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => setMonthDate(new Date())}>Hoje</Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-7 gap-1">
                      {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => (
                        <div key={d} className="text-center text-xs font-body font-medium text-muted-foreground py-1">{d}</div>
                      ))}
                      {monthDays.map((date, i) => {
                        if (!date) return <div key={`empty-${i}`} />;
                        const dayPosts = posts.filter(p => p.scheduled_date === date);
                        const isToday = date === today;
                        const isSelected = date === selectedMonthDay;
                        return (
                          <button
                            key={date}
                            onClick={() => setSelectedMonthDay(date === selectedMonthDay ? null : date)}
                            className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-center text-xs font-body transition-all ${
                              isSelected
                                ? "bg-primary/15 border-2 border-primary"
                                : isToday
                                ? "bg-primary/10 border border-primary/50"
                                : dayPosts.length > 0
                                ? "hover:bg-accent border border-transparent hover:border-primary/20"
                                : "hover:bg-accent border border-transparent"
                            }`}
                          >
                            <span className={`text-sm font-body font-normal ${isToday || isSelected ? "text-primary" : "text-foreground"}`}>
                              {new Date(date + "T12:00:00").getDate()}
                            </span>
                            {dayPosts.length > 0 && (
                              <div className="flex gap-0.5 mt-0.5">
                                {dayPosts.slice(0, 3).map(p => (
                                  <span key={p.id} className="w-1.5 h-1.5 rounded-full bg-primary" />
                                ))}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Side panel */}
              <div className="space-y-4">
                {/* Selected day detail */}
                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-body font-semibold text-foreground">
                      {selectedMonthDay
                        ? new Date(selectedMonthDay + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long" })
                        : "Selecione um dia"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!selectedMonthDay ? (
                      <p className="text-xs text-muted-foreground font-body">Clique em um dia do calendário para ver os posts.</p>
                    ) : selectedMonthDayPosts.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-body">Nenhum post neste dia.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedMonthDayPosts.map(post => <PostCard key={post.id} post={post} />)}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Month stats */}
                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[15px] font-body font-semibold text-foreground">Resumo do mês</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const monthPostsAll = posts.filter(p => {
                        if (!p.scheduled_date) return false;
                        const d = new Date(p.scheduled_date);
                        return d.getMonth() === monthDate.getMonth() && d.getFullYear() === monthDate.getFullYear();
                      });
                      const published = monthPostsAll.filter(p => p.status === "publicado");
                      const scheduled = monthPostsAll.filter(p => p.status !== "publicado");
                      return (
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm font-body">
                            <span className="text-muted-foreground">Total</span>
                            <span className="font-semibold text-foreground">{monthPostsAll.length}</span>
                          </div>
                          <div className="flex justify-between text-sm font-body">
                            <span className="text-muted-foreground">Publicados</span>
                            <span className="font-semibold text-secondary">{published.length}</span>
                          </div>
                          <div className="flex justify-between text-sm font-body">
                            <span className="text-muted-foreground">Planejados</span>
                            <span className="font-semibold text-foreground">{scheduled.length}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Reflection */}
                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[15px] font-body font-semibold text-foreground flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-primary" /> Reflexão mensal
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { key: "content_best", label: "Melhor conteúdo do mês", placeholder: "Qual post se destacou?" },
                      { key: "content_rhythm", label: "Ritmo de produção", placeholder: "Como foi sua consistência?" },
                      { key: "focus_lessons", label: "Aprendizados", placeholder: "O que aprendeu?" },
                    ].map(field => (
                      <div key={field.key} className="space-y-1">
                        <Label className="text-xs font-body">{field.label}</Label>
                        <Textarea
                          placeholder={field.placeholder}
                          value={(reflectionForm as any)[field.key]}
                          onChange={e => setReflectionForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className="rounded-xl min-h-[50px] text-sm"
                        />
                      </div>
                    ))}
                    <Button size="sm" onClick={saveReflection} className="w-full gap-1.5">
                      <Save className="h-3.5 w-3.5" /> Salvar reflexão
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ═══════════ TAB: METAS ═══════════ */}
          <TabsContent value="metas">
            <div className="max-w-3xl space-y-6">
              {/* Header + Add button */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-body font-semibold text-foreground">Minhas Metas <InfoTooltip text="Metas mensais ou de projeto. Adicione marcos para dividir em etapas menores." /></h2>
                  <p className="text-xs text-muted-foreground font-body">Defina objetivos claros e acompanhe seu progresso.</p>
                </div>
                <Button onClick={() => setShowNewGoal(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Nova meta
                </Button>
              </div>

              {/* New goal form */}
              {showNewGoal && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-body">Título</Label>
                        <Input placeholder="Ex: Alcançar 10k seguidores" value={newGoalForm.title}
                          onChange={e => setNewGoalForm(f => ({ ...f, title: e.target.value }))} className="rounded-xl" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-body">Categoria</Label>
                        <Select value={newGoalForm.category} onValueChange={v => setNewGoalForm(f => ({ ...f, category: v }))}>
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {GOAL_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-body">Valor objetivo</Label>
                        <Input placeholder="Ex: 10000" type="number" value={newGoalForm.target_value}
                          onChange={e => setNewGoalForm(f => ({ ...f, target_value: e.target.value }))} className="rounded-xl" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-body">Observação</Label>
                        <Input placeholder="Notas sobre a meta..." value={newGoalForm.observation}
                          onChange={e => setNewGoalForm(f => ({ ...f, observation: e.target.value }))} className="rounded-xl" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-body">Prazo (opcional)</Label>
                        <Input type="date" value={newGoalForm.due_date}
                          onChange={e => setNewGoalForm(f => ({ ...f, due_date: e.target.value }))} className="rounded-xl text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setShowNewGoal(false)}>Cancelar</Button>
                      <Button size="sm" onClick={createGoal} disabled={!newGoalForm.title.trim()}>Criar meta</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Goals list */}
              {goals.length === 0 && !showNewGoal ? (
                <Card className="border-border">
                  <CardContent className="py-12 text-center">
                    <Target className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground font-body">Nenhuma meta criada ainda.</p>
                    <p className="text-xs text-muted-foreground font-body mt-1">Defina objetivos para acompanhar sua evolução.</p>
                  </CardContent>
                </Card>
              ) : (
                goals.map(goal => {
                  const goalMilestones = milestones.filter(m => m.goal_id === goal.id);
                  const completedMs = goalMilestones.filter(m => m.completed).length;
                  const target = goal.target_value || 0;
                  const current = goal.current_value || 0;
                  const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
                  const isExpanded = expandedGoal === goal.id;
                  const categoryLabel = GOAL_CATEGORIES.find(c => c.value === goal.category)?.label || goal.category;

                  return (
                    <Card key={goal.id} className={`border-border transition-all ${isExpanded ? "ring-1 ring-primary/20" : ""}`}>
                      <CardContent className="pt-5">
                        {/* Goal header */}
                        <button onClick={() => setExpandedGoal(isExpanded ? null : goal.id)} className="w-full text-left">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Flag className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-body font-semibold text-foreground truncate">{goal.title}</h3>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-body px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{categoryLabel}</span>
                                <span className={`text-[10px] font-body px-1.5 py-0.5 rounded ${
                                  goal.status === "concluida" ? "bg-secondary/20 text-secondary" :
                                  goal.status === "pausada" ? "bg-muted text-muted-foreground" :
                                  "bg-primary/10 text-primary"
                                }`}>
                                  {STATUS_GOAL.find(s => s.value === goal.status)?.label}
                                </span>
                                {goalMilestones.length > 0 && (
                                  <span className="text-[10px] font-body text-muted-foreground flex items-center gap-0.5">
                                    <Milestone className="h-2.5 w-2.5" /> {completedMs}/{goalMilestones.length} marcos
                                  </span>
                                )}
                                {goal.end_date && (
                                  <span className={`text-[10px] font-body flex items-center gap-0.5 ${
                                    goal.end_date < today && goal.status !== "concluida" ? "text-destructive" : "text-muted-foreground"
                                  }`}>
                                    <CalendarDays className="h-2.5 w-2.5" />
                                    {new Date(goal.end_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                                    {goal.end_date < today && goal.status !== "concluida" && " · Atrasada"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-3">
                              <p className="text-lg font-body font-bold text-foreground">{progress}%</p>
                              {target > 0 && (
                                <p className="text-[10px] text-muted-foreground font-body">{current}/{target}</p>
                              )}
                            </div>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </button>

                        {/* Expanded details */}
                        {isExpanded && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 space-y-4 border-t border-border pt-4">
                            {/* Update value */}
                            {target > 0 && (
                              <div className="flex items-center gap-3">
                                <Label className="text-xs font-body whitespace-nowrap">Valor atual:</Label>
                                <Input
                                  type="number"
                                  value={current}
                                  onChange={e => updateGoalValue(goal.id, parseFloat(e.target.value) || 0)}
                                  className="rounded-xl text-sm w-28"
                                />
                                <span className="text-xs text-muted-foreground font-body">/ {target}</span>
                              </div>
                            )}

                            {/* Status changer */}
                            <div className="flex items-center gap-3">
                              <Label className="text-xs font-body whitespace-nowrap">Status:</Label>
                              <Select value={goal.status} onValueChange={v => updateGoalStatus(goal.id, v)}>
                                <SelectTrigger className="rounded-xl text-sm w-40"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {STATUS_GOAL.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>

                            {goal.observation && (
                              <p className="text-xs text-muted-foreground font-body italic">📝 {goal.observation}</p>
                            )}

                            {/* Milestones / Baby steps */}
                            <div className="space-y-2">
                              <p className="text-xs font-body font-semibold text-foreground flex items-center gap-1.5">
                                <Milestone className="h-3.5 w-3.5 text-primary" /> Marcos (baby steps)
                              </p>
                              {goalMilestones.map(ms => (
                                <div key={ms.id} className="flex items-center gap-2">
                                  <button
                                    onClick={() => toggleMilestone(ms.id, ms.completed)}
                                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                                      ms.completed ? "bg-secondary border-secondary text-secondary-foreground" : "border-border hover:border-primary"
                                    }`}
                                  >
                                    {ms.completed && <Check className="h-3 w-3" />}
                                  </button>
                                  <span className={`text-sm font-body flex-1 ${ms.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                    {ms.name}
                                  </span>
                                  <button onClick={() => deleteMilestone(ms.id)} className="p-0.5 hover:bg-destructive/10 rounded">
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </button>
                                </div>
                              ))}
                              <div className="flex gap-2">
                                <Input placeholder="Novo marco..." value={newMilestoneName}
                                  onChange={e => setNewMilestoneName(e.target.value)}
                                  onKeyDown={e => e.key === "Enter" && addMilestone(goal.id)}
                                  className="rounded-xl text-sm" />
                                <Button variant="outline" size="sm" onClick={() => addMilestone(goal.id)} disabled={!newMilestoneName.trim()}>
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Delete goal */}
                            <div className="pt-2 border-t border-border">
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive text-xs" onClick={() => deleteGoal(goal.id)}>
                                <Trash2 className="h-3 w-3 mr-1" /> Remover meta
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}

              {/* Annual overview */}
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Visão anual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-12 gap-2 items-end h-28">
                    {Array.from({ length: 12 }, (_, i) => {
                      const now = new Date();
                      const monthPosts = posts.filter(p => {
                        if (!p.scheduled_date) return false;
                        const d = new Date(p.scheduled_date);
                        return d.getMonth() === i && d.getFullYear() === now.getFullYear();
                      });
                      const count = monthPosts.length;
                      const maxCount = Math.max(1, ...Array.from({ length: 12 }, (_, j) =>
                        posts.filter(p => p.scheduled_date && new Date(p.scheduled_date).getMonth() === j && new Date(p.scheduled_date).getFullYear() === now.getFullYear()).length
                      ));
                      const height = count > 0 ? Math.max(8, (count / maxCount) * 100) : 4;
                      return (
                        <div key={i} className="flex flex-col items-center">
                          <div className={`w-full rounded-t-lg transition-all ${i === now.getMonth() ? "bg-primary" : "bg-muted"}`} style={{ height: `${height}px` }} />
                          <span className="text-[10px] font-body text-muted-foreground mt-1">
                            {new Date(now.getFullYear(), i, 1).toLocaleDateString("pt-BR", { month: "short" }).slice(0, 3)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Post Drawer */}
      <PostDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        post={selectedPost}
        pillars={pillars}
        userId={user?.id || ""}
        onSaved={fetchData}
      />
    </div>
  );
};

export default Plano;
