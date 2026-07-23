// Cálculos puros e helpers compartilhados pelos blocos de insights (audiência,
// stories, reels e cruzamentos). Ficam separados da apresentação pra que as telas
// com DOM normal (Tailwind) e o relatório white-label (inline styles p/ html2canvas)
// usem exatamente a mesma lógica sem duplicar conta.

// Formata número curto (1.2k / 3.4M). Trata null/undefined.
export const fmtNum = (n: number | null | undefined): string =>
  n == null
    ? "-"
    : n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`
      : n >= 1000
        ? `${(n / 1000).toFixed(1).replace(".0", "")}k`
        : String(Math.round(n));

// Rótulo pt-BR do formato a partir do media_type do Instagram.
export const formatMediaLabel = (t: string | null | undefined): string =>
  t === "VIDEO" || t === "REELS"
    ? "Reels"
    : t === "CAROUSEL_ALBUM"
      ? "Carrossel"
      : t === "IMAGE"
        ? "Foto"
        : t
          ? "Outro"
          : "Outro";

// ============================ Audiência ============================
export type AudienceLike = {
  metric: string;
  dimension: string;
  breakdown_value: string;
  value: number;
};
export type BreakdownItem = { label: string; value: number; pct: number };
export type AudienceBreakdownData = {
  hasData: boolean;
  source: "followers" | "engaged" | null;
  total: number; // total de seguidores/engajados considerado (dimensão gênero como base)
  age: BreakdownItem[];
  gender: BreakdownItem[];
  city: BreakdownItem[];
  country: BreakdownItem[];
};

// Ordem natural das faixas etárias do Instagram.
const AGE_ORDER = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const GENDER_LABEL: Record<string, string> = { F: "Feminino", M: "Masculino", U: "Não informado" };

function buildDimension(
  rows: AudienceLike[],
  dimension: string,
  opts: { top?: number; order?: string[]; labelMap?: Record<string, string> } = {},
): BreakdownItem[] {
  const filtered = rows.filter((r) => r.dimension === dimension && Number(r.value) > 0);
  if (filtered.length === 0) return [];
  const total = filtered.reduce((a, r) => a + Number(r.value), 0);
  let items: BreakdownItem[] = filtered.map((r) => ({
    label: opts.labelMap?.[r.breakdown_value] ?? r.breakdown_value,
    value: Number(r.value),
    pct: total > 0 ? (Number(r.value) / total) * 100 : 0,
  }));
  if (opts.order) {
    // Ordena pela ordem natural informada (ex.: faixas etárias), com o resto no fim.
    items.sort((a, b) => {
      const ia = opts.order!.indexOf(a.label);
      const ib = opts.order!.indexOf(b.label);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  } else {
    items.sort((a, b) => b.value - a.value);
  }
  if (opts.top) items = items.slice(0, opts.top);
  return items;
}

// Monta a demografia priorizando seguidores; cai pra "engaged" se não houver seguidores.
export function computeAudienceBreakdown(rows: AudienceLike[] | undefined | null): AudienceBreakdownData {
  const all = rows ?? [];
  const hasFollowers = all.some((r) => r.metric === "followers" && Number(r.value) > 0);
  const source: "followers" | "engaged" | null = hasFollowers
    ? "followers"
    : all.some((r) => r.metric === "engaged" && Number(r.value) > 0)
      ? "engaged"
      : null;
  if (!source) {
    return { hasData: false, source: null, total: 0, age: [], gender: [], city: [], country: [] };
  }
  const scoped = all.filter((r) => r.metric === source);
  const age = buildDimension(scoped, "age", { order: AGE_ORDER });
  const gender = buildDimension(scoped, "gender", { labelMap: GENDER_LABEL });
  const city = buildDimension(scoped, "city", { top: 6 });
  const country = buildDimension(scoped, "country", { top: 6 });
  const total = gender.reduce((a, g) => a + g.value, 0) || age.reduce((a, g) => a + g.value, 0);
  const hasData = age.length + gender.length + city.length + country.length > 0;
  return { hasData, source, total, age, gender, city, country };
}

// ============================ Stories ============================
export type StoryLike = { metrics: Record<string, number> | null; posted_at?: string | null };
export type StoriesSummaryData = {
  hasData: boolean;
  count: number;
  reach: number;
  avgReach: number;
  replies: number;
  replyRate: number; // respostas ÷ alcance (%)
  interactions: number;
  navigation: number;
};

const sMetric = (s: StoryLike, k: string) => Number(s.metrics?.[k] ?? 0);

export function computeStoriesSummary(stories: StoryLike[] | undefined | null): StoriesSummaryData {
  const list = stories ?? [];
  if (list.length === 0) {
    return { hasData: false, count: 0, reach: 0, avgReach: 0, replies: 0, replyRate: 0, interactions: 0, navigation: 0 };
  }
  const reach = list.reduce((a, s) => a + sMetric(s, "reach"), 0);
  const replies = list.reduce((a, s) => a + sMetric(s, "replies"), 0);
  const interactions = list.reduce((a, s) => a + sMetric(s, "total_interactions"), 0);
  const navigation = list.reduce((a, s) => a + sMetric(s, "navigation"), 0);
  return {
    hasData: true,
    count: list.length,
    reach,
    avgReach: list.length > 0 ? Math.round(reach / list.length) : 0,
    replies,
    replyRate: reach > 0 ? (replies / reach) * 100 : 0,
    interactions,
    navigation,
  };
}

// ============================ Cruzamentos (o ouro) ============================
export type CrossItem = {
  media_type: string | null;
  posted_at: string | null;
  reach: number;
  interactions: number;
  pillar?: string | null;
  hook?: string | null;
};
export type CrossGroup = {
  label: string;
  avgReach: number;
  avgEng: number; // interações ÷ alcance médio (%)
  count: number;
  color?: string | null;
};
export type CrossAnalysisData = {
  hasData: boolean;
  overallAvgReach: number;
  byFormat: CrossGroup[];
  byPillar: CrossGroup[];
  byHook: CrossGroup[];
  byWeekday: CrossGroup[];
  byTime: CrossGroup[];
};

// Dia da semana e hora no fuso do Brasil (posted_at é timestamptz).
const wdFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Sao_Paulo" });
const hFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" });
const WD_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export const WD_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const TIME_BUCKETS = [
  { label: "Madrugada", from: 0, to: 5 },
  { label: "Manhã", from: 6, to: 11 },
  { label: "Tarde", from: 12, to: 17 },
  { label: "Noite", from: 18, to: 23 },
];

function weekdayBR(iso: string): number {
  try { return WD_INDEX[wdFmt.format(new Date(iso))] ?? -1; } catch { return -1; }
}
function hourBR(iso: string): number {
  try { return parseInt(hFmt.format(new Date(iso)), 10) % 24; } catch { return -1; }
}

// Agrupa por chave, calcula alcance médio e engajamento médio, ordena por alcance.
function groupBy(
  items: CrossItem[],
  keyOf: (i: CrossItem) => string | null,
  opts: { sort?: "reach" | "fixed"; order?: string[]; colorOf?: (i: CrossItem) => string | null | undefined; top?: number } = {},
): CrossGroup[] {
  const acc: Record<string, { reach: number; eng: number; n: number; color?: string | null }> = {};
  items.forEach((i) => {
    const k = keyOf(i);
    if (!k) return;
    acc[k] = acc[k] ?? { reach: 0, eng: 0, n: 0, color: opts.colorOf?.(i) ?? null };
    acc[k].reach += i.reach;
    acc[k].eng += i.reach > 0 ? (i.interactions / i.reach) * 100 : 0;
    acc[k].n += 1;
  });
  let rows: CrossGroup[] = Object.entries(acc).map(([label, v]) => ({
    label,
    avgReach: v.n > 0 ? Math.round(v.reach / v.n) : 0,
    avgEng: v.n > 0 ? v.eng / v.n : 0,
    count: v.n,
    color: v.color,
  }));
  if (opts.sort === "fixed" && opts.order) {
    rows.sort((a, b) => opts.order!.indexOf(a.label) - opts.order!.indexOf(b.label));
  } else {
    rows.sort((a, b) => b.avgReach - a.avgReach);
  }
  if (opts.top) rows = rows.slice(0, opts.top);
  return rows;
}

export function computeCrossAnalysis(items: CrossItem[] | undefined | null): CrossAnalysisData {
  const list = (items ?? []).filter((i) => i.reach > 0 || i.interactions > 0);
  if (list.length === 0) {
    return { hasData: false, overallAvgReach: 0, byFormat: [], byPillar: [], byHook: [], byWeekday: [], byTime: [] };
  }
  const totalReach = list.reduce((a, i) => a + i.reach, 0);
  const overallAvgReach = list.length > 0 ? Math.round(totalReach / list.length) : 0;

  const byFormat = groupBy(list, (i) => formatMediaLabel(i.media_type));
  const byPillar = groupBy(list, (i) => (i.pillar ? i.pillar : null), { colorOf: () => null });
  const byHook = groupBy(list, (i) => (i.hook ? i.hook.trim() : null), { top: 4 });
  const byWeekday = groupBy(
    list.filter((i) => i.posted_at),
    (i) => { const w = weekdayBR(i.posted_at!); return w >= 0 ? WD_PT[w] : null; },
  );
  const byTime = groupBy(
    list.filter((i) => i.posted_at),
    (i) => {
      const h = hourBR(i.posted_at!);
      if (h < 0) return null;
      return TIME_BUCKETS.find((b) => h >= b.from && h <= b.to)?.label ?? null;
    },
  );

  return { hasData: true, overallAvgReach, byFormat, byPillar, byHook, byWeekday, byTime };
}

// Gera frases acionáveis (direcionamento) a partir dos cruzamentos calculados.
export function crossHeadlines(data: CrossAnalysisData): string[] {
  const out: string[] = [];
  const base = data.overallAvgReach;
  const ratio = (v: number) => (base > 0 ? v / base : 0);

  const topFmt = data.byFormat[0];
  if (topFmt && data.byFormat.length > 1 && base > 0) {
    const r = ratio(topFmt.avgReach);
    if (r >= 1.15) {
      out.push(`${topFmt.label} é seu formato mais forte: ${fmtNum(topFmt.avgReach)} de alcance médio, ${r.toFixed(1)}x a média geral. Priorize ${topFmt.label} na próxima leva.`);
    }
  }
  const topPillar = data.byPillar[0];
  if (topPillar && data.byPillar.length > 1) {
    out.push(`O pilar "${topPillar.label}" puxa mais alcance (${fmtNum(topPillar.avgReach)} em média). Vale reforçar esse tema.`);
  }
  const topDay = data.byWeekday[0];
  if (topDay && data.byWeekday.length > 1) {
    out.push(`Melhor dia pra publicar: ${topDay.label} (${fmtNum(topDay.avgReach)} de alcance médio).`);
  }
  const topTime = data.byTime[0];
  if (topTime && data.byTime.length > 1) {
    out.push(`Seus posts da ${topTime.label.toLowerCase()} rendem mais (${fmtNum(topTime.avgReach)} de alcance médio). Concentre as publicações nesse período.`);
  }
  return out;
}
