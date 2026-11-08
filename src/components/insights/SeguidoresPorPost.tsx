import { useMemo } from "react";
import { UserPlus } from "lucide-react";
import { CARD } from "./estiloCria";
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
    <div className={`${CARD} p-4`}>
      <p className="text-base font-display font-extrabold flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /> O que trouxe seguidor</p>
      <p className="text-xs text-muted-foreground mt-0.5 mb-3">Seguidores e visitas ao perfil por post.</p>
      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ainda sem base no período. O número aparece depois de alguns dias de coleta.</p>
      ) : (
        <div className="space-y-2.5">
          {linhas.map((l) => {
            const tipo = ehReels(l.m.media_type) ? "Reels" : l.m.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : "Foto";
            return (
              <div key={l.m.id} className="pb-2.5 border-b-[1.5px] border-dashed border-foreground/15 last:border-b-0">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-11 rounded-lg border-2 border-foreground bg-muted overflow-hidden shrink-0">
                    {l.m.thumbnail_url && <img src={l.m.thumbnail_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold truncate">{ganchoDaLegenda(l.m.caption) || "(sem legenda)"}</span>
                    <span className="block text-[11.5px] text-muted-foreground">{tipo}{l.m.posted_at ? ` · ${new Date(l.m.posted_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : ""}</span>
                  </span>
                  {l.seg != null && (
                    <span className="text-right shrink-0">
                      <span className="block font-display font-extrabold text-[20px] leading-none text-[#00A652]">+{l.seg}{l.estimado ? "*" : ""}</span>
                      <span className="block text-[10.5px] text-muted-foreground">seguidores</span>
                    </span>
                  )}
                  {l.visitas != null && (
                    <span className="text-right shrink-0 w-14">
                      <span className="block font-display font-extrabold text-[18px] leading-none">{l.visitas}</span>
                      <span className="block text-[10.5px] text-muted-foreground">visitas</span>
                    </span>
                  )}
                </div>
                <div className="mt-2 ml-12 flex gap-1 h-2">
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
