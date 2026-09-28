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

// Rótulo pt-BR do formato (sempre no PLURAL) a partir do media_type do Instagram
// ou de rótulos textuais soltos. Plural garante concordância nas frases de direção
// ("Reels performam...", "Carrosséis performam..."), sem "Foto"/"Carrossel" no singular.
export const formatMediaLabel = (t: string | null | undefined): string => {
  const k = (t ?? "").toString().trim().toLowerCase();
  // Todo vídeo do Instagram virou Reels (2023). O VIDEO que aparece em posts
  // antigos, ou quando a coleta não trazia media_product_type, é Reels também:
  // separar "Vídeos" de "Reels" partia o mesmo formato em dois na análise.
  if (k === "reels" || k === "reel" || k === "video" || k === "vídeo" || k === "reel de video" || k === "reel de vídeo") return "Reels";
  if (k === "carousel_album" || k === "carousel" || k === "carrossel" || k === "carrosseis" || k === "carrosséis") return "Carrosséis";
  if (k === "image" || k === "photo" || k === "foto" || k === "fotos") return "Fotos";
  if (k === "story" || k === "stories") return "Stories";
  return "Outros";
};

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
// Lapidação honesta (ciclo 3 dos dados do Instagram, 28/09/2026):
//   - post com menos de 3 dias fica FORA da comparação (o alcance dele ainda
//     está crescendo; comparar com post de 2 meses era injusto);
//   - "alcance típico" = MEDIANA, não média: um viral isolado não arrasta mais
//     a conclusão do grupo inteiro;
//   - só tira conclusão de grupo com pelo menos MIN_AMOSTRA posts; grupo menor
//     aparece no gráfico marcado como "poucos posts", mas não vira frase;
//   - linha editorial entra como dimensão; gancho é agrupado pelo começo
//     (4 primeiras palavras), não pelo texto exato.
export const MIN_AMOSTRA = 3;
export const IDADE_MINIMA_DIAS = 3;

export type CrossItem = {
  media_type: string | null;
  posted_at: string | null;
  reach: number;
  interactions: number;
  pillar?: string | null;
  hook?: string | null;
  linha?: string | null; // linha editorial do post vinculado
};
export type CrossGroup = {
  label: string;
  avgReach: number; // alcance TÍPICO (mediana) do grupo
  avgEng: number; // interações ÷ alcance (%), mediana do grupo
  count: number;
  poucos?: boolean; // menos que MIN_AMOSTRA: mostrar, mas não concluir
  color?: string | null;
};
export type CrossAnalysisData = {
  hasData: boolean;
  overallAvgReach: number; // alcance típico geral (mediana)
  analisados: number; // posts que entraram na conta
  recentesFora: number; // posts novos demais, deixados de fora
  byFormat: CrossGroup[];
  byPillar: CrossGroup[];
  byLinha: CrossGroup[];
  byHook: CrossGroup[];
  byWeekday: CrossGroup[];
  byTime: CrossGroup[];
};

// Interações de um post do jeito que TODAS as telas devem contar: o total que a
// Meta dá; sem ele, curtidas + comentários + salvos + compartilhamentos. Antes
// cada tela somava de um jeito e os números não batiam entre Insights e Relatório.
export function interacoesDe(metrics: Record<string, number> | null | undefined): number {
  const m = metrics ?? {};
  if (m.total_interactions != null && m.total_interactions > 0) return Number(m.total_interactions);
  return Number(m.likes ?? 0) + Number(m.comments ?? 0) + Number(m.saved ?? m.saves ?? 0) + Number(m.shares ?? 0);
}

const mediana = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const o = [...xs].sort((a, b) => a - b);
  const meio = Math.floor(o.length / 2);
  return o.length % 2 ? o[meio] : (o[meio - 1] + o[meio]) / 2;
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

