/* ═══════════════════════════════════════════════════════════════════════════
   DATAS QUE VÊM AÍ (28/10/2026, página Tendências e Cria Plano)

   Calendário fixo de datas comerciais e feriados do Brasil, calculado por ano
   (Páscoa, Carnaval, Mães, Pais e Black Friday mudam de dia). Não depende da
   curadoria: a faixa de datas e o "Próxima data" nunca ficam vazios.
   ═══════════════════════════════════════════════════════════════════════════ */

export type DataComercial = { iso: string; nome: string; dica: string; diasAte: number };

function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}
/** n-ésimo dia da semana (0=dom) do mês. */
function enesimo(ano: number, mes: number, diaSemana: number, n: number): Date {
  const d = new Date(ano, mes, 1);
  const desloc = (diaSemana - d.getDay() + 7) % 7;
  return new Date(ano, mes, 1 + desloc + (n - 1) * 7);
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const somaDias = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

function datasDoAno(ano: number): Array<{ d: Date; nome: string; dica: string }> {
  const p = pascoa(ano);
  const blackFriday = somaDias(enesimo(ano, 10, 4, 4), 1); // dia seguinte à 4ª quinta de novembro
  return [
    { d: new Date(ano, 0, 1), nome: "Ano Novo", dica: "Metas, retrospectiva e começo de ciclo" },
    { d: somaDias(p, -47), nome: "Carnaval", dica: "Feriado prolongado: conteúdo leve ou bastidor" },
    { d: new Date(ano, 2, 8), nome: "Dia da Mulher", dica: "Histórias reais, sem clichê de flor" },
    { d: new Date(ano, 2, 15), nome: "Dia do Consumidor", dica: "Promoção e prova social" },
    { d: p, nome: "Páscoa", dica: "Família, recomeço e presente" },
    { d: new Date(ano, 3, 21), nome: "Tiradentes", dica: "Feriado: agende antes" },
    { d: new Date(ano, 4, 1), nome: "Dia do Trabalho", dica: "Rotina e bastidor de quem trabalha" },
    { d: enesimo(ano, 4, 0, 2), nome: "Dia das Mães", dica: "Comece o aquecimento 3 semanas antes" },
    { d: new Date(ano, 5, 12), nome: "Dia dos Namorados", dica: "Presente, casal e humor" },
    { d: new Date(ano, 5, 24), nome: "São João", dica: "Festa junina e cultura regional" },
    { d: enesimo(ano, 7, 0, 2), nome: "Dia dos Pais", dica: "Aquecimento 2 semanas antes" },
    { d: new Date(ano, 8, 7), nome: "Independência", dica: "Feriado: agende antes" },
    { d: new Date(ano, 8, 15), nome: "Dia do Cliente", dica: "Agradecimento e oferta pra quem já compra" },
    { d: new Date(ano, 9, 12), nome: "Dia das Crianças", dica: "Nostalgia e presente" },
    { d: new Date(ano, 9, 31), nome: "Halloween", dica: "Trend de fantasia e humor" },
    { d: new Date(ano, 10, 2), nome: "Finados", dica: "Pausa ou conteúdo leve" },
    { d: new Date(ano, 10, 15), nome: "Proclamação da República", dica: "Feriado prolongado" },
    { d: new Date(ano, 10, 20), nome: "Consciência Negra", dica: "Feriado nacional: respeito e referência" },
    { d: blackFriday, nome: "Black Friday", dica: "Aquecimento com prova e bastidor antes da oferta" },
    { d: somaDias(blackFriday, 3), nome: "Cyber Monday", dica: "Última chamada da oferta" },
    { d: new Date(ano, 11, 25), nome: "Natal", dica: "Presente, retrospectiva e gratidão" },
    { d: new Date(ano, 11, 31), nome: "Réveillon", dica: "Retrospectiva do ano" },
  ];
}

export function proximasDatas(hoje = new Date(), quantas = 5): DataComercial[] {
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const todas = [...datasDoAno(base.getFullYear()), ...datasDoAno(base.getFullYear() + 1)]
    .filter((x) => x.d >= base)
    .sort((a, b) => a.d.getTime() - b.d.getTime());
  return todas.slice(0, quantas).map((x) => ({
    iso: ymd(x.d), nome: x.nome, dica: x.dica,
    diasAte: Math.round((x.d.getTime() - base.getTime()) / 86400000),
  }));
}

export function dataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
