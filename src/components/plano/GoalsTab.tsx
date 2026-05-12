import { motion } from "framer-motion";
import { CalendarDays, Check, Flag, Milestone as MilestoneIcon, Plus, Target, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import type { StructuredGoal, Milestone } from "@/hooks/useGoals";
import type { Post } from "@/hooks/usePosts";

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

export type NewGoalForm = {
  title: string;
  category: string;
  target_value: string;
  observation: string;
  due_date: string;
};

type Props = {
  goals: StructuredGoal[];
  milestones: Milestone[];
  posts: Post[];
  today: string;
  showNewGoal: boolean;
  newGoalForm: NewGoalForm;
  newMilestoneName: string;
  expandedGoal: string | null;
  onShowNewGoal: (show: boolean) => void;
  onNewGoalFormChange: (patch: Partial<NewGoalForm>) => void;
  onCreateGoal: () => void;
  onUpdateGoalValue: (id: string, value: number) => void;
  onUpdateGoalStatus: (id: string, status: string) => void;
  onDeleteGoal: (id: string) => void;
  onToggleMilestone: (id: string, completed: boolean) => void;
  onAddMilestone: (goalId: string) => void;
  onDeleteMilestone: (id: string) => void;
  onNewMilestoneNameChange: (value: string) => void;
  onExpandedGoalChange: (id: string | null) => void;
};

export function GoalsTab({
  goals,
  milestones,
  posts,
  today,
  showNewGoal,
  newGoalForm,
  newMilestoneName,
  expandedGoal,
  onShowNewGoal,
  onNewGoalFormChange,
  onCreateGoal,
  onUpdateGoalValue,
  onUpdateGoalStatus,
  onDeleteGoal,
  onToggleMilestone,
  onAddMilestone,
  onDeleteMilestone,
  onNewMilestoneNameChange,
  onExpandedGoalChange,
}: Props) {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-body font-semibold text-foreground">
            Minhas Metas{" "}
            <InfoTooltip text="Metas mensais ou de projeto. Adicione marcos para dividir em etapas menores." />
          </h2>
          <p className="text-xs text-muted-foreground font-body">Defina objetivos claros e acompanhe seu progresso.</p>
        </div>
        <Button onClick={() => onShowNewGoal(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nova meta
        </Button>
      </div>

      {showNewGoal && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-body">Título</Label>
                <Input
                  placeholder="Ex: Alcançar 10k seguidores"
                  value={newGoalForm.title}
                  onChange={(e) => onNewGoalFormChange({ title: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-body">Categoria</Label>
                <Select value={newGoalForm.category} onValueChange={(v) => onNewGoalFormChange({ category: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOAL_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-body">Valor objetivo</Label>
                <Input
                  placeholder="Ex: 10000"
                  type="number"
                  value={newGoalForm.target_value}
                  onChange={(e) => onNewGoalFormChange({ target_value: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-body">Observação</Label>
                <Input
                  placeholder="Notas sobre a meta..."
                  value={newGoalForm.observation}
                  onChange={(e) => onNewGoalFormChange({ observation: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-body">Prazo (opcional)</Label>
                <Input
                  type="date"
                  value={newGoalForm.due_date}
                  onChange={(e) => onNewGoalFormChange({ due_date: e.target.value })}
                  className="rounded-xl text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => onShowNewGoal(false)}>Cancelar</Button>
              <Button size="sm" onClick={onCreateGoal} disabled={!newGoalForm.title.trim()}>Criar meta</Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                <button
                  type="button"
                  onClick={() => onExpandedGoalChange(isExpanded ? null : goal.id)}
                  className="w-full text-left"
                >
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
                            <MilestoneIcon className="h-2.5 w-2.5" /> {completedMs}/{goalMilestones.length} marcos
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

                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 space-y-4 border-t border-border pt-4"
                  >
                    {target > 0 && (
                      <div className="flex items-center gap-3">
                        <Label className="text-xs font-body whitespace-nowrap">Valor atual:</Label>
                        <Input
                          type="number"
                          value={current}
                          onChange={(e) => onUpdateGoalValue(goal.id, parseFloat(e.target.value) || 0)}
                          className="rounded-xl text-sm w-28"
                        />
                        <span className="text-xs text-muted-foreground font-body">/ {target}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <Label className="text-xs font-body whitespace-nowrap">Status:</Label>
                      <Select value={goal.status ?? "em_andamento"} onValueChange={(v) => onUpdateGoalStatus(goal.id, v)}>
                        <SelectTrigger className="rounded-xl text-sm w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_GOAL.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {goal.observation && (
                      <p className="text-xs text-muted-foreground font-body italic">📝 {goal.observation}</p>
                    )}

                    <div className="space-y-2">
                      <p className="text-xs font-body font-semibold text-foreground flex items-center gap-1.5">
                        <MilestoneIcon className="h-3.5 w-3.5 text-primary" /> Marcos (baby steps)
                      </p>
                      {goalMilestones.map(ms => (
                        <div key={ms.id} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onToggleMilestone(ms.id, !!ms.completed)}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                              ms.completed ? "bg-secondary border-secondary text-secondary-foreground" : "border-border hover:border-primary"
                            }`}
                          >
                            {ms.completed && <Check className="h-3 w-3" />}
                          </button>
                          <span className={`text-sm font-body flex-1 ${ms.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {ms.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => onDeleteMilestone(ms.id)}
                            className="p-0.5 hover:bg-destructive/10 rounded"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Novo marco..."
                          value={newMilestoneName}
                          onChange={(e) => onNewMilestoneNameChange(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && onAddMilestone(goal.id)}
                          className="rounded-xl text-sm"
                        />
                        <Button variant="outline" size="sm" onClick={() => onAddMilestone(goal.id)} disabled={!newMilestoneName.trim()}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive text-xs"
                        onClick={() => onDeleteGoal(goal.id)}
                      >
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
              const maxCount = Math.max(
                1,
                ...Array.from({ length: 12 }, (_, j) =>
                  posts.filter(p =>
                    p.scheduled_date &&
                    new Date(p.scheduled_date).getMonth() === j &&
                    new Date(p.scheduled_date).getFullYear() === now.getFullYear()
                  ).length
                )
              );
              const height = count > 0 ? Math.max(8, (count / maxCount) * 100) : 4;
              return (
                <div key={i} className="flex flex-col items-center">
                  <div
                    className={`w-full rounded-t-lg transition-all ${i === now.getMonth() ? "bg-primary" : "bg-muted"}`}
                    style={{ height: `${height}px` }}
                  />
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
  );
}
