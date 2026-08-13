import type { CSSProperties } from "react";
import { normalizarFormato } from "@/lib/constants";

// Fonte única das cores por FORMATO de post (kanban do Cria Post, visão de
// calendário, filtros de formato e a lista de vínculo do Insights).
// Antes o mapa vivia duplicado em CriaPostBoard.tsx e Insights.tsx, cobrindo só
// 5 dos 7 formatos que o app aceita (FORMATS em src/lib/constants.ts).
//
// Cada formato tem dois tons: `base` (tema claro, cor oficial da marca) e `dark`
// (a mesma cor clareada pra continuar legível sobre o fundo escuro do app).
// O consumo é sempre via CSS var + classe utilitária: o Tailwind troca o tom
// sozinho dentro de `.dark`, sem ninguém precisar ler o tema em JS.
export type FormatColor = { base: string; dark: string };

// Formato desconhecido (ou vazio): neutro, sem chamar atenção.
export const FORMAT_COLOR_FALLBACK: FormatColor = { base: "#6B6B66", dark: "#A9A49A" };

export const FORMAT_COLORS: Record<string, FormatColor> = {
  reels: { base: "#0061EE", dark: "#79ACFF" },      // azul CRIA
  carrossel: { base: "#01A652", dark: "#43D68A" },  // verde CRIA
  foto: { base: "#EA4918", dark: "#FF8A63" },       // laranja CRIA
  story: { base: "#7C90F0", dark: "#A9B6F7" },      // lilás CRIA
  video: { base: "#4B3FA8", dark: "#9C92F2" },      // índigo
  shorts: { base: "#DB2777", dark: "#FF8FC2" },     // rosa (o #FF77B9 puro some no branco)
  live: { base: "#D97706", dark: "#FFC24D" },       // âmbar (o amarelo puro some no branco)
};

// Cor do formato, com fallback neutro pra formato desconhecido/vazio.
export function corDoFormato(format?: string | null): FormatColor {
  if (!format) return FORMAT_COLOR_FALLBACK;
  // Canoniza antes de buscar a cor: "Reels"/"reels"/"reel" caem na MESMA cor,
  // senão uma variação ia pro fallback cinza e o formato aparecia com duas cores.
  return FORMAT_COLORS[normalizarFormato(format)] ?? FORMAT_COLOR_FALLBACK;
}

// Vars do elemento. Use junto de FORMAT_TEXT_CLASS / FORMAT_BORDER_CLASS /
// FORMAT_DOT_CLASS, que leem --fmt no claro e --fmt-dark no escuro.
export function formatColorVars(format?: string | null): CSSProperties {
  const c = corDoFormato(format);
  return { ["--fmt" as string]: c.base, ["--fmt-dark" as string]: c.dark } as CSSProperties;
}

// Texto na cor do formato.
export const FORMAT_TEXT_CLASS = "text-[color:var(--fmt)] dark:text-[color:var(--fmt-dark)]";
// Barra lateral (borda esquerda) na cor do formato. A LARGURA vai inline
// (borderLeftWidth), senão o utilitário `border` do card sobrescreve.
export const FORMAT_BORDER_CLASS = "border-l-[color:var(--fmt)] dark:border-l-[color:var(--fmt-dark)]";
// Bolinha na cor do formato (chips de filtro).
export const FORMAT_DOT_CLASS = "bg-[color:var(--fmt)] dark:bg-[color:var(--fmt-dark)]";
