// ═══════════════════════════════════════════════════════════════════════════
// RANKING DE GANCHOS E SEGUIDORES POR POST (Walter, 28/10/2026; mockup aprovado)
//
// Cálculo puro, sem tela, pra poder testar:
//   - janela justa: compara cada Reels na MESMA idade (foto de 24 h ou de
//     7 dias, gravadas pela coleta), em vez de post de ontem contra post de
//     dois meses;
//   - "passou do início" = 100% menos o reels_skip_rate da Meta (quem pulou
//     nos 3 primeiros segundos);
//   - seguidores por Reels é ESTIMATIVA: a Meta não informa follows de Reels.
//     Usa o ganho diário de seguidores acima do ritmo normal do perfil, nos
//     dias em que o Reels estava novo, dividido entre os Reels daqueles dias.
//     Em foto e carrossel o número é o da Meta (follows).
// ═══════════════════════════════════════════════════════════════════════════

export type Janela = "24h" | "7d" | "total";

export type MidiaIg = {
  id: string;
  media_type: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  posted_at?: string | null;
  post_id?: string | null;
  metrics: Record<string, unknown> | null;
};

export const ehReels = (t: string | null | undefined) => t === "REELS" || t === "VIDEO";

/** Métricas da janela pedida (null quando o post não tem a foto daquela idade). */
export function metricasNaJanela(m: MidiaIg, janela: Janela): Record<string, number> | null {
  const base = (m.metrics ?? {}) as Record<string, unknown>;
  const fonte = janela === "total" ? base : (base[janela === "24h" ? "snap_24h" : "snap_7d"] as Record<string, unknown> | undefined);
  if (!fonte || typeof fonte !== "object") return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(fonte)) if (typeof v === "number") out[k] = v;
  return out;
}

/** reels_skip_rate vem em % (ex.: 34.2); se vier em fração (0.342), converte. */
export function passouDoInicio(metrics: Record<string, number>): number | null {
  const raw = metrics.reels_skip_rate;
  if (raw == null || !Number.isFinite(raw)) return null;
  const pct = raw <= 1 ? raw * 100 : raw;
  return Math.max(0, Math.min(100, 100 - pct));
}

/** Primeira frase da legenda, sem hashtag nem menção: é o gancho escrito. */
export function ganchoDaLegenda(caption: string | null | undefined): string {
  const linha = (caption ?? "").split(/\n/).map((l) => l.trim()).find((l) => l && !/^[#@]/.test(l)) ?? "";
  const limpa = linha.replace(/#[\p{L}\p{N}_]+/gu, "").replace(/\s+/g, " ").trim();
  const frase = limpa.split(/(?<=[.!?])\s/)[0] ?? limpa;
  return frase.length > 90 ? frase.slice(0, 88).trimEnd() + "…" : frase;
}

// Dia de calendário em Brasília (yyyy-mm-dd).
export function diaBR(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

function somaDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mediana(v: number[]): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Seguidores por post: real (follows) em foto e carrossel; estimado em Reels.
 * Devolve o mapa id → { valor, estimado }. Reels sem base suficiente fica de fora.
 */
export function seguidoresPorPost(
  midias: MidiaIg[],
  diario: Array<{ date: string; followers: number | null }>,
): Map<string, { valor: number; estimado: boolean }> {
  const out = new Map<string, { valor: number; estimado: boolean }>();
  for (const m of midias) {
    const f = Number((m.metrics as Record<string, unknown> | null)?.follows);
    if (!ehReels(m.media_type) && Number.isFinite(f)) out.set(m.id, { valor: f, estimado: false });
  }

  // Ganho por dia (só entre dias seguidos com contagem).
  const pts = diario.filter((d) => d.followers != null).sort((a, b) => a.date.localeCompare(b.date));
  const ganho = new Map<string, number>();
  for (let i = 1; i < pts.length; i++) {
    if (somaDias(pts[i - 1].date, 1) === pts[i].date) ganho.set(pts[i].date, (pts[i].followers ?? 0) - (pts[i - 1].followers ?? 0));
  }
  if (ganho.size < 5) return out; // pouca série: não dá pra separar o ritmo normal
  const ritmo = mediana([...ganho.values()]);

  // Reels "novos" em cada dia: publicados no dia ou no dia anterior.
  const reelsPorDia = new Map<string, string[]>();
  const feedPorDia = new Map<string, number>();
  for (const m of midias) {
    if (!m.posted_at) continue;
    const d0 = diaBR(m.posted_at);
    if (ehReels(m.media_type)) {
      for (const d of [d0, somaDias(d0, 1)]) reelsPorDia.set(d, [...(reelsPorDia.get(d) ?? []), m.id]);
    } else {
      const f = Number((m.metrics as Record<string, unknown> | null)?.follows);
      if (Number.isFinite(f)) feedPorDia.set(d0, (feedPorDia.get(d0) ?? 0) + f);
    }
  }
  const acumulado = new Map<string, number>();
  const comBase = new Set<string>();
  for (const [dia, ids] of reelsPorDia) {
    if (!ganho.has(dia)) continue;
    const extra = Math.max(0, (ganho.get(dia) ?? 0) - ritmo - (feedPorDia.get(dia) ?? 0));
    for (const id of ids) {
      comBase.add(id);
      acumulado.set(id, (acumulado.get(id) ?? 0) + extra / ids.length);
    }
  }
  for (const id of comBase) out.set(id, { valor: Math.round(acumulado.get(id) ?? 0), estimado: true });
  return out;
}

export type LinhaGancho = {
  midia: MidiaIg;
  gancho: string;
  passou: number | null;        // % que passou dos 3 primeiros segundos
  tempoMedioS: number | null;   // segundos
  views: number;
  alcance: number;
};

/** Ranking dos Reels na janela. Sem a foto daquela idade, o Reels fica de fora (e é contado). */
export function rankingDeGanchos(
  midias: MidiaIg[],
  janela: Janela,
  ordem: "passou" | "tempo" | "views",
  ganchoDe?: (m: MidiaIg) => string | null | undefined,
): { linhas: LinhaGancho[]; semFoto: number } {
  let semFoto = 0;
  const linhas: LinhaGancho[] = [];
  for (const m of midias) {
    if (!ehReels(m.media_type)) continue;
    const met = metricasNaJanela(m, janela);
    if (!met) { semFoto++; continue; }
    const ms = met.ig_reels_avg_watch_time;
    linhas.push({
      midia: m,
      gancho: (ganchoDe?.(m) || "").trim() || ganchoDaLegenda(m.caption) || "(sem legenda)",
      passou: passouDoInicio(met),
      tempoMedioS: Number.isFinite(ms) && ms > 0 ? ms / 1000 : null,
      views: Number(met.views ?? 0) + Number(met.plays ?? 0),
      alcance: Number(met.reach ?? 0),
    });
  }
  const chave = (l: LinhaGancho) => (ordem === "passou" ? l.passou ?? -1 : ordem === "tempo" ? l.tempoMedioS ?? -1 : l.views);
  linhas.sort((a, b) => chave(b) - chave(a) || b.views - a.views);
  return { linhas, semFoto };
}
