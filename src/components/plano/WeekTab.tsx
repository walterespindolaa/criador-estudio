import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { CalendarWeekView } from "@/components/calendar/CalendarWeekView";
import type { Post } from "@/hooks/usePosts";
import type { Pillar } from "@/hooks/usePillars";
import type { Habit, HabitLog } from "@/hooks/useHabits";

type WeekDay = { date: string; name: string; dayNum: number };

type Props = {
  posts: Post[];
  pillars: Pillar[];
  habits: Habit[];
  habitLogs: HabitLog[];
  weekDays: WeekDay[];
  weekOffset: number;
  weekLabel: string;
  weekPublishedCount: number;
  weekGoal: number;
  weekProgress: number;
  today: string;
  newHabit: string;
  onNewHabitChange: (value: string) => void;
  onWeekChange: (delta: number) => void;
  onPostClick: (postId: string) => void;
  onToggleHabit: (habitId: string, date: string) => void;
  onAddHabit: () => void;
  onDeleteHabit: (habitId: string) => void;
};

export function WeekTab({
  posts,
  pillars,
  habits,
  habitLogs,
  weekDays,
  weekOffset,
  weekLabel,
  weekPublishedCount,
  weekGoal,
  weekProgress,
  today,
  newHabit,
  onNewHabitChange,
  onWeekChange,
  onPostClick,
  onToggleHabit,
  onAddHabit,
  onDeleteHabit,
}: Props) {
  const isHabitDone = (habitId: string, date: string) =>
    habitLogs.find(l => l.habit_id === habitId && l.date === date)?.done || false;

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onWeekChange(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-body font-medium text-foreground">{weekLabel}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onWeekChange(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {weekOffset !== 0 && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => onWeekChange(0)}>
                  Hoje
                </Button>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground font-body">{weekPublishedCount}/{weekGoal} posts</p>
              <Progress value={weekProgress} className="w-24 h-1.5 mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      <CalendarWeekView
        posts={posts}
        pillars={pillars}
        weekDays={weekDays}
        weekOffset={weekOffset}
        onWeekChange={onWeekChange}
        onPostClick={(post) => onPostClick(post.id)}
        today={today}
      />

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-body font-semibold text-foreground">
            Hábitos diários{" "}
            <InfoTooltip text="Acompanhamento semanal dos seus hábitos de criação. Marque os dias que cumpriu cada hábito." />
          </CardTitle>
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
                        type="button"
                        onClick={() => onToggleHabit(habit.id, day.date)}
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
                    <button
                      type="button"
                      onClick={() => onDeleteHabit(habit.id)}
                      className="p-1 ml-1 hover:bg-destructive/10 rounded"
                    >
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
              onChange={(e) => onNewHabitChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAddHabit()}
              className="rounded-xl text-sm"
            />
            <Button variant="outline" size="sm" onClick={onAddHabit} disabled={!newHabit.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
