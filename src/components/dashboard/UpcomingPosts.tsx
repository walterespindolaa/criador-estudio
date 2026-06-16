import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { usePosts } from "@/hooks/usePosts";
import { usePillars } from "@/hooks/usePillars";
import { statusRamp } from "@/lib/statusRamp";
import { PlatformIcon } from "@/components/shared/PlatformIcon";

const STATUS_LABEL: Record<string, string> = {
  ideia: "Ideia", roteiro: "Planejamento", gravando: "Produzindo",
  editando: "Pronto", agendado: "Agendado", publicado: "Publicado",
};
const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function dateLabel(iso: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(iso + "T00:00:00");
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function UpcomingPosts() {
  const navigate = useNavigate();
  const { posts } = usePosts({ limit: 50 });
  const { pillars } = usePillars();
  const ramp = statusRamp();

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return posts
      .filter((p) => p.scheduled_date && p.scheduled_date >= today && p.status !== "publicado")
      .sort((a, b) => (a.scheduled_date! < b.scheduled_date! ? -1 : 1))
      .slice(0, 5);
  }, [posts]);

  const pillarColor = (id: string | null) => pillars.find((p) => p.id === id)?.color ?? "var(--muted-foreground)";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-warm)]">
      <h3 className="mb-1 flex items-center gap-2 font-display text-[15px] font-bold">
        <CalendarClock className="h-4 w-4 text-primary" /> Próximos posts
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">Agendados pela frente</p>
      {upcoming.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Nenhum post agendado. <button onClick={() => navigate("/app/criando")} className="font-semibold text-primary">Programe um →</button></p>
      ) : (
        <ul className="divide-y divide-border">
          {upcoming.map((p) => {
            const step = ramp[p.status ?? "ideia"] ?? ramp.ideia;
            return (
              <li key={p.id} onClick={() => navigate("/app/criando")} className="flex cursor-pointer items-center gap-3 py-2.5 hover:opacity-80">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted">
                  <PlatformIcon platform={p.platform} size="sm" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.title || "Sem título"}</p>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: pillarColor(p.pillar_id) }} />
                    <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: step.from, color: step.ink }}>{STATUS_LABEL[p.status ?? ""] ?? p.status}</span>
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{dateLabel(p.scheduled_date!)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default UpcomingPosts;
