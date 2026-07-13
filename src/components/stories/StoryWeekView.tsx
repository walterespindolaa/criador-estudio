import { useState } from "react";
import { Check, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StorySlot, ScheduledPostLite } from "@/hooks/useStoryPlan";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const FORMAT_STYLE: Record<string, { bg: string; fg: string }> = {
  enquete: { bg: "#EEEDFE", fg: "#3C3489" },
  caixinha: { bg: "#E1F5EE", fg: "#085041" },
  bastidor: { bg: "#FAEEDA", fg: "#854F0B" },
  tutorial: { bg: "#E7F0FB", fg: "#1E4B8F" },
  "antes-depois": { bg: "#FBEAF0", fg: "#72243E" },
  "dica-rapida": { bg: "#EAF7E9", fg: "#2E6B2C" },
  contagem: { bg: "#FDEEE6", fg: "#8A3B14" },
  quiz: { bg: "#F0EAFB", fg: "#5B2A86" },
};
function fmtStyle(f: string | null) {
  return FORMAT_STYLE[(f || "").toLowerCase()] ?? { bg: "#EFEFEF", fg: "#555" };
}

function localIso(d: Date): string {
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return t.toISOString().slice(0, 10);
}
function shortDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

type Props = {
  weekStart: Date;
  slots: StorySlot[];
  posts?: ScheduledPostLite[];
  today: string;
  onShiftWeek: (deltaDays: number) => void;
  onToday: () => void;
  onReschedule: (id: string, dateIso: string) => void;
  onSlotClick: (slot: StorySlot) => void;
  onToggleDone: (slot: StorySlot) => void;
  onDeleteSlot: (id: string) => void;
  onAddDay: (dateIso: string) => void;
};

export function StoryWeekView({
  weekStart, slots, posts = [], today,
  onShiftWeek, onToday, onReschedule, onSlotClick, onToggleDone, onDeleteSlot, onAddDay,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const slotsByDay = new Map<string, StorySlot[]>();
  for (const s of slots) (slotsByDay.get(s.slot_date) ?? slotsByDay.set(s.slot_date, []).get(s.slot_date)!).push(s);
  const postsByDay = new Map<string, ScheduledPostLite[]>();
  for (const p of posts) if (p.scheduled_date) (postsByDay.get(p.scheduled_date) ?? postsByDay.set(p.scheduled_date, []).get(p.scheduled_date)!).push(p);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-lg text-foreground">{shortDate(days[0])}, {shortDate(days[6])}</h3>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => onShiftWeek(-7)} aria-label="Semana anterior">‹</Button>
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={onToday}>Hoje</Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => onShiftWeek(7)} aria-label="Próxima semana">›</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          const iso = localIso(d);
          const isToday = iso === today;
          const daySlots = slotsByDay.get(iso) ?? [];
          const dayPosts = postsByDay.get(iso) ?? [];
          return (
            <div
              key={iso}
              onDragOver={(e) => { e.preventDefault(); setOverKey(iso); }}
              onDragLeave={() => setOverKey((k) => (k === iso ? null : k))}
              onDrop={() => { if (dragId) onReschedule(dragId, iso); setDragId(null); setOverKey(null); }}
              className={cn(
                "min-h-[120px] sm:min-h-[340px] border rounded-lg p-1.5 bg-background flex flex-col gap-1 overflow-y-auto transition-all",
                overKey === iso ? "ring-2 ring-primary border-primary" : (isToday ? "border-primary" : "border-border"),
              )}
            >
              <div className="flex items-center justify-between px-0.5 mb-0.5">
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-wider font-body font-semibold text-muted-foreground">{WEEKDAYS[i]}</span>
                  <span className={cn("ml-1 text-sm font-display font-bold", isToday ? "text-primary" : "text-foreground")}>{d.getDate()}</span>
                </div>
                <button onClick={() => onAddDay(iso)} className="text-muted-foreground hover:text-primary" aria-label="Adicionar story"><Plus className="h-3.5 w-3.5" /></button>
              </div>

              {dayPosts.map((p) => (
                <div key={p.id} className="text-[10px] font-body text-muted-foreground bg-muted/50 rounded px-1.5 py-1 truncate">
                  📸 {p.title || "post"}{p.scheduled_time ? ` · ${p.scheduled_time.slice(0, 5)}` : ""}
                </div>
              ))}

              {daySlots.map((s) => {
                const st = fmtStyle(s.format);
                const done = s.status === "feito";
                return (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDragId(s.id); }}
                    onDragEnd={() => { setDragId(null); setOverKey(null); }}
                    className={cn(
                      "group rounded-lg border p-1.5 cursor-grab active:cursor-grabbing transition-all hover:shadow-warm-md",
                      done ? "border-border/50 bg-muted/40" : "border-border bg-card",
                    )}
                  >
                    <div className="flex items-start gap-1.5">
                      <button
                        onClick={() => onToggleDone(s)}
                        aria-label={done ? "Marcar pendente" : "Marcar feito"}
                        className={cn("mt-0.5 h-3.5 w-3.5 rounded-full border flex items-center justify-center shrink-0", done ? "bg-secondary border-secondary" : "border-muted-foreground/40")}
                      >
                        {done && <Check className="h-2 w-2 text-white" />}
                      </button>
                      <div className="min-w-0 flex-1" onClick={() => onSlotClick(s)}>
                        <div className="flex items-center gap-1 flex-wrap">
                          {s.slot_time && <span className="text-[9px] font-body text-muted-foreground">{s.slot_time.slice(0, 5)}</span>}
                          {s.format && <span className="text-[9px] font-body px-1 py-0.5 rounded-full capitalize" style={{ background: st.bg, color: st.fg }}>{s.format}</span>}
                        </div>
                        <p className={cn("text-[11px] font-body font-medium leading-snug mt-0.5 line-clamp-2", done ? "line-through text-muted-foreground" : "text-foreground")}>{s.title}</p>
                      </div>
                      <div className="flex-col gap-0.5 shrink-0 hidden group-hover:flex">
                        <button onClick={() => onSlotClick(s)} className="text-muted-foreground hover:text-primary" aria-label="Editar"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => onDeleteSlot(s.id)} className="text-muted-foreground hover:text-destructive" aria-label="Excluir"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {daySlots.length === 0 && dayPosts.length === 0 && (
                <p className="text-[11px] font-body text-muted-foreground/50 px-0.5 py-1">Livre</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
