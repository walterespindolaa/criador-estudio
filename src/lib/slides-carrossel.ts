/* SLIDES DO CARROSSEL (Walter, 19/10/2026; mockup aprovado).
 * Nada muda no banco: o slide 1 é o campo `hook` (capa) e os slides 2..N
 * vivem juntos no campo `cta`, um por parágrafo. Estes helpers são puros
 * pra poder testar a ida e a volta sem a tela. */

/** Separa o texto do campo `cta` em slides. Linha em branco separa slide
 *  (quebras simples dentro de um slide são preservadas). Texto antigo sem
 *  nenhuma linha em branco, mas com várias linhas, vira um slide por linha. */
export function parseSlides(texto: string | null | undefined): string[] {
  const t = (texto ?? "").replace(/\r\n/g, "\n").trim();
  if (!t) return [];
  const blocos = /\n\s*\n/.test(t) ? t.split(/\n\s*\n/) : t.split("\n");
  return blocos.map((b) => b.trim()).filter((b) => b.length > 0);
}

/** Junta os slides de volta no formato do campo `cta`. Slide vazio não é
 *  gravado (não deixa linha em branco solta no meio). */
export function joinSlides(slides: string[]): string {
  return slides.map((s) => s.trim()).filter((s) => s.length > 0).join("\n\n");
}

/** Limite de lâminas de um carrossel no Instagram. */
export const LIMITE_SLIDES = 20;
