// Período de fechamento de um terceiro (designer, editor, filmmaker...).
//
// Tudo em datas de calendário YYYY-MM-DD (fuso BR vem de fora, via hojeBR()).
// O que conta pra cair no período é a DATA DO LANÇAMENTO do cachê
// (fin_records.date), que é a data da entrega da peça no fuso BR, ou a data do
// serviço no lançamento avulso.
//
//   mensal / servico : 1 ao último dia do mês
//   quinzenal        : 1 a 15 e 16 ao último dia
//   dia15            : 16 do mês anterior a 15 do mês (fecha todo dia 15)

export type Fechamento = "servico" | "dia15" | "quinzenal" | "mensal";

export const ROTULO_FECHAMENTO: Record<Fechamento, string> = {
  servico: "Por serviço",
  dia15: "Todo dia 15",
  quinzenal: "Quinzenal (15 e fim do mês)",
  mensal: "Mensal (fim do mês)",
};

export type Periodo = { de: string; ate: string };

const pad = (n: number) => String(n).padStart(2, "0");
const ultimoDia = (y: number, m: number) => new Date(y, m, 0).getDate(); // m 1..12
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Normaliza (ano, mês) com mês fora de 1..12. */
function norm(y: number, m: number): [number, number] {
  const idx = y * 12 + (m - 1);
  return [Math.floor(idx / 12), (idx % 12 + 12) % 12 + 1];
}

/**
 * Período que contém `hoje` (offset 0) ou os anteriores/seguintes (offset -1, +1...).
 */
export function periodoDoFechamento(tipo: Fechamento, hoje: string, offset = 0): Periodo {
  const [y0, m0, d0] = hoje.split("-").map(Number);

  if (tipo === "quinzenal") {
    // índice de quinzena: 2 por mês
    const idx = (y0 * 12 + (m0 - 1)) * 2 + (d0 > 15 ? 1 : 0) + offset;
    const mesIdx = Math.floor(idx / 2);
    const y = Math.floor(mesIdx / 12);
    const m = (mesIdx % 12) + 1;
    return idx % 2 === 0
      ? { de: iso(y, m, 1), ate: iso(y, m, 15) }
      : { de: iso(y, m, 16), ate: iso(y, m, ultimoDia(y, m)) };
  }

  if (tipo === "dia15") {
    // Mês "de referência" = mês em que o período FECHA (dia 15).
    const [yr, mr] = norm(y0, m0 + (d0 > 15 ? 1 : 0) + offset);
    const [ya, ma] = norm(yr, mr - 1);
    return { de: iso(ya, ma, 16), ate: iso(yr, mr, 15) };
  }

  // mensal e por serviço: mês cheio
  const [y, m] = norm(y0, m0 + offset);
  return { de: iso(y, m, 1), ate: iso(y, m, ultimoDia(y, m)) };
}

/** "16/09 a 15/10" */
export function rotuloPeriodo(p: Periodo): string {
  const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  return `${dm(p.de)} a ${dm(p.ate)}`;
}

export const dentro = (data: string, p: Periodo) => data >= p.de && data <= p.ate;
