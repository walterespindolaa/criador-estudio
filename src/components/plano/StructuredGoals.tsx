import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Target, ChevronDown, ChevronUp, Edit2, Check, Trophy, Milestone as MilestoneIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Goal {
  id: string;
  title: string;
  category: string;
  period: string;
  current_value: number;
  target_value: number;
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

const CATEGORIES = [
  { value: "seguidores", label: "Seguidores" },
  { value: "posts", label: "Posts publicados" },
  { value: "vendas", label: "Vendas" },
  { value: "engajamento", label: "Engajamento" },
  { value: "receita", label: "Receita (R$)" },
  { value: "alcance", label: "Alcance" },
  { value: "geral", label: "Outro" },
];

const STATUS_OPTIONS = [
  { value: "em_andamento", label: "Em andamento", color: "bg-primary/20 text-primary" },
  { value: "concluida", label: "Concluída", color: "bg-secondary/20 text-secondary" },
  { value: "pausada", label: "Pausada", color: "bg-muted text-muted-foreground" },
];

export function StructuredGoals({ userId }: { userId: string }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("geral");
  const [targetValue, setTargetValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [observation, setObservation] = useState("");
  const [newMilestone, setNewMilestone] = useState("");

  const fetchGoals = useCallback(async () => {
    const [goalsRes, milestonesRes] = await Promise.all([
      supabase.from("structured_goals" as any).select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("milestones" as any).select("*").eq("user_id", userId).order("position"),
    ]);
    setGoals((goalsRes.data as any[]) || []);
    setMilestones((milestonesRes.data as any[]) || []);
  }, [userId]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const resetForm = () => {
    setTitle(""); setCategory("geral"); setTargetValue(""); setCurrentValue("");
    setStartDate(""); setEndDate(""); setObservation(""); setShowForm(false); setEditingGoal(null);
  };

  const handleSaveGoal = async () => {
    if (!title.trim()) return;
    const data: any = {
      user_id: userId,
      title: title.trim(),
      category,
      current_value: parseFloat(currentValue) || 0,
      target_value: parseFloat(targetValue) || 0,
      start_date: startDate || null,
      end_date: endDate || null,
      observation: observation || null,
    };

    if (editingGoal) {
      await supabase.from("structured_goals" as any).update(data).eq("id", editingGoal);
      toast.success("Meta atualizada!");
    } else {
      await supabase.from("structured_goals" as any).insert(data);
      toast.success("Meta criada!");
    }
    resetForm();
    fetchGoals();
  };

  const editGoal = (goal: Goal) => {
    setTitle(goal.title); setCategory(goal.category);
    setTargetValue(goal.target_value.toString()); setCurrentValue(goal.current_value.toString());
    setStartDate(goal.start_date || ""); setEndDate(goal.end_date || "");
    setObservation(goal.observation || ""); setEditingGoal(goal.id); setShowForm(true);
  };

  const updateGoalStatus = async (goalId: string, status: string) => {
    await supabase.from("structured_goals" as any).update({ status }).eq("id", goalId);
    fetchGoals();
  };

  const updateCurrentValue = async (goalId: string, value: string) => {
    await supabase.from("structured_goals" as any).update({ current_value: parseFloat(value) || 0 }).eq("id", goalId);
    fetchGoals();
  };

  const deleteGoal = async (goalId: string) => {
    await supabase.from("structured_goals" as any).delete().eq("id", goalId);
    toast.success("Meta removida.");
    fetchGoals();
  };

  const addMilestone = async (goalId: string) => {
    if (!newMilestone.trim()) return;
    const goalMilestones = milestones.filter(m => m.goal_id === goalId);
    await supabase.from("milestones" as any).insert({
      user_id: userId,
      goal_id: goalId,
      name: newMilestone.trim(),
      position: goalMilestones.length,
    });
    setNewMilestone("");
    fetchGoals();
  };

  const toggleMilestone = async (ms: MilestoneItem) => {
    await supabase.from("milestones" as any).update({
      completed: !ms.completed,
      completed_at: !ms.completed ? new Date().toISOString() : null,
    }).eq("id", ms.id);
    fetchGoals();
  };

  const deleteMilestone = async (id: string) => {
    await supabase.from("milestones" as any).delete().eq("id", id);
    fetchGoals();
  };

  const getProgress = (goal: Goal) => {
    if (!goal.target_value || goal.target_value === 0) return 0;
    return Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-foreground text-lg">Minhas Metas</h3>
          <p className="text-sm text-muted-foreground font-body">Acompanhe seu progresso com metas estruturadas</p>
        </div>
        <Button variant="hero" size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova meta
        </Button>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="bg-card rounded-2xl p-5 shadow-warm border border-border overflow-hidden"
          >
            <h4 className="font-display font-semibold text-foreground mb-4">{editingGoal ? "Editar meta" : "Nova meta"}</h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="font-body text-sm">Título da meta</Label>
                <Input placeholder="Ex: Chegar a 10k seguidores" value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-body text-sm">Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Valor atual</Label>
                    <Input type="number" placeholder="0" value={currentValue} onChange={e => setCurrentValue(e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body text-sm">Objetivo</Label>
                    <Input type="number" placeholder="0" value={targetValue} onChange={e => setTargetValue(e.target.value)} className="rounded-xl" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-body text-sm">Data início</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Data fim</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-body text-sm">Observação</Label>
                <Textarea placeholder="Estratégia, motivo, anotações..." value={observation} onChange={e => setObservation(e.target.value)} className="rounded-xl min-h-[60px]" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={resetForm}>Cancelar</Button>
                <Button variant="hero" className="flex-1" onClick={handleSaveGoal} disabled={!title.trim()}>
                  {editingGoal ? "Salvar" : "Criar meta"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goals list */}
      {goals.length === 0 && !showForm && (
        <div className="bg-card rounded-2xl p-8 shadow-warm border border-border text-center">
          <Target className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-body text-muted-foreground">Nenhuma meta criada ainda.</p>
          <p className="font-body text-sm text-muted-foreground/70 mt-1">Crie sua primeira meta para acompanhar seu crescimento!</p>
        </div>
      )}

      {goals.map(goal => {
        const progress = getProgress(goal);
        const goalMilestones = milestones.filter(m => m.goal_id === goal.id);
        const milestoneDone = goalMilestones.filter(m => m.completed).length;
        const isExpanded = expandedGoal === goal.id;
        const statusOpt = STATUS_OPTIONS.find(s => s.value === goal.status);
        const catLabel = CATEGORIES.find(c => c.value === goal.category)?.label || goal.category;

        return (
          <motion.div key={goal.id} layout className="bg-card rounded-2xl shadow-warm border border-border overflow-hidden">
            {/* Header */}
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusOpt?.color}`}>{statusOpt?.label}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-body bg-accent text-accent-foreground">{catLabel}</span>
                  </div>
                  <h4 className="font-display font-semibold text-foreground">{goal.title}</h4>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button onClick={() => editGoal(goal)} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                    <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => deleteGoal(goal.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              </div>

              {/* Progress */}
              <div className="flex items-center gap-3 mb-2">
                <Progress value={progress} className="flex-1 h-2" />
                <span className="text-sm font-body font-semibold text-foreground shrink-0">{progress}%</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground font-body">
                <span>{goal.current_value} / {goal.target_value}</span>
                {goal.end_date && <span>até {new Date(goal.end_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}</span>}
              </div>

              {/* Quick update + expand */}
              <div className="flex items-center gap-2 mt-3">
                <Input
                  type="number"
                  placeholder="Atualizar valor"
                  className="rounded-xl h-8 text-xs flex-1"
                  defaultValue={goal.current_value}
                  onBlur={(e) => {
                    if (e.target.value !== goal.current_value.toString()) {
                      updateCurrentValue(goal.id, e.target.value);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      updateCurrentValue(goal.id, (e.target as HTMLInputElement).value);
                    }
                  }}
                />
                <Select value={goal.status} onValueChange={(v) => updateGoalStatus(goal.id, v)}>
                  <SelectTrigger className="rounded-xl h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <button onClick={() => setExpandedGoal(isExpanded ? null : goal.id)} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
              </div>
            </div>

            {/* Expanded: Milestones */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="border-t border-border overflow-hidden"
                >
                  <div className="p-5 space-y-3">
                    <p className="font-body text-sm font-semibold text-foreground flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-primary" /> Baby Steps ({milestoneDone}/{goalMilestones.length})
                    </p>

                    {goalMilestones.map(ms => (
                      <div key={ms.id} className="flex items-center gap-3">
                        <button
                          onClick={() => toggleMilestone(ms)}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                            ms.completed ? "bg-secondary border-secondary" : "border-border hover:border-primary"
                          }`}
                        >
                          {ms.completed && <Check className="h-3 w-3 text-secondary-foreground" />}
                        </button>
                        <span className={`font-body text-sm flex-1 ${ms.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {ms.name}
                        </span>
                        {ms.completed_at && (
                          <span className="text-[10px] text-muted-foreground font-body">
                            {new Date(ms.completed_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                          </span>
                        )}
                        <button onClick={() => deleteMilestone(ms.id)} className="p-1 hover:bg-destructive/10 rounded">
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <Input
                        placeholder="Ex: 100 seguidores"
                        value={newMilestone}
                        onChange={e => setNewMilestone(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addMilestone(goal.id)}
                        className="rounded-xl text-sm h-8"
                      />
                      <Button variant="outline" size="sm" onClick={() => addMilestone(goal.id)} disabled={!newMilestone.trim()}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {goal.observation && (
                      <p className="text-xs text-muted-foreground font-body bg-muted/50 rounded-xl p-3 mt-2">{goal.observation}</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
