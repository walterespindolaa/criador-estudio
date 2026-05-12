import { ListChecks, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import type { Post } from "@/hooks/usePosts";
import type { Pillar } from "@/hooks/usePillars";

export type ReflectionFormState = {
  biz_worked: string;
  biz_blocked: string;
  content_best: string;
  content_rhythm: string;
  focus_execution: string;
  focus_lessons: string;
};

type Props = {
  posts: Post[];
  pillars: Pillar[];
  currentMonth: Date;
  today: string;
  reflectionForm: ReflectionFormState;
  onMonthChange: (delta: number) => void;
  onPostClick: (postId: string) => void;
  onReflectionChange: (key: keyof ReflectionFormState, value: string) => void;
  onSaveReflection: () => void;
};

const REFLECTION_FIELDS: ReadonlyArray<{
  key: "content_best" | "content_rhythm" | "focus_lessons";
  label: string;
  placeholder: string;
}> = [
  { key: "content_best", label: "Melhor conteúdo do mês", placeholder: "Qual post se destacou?" },
  { key: "content_rhythm", label: "Ritmo de produção", placeholder: "Como foi sua consistência?" },
  { key: "focus_lessons", label: "Aprendizados", placeholder: "O que aprendeu?" },
];

export function MonthTab({
  posts,
  pillars,
  currentMonth,
  today,
  reflectionForm,
  onMonthChange,
  onPostClick,
  onReflectionChange,
  onSaveReflection,
}: Props) {
  return (
    <div className="space-y-6">
      <CalendarMonthView
        posts={posts}
        pillars={pillars}
        currentMonth={currentMonth}
        onMonthChange={onMonthChange}
        onPostClick={(post) => onPostClick(post.id)}
        onDayClick={() => { /* click on post opens drawer */ }}
        today={today}
      />

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-body font-semibold text-foreground flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" /> Reflexão mensal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {REFLECTION_FIELDS.map(field => (
            <div key={field.key} className="space-y-1">
              <Label className="text-xs font-body">{field.label}</Label>
              <Textarea
                placeholder={field.placeholder}
                value={reflectionForm[field.key]}
                onChange={(e) => onReflectionChange(field.key, e.target.value)}
                className="rounded-xl min-h-[50px] text-sm"
              />
            </div>
          ))}
          <Button size="sm" onClick={onSaveReflection} className="w-full gap-1.5">
            <Save className="h-3.5 w-3.5" /> Salvar reflexão
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
