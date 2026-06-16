import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Target, ListChecks, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePosts } from "@/hooks/usePosts";
import { usePillars } from "@/hooks/usePillars";
import { useGoals } from "@/hooks/useGoals";
import { useReflections } from "@/hooks/useReflections";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { GoalsTab } from "@/components/plano/GoalsTab";

const Metas = () => {
  const { user } = useAuth();
  const { posts } = usePosts();
  const { pillars } = usePillars();

  const [showNewGoal, setShowNewGoal] = useState(false);
  const [newGoalForm, setNewGoalForm] = useState({ title: "", category: "geral", target_value: "", observation: "", due_date: "" });
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

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

  type RForm = { biz_worked: string; biz_blocked: string; content_best: string; content_rhythm: string; focus_execution: string; focus_lessons: string; };

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const { reflection, saveReflection: saveReflectionMutation } = useReflections(currentMonth);
  const [reflectionForm, setReflectionForm] = useState<RForm>({ biz_worked: "", biz_blocked: "", content_best: "", content_rhythm: "", focus_execution: "", focus_lessons: "" });

  useEffect(() => {
    if (!reflection) { setReflectionForm({ biz_worked: "", biz_blocked: "", content_best: "", content_rhythm: "", focus_execution: "", focus_lessons: "" }); return; }
    setReflectionForm({
      biz_worked: reflection.biz_worked || "", biz_blocked: reflection.biz_blocked || "",
      content_best: reflection.content_best || "", content_rhythm: reflection.content_rhythm || "",
      focus_execution: reflection.focus_execution || "", focus_lessons: reflection.focus_lessons || "",
    });
  }, [reflection]);

  const handleSaveReflection = async () => {
    try {
      await saveReflectionMutation.mutateAsync({
        biz_worked: reflectionForm.biz_worked || null, biz_blocked: reflectionForm.biz_blocked || null,
        content_best: reflectionForm.content_best || null, content_rhythm: reflectionForm.content_rhythm || null,
        focus_execution: reflectionForm.focus_execution || null, focus_lessons: reflectionForm.focus_lessons || null,
      });
      toast.success("Reflexão salva!");
    } catch { toast.error("Erro ao salvar reflexão."); }
  };

  const REFLECTION_FIELDS: { key: keyof RForm; label: string; placeholder: string }[] = [
    { key: "biz_worked", label: "O que funcionou", placeholder: "O que deu certo este mês?" },
    { key: "biz_blocked", label: "O que travou", placeholder: "O que atrapalhou ou ficou pendente?" },
    { key: "content_best", label: "Melhor conteúdo do mês", placeholder: "Qual post se destacou?" },
    { key: "content_rhythm", label: "Ritmo de produção", placeholder: "Como foi sua consistência?" },
    { key: "focus_execution", label: "Execução & foco", placeholder: "Como foi sua disciplina?" },
    { key: "focus_lessons", label: "Aprendizados", placeholder: "O que aprendeu?" },
  ];

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm shrink-0">
            <Target className="h-5 w-5 text-white" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Metas</h1>
            <p className="text-muted-foreground font-body mt-0.5 text-sm">Suas metas de criação e marcos</p>
          </div>
        </div>

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

        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ListChecks className="h-4 w-4 text-primary" />
            <h2 className="font-display font-bold text-lg">Reflexão do mês</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REFLECTION_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <label className="text-xs font-body font-medium text-muted-foreground">{field.label}</label>
                <Textarea value={reflectionForm[field.key]}
                  onChange={(e) => setReflectionForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder} className="rounded-xl min-h-[80px] text-sm" />
              </div>
            ))}
          </div>
          <Button size="sm" onClick={handleSaveReflection} className="w-full mt-4 gap-1.5">
            <Save className="h-3.5 w-3.5" /> Salvar reflexão
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default Metas;
