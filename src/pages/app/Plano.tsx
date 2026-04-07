import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, CalendarDays, Target, BarChart3, Check, Calendar } from "lucide-react";
import { FORMAT_LABELS } from "@/lib/constants";
import { PlatformIcon } from "@/components/shared/PlatformIcon";

interface Post {
  id: string;
  title: string;
  platform: string;
  format: string;
  status: string;
  scheduled_date: string | null;
}

interface Habit {
  id: string;
  name: string;
  position: number;
}

interface HabitLog {
  id: string;
  habit_id: string;
  date: string;
  done: boolean;
}

interface MonthlyGoal {
  id: string;
  month: string;
  goals: string[] | null;
  focus: string | null;
  reflection: string | null;
}

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

const Plano = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [posts, setPosts] = useState<Post[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [monthlyGoal, setMonthlyGoal] = useState<MonthlyGoal | null>(null);
  const [newHabit, setNewHabit] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [focus, setFocus] = useState("");
  const [reflection, setReflection] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [monthlyPosts, setMonthlyPosts] = useState<{ month: string; count: number }[]>([]);

  const today = new Date().toISOString().split("T")[0];
  const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
  const weekDays = getDaysOfWeek();

  const fetchData = async () => {
    if (!user) return;
    const [postsRes, habitsRes, logsRes, goalRes] = await Promise.all([
      supabase.from("posts").select("id, title, platform, format, status, scheduled_date").eq("user_id", user.id),
      supabase.from("habits").select("*").eq("user_id", user.id).order("position"),
      supabase.from("habit_logs").select("*").eq("user_id", user.id).gte("date", weekDays[0].date).lte("date", weekDays[6].date),
      supabase.from("monthly_goals").select("*").eq("user_id", user.id).eq("month", currentMonth).maybeSingle(),
    ]);
    setPosts(postsRes.data || []);
    setHabits(habitsRes.data || []);
    setHabitLogs(logsRes.data || []);
    if (goalRes.data) {
      setMonthlyGoal(goalRes.data);
      setGoals(goalRes.data.goals || []);
      setFocus(goalRes.data.focus || "");
      setReflection(goalRes.data.reflection || "");
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  // Calculate weekly posts count
  const weekPosts = posts.filter(p =>
    p.scheduled_date && weekDays.some(d => d.date === p.scheduled_date) && p.status !== "publicado"
  );
  const weekPublished = posts.filter(p =>
    p.status === "publicado" && p.scheduled_date && weekDays.some(d => d.date === p.scheduled_date)
  );

  const addHabit = async () => {
    if (!newHabit.trim() || !user) return;
    await supabase.from("habits").insert({
      user_id: user.id,
      name: newHabit.trim(),
      position: habits.length,
    });
    setNewHabit("");
    fetchData();
    toast.success("Hábito adicionado!");
  };

  const deleteHabit = async (id: string) => {
    await supabase.from("habits").delete().eq("id", id);
    fetchData();
  };

  const toggleHabitLog = async (habitId: string, date: string) => {
    if (!user) return;
    const existing = habitLogs.find(l => l.habit_id === habitId && l.date === date);
    if (existing) {
      await supabase.from("habit_logs").update({ done: !existing.done }).eq("id", existing.id);
    } else {
      await supabase.from("habit_logs").insert({
        user_id: user.id,
        habit_id: habitId,
        date,
        done: true,
      });
    }
    fetchData();
  };

  const isHabitDone = (habitId: string, date: string) => {
    return habitLogs.find(l => l.habit_id === habitId && l.date === date)?.done || false;
  };

  const saveMonthlyGoals = async () => {
    if (!user) return;
    const data = {
      user_id: user.id,
      month: currentMonth,
      goals,
      focus: focus || null,
      reflection: reflection || null,
    };
    if (monthlyGoal) {
      await supabase.from("monthly_goals").update(data).eq("id", monthlyGoal.id);
    } else {
      await supabase.from("monthly_goals").insert(data);
    }
    toast.success("Metas salvas!");
    fetchData();
  };

  const addGoal = () => {
    if (!newGoal.trim() || goals.length >= 5) return;
    setGoals([...goals, newGoal.trim()]);
    setNewGoal("");
  };

  const removeGoal = (index: number) => setGoals(goals.filter((_, i) => i !== index));

  const now = new Date();
  const monthDays = getMonthDays(now.getFullYear(), now.getMonth());
  const dayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <div className="max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Meu Plano</h1>
        <p className="text-muted-foreground font-body mb-6">
          Planeje, acompanhe e reflita sobre sua produção.
        </p>

        <Tabs defaultValue="semana">
          <TabsList className="bg-card border border-border rounded-xl mb-6">
            <TabsTrigger value="semana" className="rounded-lg font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <CalendarDays className="h-4 w-4 mr-1" /> Semana
            </TabsTrigger>
            <TabsTrigger value="mes" className="rounded-lg font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <BarChart3 className="h-4 w-4 mr-1" /> Mês
            </TabsTrigger>
            <TabsTrigger value="metas" className="rounded-lg font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Target className="h-4 w-4 mr-1" /> Metas
            </TabsTrigger>
          </TabsList>

          {/* TAB: Semana */}
          <TabsContent value="semana">
            {/* Weekly progress */}
            <div className="bg-card rounded-2xl p-5 shadow-warm border border-border mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="font-body font-semibold text-foreground text-sm">
                  Meta da semana: {weekPublished.length}/{profile?.weekly_goal || 3} posts
                </p>
                <span className="text-xs text-muted-foreground font-body">
                  {Math.round((weekPublished.length / (profile?.weekly_goal || 3)) * 100)}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (weekPublished.length / (profile?.weekly_goal || 3)) * 100)}%` }}
                />
              </div>
            </div>

            {/* Week grid */}
            <div className="grid grid-cols-7 gap-3 mb-8">
              {weekDays.map(day => {
                const dayPosts = posts.filter(p => p.scheduled_date === day.date);
                const isToday = day.date === today;
                return (
                  <div
                    key={day.date}
                    className={`rounded-2xl p-3 border min-h-[160px] ${
                      isToday ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <p className={`text-xs font-body font-semibold mb-1 ${isToday ? "text-primary" : "text-foreground"}`}>
                      {day.name}
                    </p>
                    <p className="text-xs text-muted-foreground font-body mb-3">{day.label}</p>
                    {dayPosts.map(post => (
                      <div key={post.id} className="bg-background rounded-lg p-2 mb-1 border border-border">
                        <p className="text-xs font-body font-medium text-foreground truncate">{post.title}</p>
                        <span className="text-xs">{PLATFORM_ICONS[post.platform]}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Daily habits */}
            <div className="bg-card rounded-2xl p-5 shadow-warm border border-border">
              <div className="flex items-center justify-between mb-4">
                <p className="font-body font-semibold text-foreground text-sm">Hábitos diários</p>
              </div>
              {habits.length === 0 ? (
                <p className="text-sm text-muted-foreground font-body mb-3">
                  Adicione hábitos como "Filmei hoje?", "Postei?", "Respondi comentários?"
                </p>
              ) : (
                <div className="space-y-2 mb-4">
                  {habits.map(habit => (
                    <div key={habit.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="font-body text-sm text-foreground">{habit.name}</span>
                      </div>
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
                <Input
                  placeholder="Novo hábito..."
                  value={newHabit}
                  onChange={(e) => setNewHabit(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addHabit()}
                  className="rounded-xl text-sm"
                />
                <Button variant="outline" size="sm" onClick={addHabit} disabled={!newHabit.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* TAB: Mês */}
          <TabsContent value="mes">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calendar */}
              <div className="lg:col-span-2 bg-card rounded-2xl p-5 shadow-warm border border-border">
                <h3 className="font-display font-semibold text-foreground mb-4">
                  {now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </h3>
                <div className="grid grid-cols-7 gap-1">
                  {dayNames.map(d => (
                    <div key={d} className="text-center text-xs font-body font-medium text-muted-foreground py-1">{d}</div>
                  ))}
                  {monthDays.map((date, i) => {
                    if (!date) return <div key={`empty-${i}`} />;
                    const dayPosts = posts.filter(p => p.scheduled_date === date || (p.status === "publicado" && p.scheduled_date === date));
                    const isToday = date === today;
                    return (
                      <div
                        key={date}
                        className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-center text-xs font-body ${
                          isToday ? "bg-primary/10 border border-primary" : "hover:bg-accent"
                        }`}
                      >
                        <span className={isToday ? "text-primary font-bold" : "text-foreground"}>
                          {new Date(date + "T12:00:00").getDate()}
                        </span>
                        {dayPosts.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5">
                            {dayPosts.slice(0, 3).map(p => (
                              <span
                                key={p.id}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{
                                  backgroundColor:
                                    p.platform === "instagram" ? "#C4622D" :
                                    p.platform === "tiktok" ? "#1C1C1A" :
                                    "#5C7A6B"
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Side panel */}
              <div className="bg-card rounded-2xl p-5 shadow-warm border border-border">
                <h3 className="font-display font-semibold text-foreground mb-4">Planejamento do mês</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Foco do mês</Label>
                    <Input
                      placeholder="Qual o foco principal?"
                      value={focus}
                      onChange={(e) => setFocus(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Reflexão</Label>
                    <Textarea
                      placeholder="Como foi o mês?"
                      value={reflection}
                      onChange={(e) => setReflection(e.target.value)}
                      className="rounded-xl min-h-[80px]"
                    />
                  </div>
                  <Button variant="default" className="w-full" onClick={saveMonthlyGoals}>
                    Salvar
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB: Metas */}
          <TabsContent value="metas">
            <div className="max-w-2xl space-y-6">
              <div className="bg-card rounded-2xl p-6 shadow-warm border border-border">
                <h3 className="font-display font-semibold text-foreground mb-4">
                  O que quero alcançar este mês
                </h3>
                {goals.map((goal, i) => (
                  <div key={i} className="flex items-center gap-3 mb-3">
                    <Checkbox className="rounded" />
                    <span className="font-body text-sm text-foreground flex-1">{goal}</span>
                    <button onClick={() => removeGoal(i)} className="p-1 hover:bg-destructive/10 rounded">
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                ))}
                {goals.length < 5 && (
                  <div className="flex gap-2 mt-3">
                    <Input
                      placeholder="Nova meta..."
                      value={newGoal}
                      onChange={(e) => setNewGoal(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addGoal()}
                      className="rounded-xl text-sm"
                    />
                    <Button variant="outline" size="sm" onClick={addGoal}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <Button variant="default" className="w-full mt-4" onClick={saveMonthlyGoals}>
                  Salvar metas
                </Button>
              </div>

              {/* Annual overview */}
              <div className="bg-card rounded-2xl p-6 shadow-warm border border-border">
                <h3 className="font-display font-semibold text-foreground mb-4">Visão anual</h3>
                <div className="grid grid-cols-12 gap-2 items-end h-32">
                  {Array.from({ length: 12 }, (_, i) => {
                    const month = new Date(now.getFullYear(), i, 1);
                    const monthPosts = posts.filter(p => {
                      if (!p.scheduled_date) return false;
                      const d = new Date(p.scheduled_date);
                      return d.getMonth() === i && d.getFullYear() === now.getFullYear();
                    });
                    const count = monthPosts.length;
                    const maxHeight = 100;
                    const height = count > 0 ? Math.max(8, (count / Math.max(1, ...Array.from({ length: 12 }, (_, j) => 
                      posts.filter(p => p.scheduled_date && new Date(p.scheduled_date).getMonth() === j).length
                    ))) * maxHeight) : 4;
                    
                    return (
                      <div key={i} className="flex flex-col items-center">
                        <div
                          className={`w-full rounded-t-lg ${i === now.getMonth() ? "bg-primary" : "bg-muted"}`}
                          style={{ height: `${height}px` }}
                        />
                        <span className="text-xs font-body text-muted-foreground mt-1">
                          {month.toLocaleDateString("pt-BR", { month: "short" }).slice(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default Plano;
