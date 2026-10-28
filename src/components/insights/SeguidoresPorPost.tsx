import { useMemo } from "react";
import { UserPlus } from "lucide-react";
import { seguidoresPorPost, ehReels, ganchoDaLegenda, type MidiaIg } from "./ganchos";

/* ═══════════════════════════════════════════════════════════════════════════
   O QUE TROUXE SEGUIDOR (Walter, 28/10/2026; mockup aprovado)

   Foto e carrossel: o número de seguidores que a Meta informa por post.
   Reels: estimativa (a Meta não informa), marcada com asterisco e listrada.
   Junto, as visitas ao perfil que o post gerou (foto e carrossel).
   ═══════════════════════════════════════════════════════════════════════════ */

export function SeguidoresPorPost({ media, diario, limite = 6 }: {
  media: MidiaIg[] | null | undefined;
  diario: Array<{ date: string; followers: number | null }> | null | undefined;
  limite?: number;
}) {
  const linhas = useMemo(() => {
    const lista = media ?? [];
    const seg = seguidoresPorPost(lista, diario ?? []);
    return lista
      .map((m) => {
        const s = seg.get(m.id);
        const visitas = Number((m.metrics as Record<string, unknown> | null)?.profile_visits ?? NaN);
        return { m, seg: s?.valor ?? null, estimado: !!s?.estimado, visitas: Number.isFinite(visitas) ? visitas : null };
      })
      .filter((l) => (l.seg ?? 0) > 0 || (l.visitas ?? 0) > 0)
      .sort((a, b) => (b.seg ?? 0) - (a.seg ?? 0) || (b.visitas ?? 0) - (a.visitas ?? 0))
      .slice(0, limite);
  }, [media, diario, limite]);

  const max = Math.max(1, ...linhas.map((l) => Math.max(l.seg ?? 0, (l.visitas ?? 0) / 4)));

  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-base font-display font-extrabold flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /> O que trouxe seguidor</p>
      <p className="text-xs text-muted-foreground mt-0.5 mb-3">Seguidores e visitas ao perfil por post.</p>
      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ainda sem base no período. O número aparece depois de alguns dias de coleta.</p>
      ) : (
        <div className="space-y-2.5">
          {linhas.map((l) => {
            const tipo = ehReels(l.m.media_type) ? "Reels" : l.m.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : "Foto";
            return (
              <div key={l.m.id}>
                <div className="flex justify-between gap-2 text-[12.5px]">
                  <span className="min-w-0 truncate">{tipo} · {ganchoDaLegenda(l.m.caption) || "(sem legenda)"}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {l.seg != null ? `+${l.seg}${l.estimado ? "*" : ""} seguidores` : ""}{l.seg != null && l.visitas != null ? " · " : ""}{l.visitas != null ? `${l.visitas} visitas` : ""}
                  </span>
                </div>
                <div className="mt-1 flex gap-1 h-2.5">
                  {l.seg != null && (
                    <div className="h-full rounded" style={{ width: `${Math.max(2, ((l.seg ?? 0) / max) * 60)}%`,
                      background: l.estimado ? "repeating-linear-gradient(45deg,#EA4918 0 3px,#F6C9B8 3px 6px)" : "#EA4918" }} />
                  )}
                  {l.visitas != null && <div className="h-full rounded bg-[#F6C9B8]" style={{ width: `${Math.max(2, ((l.visitas / 4) / max) * 38)}%` }} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#EA4918]" /> seguidores</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#F6C9B8]" /> visitas ao perfil</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "repeating-linear-gradient(45deg,#EA4918 0 3px,#F6C9B8 3px 6px)" }} /> estimativa (Reels)</span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">* A Meta não informa quantos seguidores cada Reels trouxe. O Cria estima pelo ganho de seguidores acima do ritmo normal do perfil nos dois dias depois do Reels, dividido entre os Reels daqueles dias.</p>
    </div>
  );
}
