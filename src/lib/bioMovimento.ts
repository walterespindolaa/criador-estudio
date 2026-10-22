/* ═══════════════════════════════════════════════════════════════════════════
   NÚMEROS QUE SOBEM (22/10/2026)

   O número da página ("12 anos", "+300 clientes", "18,4 mil", "98%") é texto
   livre. Pra ele subir de 0 até o valor quando aparece na tela, a gente separa
   o que é número do que é enfeite em volta, anima só o número e devolve o
   enfeite igualzinho. O que não tem número fica parado, sem drama.
   ═══════════════════════════════════════════════════════════════════════════ */

export type NumeroPartido = {
  antes: string;
  valor: number;
  depois: string;
  /** Casas depois da vírgula, como a pessoa escreveu. */
  casas: number;
  /** Escreveu com ponto de milhar ("1.200"): a animação mantém o ponto. */
  milhar: boolean;
};

/** "+1.200 clientes" vira { antes: "+", valor: 1200, depois: " clientes" }.
 *  Formato brasileiro: ponto é milhar, vírgula é decimal. */
export function partirNumero(texto: string): NumeroPartido | null {
  const t = typeof texto === "string" ? texto : "";
  if (!t || t.length > 40) return null;
  const m = t.match(/^(\D*?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?(.*)$/s);
  if (!m) return null;
  const [, antes, inteiro, decimal = "", depois] = m;
  const milhar = inteiro.includes(".");
  const valor = Number(inteiro.replace(/\./g, "") + (decimal ? `.${decimal}` : ""));
  if (!Number.isFinite(valor)) return null;
  return { antes, valor, depois, casas: decimal.length, milhar };
}

/** Escreve um valor intermediário no mesmo formato do original. */
export function escreverParcial(p: NumeroPartido, valor: number): string {
  const fixo = valor.toFixed(p.casas);
  const [inteiro, dec] = fixo.split(".");
  const int = p.milhar ? inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : inteiro;
  return p.antes + int + (dec ? `,${dec}` : "") + p.depois;
}

/** Curva que freia no fim: o número corre no começo e assenta devagar. */
export const frear = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** 18432 vira "18,4 mil"; 1250000 vira "1,2 mi". Pra seguidor, view e alcance. */
export function numeroCurto(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return "";
  const corta = (v: number) => {
    const s = v >= 100 ? String(Math.floor(v)) : (Math.floor(v * 10) / 10).toFixed(1).replace(/\.0$/, "");
    return s.replace(".", ",");
  };
  if (n >= 1_000_000) return `${corta(n / 1_000_000)} mi`;
  if (n >= 1_000) return `${corta(n / 1_000)} mil`;
  return String(Math.round(n));
}

/** Texto com cara de espaço reservado ("[00]", "[preço]", "00k"). Esse tipo
 *  de coisa nunca vai pro ar: é sinal de que a pessoa ainda não preencheu. */
export const ehMarcador = (t: string) => /\[[^\]]*\]/.test(t) || /^\s*0{2,}\s*[a-z%]*\s*$/i.test(t);
