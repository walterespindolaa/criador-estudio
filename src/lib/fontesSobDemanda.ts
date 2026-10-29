/* FONTES SOB DEMANDA (Walter, 29/10/2026: "ajuste as fontes pesadas").
   O index.html puxava 7 folhas do Google Fonts em toda tela, inclusive as 8
   famílias que só aparecem pra quem escolheu outro tema em Ajustes ou na
   página de bio. Agora o index.html só traz as do tema padrão (Baloo 2,
   Roboto, Grand Hotel, Plus Jakarta Sans, Nunito Sans, Bricolage) e as outras
   entram aqui, na hora em que alguma tela precisa delas. Cada família entra
   uma vez só por página. */

const ESPEC: Record<string, string> = {
  "DM Serif Display": "DM+Serif+Display",
  "DM Sans": "DM+Sans:wght@400;500;600;700",
  "Space Grotesk": "Space+Grotesk:wght@400;500;600;700",
  "Outfit": "Outfit:wght@400;500;600;700",
  "Quicksand": "Quicksand:wght@400;500;600;700",
  "Nunito": "Nunito:wght@400;500;600;700",
  "Sora": "Sora:wght@400;500;600;700;800",
  "Inter": "Inter:wght@400;500;600;700",
};

/** Pares (títulos, texto) de cada tema de Ajustes que não é o padrão. */
export const FONTES_DO_TEMA: Record<string, string[]> = {
  elegante: ["DM Serif Display", "DM Sans"],
  criativo: ["Space Grotesk", "Outfit"],
  suave: ["Quicksand", "Nunito"],
  bold: ["Sora", "Inter"],
};

export const TODAS_AS_FONTES_EXTRAS = Object.keys(ESPEC);

const carregadas = new Set<string>();

export function carregarFontes(familias: (string | null | undefined)[]) {
  if (typeof document === "undefined") return;
  const novas = familias.filter((f): f is string => !!f && !!ESPEC[f] && !carregadas.has(f));
  if (!novas.length) return;
  novas.forEach((f) => carregadas.add(f));
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${novas.map((f) => `family=${ESPEC[f]}`).join("&")}&display=swap`;
  document.head.appendChild(link);
}

export function carregarFontesDoTema(chave: string | null | undefined) {
  if (chave && FONTES_DO_TEMA[chave]) carregarFontes(FONTES_DO_TEMA[chave]);
}