// Gancho agrupado pelo começo: "3 erros que...", "3 erros que eu..." viram o mesmo.
function chaveGancho(h: string | null | undefined): string | null {
  const t = (h ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const palavras = t.split(" ").slice(0, 4).join(" ");
  return palavras.charAt(0).toUpperCase() + palavras.slice(1) + (t.split(" ").length > 4 ? "..." : "");
}

// Agrupa por chave: alcance e engajamento TÍPICOS (mediana), ordenados por alcance.
function groupBy(
  items: CrossItem[],
  keyOf: (i: CrossItem) => string | null,
  opts: { sort?: "reach" | "fixed"; order?: string[]; top?: number } = {},
): CrossGroup[] {
  const acc: Record<string, { reach: number[]; eng: number[] }> = {};
  items.forEach((i) => {
    const k = keyOf(i);
    if (!k) return;
    acc[k] = acc[k] ?? { reach: [], eng: [] };
    acc[k].reach.push(i.reach);
    if (i.reach > 0) acc[k].eng.push((i.interactions / i.reach) * 100);
  });
  let rows: CrossGroup[] = Object.entries(acc).map(([label, v]) => ({
    label,
    avgReach: Math.round(mediana(v.reach)),
    avgEng: mediana(v.eng),
    count: v.reach.length,
    poucos: v.reach.length < MIN_AMOSTRA,
  }));
  if (opts.sort === "fixed" && opts.order) {
    rows.sort((a, b) => opts.order!.indexOf(a.label) - opts.order!.indexOf(b.label));
  } else {
    // Grupos com amostra boa primeiro; dentro deles, maior alcance típico.
    rows.sort((a, b) => Number(!!a.poucos) - Number(!!b.poucos) || b.avgReach - a.avgReach);
  }
  if (opts.top) rows = rows.slice(0, opts.top);
  return rows;
}

export function computeCrossAnalysis(items: CrossItem[] | undefined | null): CrossAnalysisData {
  const corte = Date.now() - IDADE_MINIMA_DIAS * 86400000;
  const comDado = (items ?? []).filter((i) => i.reach > 0 || i.interactions > 0);
  const list = comDado.filter((i) => !i.posted_at || new Date(i.posted_at).getTime() <= corte);
  const recentesFora = comDado.length - list.length;
  const vazio = { hasData: false, overallAvgReach: 0, analisados: 0, recentesFora, byFormat: [], byPillar: [], byLinha: [], byHook: [], byWeekday: [], byTime: [] };
  if (list.length === 0) return vazio;
  const overallAvgReach = Math.round(mediana(list.map((i) => i.reach)));

  const byFormat = groupBy(list, (i) => formatMediaLabel(i.media_type));
  const byPillar = groupBy(list, (i) => (i.pillar ? i.pillar : null));
  const byLinha = groupBy(list, (i) => (i.linha ? i.linha : null));
  const byHook = groupBy(list, (i) => chaveGancho(i.hook), { top: 5 });
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

  return { hasData: true, overallAvgReach, analisados: list.length, recentesFora, byFormat, byPillar, byLinha, byHook, byWeekday, byTime };
}

// Frases de direção. Regra de ouro: só afirma com amostra (>= MIN_AMOSTRA posts
// em CADA grupo comparado) e com diferença que importa (>= 20%). Sem base,
// não inventa: devolve uma frase dizendo o que falta.
// opts.dicaLigar: só na tela de Insights da própria conta. No relatório que
// vai pro cliente a frase "ligue as publicações" seria instrução interna.
export function crossHeadlines(data: CrossAnalysisData, opts: { dicaLigar?: boolean } = {}): string[] {
  const out: string[] = [];
  const base = data.overallAvgReach;
  const bons = (g: CrossGroup[]) => g.filter((x) => !x.poucos);
  const pct = (a: number, b: number) => Math.round((a / b - 1) * 100);

  const fmts = bons(data.byFormat);
  if (fmts.length >= 2 && fmts[1].avgReach > 0 && fmts[0].avgReach >= fmts[1].avgReach * 1.2) {
    const x = (fmts[0].avgReach / fmts[1].avgReach).toFixed(1).replace(".0", "").replace(".", ",");
    out.push(`${fmts[0].label} alcançam ${x}x mais que ${fmts[1].label} (${fmtNum(fmts[0].avgReach)} de alcance típico em ${fmts[0].count} posts). Priorize esse formato na próxima leva.`);
  }
  const engF = fmts.filter((g) => g.avgEng > 0).sort((a, b) => b.avgEng - a.avgEng);
  if (engF.length >= 2 && engF[0].label !== fmts[0]?.label && engF[0].avgEng >= engF[1].avgEng * 1.2) {
    out.push(`${engF[0].label} são os que mais engajam: ${engF[0].avgEng.toFixed(1).replace(".", ",")}% de interações sobre o alcance. Bom pra fortalecer relacionamento.`);
  }

  const topo = (g: CrossGroup[], frase: (x: CrossGroup, p: number) => string) => {
    const b = bons(g);
    if (b.length >= 2 && base > 0 && b[0].avgReach >= base * 1.2) out.push(frase(b[0], pct(b[0].avgReach, base)));
  };
  topo(data.byPillar, (x, p) => `O pilar "${x.label}" alcança ${p}% acima do seu normal (${x.count} posts). Vale reforçar esse tema.`);
  topo(data.byLinha, (x, p) => `A linha editorial "${x.label}" rende ${p}% acima do seu normal (${x.count} posts).`);
  topo(data.byWeekday, (x, p) => `${x.label} é o seu melhor dia: ${p}% acima do normal (${x.count} posts).`);
  topo(data.byTime, (x, p) => `Posts da ${x.label.toLowerCase()} alcançam ${p}% acima do normal (${x.count} posts). Concentre as publicações nesse período.`);
  topo(data.byHook, (x, p) => `Ganchos que começam com "${x.label}" rendem ${p}% acima do normal (${x.count} posts). Explore mais esse ângulo.`);

  // Pilar/linha sem base porque os posts não estão ligados: diz o caminho.
  if (opts.dicaLigar && data.byPillar.length === 0 && data.analisados >= MIN_AMOSTRA * 2) {
    out.push("Ligue as publicações aos posts do Cria (logo acima) pra ver quais pilares e linhas editoriais rendem mais.");
  }
  return out;
}

// ============================ Variação de seguidores ============================
// O histórico de seguidores só começa quando o sync começou. Comparar "atual - primeiro
// valor" numa conta recém-conectada gera um "+N (30d)" gigante e falso. Aqui só devolvemos
// delta quando a série cobre a janela de verdade (~25-30 dias); senão, delta = null.
export type FollowersDelta = {
  delta: number | null; // null quando a série é curta demais pra afirmar "30d"
  spanDays: number; // dias entre o 1º e o último ponto com seguidores
  hasWindow: boolean; // true se cobre a janela mínima
};

export function computeFollowersDelta(
  daily: { date: string; followers: number | null }[] | undefined | null,
  windowDays = 30,
  minSpanDays = 25,
): FollowersDelta {
  const pts = (daily ?? []).filter((d) => d.followers != null && d.date);
  if (pts.length < 2) return { delta: null, spanDays: 0, hasWindow: false };
  const last = pts[pts.length - 1];
  const lastTime = new Date(last.date).getTime();
  const spanDays = Math.round((lastTime - new Date(pts[0].date).getTime()) / 86400000);
  if (spanDays < minSpanDays) return { delta: null, spanDays, hasWindow: false };
  // Ponto mais próximo de windowDays atrás (não o primeiro cru), pra um "30d" honesto.
  const target = lastTime - windowDays * 86400000;
  let ref = pts[0];
  let best = Infinity;
  for (const p of pts) {
    const diff = Math.abs(new Date(p.date).getTime() - target);
    if (diff < best) { best = diff; ref = p; }
  }
  return { delta: (last.followers ?? 0) - (ref.followers ?? 0), spanDays, hasWindow: true };
}
