/* ═══════════════════════════════════════════════════════════════════════════
   A FORMA DA FOTO DO BLOCO (Walter, 20/09/2026)

   Mora numa biblioteca, e não dentro do editor, por um motivo de peso: quem lê
   esta tabela é também a PÁGINA PÚBLICA, e importar do editor arrastaria o
   recortador de imagem e os hooks de upload pro pacote que o visitante baixa.
   A página pública do link na bio é a que mais precisa abrir rápido.
   ═══════════════════════════════════════════════════════════════════════════ */

export const FORMAS_DA_FOTO = {
  horizontal: { rotulo: "Deitada", ratio: 16 / 9, classe: "aspect-[16/9]" },
  quadrada: { rotulo: "Quadrada", ratio: 1, classe: "aspect-square" },
  vertical: { rotulo: "Em pé", ratio: 3 / 4, classe: "aspect-[3/4]" },
} as const;

export type FormaDaFoto = keyof typeof FORMAS_DA_FOTO;

/** Bloco antigo (sem escolha gravada) cai em deitada, que é como a página
 *  pública já desenhava o bloco de texto desde sempre. */
export const formaValida = (v: string): FormaDaFoto =>
  (v in FORMAS_DA_FOTO ? v : "horizontal") as FormaDaFoto;

export const classeDaForma = (v: string) => FORMAS_DA_FOTO[formaValida(v)].classe;
