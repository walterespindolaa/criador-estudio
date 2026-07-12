import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import type { PortalPost } from "@/pages/AprovarPortal";

type Props = {
  posts: PortalPost[];
  brand: string | null;
};

export function PortalCalendario({ posts, brand }: Props) {
  const scheduled = useMemo(
    () =>
      [...posts]
        .filter((p) => p.scheduled_date)
        .sort((a, b) => (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? "")),
    [posts]
  );

  const accent = brand ?? "hsl(var(--primary))";

  if (scheduled.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <CalendarDays className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-body text-muted-foreground">Nenhum post agendado ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {scheduled.map((p) => {
        const date = p.scheduled_date ? new Date(p.scheduled_date + "T00:00:00") : null;
        const day = date ? String(date.getDate()).padStart(2, "0") : "--";
        const month = date
          ? date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")
          : "";
        return (
          <div
            key={p.post_id}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
          >
            <div
              className="flex flex-col items-center justify-center rounded-xl px-3 py-2 min-w-[60px]"
              style={{ background: `${accent}14`, color: accent }}
            >
              <span className="text-lg font-display font-extrabold leading-none">{day}</span>
              <span className="text-[10px] font-body uppercase mt-1">{month}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-body font-semibold text-foreground truncate">{p.title}</p>
              <p className="text-xs text-muted-foreground font-body capitalize">
                {p.platform} · {p.format}
                {p.scheduled_time ? ` · ${p.scheduled_time.slice(0, 5)}` : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
