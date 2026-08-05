// Situação REAL de um cliente da carteira (ativo x inativo), derivada na leitura.
//
// A regra do encerramento: o cliente é ativo ATÉ O DIA do encerramento,
// INCLUSIVE. Encerramento marcado pra uma data futura = contrato ainda
// vigente = ATIVO (mesmo que alguma tela antiga tenha gravado status
// "inativo" na hora de agendar). Encerramento no passado = INATIVO, mesmo
// que ninguém tenha lembrado de virar o status na mão: não existe robô pra
// isso, a leitura resolve sozinha na virada do dia.
// Sem data de encerramento: vale o status manual (e a flag booleana antiga).
//
// Use isto em TODA tela que decide "ativo ou inativo" (lista de clientes,
// filtro Ativos/Inativos, contagem da home, aniversários). O Caixa NÃO usa
// isto: lá a unidade é o MÊS e a regra já vive em mensalidadeAtivaNoMes
// (src/lib/finance.ts), que conta a mensalidade até o mês do encerramento.

import { hojeBR } from "@/lib/date-br";

export type ClienteStatusLike = {
  status?: string | null;
  active?: boolean | null;
  contract_end_date?: string | null;
};

/** Inativo DE VERDADE: com data de encerramento, a data manda (YYYY-MM-DD
 *  compara certo como string); sem data, vale o status manual. */
export function clienteInativo(c: ClienteStatusLike, hoje: string = hojeBR()): boolean {
  if (c.contract_end_date) return c.contract_end_date < hoje;
  return c.status === "inativo" || c.active === false;
}
