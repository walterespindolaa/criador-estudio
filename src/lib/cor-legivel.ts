/* ═══════════════════════════════════════════════════════════════════════════
   COR DA MARCA LEGÍVEL (pente fino 23/09/2026)

   As páginas públicas (aprovação, materiais, cronograma) pintam com a cor
   que a social mídia cadastrou pro cliente. Marca creme, amarela ou pastel
   deixava título branco invisível no hero e texto da marca invisível na
   folha bege. Estas funções vivem aqui pra todas as páginas usarem a mesma
   régua, em vez de cada uma copiar a luminância.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Escurece (pct negativo) ou clareia (pct positivo) um hex. */
export function shadeHex(hex: string, pct: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const f = (i: number) => {
    const v = parseInt(clean.slice(i, i + 2), 16);
    const out = Math.min(255, Math.max(0, Math.round(v * (1 + pct / 100))));
    return out.toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(2)}${f(4)}`;
}

/** Luminância relativa (0 = preto, 1 = branco), WCAG. */
export function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 1;
  const ch = (i: number) => {
    const v = parseInt(clean.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
}

/** Texto em HSL (pro --primary-foreground) legível em cima da cor da marca. */
export function readableFg(hex: string): string {
  return luminance(hex) > 0.6 ? "24 10% 12%" : "0 0% 100%";
}

/** Mesma decisão, em hex, pra `style={{ color }}` direto. */
export function readableFgHex(hex: string): string {
  return luminance(hex) > 0.6 ? "#1c1917" : "#ffffff";
}

/** Cor da marca escurecida até dar contraste como TEXTO em fundo claro. */
export function corSeguraEmFundoClaro(hex: string): string {
  let cor = hex;
  let guarda = 0;
  while (luminance(cor) > 0.35 && guarda < 8) {
    cor = shadeHex(cor, -18);
    guarda += 1;
  }
  return cor;
}
