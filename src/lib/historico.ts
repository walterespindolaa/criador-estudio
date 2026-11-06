/* ═══════════════════════════════════════════════════════════════════════════
   HISTÓRICO QUE DIZ O QUE FUNCIONOU (Walter, 07/11/2026; mockup aprovado)

   Antes a tela contava quantos posts saíram. O banco já guardava alcance,
   salvos, compartilhamentos, curtidas e seguidores de cada post vinculado ao
   Instagram (social_insights) e o resultado preenchido à mão (posts.result_*),
   e nada disso aparecia. Aqui ficam só contas puras (sem React, sem banco),
   pra tela e pros testes.
   ═══════════════════════════════════════════════════════════════════════════ */

export type MetricasIg = Record<string, unknown> | null | undefined;

export type PostBase = {
  id: string;
  title: string | null;
  format: string | null;
  platform: string | null;
  pillar_id: string | null;
  published_at: string | null;
  result_reach?: number | null;
  result_views?: number | null;
  result_saves?: number | null;
  result_shares?: number | null;
  result_comments?: number | null;
};

export type Numeros = {
  alcance: number | null;
  views: number | null;
  salvos: number | null;
  compart: number | null;
  curtidas: number | null;
  coment: number | null;
  seguidores: number | null;
  /** Reels: tempo médio assistido, em segundos. */
  tempoMedio: number | null;
  /** Reels: % de quem pulou nos primeiros segundos. */
  pularam: number | null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** O número do Instagram vale mais que o preenchido à mão; sem os dois, null. */
export function numerosDoPost(p: PostBase, m: MetricasIg): Numeros {
  const g = (k: string) => (m ? num(m[k]) : null);
  const w = g("ig_reels_avg_watch_time");
  return {
    alcance: g("reach") ?? num(p.result_reach),
    views: g("views") ?? num(p.result_views),
    salvos: g("saved") ?? num(p.result_saves),
    compart: g("shares") ?? num(p.result_shares),
    curtidas: g("likes"),
    coment: g("comments") ?? num(p.result_comments),
    seguidores: g("follows"),
    tempoMedio: w != null ? Math.round(w / 100) / 10 : null,
    pularam: g("reels_skip_rate"),
  };
}

export const temNumeros = (n: Numeros) => n.alcance != null || n.views != null || n.salvos != null;

/* ── Período ────────────────────────────────────────────────────────────── */

export type Periodo = "90d" | "mes" | "ano" | "tudo";
export const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "90d", label: "90 dias" },
  { key: "mes", label: "Este mês" },
  { key: "ano", label: "Este ano" },
  { key: "tudo", label: "Tudo" },
];

/** [início, fim) do período e do período anterior do mesmo tamanho. */
export function janelas(periodo: Periodo, agora = new Date()): { atual: [Date, Date] | null; antes: [Date, Date] | null } {
  if (periodo === "tudo") return { atual: null, antes: null };
  if (periodo === "90d") {
    const ini = new Date(agora.getTime() - 90 * 864e5);
    return { atual: [ini, agora], antes: [new Date(ini.getTime() - 90 * 864e5), ini] };
  }
  if (periodo === "mes") {
    const ini = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const iniAntes = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    // Mês anterior até o mesmo dia, pra comparar pedaço igual com pedaço igual.
    const fimAntes = new Date(iniAntes.getTime() + (agora.getTime() - ini.getTime()));
    return { atual: [ini, agora], antes: [iniAntes, fimAntes < ini ? fimAntes : ini] };
  }
  const ini = new Date(agora.getFullYear(), 0, 1);
  const iniAntes = new Date(agora.getFullYear() - 1, 0, 1);
  const fimAntes = new Date(iniAntes.getTime() + (agora.getTime() - ini.getTime()));
  return { atual: [ini, agora], antes: [iniAntes, fimAntes < ini ? fimAntes : ini] };
}

export const dentro = (iso: string | null, j: [Date, Date] | null) => {
  if (!j) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= j[0].getTime() && t < j[1].getTime();
};

/* ── Números do topo ───────────────────────────────────────────────────── */

export type Resumo = {
  posts: number;
  alcanceSoma: number;
  alcanceMedio: number | null;
  salvos: number;
  seguidores: number;
  /** Posts com número de seguidores (o Instagram não dá isso pra Reels). */
  comSeguidores: number;
  comNumeros: number;
};

export function resumir(lista: { n: Numeros }[]): Resumo {
  let alc = 0, comAlc = 0, salvos = 0, seg = 0, comSeg = 0, com = 0;
  for (const { n } of lista) {
    if (temNumeros(n)) com++;
    if (n.alcance != null) { alc += n.alcance; comAlc++; }
    if (n.salvos != null) salvos += n.salvos;
    if (n.seguidores != null) { seg += n.seguidores; comSeg++; }
  }
  return {
    posts: lista.length, alcanceSoma: alc, alcanceMedio: comAlc ? Math.round(alc / comAlc) : null,
    salvos, seguidores: seg, comSeguidores: comSeg, comNumeros: com,
  };
}

/** Variação em % (arredondada). null quando não dá pra comparar. */
export function variacao(agora: number | null, antes: number | null): number | null {
  if (agora == null || antes == null || antes === 0) return null;
  return Math.round(((agora - antes) / antes) * 100);
}

/* ── Ranking e o porquê ────────────────────────────────────────────────── */

export type Criterio = "alcance" | "salvos" | "compart" | "seguidores";
export const CRITERIOS: { key: Criterio; label: string; curto: string }[] = [
  { key: "alcance", label: "Alcance", curto: "alcance" },
  { key: "salvos", label: "Salvos", curto: "salvos" },
  { key: "compart", label: "Compartilhamentos", curto: "compartilhamentos" },
  { key: "seguidores", label: "Seguidores", curto: "seguidores" },
];

