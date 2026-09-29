/**
 * "2026-09-28" + "06:00:00" vira "28/09 às 06:00".
 *
 * POR QUE EXISTE (29/09/2026): os cards do Criando e da Aprovação mostravam a
 * data crua do banco ("2026-09-28 às 06:00:00"). Apareceu nos prints do
 * manual do criador e ninguém lê data assim no Brasil. A conta é feita na
 * string, sem Date, pra não escorregar um dia por causa do fuso.
 */
export function dataHoraCurta(data?: string | null, hora?: string | null): string {
  if (!data) return "";
  const [, m, d] = data.slice(0, 10).split("-");
  const dia = d && m ? `${d}/${m}` : data;
  const h = hora && /^\d{1,2}:\d{2}/.test(hora) ? hora.slice(0, 5) : "";
  return h ? `${dia} às ${h}` : dia;
}
