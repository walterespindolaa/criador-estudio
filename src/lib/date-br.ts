// Datas "de calendário" no fuso do Brasil (America/Sao_Paulo).
//
// Por que existe: `new Date().toISOString().split("T")[0]` devolve a data em UTC.
// Como o Brasil é UTC-3, das 21h à meia-noite o "hoje" em UTC já é o dia seguinte
// o que fazia lembretes, cronograma e tarefas aparecerem no dia errado à noite.
// Colunas como `scheduled_date`/`due_date` são DATE (dia de calendário local), então
// a comparação tem que ser feita no fuso BR, não em UTC.

const TZ = "America/Sao_Paulo";

// en-CA formata como YYYY-MM-DD. Funciona independente do fuso do navegador/servidor,
// sempre normalizando para o dia de calendário no Brasil.
const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data (YYYY-MM-DD) de um instante, no fuso do Brasil. */
export function toISODateBR(date: Date = new Date()): string {
  return fmt.format(date);
}

/** "Hoje" (YYYY-MM-DD) no fuso do Brasil. */
export function hojeBR(): string {
  return toISODateBR(new Date());
}

/**
 * Interpreta uma string YYYY-MM-DD como dia de calendário e devolve um Date à
 * meia-noite LOCAL (não UTC). Evita o off-by-one de `new Date("2026-03-01")`,
 * que o JS trata como meia-noite UTC (= 21h do dia anterior em BRT).
 */
export function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
