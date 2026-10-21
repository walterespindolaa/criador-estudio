import type jsPDF from "jspdf";

/* TEXTO QUE O PDF CONSEGUE DESENHAR (Gabriela, 20/10/2026: "ficou todo bugado
   o guia"). As fontes padrão do jsPDF (helvetica) só têm os caracteres do
   WinAnsi. Um único caractere fora dele na linha, como o "₂" de "CO₂", faz o
   jsPDF gravar a linha inteira em outra codificação: no leitor ela sai com as
   letras espaçadas ("C O ,  D a y") e por cima do texto vizinho.
   Aqui cada texto passa por uma limpeza antes de ir pro PDF:
   - NFKC transforma o que tem equivalente simples (₂ vira 2, ² vira 2, ﬁ vira fi);
   - espaços e hífens exóticos viram espaço e hífen comuns;
   - o que ainda sobrar fora do WinAnsi (emoji, símbolos) sai. */
const EXTRAS_WINANSI = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

export function textoPdf(s: string): string {
  if (!s) return s;
  let t = s.normalize("NFKC")
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[\u2010-\u2012\u2212]/g, "-");
  let out = "";
  for (const ch of t) {
    const c = ch.codePointAt(0) ?? 0;
    if (c <= 0xff || EXTRAS_WINANSI.has(ch)) out += ch;
  }
  t = out.replace(/[ \t]{2,}/g, " ");
  return t;
}

const limpar = (v: unknown): unknown =>
  typeof v === "string" ? textoPdf(v) : Array.isArray(v) ? v.map(limpar) : v;

/** Faz todo text/splitTextToSize/getTextWidth deste PDF passar pela limpeza. */
export function blindarTextoPdf(pdf: jsPDF): jsPDF {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = pdf as any;
  const text = p.text.bind(p);
  p.text = (t: unknown, ...resto: unknown[]) => text(limpar(t), ...resto);
  const split = p.splitTextToSize.bind(p);
  p.splitTextToSize = (t: unknown, ...resto: unknown[]) => split(limpar(t), ...resto);
  const largura = p.getTextWidth.bind(p);
  p.getTextWidth = (t: unknown) => largura(limpar(t));
  return pdf;
}
