// Melhor horário pra postar, heurística por plataforma + nicho (padrão Brasil).
// Quando a integração com o Instagram (insights) for aprovada, dá pra trocar
// esta heurística por dados reais de quando a audiência da pessoa está online.

export type BestTimes = {
  days: string;          // ex: "Ter, Qua e Qui"
  slots: string[];       // ex: ["12:00", "19:00", "21:00"]
  source: "heuristica" | "insights";
};

const PLATFORM_BASE: Record<string, { days: string; slots: string[] }> = {
  instagram: { days: "Ter, Qua e Qui", slots: ["12:00", "19:00", "21:00"] },
  tiktok: { days: "Ter, Qui e Sáb", slots: ["11:00", "19:00", "22:00"] },
  youtube: { days: "Sex, Sáb e Dom", slots: ["15:00", "18:00", "20:00"] },
};

// Ajustes por nicho (casados por palavra-chave no texto do nicho).
const NICHE_RULES: { match: string[]; days?: string; slots: string[] }[] = [
  { match: ["fitness", "saúde", "saude", "treino", "academia", "corrida"], days: "Seg, Qua e Sex", slots: ["06:00", "12:00", "18:00"] },
  { match: ["gastronom", "comida", "food", "receita", "culinár", "culinar", "chef"], slots: ["11:00", "18:00", "20:00"] },
  { match: ["moda", "beleza", "make", "estética", "estetica", "cabelo"], slots: ["12:00", "19:00", "21:00"] },
  { match: ["negócio", "negocio", "empreend", "marketing", "finanç", "financ", "vendas", "b2b"], days: "Seg, Ter e Qua", slots: ["08:00", "12:00", "18:00"] },
  { match: ["viagem", "turismo", "viajar"], days: "Qui, Sex e Dom", slots: ["18:00", "20:00", "21:00"] },
  { match: ["educa", "curso", "ensino", "estudo", "concurso"], slots: ["07:00", "12:00", "20:00"] },
  { match: ["mãe", "mae", "maternidade", "família", "familia", "filho"], slots: ["09:00", "14:00", "21:00"] },
];

export function bestTimes(platform?: string | null, niche?: string | null): BestTimes {
  const base = PLATFORM_BASE[(platform ?? "instagram").toLowerCase()] ?? PLATFORM_BASE.instagram;
  const n = (niche ?? "").toLowerCase();
  const rule = n ? NICHE_RULES.find((r) => r.match.some((m) => n.includes(m))) : undefined;
  return {
    days: rule?.days ?? base.days,
    slots: rule?.slots ?? base.slots,
    source: "heuristica",
  };
}

// ============================================================
// MELHOR HORÁRIO A PARTIR DO INSTAGRAM REAL
//
// Quando a conta tem Instagram conectado e histórico suficiente, dá pra parar de
// chutar por nicho e olhar o que de fato aconteceu: a que horas (fuso BR) cada
// post foi publicado x quanto ele engajou. Os dias/horários que mais renderam
// viram a sugestão. Sem dado suficiente, devolve null e a tela cai na heurística.
// ============================================================

export type MediaForBestTimes = {
  posted_at: string | null;
  metrics: Record<string, number> | null;
};

// Mínimo de posts com dado utilizável pra sair da heurística. Abaixo disso a
// média por dia/horário é ruído: um ou dois posts não dizem "melhor horário".
export const MIN_POSTS_BEST_TIMES = 6;

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAY_NAME_TO_IDX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

// Dia da semana + hora de um instante, sempre no fuso do Brasil (não no fuso do
// aparelho e não em UTC): é o horário que a audiência daqui viu o post no ar.
const brParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  hour: "2-digit",
  hour12: false,
});

function diaHoraBR(iso: string): { dia: number; hora: number } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  let dia = -1;
  let hora = -1;
  for (const p of brParts.formatToParts(d)) {
    if (p.type === "weekday") dia = DAY_NAME_TO_IDX[p.value] ?? -1;
    if (p.type === "hour") hora = parseInt(p.value, 10) % 24; // "24" vira 0 (meia-noite)
  }
  if (dia < 0 || Number.isNaN(hora) || hora < 0) return null;
  return { dia, hora };
}

// Engajamento de um post, do sinal mais forte pro mais fraco: interações totais,
// depois a soma de curtidas/comentários/salvos/compart., por fim alcance/views.
function engajamento(m: Record<string, number> | null): number {
  if (!m) return 0;
  if (typeof m.total_interactions === "number" && m.total_interactions > 0) return m.total_interactions;
  const soma = (m.likes ?? 0) + (m.comments ?? 0) + (m.saved ?? 0) + (m.shares ?? 0);
  if (soma > 0) return soma;
  return m.reach ?? m.views ?? 0;
}

function juntarDias(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

// Calcula os melhores dias/horários pelo desempenho real dos posts. Devolve null
// quando não há posts com dado suficiente pra afirmar algo (aí usa a heurística).
export function bestTimesFromMedia(media: MediaForBestTimes[] | undefined | null): BestTimes | null {
  if (!media || media.length === 0) return null;

  type Acc = { soma: number; n: number };
  const porDia = new Map<number, Acc>();
  const porHora = new Map<number, Acc>();
  let usados = 0;

  for (const item of media) {
    if (!item.posted_at) continue;
    const eng = engajamento(item.metrics);
    if (eng <= 0) continue;
    const dh = diaHoraBR(item.posted_at);
    if (!dh) continue;
    usados++;
    const d = porDia.get(dh.dia) ?? { soma: 0, n: 0 };
    d.soma += eng; d.n++; porDia.set(dh.dia, d);
    const h = porHora.get(dh.hora) ?? { soma: 0, n: 0 };
    h.soma += eng; h.n++; porHora.set(dh.hora, h);
  }

  if (usados < MIN_POSTS_BEST_TIMES) return null;

  // Rankeia por MÉDIA de engajamento (não por soma): um horário com 1 post
  // campeão não deve empurrar pra frente um horário com 5 posts consistentes.
  const topDias = [...porDia.entries()]
    .map(([dia, a]) => ({ dia, media: a.soma / a.n }))
    .sort((x, y) => y.media - x.media)
    .slice(0, 3)
    .map((x) => x.dia)
    .sort((a, b) => a - b);

  const topHoras = [...porHora.entries()]
    .map(([hora, a]) => ({ hora, media: a.soma / a.n }))
    .sort((x, y) => y.media - x.media)
    .slice(0, 3)
    .map((x) => x.hora)
    .sort((a, b) => a - b);

  if (topDias.length === 0 || topHoras.length === 0) return null;

  return {
    days: juntarDias(topDias.map((d) => DAY_LABELS[d])),
    slots: topHoras.map((h) => `${String(h).padStart(2, "0")}:00`),
    source: "insights",
  };
}
