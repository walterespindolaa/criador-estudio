// Ordenação por DATA dos quadros (kanban), em um lugar só.
//
// Regra única, valendo pra todos os boards: data crescente (o que vence antes
// aparece primeiro) e card SEM DATA sempre no fim da coluna.
//
// "Sem data" é um balde só: null, undefined, string vazia ou só com espaços,
// texto que não é data e data que nem existe no calendário (31/02). Tudo isso
// cai no fim, mantendo entre si a ordem em que já estava.
//
// A comparação é LEXICOGRÁFICA sobre YYYY-MM-DD (e HH:MM). Não passa por
// `new Date(...)` em momento nenhum, então não existe conversão de fuso nem
// off-by-one (mesmo motivo do src/lib/date-br.ts).

/**
 * Normaliza um valor de data pra chave comparável "YYYY-MM-DD".
 * Aceita tanto DATE ("2026-08-02") quanto timestamp ISO ("2026-08-02T12:00:00Z").
 * Devolve null quando o valor não é uma data utilizável.
 */
export function chaveData(valor?: string | null): string | null {
  if (!valor) return null;
  const s = String(valor).trim();
  if (s.length < 10) return null;
  const dia = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
  const [y, m, d] = dia.split("-").map(Number);
  // Data que não existe no calendário (2026-02-31, mês 13...) conta como "sem data".
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dia;
}

/**
 * Normaliza um horário pra chave comparável "HH:MM". Devolve "" quando não há
 * horário, e "" ordena ANTES de qualquer hora: dentro do mesmo dia, o card sem
 * horário definido vem primeiro (mesma convenção da Agenda).
 */
export function chaveHora(valor?: string | null): string {
  if (!valor) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(String(valor).trim());
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return "";
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/**
 * Devolve uma NOVA lista ordenada por data crescente, com os itens sem data no
 * fim. Nunca altera o array recebido.
 *
 * @param itens   lista da coluna
 * @param getData de onde sai a data do item (scheduled_date, due_date, deadline...)
 * @param getHora opcional: desempata dois cards do mesmo dia pelo horário
 */
export function ordenarPorData<T>(
  itens: T[],
  getData: (item: T) => string | null | undefined,
  getHora?: (item: T) => string | null | undefined,
): T[] {
  return itens
    .map((item, i) => ({
      item,
      i,
      dia: chaveData(getData(item)),
      hora: getHora ? chaveHora(getHora(item)) : "",
    }))
    .sort((a, b) => {
      if (a.dia && b.dia) {
        if (a.dia !== b.dia) return a.dia < b.dia ? -1 : 1;
        if (a.hora !== b.hora) return a.hora < b.hora ? -1 : 1;
        return a.i - b.i; // empate total: mantém a ordem original (estável)
      }
      if (a.dia) return -1; // quem tem data vem antes de quem não tem
      if (b.dia) return 1;
      return a.i - b.i; // os dois sem data: preserva a ordem que já estava
    })
    .map((x) => x.item);
}
