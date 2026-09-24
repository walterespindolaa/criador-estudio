// Dinheiro em pt-BR. Regra: o valor guardado é SEMPRE número em reais (ex.: 1197.5).
// A digitação aceita "1197", "1.197", "1.197,50" e "1197,5", nunca vira 1,2.

export function parseBRL(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/[R$\s]/g, "");
  if (!s) return null;

  const hasComma = s.includes(",");
  if (hasComma) {
    // pt-BR: ponto é separador de milhar, vírgula é decimal.
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // Sem vírgula: ponto pode ser milhar ("1.197") ou decimal ("1197.5").
    // Trata como MILHAR quando o último grupo tem exatamente 3 dígitos (padrão BR).
    const parts = s.split(".");
    if (parts.length > 1 && parts[parts.length - 1].length === 3) s = parts.join("");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

// "1.197,00" (sem o R$, pro input). Vazio quando null, nunca mostra 0 preso.
export function formatBRLInput(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return "";
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// "R$ 1.197,00" pra exibição. Vazio/zero vira "-" (não polui a tela com R$ 0).
export function formatBRL(v: number | null | undefined, opts?: { zeroAsDash?: boolean }): string {
  const n = Number(v);
  if (v == null || !Number.isFinite(n)) return "-";
  if (n === 0 && (opts?.zeroAsDash ?? true)) return "-";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ── Dois formatos únicos pro app inteiro (pente fino 23/09/2026) ──────────
   Havia 17 `brl` locais: uns recebiam CENTAVOS (Stripe), outros REAIS
   (Caixa), e a mesma tela às vezes misturava. Aqui o nome diz a unidade. */

/** Reais -> "R$ 1.234,56". Zero vira "R$ 0,00" (não traço). */
export function brlReais(v: number | null | undefined): string {
  const n = Number(v);
  if (v == null || !Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Centavos (Stripe) -> "R$ 1.234,56". */
export function brlCentavos(c: number | null | undefined): string {
  return brlReais((Number(c) || 0) / 100);
}