export function media(lista: { n: Numeros }[], c: Criterio): number | null {
  const v = lista.map((x) => x.n[c]).filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function ranking<T extends { n: Numeros }>(lista: T[], c: Criterio, quantos = 3): T[] {
  return lista
    .filter((x) => (x.n[c] ?? 0) > 0)
    .sort((a, b) => (b.n[c] ?? 0) - (a.n[c] ?? 0))
    .slice(0, quantos);
}

const um = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Uma frase curta e verdadeira do porquê, só com conta (sem IA). */
export function porque(x: { n: Numeros }, c: Criterio, lista: { n: Numeros }[]): string {
  const n = x.n;
  const v = n[c];
  const med = media(lista, c);
  const nome = CRITERIOS.find((k) => k.key === c)!.curto;
  if (v != null && med && med > 0 && lista.length >= 3) {
    const r = v / med;
    if (r >= 1.5) return `${um(r)}x a sua média de ${nome}`;
  }
  if (n.tempoMedio != null && n.pularam != null && n.pularam < 50) return `só ${Math.round(n.pularam)}% pularam no começo`;
  if (n.alcance && n.salvos != null) {
    const taxa = n.salvos / n.alcance;
    const taxas = lista.filter((y) => y.n.alcance && y.n.salvos != null).map((y) => y.n.salvos! / y.n.alcance!);
    const mt = taxas.length ? taxas.reduce((a, b) => a + b, 0) / taxas.length : 0;
    if (taxas.length >= 3 && mt > 0 && taxa >= mt * 1.5) return "muito salvo pra quantos viram";
  }
  if (n.compart != null && n.salvos != null && n.compart > n.salvos && n.compart >= 5) return "mais compartilhado do que salvo";
  if (n.seguidores && n.seguidores > 0 && c !== "seguidores") return `trouxe ${n.seguidores} ${n.seguidores === 1 ? "seguidor" : "seguidores"}`;
  return "acima da sua média";
}

/* ── Onde está o resultado ─────────────────────────────────────────────── */

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const fmtBR = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "numeric", hour12: false });
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** "Ter à noite", no fuso do Brasil. */
export function faixaDoHorario(iso: string): string {
  const partes = fmtBR.formatToParts(new Date(iso));
  const wd = WD[partes.find((p) => p.type === "weekday")?.value ?? "Sun"] ?? 0;
  const h = Number(partes.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const faixa = h < 6 ? "de madrugada" : h < 12 ? "de manhã" : h < 18 ? "à tarde" : "à noite";
  return `${DIAS[wd]} ${faixa}`;
}

export type Grupo = { chave: string; nome: string; alcanceMedio: number; posts: number };

/** Alcance médio por grupo (só posts com alcance), do maior pro menor. */
export function porGrupo<T extends { n: Numeros }>(lista: T[], chave: (x: T) => string | null, nome: (k: string) => string): Grupo[] {
  const m = new Map<string, { soma: number; n: number }>();
  for (const x of lista) {
    const k = chave(x);
    if (!k || x.n.alcance == null) continue;
    const g = m.get(k) ?? { soma: 0, n: 0 };
    g.soma += x.n.alcance; g.n++;
    m.set(k, g);
  }
  return [...m.entries()]
    .map(([k, g]) => ({ chave: k, nome: nome(k), alcanceMedio: Math.round(g.soma / g.n), posts: g.n }))
    .sort((a, b) => b.alcanceMedio - a.alcanceMedio);
}

/* ── Pilares repetidos ─────────────────────────────────────────────────── */

/** "Inteligencia Artificial / Sistemas" e "Inteligência Artificial e Sistemas" viram a mesma chave. */
export function chaveDoPilar(nome: string): string {
  return nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s*[/&+]\s*/g, " e ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type PilarSimples = { id: string; name: string; position?: number | null };
export type Repetidos = { fica: PilarSimples; saem: PilarSimples[] };

/**
 * Grupos de pilares com o mesmo nome. Fica o que tem mais posts; empate, o que
 * tem acento (nome escrito certo); empate, o que vem primeiro na ordem.
 */
export function pilaresRepetidos(pilares: PilarSimples[], postsPorPilar: Record<string, number>): Repetidos[] {
  const m = new Map<string, PilarSimples[]>();
  for (const p of pilares) {
    const k = chaveDoPilar(p.name);
    if (!k) continue;
    m.set(k, [...(m.get(k) ?? []), p]);
  }
  const acento = (s: string) => (/[^\x00-\x7F]/.test(s) ? 1 : 0);
  return [...m.values()]
    .filter((g) => g.length > 1)
    .map((g) => {
      const ord = [...g].sort((a, b) =>
        (postsPorPilar[b.id] ?? 0) - (postsPorPilar[a.id] ?? 0)
        || acento(b.name) - acento(a.name)
        || (a.position ?? 0) - (b.position ?? 0));
      return { fica: ord[0], saem: ord.slice(1) };
    });
}

/* ── Formatação ────────────────────────────────────────────────────────── */

/** 1.340 · 24,1 mil · 1,2 mi */
export function compacto(v: number | null | undefined): string {
  if (v == null) return "-";
  const a = Math.abs(v);
  if (a >= 1e6) return `${um(v / 1e6)} mi`;
  if (a >= 1e4) return `${um(v / 1e3)} mil`;
  return Math.round(v).toLocaleString("pt-BR");
}

/** "novembro de 2026" (minúsculo, como se escreve em português). */
export function nomeDoMes(chave: string): string {
  const [y, m] = chave.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 15).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).toLowerCase();
}
