import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePosts, type Post } from "@/hooks/usePosts";
import { usePillars } from "@/hooks/usePillars";
import { useHabits } from "@/hooks/useHabits";
import { useGoals } from "@/hooks/useGoals";
import { useReflections } from "@/hooks/useReflections";
import { toast } from "sonner";
import {
  Plus, Trash2, CalendarDays, Target, BarChart3, Check, ChevronLeft, ChevronRight,
  Flag, TrendingUp, ListChecks, Save, Milestone,
} from "lucide-react";
import { PostEditor } from "@/components/kanban/PostEditor";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { WeekTab } from "@/components/plano/WeekTab";
import { MonthTab } from "@/components/plano/MonthTab";
import { GoalsTab } from "@/components/plano/GoalsTab";

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

type ReflectionFormState = {
  biz_worked: string;
  biz_blocked: string;
  content_best: string;
  content_rhythm: string;
  focus_execution: string;
  focus_lessons: string;
};

const Plano = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { posts } = usePosts();
  const { pillars } = usePillars();

  const [weekOffset, setWeekOffset] = useState(0);
  const [newHabit, setNewHabit] = useState("");

  const [monthDate, setMonthDate] = useState(new Date());

  const [showNewGoal, setShowNewGoal] = useState(false);
  const [newGoalForm, setNewGoalForm] = useState({ title: "", category: "geral", target_value: "", observation: "", due_date: "" });
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const [reflectionForm, setReflectionForm] = useState<ReflectionFormState>({
    biz_worked: "", biz_blocked: "", content_best: "", content_rhythm: "", focus_execution: "", focus_lessons: "",
  });

  const today = new Date().toISOString().split("T")[0];
  const weekDays = useMemo(() => getDaysOfWeek(weekOffset), [weekOffset]);

  const dateRange = useMemo(
    () => ({ start: weekDays[0].date, end: weekDays[6].date }),
    [weekDays],
  );

  const {
    habits,
    habitLogs,
    createHabit,
    deleteHabit: deleteHabitMutation,
    toggleHabitLog,
  } = useHabits({ dateRange });

  const {
    structuredGoals: goals,
    milestones,
    createGoal: createGoalMutation,
    updateGoalProgress,
    updateGoalStatus: updateGoalStatusMutation,
    deleteGoal: deleteGoalMutation,
    createMilestone,
    updateMilestone,
    deleteMilestone: deleteMilestoneMutation,
  } = useGoals();

  const currentMonth = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}-01`;
  const { reflection, saveReflection: saveReflectionMutation } = useReflections(currentMonth);

  useEffect(() => {
    if (!reflection) {
      setReflectionForm({
        biz_worked: "", biz_blocked: "", content_best: "", content_rhythm: "", focus_execution: "", focus_lessons: "",
      });
      return;
    }
    setReflectionForm({
      biz_worked: reflection.biz_worked || "",
      biz_blocked: reflection.biz_blocked || "",
      content_best: reflection.content_best || "",
      content_rhythm: reflection.content_rhythm || "",
      focus_execution: reflection.focus_execution || "",
      focus_lessons: reflection.focus_lessons || "",
    });
  }, [reflection]);

  const handleToggleHabit = async (habitId: string, date: string) => {
    try {
      await toggleHabitLog.mutateAsync({ habitId, date });
    } catch {
      toast.error("Erro ao atualizar hábito.");
    }
  };

  const isHabitDone = (habitId: string, date: string) =>
    habitLogs.find(l => l.habit_id === habitId && l.date === date)?.done || false;

  const addHabit = async () => {
    if (!newHabit.trim()) return;
    try {
      await createHabit.mutateAsync({ name: newHabit.trim() });
      setNewHabit("");
    } catch {
      toast.error("Erro ao adicionar hábito.");
    }
  };

  const handleDeleteHabit = async (id: string) => {
    try {
      await deleteHabitMutation.mutateAsync(id);
    } catch {
      toast.error("Erro ao remover hábito.");
    }
  };

  const createGoal = async () => {
    if (!newGoalForm.title.trim()) return;
    try {
      await createGoalMutation.mutateAsync({
        title: newGoalForm.title.trim(),
        category: newGoalForm.category,
        target_value: newGoalForm.target_value ? parseFloat(newGoalForm.target_value) : 0,
        observation: newGoalForm.observation || null,
        end_date: newGoalForm.due_date || null,
        status: "em_andamento",
      });
      setNewGoalForm({ title: "", category: "geral", target_value: "", observation: "", due_date: "" });
      setShowNewGoal(false);
      toast.success("Meta criada!");
    } catch {
      toast.error("Erro ao criar meta.");
    }
  };

  const updateGoalValue = async (goalId: string, value: number) => {
    try {
      await updateGoalProgress.mutateAsync({ id: goalId, current_value: value });
    } catch {
      toast.error("Erro ao atualizar valor.");
    }
  };

  const updateGoalStatus = async (goalId: string, status: string) => {
    try {
      await updateGoalStatusMutation.mutateAsync({ id: goalId, status });
      toast.success("Status atualizado!");
    } catch {
      toast.error("Erro ao atualizar status.");
    }
  };

  const deleteGoal = async (goalId: string) => {
    try {
      await deleteGoalMutation.mutateAsync(goalId);
      toast.success("Meta removida.");
    } catch {
      toast.error("Erro ao remover meta.");
    }
  };

  const addMilestone = async (goalId: string) => {
    if (!newMilestoneName.trim()) return;
    const goalMilestones = milestones.filter(m => m.goal_id === goalId);
    try {
      await createMilestone.mutateAsync({
        goal_id: goalId,
        name: newMilestoneName.trim(),
        position: goalMilestones.length,
      });
      setNewMilestoneName("");
    } catch {
      toast.error("Erro ao adicionar marco.");
    }
  };

  const toggleMilestone = async (milestoneId: string, completed: boolean) => {
    try {
      await updateMilestone.mutateAsync({
        id: milestoneId,
        updates: {
          completed: !completed,
          completed_at: !completed ? new Date().toISOString() : null,
        },
      });
    } catch {
      toast.error("Erro ao atualizar marco.");
    }
  };

  const deleteMilestone = async (id: string) => {
    try {
      await deleteMilestoneMutation.mutateAsync(id);
    } catch {
      toast.error("Erro ao remover marco.");
    }
  };

  const saveReflection = async () => {
    try {
      await saveReflectionMutation.mutateAsync({
        biz_worked: reflectionForm.biz_worked || null,
        biz_blocked: reflectionForm.biz_blocked || null,
        content_best: reflectionForm.content_best || null,
        content_rhythm: reflectionForm.content_rhythm || null,
        focus_execution: reflectionForm.focus_execution || null,
        focus_lessons: reflectionForm.focus_lessons || null,
      });
      toast.success("Reflexão salva!");
    } catch {
      toast.error("Erro ao salvar reflexão.");
    }
  };

  const openPost = (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (post) {
      setSelectedPost(post);
      setDrawerOpen(true);
    }
  };

  const weekPublished = posts.filter(p =>
    p.status === "publicado" && p.scheduled_date && weekDays.some(d => d.date === p.scheduled_date)
  );
  const weekGoal = profile?.weekly_goal || 3;
  const weekProgress = Math.min(100, Math.round((weekPublished.length / weekGoal) * 100));

  const weekLabel = (() => {
    const start = new Date(weekDays[0].date + "T12:00:00");
    const end = new Date(weekDays[6].date + "T12:00:00");
    return `${start.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} — ${end.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`;
  })();

  return (
    <div className="max-w-5xl pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-sm shrink-0">
            <CalendarDays className="h-5 w-5 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Meu Plano</h1>
            <p className="text-muted-foreground font-body mt-0.5 text-sm">Planeje, acompanhe e reflita sobre sua produção.</p>
          </div>
        </div>

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
            <WeekTab
              posts={posts}
              pillars={pillars}
              habits={habits}
              habitLogs={habitLogs}
              weekDays={weekDays}
              weekOffset={weekOffset}
              weekLabel={weekLabel}
              weekPublishedCount={weekPublished.length}
              weekGoal={weekGoal}
              weekProgress={weekProgress}
              today={today}
              newHabit={newHabit}
              onNewHabitChange={setNewHabit}
              onWeekChange={(delta) => {
                if (delta === 0) setWeekOffset(0);
                else setWeekOffset((w) => w + delta);
              }}
              onPostClick={openPost}
              onToggleHabit={handleToggleHabit}
              onAddHabit={addHabit}
              onDeleteHabit={handleDeleteHabit}
            />
          </TabsContent>

          {/* ═══════════ TAB: MÊS ═══════════ */}
          <TabsContent value="mes">
            <MonthTab
              posts={posts}
              pillars={pillars}
              currentMonth={monthDate}
              today={today}
              reflectionForm={reflectionForm}
              onMonthChange={(delta) => {
                if (delta === 0) setMonthDate(new Date());
                else setMonthDate((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
              }}
              onPostClick={openPost}
              onReflectionChange={(key, value) => setReflectionForm(prev => ({ ...prev, [key]: value }))}
              onSaveReflection={saveReflection}
            />
          </TabsContent>

          {/* ═══════════ TAB: METAS ═══════════ */}
          <TabsContent value="metas">
            <GoalsTab
              goals={goals}
              milestones={milestones}
              posts={posts}
              today={today}
              showNewGoal={showNewGoal}
              newGoalForm={newGoalForm}
              newMilestoneName={newMilestoneName}
              expandedGoal={expandedGoal}
              onShowNewGoal={setShowNewGoal}
              onNewGoalFormChange={(patch) => setNewGoalForm(prev => ({ ...prev, ...patch }))}
              onCreateGoal={createGoal}
              onUpdateGoalValue={updateGoalValue}
              onUpdateGoalStatus={updateGoalStatus}
              onDeleteGoal={deleteGoal}
              onToggleMilestone={toggleMilestone}
              onAddMilestone={addMilestone}
              onDeleteMilestone={deleteMilestone}
              onNewMilestoneNameChange={setNewMilestoneName}
              onExpandedGoalChange={setExpandedGoal}
            />
          </TabsContent>

        </Tabs>
      </motion.div>

      <PostEditor
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        post={selectedPost}
        pillars={pillars}
        userId={user?.id || ""}
        onSaved={() => { /* React Query invalidations handle refresh */ }}
      />
    </div>
  );
};

export default Plano;
