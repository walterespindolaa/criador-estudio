import { Play, Eye, Clock, ExternalLink } from "lucide-react";
import { fmtNum } from "./insightsUtils";

// Ranking de REELS por tempo médio assistido (ig_reels_avg_watch_time, em ms),
// com views como métrica de apoio. Reaproveitado no criador e na visão do gestor.

export type ReelLike = {
  id: string;
  media_type: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  metrics: Record<string, number> | null;
};

const isReel = (t: string | null) => t === "REELS" || t === "VIDEO";
const num = (r: ReelLike, k: string) => Number(r.metrics?.[k] ?? 0);
// ig_reels_avg_watch_time vem em milissegundos; formata como "12,3s" ou "1m 05s".
const fmtWatch = (ms: number): string => {
  if (ms <= 0) return "-";
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1).replace(".", ",")}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
};

export function ReelsRanking({ media, limit = 5 }: { media: ReelLike[] | undefined | null; limit?: number }) {
  const reels = (media ?? [])
    .filter((r) => isReel(r.media_type))
    .map((r) => ({ r, watch: num(r, "ig_reels_avg_watch_time"), views: num(r, "views") + num(r, "plays") }))
    .filter((x) => x.watch > 0 || x.views > 0)
    .sort((a, b) => b.watch - a.watch || b.views - a.views)
    .slice(0, limit);

  if (reels.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <Play className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-body text-foreground font-medium">Sem reels com dados de retenção</p>
        <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">
          O tempo médio assistido aparece conforme o Instagram devolve as métricas dos reels publicados.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-primary" />
        <p className="text-sm font-display font-bold text-foreground">Reels por tempo médio assistido</p>
      </div>
      <div className="space-y-1">
        {reels.map(({ r, watch, views }, i) => (
          <div key={r.id} className="flex items-center gap-3 py-2 border-b border-dashed border-border last:border-none">
            <span className="w-5 text-center text-[13px] font-display font-extrabold text-primary shrink-0">{i + 1}</span>
            <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden shrink-0 grid place-items-center">
              {r.thumbnail_url
                ? <img src={r.thumbnail_url} referrerPolicy="no-referrer" alt="" loading="lazy" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                : <Play className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-body text-foreground line-clamp-1">{r.caption || "(sem legenda)"}</p>
              <div className="flex items-center gap-3 text-[11px] font-body text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtWatch(watch)}</span>
                {views > 0 && <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {fmtNum(views)}</span>}
              </div>
            </div>
            {r.permalink && (
              <a href={r.permalink} target="_blank" rel="noreferrer" aria-label="Abrir no Instagram" className="text-muted-foreground/60 hover:text-primary shrink-0">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
