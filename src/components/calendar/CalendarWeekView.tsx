import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getStatusClasses } from "@/lib/statusColors";
import type { Post } from "@/hooks/usePosts";
import type { Pillar } from "@/hooks/usePillars";

const HOUR_HEIGHT = 56;
const START_HOUR = 8;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

type WeekDay = { date: string; name: string; dayNum: number };

type Props = {
  posts: Post[];
  pillars: Pillar[];
  weekDays: WeekDay[];
  weekOffset: number;
  onWeekChange: (delta: number) => void;
  onPostClick: (post: Post) => void;
  today: string;
  onReschedule?: (postId: string, date: string, time: string | null) => void;
};

function timeToTopPx(time: string | null | undefined): number | null {
  if (!time) return null;
  const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(hh)) return null;
  const offsetMinutes = hh * 60 + (Number.isNaN(mm) ? 0 : mm) - START_HOUR * 60;
  if (offsetMinutes < 0 || offsetMinutes > (END_HOUR - START_HOUR + 1) * 60) return null;
  return (offsetMinutes / 60) * HOUR_HEIGHT;
}

function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display} ${period}`;
}

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }

export function CalendarWeekView({ posts, pillars, weekDays, weekOffset, onWeekChange, onPostClick, today, onReschedule }: Props) {
  const pillarById = new Map(pillars.map((p) => [p.id, p]));
  const [dragging, setDragging] = useState(false);
  const [overKey, setOverKey] = useState<string | null>(null);

  const postsByDay = new Map<string, Post[]>();
  for (const post of posts) {
    if (!post.scheduled_date) continue;
    const list = postsByDay.get(post.scheduled_date) ?? [];
    list.push(post);
    postsByDay.set(post.scheduled_date, list);
  }

  const firstLabel = weekDays[0] ? `${weekDays[0].name} ${weekDays[0].dayNum}` : "";
  const lastLabel = weekDays[6] ? `${weekDays[6].name} ${weekDays[6].dayNum}` : "";

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onWeekChange(-1)} aria-label="Semana anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => onWeekChange(1)} aria-label="Próxima semana"><ChevronRight className="h-4 w-4" /></Button>
          {weekOffset !== 0 && (<Button variant="ghost" size="sm" onClick={() => onWeekChange(-weekOffset)}>Esta semana</Button>)}
        </div>
        <p className="text-sm font-body text-muted-foreground">{firstLabel} — {lastLabel}</p>
      </div>

      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-card sticky top-0 z-10">
        <div />
        {weekDays.map((day) => {
          const isToday = day.date === today;
          return (
            <div key={day.date} className={cn("text-center py-3 border-l border-border", isToday && "bg-primary/5")}>
              <p className="text-[11px] uppercase tracking-wider font-body font-semibold text-muted-foreground">{day.name}</p>
              <p className={cn("text-lg font-display font-bold mt-0.5", isToday ? "text-primary" : "text-foreground")}>{day.dayNum}</p>
              {isToday && <div className="w-1.5 h-1.5 bg-primary rounded-full mx-auto mt-1" />}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-muted/20">
        <div className="px-2 py-2 text-[10px] font-body font-semibold uppercase text-muted-foreground flex items-center justify-end gap-1"><Clock className="h-3 w-3" /> Sem horário</div>
        {weekDays.map((day) => {
          const dayPosts = (postsByDay.get(day.date) ?? []).filter((p) => !p.scheduled_time);
          const key = `untimed-${day.date}`;
          return (
            <div
              key={key}
              onDragOver={onReschedule ? (e) => { e.preventDefault(); setOverKey(key); } : undefined}
              onDragLeave={onReschedule ? () => setOverKey((k) => (k === key ? null : k)) : undefined}
              onDrop={onReschedule ? (e) => { e.preventDefault(); setOverKey(null); const id = e.dataTransfer.getData("text/plain"); if (id) onReschedule(id, day.date, null); } : undefined}
              className={cn("border-l border-border p-1 space-y-1 min-h-[50px] transition-colors", day.date === today && "bg-primary/[0.03]", overKey === key && "bg-primary/10 ring-1 ring-inset ring-primary")}
            >
              {dayPosts.map((post) => {
                const pillar = post.pillar_id ? pillarById.get(post.pillar_id) : undefined;
                return (
                  <button
                    key={post.id}
                    type="button"
                    draggable={!!onReschedule}
                    onDragStart={onReschedule ? (e) => { e.dataTransfer.setData("text/plain", post.id); e.dataTransfer.effectAllowed = "move"; setDragging(true); } : undefined}
                    onDragEnd={onReschedule ? () => { setDragging(false); setOverKey(null); } : undefined}
                    onClick={() => onPostClick(post)}
                    style={{ borderLeftColor: pillar?.color, borderLeftWidth: pillar ? 3 : undefined, pointerEvents: dragging ? "none" : undefined }}
                    className={cn("w-full text-left rounded-md border px-1.5 py-1 hover:shadow-warm-md hover:scale-[1.01] transition-all duration-150", onReschedule && "cursor-grab active:cursor-grabbing", getStatusClasses(post.status))}
                  >
                    <p className="text-[10px] font-body font-medium line-clamp-1">{post.title}</p>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="relative grid grid-cols-[60px_repeat(7,1fr)]" style={{ height: HOURS.length * HOUR_HEIGHT }}>
        <div className="relative">
          {HOURS.map((h) => (
            <div key={h} className="absolute left-0 right-0 text-[10px] font-body font-semibold uppercase text-muted-foreground text-right pr-2" style={{ top: (h - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}>{formatHour(h)}</div>
          ))}
        </div>

        {weekDays.map((day) => {
          const isToday = day.date === today;
          const dayPosts = (postsByDay.get(day.date) ?? []).filter((p) => p.scheduled_time);
          const key = `timed-${day.date}`;
          return (
            <div
              key={day.date}
              onDragOver={onReschedule ? (e) => { e.preventDefault(); setOverKey(key); } : undefined}
              onDragLeave={onReschedule ? () => setOverKey((k) => (k === key ? null : k)) : undefined}
              onDrop={onReschedule ? (e) => {
                e.preventDefault(); setOverKey(null);
                const id = e.dataTransfer.getData("text/plain");
                if (!id) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                let hour = START_HOUR + Math.floor(y / HOUR_HEIGHT);
                if (hour < START_HOUR) hour = START_HOUR;
                if (hour > END_HOUR) hour = END_HOUR;
                const min = (y - Math.floor(y / HOUR_HEIGHT) * HOUR_HEIGHT) < HOUR_HEIGHT / 2 ? "00" : "30";
                onReschedule(id, day.date, `${pad2(hour)}:${min}`);
              } : undefined}
              className={cn("relative border-l border-border transition-colors", isToday && "bg-primary/[0.03]", overKey === key && "bg-primary/5 ring-1 ring-inset ring-primary")}
            >
              {HOURS.map((h) => (<div key={h} className="border-b border-border/40 pointer-events-none" style={{ height: HOUR_HEIGHT }} />))}

              {dayPosts.map((post) => {
                const top = timeToTopPx(post.scheduled_time);
                if (top === null) return null;
                const pillar = post.pillar_id ? pillarById.get(post.pillar_id) : undefined;
                return (
                  <button
                    key={post.id}
                    type="button"
                    draggable={!!onReschedule}
                    onDragStart={onReschedule ? (e) => { e.dataTransfer.setData("text/plain", post.id); e.dataTransfer.effectAllowed = "move"; setDragging(true); } : undefined}
                    onDragEnd={onReschedule ? () => { setDragging(false); setOverKey(null); } : undefined}
                    onClick={() => onPostClick(post)}
                    style={{ top: `${top}px`, minHeight: "60px", borderLeftColor: pillar?.color, borderLeftWidth: pillar ? 3 : 1, pointerEvents: dragging ? "none" : undefined }}
                    className={cn("absolute left-1 right-1 rounded-lg border p-2 overflow-hidden hover:shadow-warm-md hover:scale-[1.01] transition-all duration-150 group", onReschedule ? "cursor-grab active:cursor-grabbing" : "cursor-pointer", getStatusClasses(post.status))}
                  >
                    <span className="text-[10px] font-body font-semibold opacity-80">{post.scheduled_time?.slice(0, 5)}</span>
                    <p className="text-xs font-body font-medium line-clamp-1 mt-0.5">{post.title}</p>
                    {post.format && (<span className="text-[9px] font-body opacity-60 capitalize">{post.format}</span>)}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
