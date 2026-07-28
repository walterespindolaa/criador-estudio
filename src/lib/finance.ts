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

// ═══════════════════════════════════════════════════════════════════════
// RECEITA DO MÊS (PJ), fonte única da verdade.
//
// Era o buraco que fazia os números NÃO baterem entre a Home, a Visão geral
// do Caixa e os Lançamentos: cada tela somava o dinheiro do seu jeito e a
// receita AVULSA (freelance/lançamento sem cliente) caía de fora do card da
// home (que só olhava o MRR da carteira). Agora a Home E o Caixa chamam esta
// MESMA conta, então os três cruzam sempre.
//
// Componentes do mês (context "pj"):
//   recebido        = entradas JÁ pagas (mensalidade paga + avulso pago)
//   aReceberMensal  = mensalidades do mês ainda pendentes (fin_monthly)
//   aReceberAvulso  = entradas lançadas à mão ainda não pagas (inclui SEM cliente)
//   aReceber        = aReceberMensal + aReceberAvulso
//   previstoBruto   = recebido + aReceber   (a "Previsão total do mês")
//   mensalRecebida  = entradas pagas de categoria "Mensalidade"
//   mensalidadesDoMes = mensalRecebida + aReceberMensal   (a carteira/MRR realizado)
//   outrasReceitas  = previstoBruto − mensalidadesDoMes    (tudo que é avulso)
//   mrr             = soma de monthly_value da carteira ativa no mês (recorrência pura)
//
// SEM contar 2x: a mensalidade paga vira fin_record (entra em `recebido`) e a
// sua instância em fin_monthly fica "pago" (fora de aReceberMensal). A pendente
// só existe em fin_monthly (aReceberMensal) e ainda não é fin_record.
export type ReceitaMes = {
  recebido: number;
  aReceberMensal: number;
  aReceberAvulso: number;
  aReceber: number;
  previstoBruto: number;
  mensalRecebida: number;
  mensalidadesDoMes: number;
  outrasReceitas: number;
  mrr: number;
};

// Tipos estruturais mínimos (evita import circular com useFinance).
// crm_client_id / month_ref entram aqui pra cruzar mensalidade × cliente × mês
// (dedup da paga manualmente e corte do cliente inativo, ver receitaDoMesPJ).
type RecLike = { context?: string | null; type: string; status: string; category?: string | null; amount: number | string; date: string; crm_client_id?: string | null };
type MonthlyLike = { id?: string | null; status: string; amount: number | string; crm_client_id?: string | null; month_ref?: string | null };
type ClientLike = { id?: string | null; status?: string | null; monthly_value?: number | null; contract_end_date?: string | null };

/**
 * Clientes cuja mensalidade do mês JÁ foi lançada como fin_record pago
 * (entrada/pago/categoria "Mensalidade"). Esse dinheiro já está em `recebido`,
 * então a instância pendente correspondente NÃO deve somar de novo.
 */
export function paidMonthlyClientIds(records: RecLike[], ym: string): Set<string> {
  return new Set(
    records
      .filter(
        (r) =>
          (r.context ?? "pj") === "pj" &&
          String(r.date).slice(0, 7) === ym &&
          r.type === "entrada" &&
          r.status === "pago" &&
          (r.category ?? "") === "Mensalidade" &&
          r.crm_client_id,
      )
      .map((r) => String(r.crm_client_id)),
  );
}

/**
 * FONTE ÚNICA das mensalidades pendentes que REALMENTE contam como "a receber".
 * Use em TODA agregação do Caixa (visão geral, rentabilidade, lançamentos,
 * calendário, inadimplência, ficha do cliente) pra os números baterem entre abas.
 *
 * Tira da conta:
 *  - BUG 1 (dedup): mensalidade do mês já lançada à mão como paga (senão conta 2x).
 *  - BUG 3 (fantasma): cliente inativo/encerrado no mês da instância.
 *  - BUG 3b (excluído): cliente que saiu da carteira (soft delete) — a instância
 *    pendente vira "a receber" invisível. Se há carteira carregada e o cliente
 *    não está nela, não soma. (Guardado por clients.length > 0 pra não zerar
 *    durante o carregamento.)
 */
export function billablePendingMonthlies<M extends MonthlyLike>(
  monthlies: M[],
  records: RecLike[],
  clients: ClientLike[],
  ym: string,
): M[] {
  const pagos = paidMonthlyClientIds(records, ym);
  const clientById = new Map(clients.filter((c) => c.id).map((c) => [String(c.id), c] as const));
  const temCarteira = clients.length > 0;
  return monthlies.filter((m) => {
    if (m.status !== "pendente") return false;
    const cid = m.crm_client_id ? String(m.crm_client_id) : null;
    if (!cid) return true; // instância sem cliente vinculado, mantém.
    if (pagos.has(cid)) return false; // BUG 1
    const c = clientById.get(cid);
    if (!c) return !temCarteira; // BUG 3b: cliente excluído da carteira.
    const mesInstancia = m.month_ref ? String(m.month_ref).slice(0, 7) : ym;
    return mensalidadeAtivaNoMes(c, mesInstancia); // BUG 3
  });
}

/**
 * Reconcilia a receita PJ de um mês a partir das 3 fontes já carregadas.
 * @param records   fin_records (qualquer janela que contenha o mês).
 * @param monthlies fin_monthly do mês (instâncias de mensalidade).
 * @param clients   carteira (crm_clients) pro MRR puro.
 * @param ym        mês de referência "YYYY-MM" (use hojeBR().slice(0,7) ou o mês visto).
 */
export function receitaDoMesPJ(
  records: RecLike[],
  monthlies: MonthlyLike[],
  clients: ClientLike[],
  ym: string,
): ReceitaMes {
  const inMonth = records.filter((r) => (r.context ?? "pj") === "pj" && String(r.date).slice(0, 7) === ym);
  const sum = (arr: RecLike[]) => arr.reduce((s, r) => s + Number(r.amount), 0);

  const recebido = sum(inMonth.filter((r) => r.type === "entrada" && r.status === "pago"));
  const aReceberAvulso = sum(inMonth.filter((r) => r.type === "entrada" && r.status !== "pago"));

  // Mensalidades pendentes que realmente contam (dedup da paga à mão + corte de
  // cliente inativo/excluído). MESMA regra usada em todas as abas do Caixa.
  const aReceberMensal = billablePendingMonthlies(monthlies, records, clients, ym)
    .reduce((s, m) => s + Number(m.amount), 0);
  const aReceber = aReceberMensal + aReceberAvulso;
  const previstoBruto = recebido + aReceber;

  const mensalRecebida = sum(inMonth.filter((r) => r.type === "entrada" && r.status === "pago" && (r.category ?? "") === "Mensalidade"));
  const mensalidadesDoMes = mensalRecebida + aReceberMensal;
  const outrasReceitas = previstoBruto - mensalidadesDoMes;

  const mrr = clients.filter((c) => mensalidadeAtivaNoMes(c, ym)).reduce((s, c) => s + (Number(c.monthly_value) || 0), 0);

  return { recebido, aReceberMensal, aReceberAvulso, aReceber, previstoBruto, mensalRecebida, mensalidadesDoMes, outrasReceitas, mrr };
}
