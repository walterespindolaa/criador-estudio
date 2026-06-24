// Melhor horário pra postar — heurística por plataforma + nicho (padrão Brasil).
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
