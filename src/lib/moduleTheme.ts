// ═══════════════════════════════════════════════════════════════════════
// COR POR MÓDULO
//
// O sistema usava só laranja e verde — as outras 4 cores da LP nunca
// apareciam. Resultado: tudo igual, tudo morto, e a pessoa nunca sabe
// "onde está" sem ler o título.
//
// Agora cada módulo tem a sua cor. Ela pinta o cabeçalho, as formas
// orgânicas e os acentos daquela área. Navegar vira uma experiência
// de cor, não só de texto.
// ═══════════════════════════════════════════════════════════════════════

export type CriaColor = "laranja" | "verde" | "azul" | "rosa" | "amarelo" | "lilas";

/** Hex das 6 cores da landing page. Fonte da verdade — não invente tons novos. */
export const CRIA_HEX: Record<CriaColor, string> = {
  laranja: "#CE4A1D",
  verde: "#3E9152",
  azul: "#2A4BDF",
  rosa: "#F27EB5",
  amarelo: "#F2C21E",
  lilas: "#7C90F0",
};

/** Nome da CSS var (definida em index.css). Use com hsl(var(--cria-azul)). */
export const criaVar = (c: CriaColor) => `--cria-${c === "lilas" ? "lilas" : c}`;

/** Cor de cada módulo. Mudou de módulo, mudou a cor da tela. */
export const MODULE_COLOR: Record<string, CriaColor> = {
  criacaixa: "azul",       // dinheiro: azul, sério e confiável
  criacrm: "rosa",         // gestão de clientes: rosa, relacionamento
  clientes: "rosa",
  criapost: "laranja",     // conteúdo: laranja, a cor-mãe do CRIA
  hubcria: "lilas",        // pesquisa/concorrência: lilás
  agenda: "amarelo",       // tempo: amarelo
  stories: "verde",        // stories: verde
  equipe: "verde",
};

/** Descobre a cor do módulo pela rota (/socialmidia/criacaixa/... → azul). */
export function colorFromPath(pathname: string): CriaColor {
  const seg = pathname.split("/").filter(Boolean);
  for (const s of seg) {
    const c = MODULE_COLOR[s];
    if (c) return c;
  }
  return "laranja";
}
