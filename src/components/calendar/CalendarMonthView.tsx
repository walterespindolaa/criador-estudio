import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getStatusClasses } from "@/lib/statusColors";
import type { Post } from "@/hooks/usePosts";
import type { Pillar } from "@/hooks/usePillars";

const WEEK_DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_LABELS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

type Props = {
  posts: Post[];
  pillars: Pillar[];
  currentMonth: Date;
  onMonthChange: (delta: number) => void;
  onPostClick: (post: Post) => void;
  onDayClick: (date: string) => void;
  today: string;
  onReschedule?: (postId: string, date: string) => void;
};

type Cell = { date: string; dayNum: number; isOtherMonth: boolean };

function pad(n: number): string { return n < 10 ? `0${n}` : String(n); }
function toIso(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function buildMonthCells(currentMonth: Date): Cell[] {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstDayIdx = firstOfMonth.getDay(); // 0 = domingo (semana começa no domingo)
  const start = new Date(year, month, 1 - firstDayIdx);
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ date: toIso(d), dayNum: d.getDate(), isOtherMonth: d.getMonth() !== month });
  }
  while (cells.length > 35 && cells.slice(35).every((c) => c.isOtherMonth)) { cells.length = 35; }
  return cells;
}

export function CalendarMonthView({ posts, pillars, currentMonth, onMonthChange, onPostClick, onDayClick, today, onReschedule }: Props) {
  const pillarById = new Map(pillars.map((p) => [p.id, p]));
  const cells = buildMonthCells(currentMonth);
  const [overDate, setOverDate] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // Mobile: tocar num dia abre a lista dos posts dele (na grade do celular não cabe texto).
  const [dayModal, setDayModal] = useState<string | null>(null);

  const postsByDay = new Map<string, Post[]>();
  for (const post of posts) {
    if (!post.scheduled_date) continue;
    const list = postsByDay.get(post.scheduled_date) ?? [];
    list.push(post);
    postsByDay.set(post.scheduled_date, list);
  }
  for (const list of postsByDay.values()) {
    list.sort((a, b) => (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? ""));
  }

  const monthLabel = `${MONTH_LABELS[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
  const isCurrentMonth = new Date().getFullYear() === currentMonth.getFullYear() && new Date().getMonth() === currentMonth.getMonth();

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onMonthChange(-1)} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => onMonthChange(1)} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Button>
          {!isCurrentMonth && (<Button variant="ghost" size="sm" onClick={() => onMonthChange(0)}>Hoje</Button>)}
        </div>
        <p className="text-sm font-display font-bold text-foreground capitalize">{monthLabel}</p>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-muted/20">
        {WEEK_DAY_LABELS.map((label) => (
          <div key={label} className="text-center py-2 text-[11px] uppercase tracking-wider font-body font-semibold text-muted-foreground">{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-border/40">
        {cells.map((cell) => {
          const dayPosts = postsByDay.get(cell.date) ?? [];
          const isToday = cell.date === today;
          return (
            <div
              key={cell.date}
              onDragOver={onReschedule ? (e) => { e.preventDefault(); setOverDate(cell.date); } : undefined}
              onDragLeave={onReschedule ? () => setOverDate((d) => (d === cell.date ? null : d)) : undefined}
              onDrop={onReschedule ? (e) => { e.preventDefault(); setOverDate(null); const id = e.dataTransfer.getData("text/plain"); if (id) onReschedule(id, cell.date); } : undefined}
              className={cn(
                "min-h-[64px] md:min-h-[100px] bg-card p-1 md:p-1.5 transition-colors",
                isToday && "ring-1 ring-primary ring-inset bg-primary/[0.03]",
                cell.isOtherMonth && "opacity-40",
                overDate === cell.date && "ring-2 ring-primary ring-inset bg-primary/10"
              )}
            >
              <p className={cn("text-xs font-body font-semibold mb-0.5 md:mb-1", isToday ? "text-primary" : "text-foreground")}>{cell.dayNum}</p>

              {/* Desktop (md+): cards com texto + drag, exatamente como antes. */}
              <div className="hidden md:block">
                {dayPosts.slice(0, 3).map((post) => {
                  const pillar = post.pillar_id ? pillarById.get(post.pillar_id) : undefined;
                  return (
                    <button
                      key={post.id}
                      type="button"
                      draggable={!!onReschedule}
                      onDragStart={onReschedule ? (e) => { e.dataTransfer.setData("text/plain", post.id); e.dataTransfer.effectAllowed = "move"; setDragging(true); } : undefined}
                      onDragEnd={onReschedule ? () => { setDragging(false); setOverDate(null); } : undefined}
                      onClick={(e) => { e.stopPropagation(); onPostClick(post); }}
                      style={{ borderLeftColor: pillar?.color, borderLeftWidth: pillar ? 2 : undefined, pointerEvents: dragging ? "none" : undefined }}
                      className={cn(
                        "w-full text-left rounded-md px-1.5 py-0.5 mb-0.5 text-[10px] font-body truncate border",
                        onReschedule && "cursor-grab active:cursor-grabbing",
                        getStatusClasses(post.status)
                      )}
                    >
                      {post.scheduled_time && (<span className="font-semibold mr-1">{post.scheduled_time.slice(0, 5)}</span>)}
                      {post.title}
                    </button>
                  );
                })}

                {dayPosts.length > 3 && (
                  <button type="button" onClick={() => onDayClick(cell.date)} className="text-[10px] text-primary font-body font-medium hover:underline">+{dayPosts.length - 3} mais</button>
                )}
              </div>

              {/* Mobile: pontos coloridos (cor do pilar) + total. Tocar abre a lista do dia. */}
              {dayPosts.length > 0 && (
                <button type="button" onClick={() => setDayModal(cell.date)}
                  className="md:hidden w-full min-h-[28px] flex flex-wrap content-start items-center gap-0.5 rounded-md px-0.5 py-0.5 hover:bg-muted/40 transition-colors"
                  aria-label={`Ver ${dayPosts.length} post(s) do dia ${cell.dayNum}`}>
                  {dayPosts.slice(0, 4).map((post) => {
                    const pillar = post.pillar_id ? pillarById.get(post.pillar_id) : undefined;
                    return <span key={post.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pillar?.color ?? "#94a3b8" }} />;
                  })}
                  <span className="ml-auto text-[10px] font-body font-bold text-muted-foreground">{dayPosts.length}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: lista dos posts do dia tocado. Cada item abre o editor (onPostClick). */}
      {dayModal && (() => {
        const items = postsByDay.get(dayModal) ?? [];
        const d = new Date(`${dayModal}T00:00:00`);
        return (
          <Dialog open onOpenChange={(o) => { if (!o) setDayModal(null); }}>
            <DialogContent className="sm:max-w-md rounded-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-display capitalize">{d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</DialogTitle></DialogHeader>
              <p className="text-[12px] font-body text-muted-foreground -mt-2">{items.length} post(s) · toque pra editar</p>
              <div className="space-y-1.5 mt-1">
                {items.map((post) => {
                  const pillar = post.pillar_id ? pillarById.get(post.pillar_id) : undefined;
                  return (
                    <button key={post.id} onClick={() => { setDayModal(null); onPostClick(post); }}
                      className="w-full flex items-center gap-2.5 rounded-xl border border-border p-3 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: pillar?.color ?? "#94a3b8" }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-body font-semibold text-foreground truncate">{post.title}</p>
                        {post.scheduled_time && <p className="text-[11px] font-body text-muted-foreground">{post.scheduled_time.slice(0, 5)}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
