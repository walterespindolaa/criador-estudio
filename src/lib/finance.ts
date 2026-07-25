// Constantes e cálculos compartilhados do Cria Caixa.
// Regra de ouro: dinheiro aqui é SEMPRE em reais (número), nunca centavos.

import type { FinSettings } from "@/hooks/useModules";

/** Formas de pagamento padronizadas, vira select, não texto livre.
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

/** Alíquota efetiva (%) que o usuário declarou. MEI não tem alíquota, tem DAS fixo. */
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
 *   (É rateio de gestão, não apuração fiscal, deixamos isso explícito na tela.)
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

/**
 * A mensalidade de um cliente só conta na carteira/MRR e só gera instância mensal
 * (fin_monthly) ATÉ o mês do encerramento do contrato (contract_end_date).
 * O mês do encerramento AINDA conta; a partir do mês seguinte, para de contar.
 *
 * Regra:
 *  - sem valor mensal (> 0): nunca conta.
 *  - com data de encerramento: conta enquanto o mês de referência for <= mês do encerramento.
 *  - sem data de encerramento: o status manda (inativo não conta).
 *
 * @param monthYYYYMM  mês de referência no formato "YYYY-MM" (ex.: "2026-07").
 *                     NÃO usar toISOString(); passe hojeBR().slice(0,7) ou o mês visto.
 */
export function mensalidadeAtivaNoMes(
  client: { status?: string | null; monthly_value?: number | null; contract_end_date?: string | null },
  monthYYYYMM: string,
): boolean {
  if (!(Number(client.monthly_value) > 0)) return false;
  const end = client.contract_end_date ? client.contract_end_date.slice(0, 7) : null;
  // Encerrado: conta até o mês do encerramento (inclusive), nunca depois.
  if (end) return monthYYYYMM <= end;
  // Sem data de encerramento: mantém a regra antiga, o status decide.
  return (client.status ?? "ativo") !== "inativo";
}
