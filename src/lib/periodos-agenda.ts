// ── FAIXAS DE PERÍODO DA AGENDA (manhã / tarde / noite) ────────────────────────
// AS JANELAS MORAM SÓ AQUI. Se um dia a agência trabalhar em outro recorte
// (ex.: tarde começando 13h), muda-se este arquivo e a grade inteira acompanha:
// grade da semana, modal "Ver todos do dia" e o período derivado do horário.
//
// Recorte adotado (é o que a operação fala no dia a dia, e o que o Walter sugeriu):
//   manhã  = antes das 12:00
//   tarde  = das 12:00 até 17:59
//   noite  = das 18:00 em diante

export const CORTE_TARDE = "12:00";
export const CORTE_NOITE = "18:00";

// Período de verdade (o que fica gravado quando a pessoa distribui o item).
export type Periodo = "manha" | "tarde" | "noite";
// Faixa renderizada no dia. "sem" NÃO é período gravado: é o item que ainda não foi
// distribuído e não tem horário pra derivar um. Fica no topo da coluna, sem rótulo.
export type Faixa = Periodo | "sem";

// Ordem de renderização dentro do dia: primeiro o que não foi distribuído, depois o dia.
export const FAIXAS: readonly Faixa[] = ["sem", "manha", "tarde", "noite"] as const;
export const PERIODOS: readonly Periodo[] = ["manha", "tarde", "noite"] as const;

export const FAIXA_LABEL: Record<Faixa, string> = {
  sem: "Sem período",
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

// Rótulo curto pro cabeçalho da faixa dentro da coluna do dia (a coluna é estreita).
export const FAIXA_HINT: Record<Faixa, string> = {
  sem: "",
  manha: `até ${CORTE_TARDE}`,
  tarde: `${CORTE_TARDE} às ${CORTE_NOITE}`,
  noite: `a partir das ${CORTE_NOITE}`,
};

/** "HH:MM" (ou "HH:MM:SS") vira período. Sem horário, devolve null. */
export function periodoDoHorario(hora: string | null | undefined): Periodo | null {
  if (!hora) return null;
  const hhmm = hora.slice(0, 5);
  if (hhmm < CORTE_TARDE) return "manha";
  if (hhmm < CORTE_NOITE) return "tarde";
  return "noite";
}

/** Valida o que veio do banco (coluna livre de texto): só aceita os três períodos. */
export function isPeriodo(v: unknown): v is Periodo {
  return v === "manha" || v === "tarde" || v === "noite";
}

/**
 * Faixa final de um item da grade, na ordem de precedência:
 *  1) período GRAVADO (a pessoa arrastou o item pra faixa; vence sempre);
 *  2) período DERIVADO do horário, quando existe horário;
 *  3) "sem" (item sem horário e ainda não distribuído).
 *
 * É essa precedência que faz o recurso funcionar ANTES da migration rodar: sem a
 * tabela de períodos o passo 1 nunca acontece e tudo cai em 2/3, que é exatamente
 * o comportamento de hoje.
 */
export function faixaDoItem(periodoGravado: unknown, hora: string | null | undefined): Faixa {
  if (isPeriodo(periodoGravado)) return periodoGravado;
  return periodoDoHorario(hora) ?? "sem";
}
