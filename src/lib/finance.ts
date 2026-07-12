// Constantes e cálculos compartilhados do Cria Caixa.
// Regra de ouro: dinheiro aqui é SEMPRE em reais (número), nunca centavos.

import type { FinSettings } from "@/hooks/useModules";

/** Formas de pagamento padronizadas — vira select, não texto livre.
 *  Padronizar é o que permite somar/filtrar e mostrar a forma na ficha do cliente. */
export const PAYMENT_METHODS = [
  "Pix",
  "Boleto",
  "Cartão de crédito",
  "Cartão de débito",
  "Transferência / TED",
  "Dinheiro",
  "Outro",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const REGIMES = [
  { v: "mei", label: "MEI", hint: "DAS fixo por mês" },
  { v: "simples", label: "Simples Nacional", hint: "% sobre o faturamento" },
  { v: "presumido", label: "Lucro Presumido", hint: "% sobre o faturamento" },
] as const;
export type Regime = (typeof REGIMES)[number]["v"];

export const isPctRegime = (r?: string) => r === "simples" || r === "presumido";

/** Alíquota efetiva (%) que o usuário declarou. MEI não tem alíquota — tem DAS fixo. */
export const taxRateOf = (fin: FinSettings | null | undefined): number =>
  isPctRegime(fin?.regime) ? Number(fin?.taxPct) || 0 : 0;

/**
 * Imposto do mês sobre o que ENTROU.
 * - MEI: DAS fixo, independe do faturamento.
 * - Simples / Presumido: alíquota × receita.
 */
export function taxOfMonth(fin: FinSettings | null | undefined, receita: number): number {
  if (!fin) return 0;
  if (isPctRegime(fin.regime)) return receita * (Number(fin.taxPct) || 0) / 100;
  return Number(fin.dasMonthly) || 0; // MEI
}

/**
 * Imposto atribuível a UM cliente.
 * - Regime %: direto, alíquota × receita daquele cliente.
 * - MEI: o DAS é fixo, então rateia proporcional à participação do cliente na receita.
 *   (É rateio de gestão, não apuração fiscal — deixamos isso explícito na tela.)
 */
export function taxOfClient(
  fin: FinSettings | null | undefined,
  receitaCliente: number,
  receitaTotal: number,
): number {
  if (!fin) return 0;
  if (isPctRegime(fin.regime)) return receitaCliente * (Number(fin.taxPct) || 0) / 100;
  const das = Number(fin.dasMonthly) || 0;
  if (!das || receitaTotal <= 0) return 0;
  return das * (receitaCliente / receitaTotal);
}

export const regimeLabel = (r?: string) => REGIMES.find((x) => x.v === r)?.label ?? "não configurado";
