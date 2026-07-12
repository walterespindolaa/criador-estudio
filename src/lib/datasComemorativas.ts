// Datas comemorativas por SEGMENTO + feriados/datas gerais.
// A social media escolhe o(s) segmento(s) do cliente e marca as datas que quer trabalhar.
// "data móvel" = muda todo ano (Páscoa, Dia das Mães...) — mostramos o rótulo, não calculamos.

export type DataComemorativaItem = { label: string; day: string };
export type DataComemorativaGroup = { month: string; items: DataComemorativaItem[] };

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

export type SegmentKey =
  | "geral" | "gastronomia" | "fitness" | "financas" | "beleza"
  | "moda" | "pet" | "educacao" | "saude" | "imobiliario";

export const SEGMENTOS: { key: SegmentKey; label: string; emoji: string }[] = [
  { key: "geral", label: "Geral / feriados", emoji: "🇧🇷" },
  { key: "gastronomia", label: "Gastronomia", emoji: "🍔" },
  { key: "fitness", label: "Fitness", emoji: "💪" },
  { key: "financas", label: "Finanças", emoji: "💰" },
  { key: "beleza", label: "Beleza & estética", emoji: "💄" },
  { key: "moda", label: "Moda", emoji: "👗" },
  { key: "pet", label: "Pet", emoji: "🐶" },
  { key: "educacao", label: "Educação", emoji: "📚" },
  { key: "saude", label: "Saúde", emoji: "🩺" },
  { key: "imobiliario", label: "Imobiliário", emoji: "🏠" },
];

// ── GERAL: feriados nacionais + datas de apelo amplo ──
const GERAL: DataComemorativaGroup[] = [
  { month: "Janeiro", items: [
    { label: "Confraternização Universal (feriado)", day: "01/01" },
    { label: "Dia Mundial da Paz", day: "01/01" },
  ] },
  { month: "Fevereiro", items: [
    { label: "Carnaval (feriado)", day: "data móvel" },
    { label: "Dia dos Namorados (global)", day: "14/02" },
  ] },
  { month: "Março", items: [
    { label: "Dia Internacional da Mulher", day: "08/03" },
    { label: "Dia do Consumidor", day: "15/03" },
    { label: "Dia Mundial da Felicidade", day: "20/03" },
  ] },
  { month: "Abril", items: [
    { label: "Sexta-feira Santa (feriado)", day: "data móvel" },
    { label: "Páscoa", day: "data móvel" },
    { label: "Tiradentes (feriado)", day: "21/04" },
    { label: "Dia do Livro", day: "23/04" },
  ] },
  { month: "Maio", items: [
    { label: "Dia do Trabalhador (feriado)", day: "01/05" },
    { label: "Dia das Mães", day: "2º domingo" },
  ] },
  { month: "Junho", items: [
    { label: "Dia dos Namorados", day: "12/06" },
    { label: "Festa Junina / São João", day: "24/06" },
    { label: "Corpus Christi (feriado)", day: "data móvel" },
  ] },
  { month: "Julho", items: [
    { label: "Dia do Amigo", day: "20/07" },
    { label: "Férias escolares", day: "mês todo" },
  ] },
  { month: "Agosto", items: [
    { label: "Dia dos Pais", day: "2º domingo" },
    { label: "Dia do Estudante", day: "11/08" },
  ] },
  { month: "Setembro", items: [
    { label: "Independência do Brasil (feriado)", day: "07/09" },
    { label: "Dia do Cliente", day: "15/09" },
    { label: "Início da Primavera", day: "22/09" },
  ] },
  { month: "Outubro", items: [
    { label: "Dia das Crianças (feriado)", day: "12/10" },
    { label: "Nossa Senhora Aparecida (feriado)", day: "12/10" },
    { label: "Dia do Professor", day: "15/10" },
    { label: "Halloween", day: "31/10" },
  ] },
  { month: "Novembro", items: [
    { label: "Finados (feriado)", day: "02/11" },
    { label: "Proclamação da República (feriado)", day: "15/11" },
    { label: "Consciência Negra (feriado)", day: "20/11" },
    { label: "Black Friday", day: "última sexta" },
  ] },
  { month: "Dezembro", items: [
    { label: "Dia da Família", day: "08/12" },
    { label: "Natal (feriado)", day: "25/12" },
    { label: "Confraternizações de fim de ano", day: "mês todo" },
    { label: "Réveillon", day: "31/12" },
    { label: "Retrospectiva do ano", day: "mês todo" },
  ] },
];

const GASTRONOMIA: DataComemorativaGroup[] = [
  { month: "Janeiro", items: [
    { label: "Dia Mundial da Pizza", day: "10/01" },
    { label: "Dia Nacional do Café", day: "24/01" },
  ] },
  { month: "Março", items: [{ label: "Dia Nacional do Sorvete", day: "23/03" }] },
  { month: "Abril", items: [
    { label: "Dia do Fondue de Queijo", day: "11/04" },
    { label: "Dia Mundial do Café", day: "14/04" },
    { label: "Dia da Mandioca", day: "22/04" },
    { label: "Dia do Churrasco", day: "24/04" },
  ] },
  { month: "Maio", items: [
    { label: "Dia Mundial do Atum", day: "02/05" },
    { label: "Dia da Cozinheira", day: "10/05" },
    { label: "Dia Nacional do Chefe de Cozinha", day: "13/05" },
    { label: "Dia Mundial do Whisky", day: "3º sábado" },
    { label: "Dia Internacional do Chá", day: "21/05" },
    { label: "Dia Internacional do Hambúrguer", day: "28/05" },
    { label: "Dia Mundial da Batata Frita", day: "30/05" },
  ] },
  { month: "Junho", items: [
    { label: "Dia Mundial do Leite", day: "01/06" },
    { label: "Dia Mundial do Sushi", day: "18/06" },
  ] },
  { month: "Julho", items: [
    { label: "Dia Mundial do Chocolate", day: "07/07" },
    { label: "Dia Nacional da Pizza", day: "10/07" },
    { label: "Dia do Sorvete", day: "23/07" },
  ] },
  { month: "Agosto", items: [
    { label: "Dia Nacional do Café com Leite", day: "07/08" },
    { label: "Dia da Cerveja Artesanal", day: "1ª sexta" },
  ] },
  { month: "Setembro", items: [
    { label: "Dia Mundial do Chef", day: "10/09" },
    { label: "Dia do Sorveteiro", day: "23/09" },
  ] },
  { month: "Outubro", items: [
    { label: "Dia Mundial do Ovo", day: "2ª sexta" },
    { label: "Dia Mundial da Alimentação", day: "16/10" },
    { label: "Dia Nacional do Macarrão", day: "25/10" },
  ] },
  { month: "Novembro", items: [{ label: "Dia Mundial do Veganismo", day: "01/11" }] },
  { month: "Dezembro", items: [
    { label: "Dia do Profissional de Culinária", day: "09/12" },
    { label: "Ceia de Natal / encomendas", day: "mês todo" },
  ] },
];

const FITNESS: DataComemorativaGroup[] = [
  { month: "Janeiro", items: [
    { label: "Metas do ano / Projeto Verão", day: "mês todo" },
    { label: "Dia Mundial do Esporte", day: "06/01" },
  ] },
  { month: "Abril", items: [
    { label: "Dia Mundial da Atividade Física", day: "06/04" },
    { label: "Dia Mundial da Saúde", day: "07/04" },
  ] },
  { month: "Junho", items: [{ label: "Dia Mundial do Bem-Estar", day: "2º sábado" }] },
  { month: "Agosto", items: [
    { label: "Dia Nacional da Saúde", day: "05/08" },
    { label: "Dia dos Profissionais de Educação Física", day: "31/08" },
  ] },
  { month: "Setembro", items: [
    { label: "Dia do Profissional de Educação Física", day: "01/09" },
    { label: "Dia Mundial do Coração", day: "29/09" },
  ] },
  { month: "Novembro", items: [{ label: "Dia Mundial do Diabetes", day: "14/11" }] },
];

const FINANCAS: DataComemorativaGroup[] = [
  { month: "Janeiro", items: [
    { label: "Planejamento financeiro do ano", day: "mês todo" },
    { label: "IPVA / IPTU — organização", day: "mês todo" },
  ] },
  { month: "Março", items: [
    { label: "Início do prazo do Imposto de Renda", day: "15/03" },
    { label: "Dia do Consumidor", day: "15/03" },
  ] },
  { month: "Abril", items: [{ label: "Reta final do Imposto de Renda", day: "mês todo" }] },
  { month: "Maio", items: [{ label: "Prazo final do Imposto de Renda", day: "31/05" }] },
  { month: "Junho", items: [{ label: "Dia Nacional da Educação Financeira", day: "01/06" }] },
  { month: "Agosto", items: [{ label: "Dia do Economista", day: "13/08" }] },
  { month: "Setembro", items: [
    { label: "Semana Nacional de Educação Financeira", day: "mês todo" },
    { label: "Dia do Cliente", day: "15/09" },
  ] },
  { month: "Outubro", items: [{ label: "Dia Mundial da Poupança", day: "31/10" }] },
  { month: "Novembro", items: [
    { label: "Black Friday — consumo consciente", day: "última sexta" },
    { label: "13º salário — como usar", day: "mês todo" },
  ] },
  { month: "Dezembro", items: [{ label: "Balanço do ano / metas do próximo", day: "mês todo" }] },
];

const BELEZA: DataComemorativaGroup[] = [
  { month: "Janeiro", items: [{ label: "Janeiro Branco (saúde mental)", day: "mês todo" }] },
  { month: "Fevereiro", items: [{ label: "Pré-Carnaval — make e cabelo", day: "mês todo" }] },
  { month: "Março", items: [{ label: "Dia Internacional da Mulher", day: "08/03" }] },
  { month: "Abril", items: [{ label: "Dia Nacional do Cabeleireiro", day: "08/04" }] },
  { month: "Maio", items: [{ label: "Dia das Mães — autocuidado", day: "2º domingo" }] },
  { month: "Setembro", items: [{ label: "Dia Mundial da Beleza", day: "09/09" }] },
  { month: "Outubro", items: [{ label: "Outubro Rosa", day: "mês todo" }] },
  { month: "Novembro", items: [
    { label: "Novembro Azul", day: "mês todo" },
    { label: "Dia do Esteticista", day: "24/11" },
  ] },
  { month: "Dezembro", items: [{ label: "Beleza pras festas de fim de ano", day: "mês todo" }] },
];

const MODA: DataComemorativaGroup[] = [
  { month: "Janeiro", items: [{ label: "Liquidação de verão", day: "mês todo" }] },
  { month: "Março", items: [{ label: "Dia Internacional da Mulher", day: "08/03" }] },
  { month: "Abril", items: [{ label: "Fashion Revolution Week", day: "3ª semana" }] },
  { month: "Maio", items: [{ label: "Dia das Mães", day: "2º domingo" }] },
  { month: "Junho", items: [{ label: "Dia dos Namorados", day: "12/06" }] },
  { month: "Julho", items: [{ label: "Dia Nacional do Estilista", day: "18/07" }] },
  { month: "Agosto", items: [{ label: "Dia dos Pais", day: "2º domingo" }] },
  { month: "Setembro", items: [{ label: "Primavera — nova coleção", day: "22/09" }] },
  { month: "Outubro", items: [{ label: "Dia das Crianças", day: "12/10" }] },
  { month: "Novembro", items: [{ label: "Black Friday", day: "última sexta" }] },
  { month: "Dezembro", items: [{ label: "Presentes de Natal / looks de festa", day: "mês todo" }] },
];

const PET: DataComemorativaGroup[] = [
  { month: "Fevereiro", items: [{ label: "Dia Nacional do Gato", day: "17/02" }] },
  { month: "Março", items: [{ label: "Dia Nacional dos Animais", day: "14/03" }] },
  { month: "Agosto", items: [{ label: "Dia Mundial do Cachorro", day: "26/08" }] },
  { month: "Setembro", items: [{ label: "Dia do Médico Veterinário", day: "09/09" }] },
  { month: "Outubro", items: [{ label: "Dia Mundial dos Animais", day: "04/10" }] },
  { month: "Dezembro", items: [{ label: "Dia de Combate ao Abandono de Animais", day: "05/12" }] },
];

const EDUCACAO: DataComemorativaGroup[] = [
  { month: "Janeiro", items: [{ label: "Volta às aulas — matrículas", day: "mês todo" }] },
  { month: "Fevereiro", items: [{ label: "Início do ano letivo", day: "mês todo" }] },
  { month: "Abril", items: [{ label: "Dia do Livro", day: "23/04" }] },
  { month: "Agosto", items: [{ label: "Dia do Estudante", day: "11/08" }] },
  { month: "Setembro", items: [{ label: "Reta final ENEM / vestibulares", day: "mês todo" }] },
  { month: "Outubro", items: [{ label: "Dia do Professor", day: "15/10" }] },
  { month: "Novembro", items: [{ label: "ENEM", day: "1º e 2º domingo" }] },
];

const SAUDE: DataComemorativaGroup[] = [
  { month: "Janeiro", items: [{ label: "Janeiro Branco (saúde mental)", day: "mês todo" }] },
  { month: "Fevereiro", items: [{ label: "Fevereiro Laranja (leucemia)", day: "mês todo" }] },
  { month: "Março", items: [{ label: "Março Azul-Marinho (câncer colorretal)", day: "mês todo" }] },
  { month: "Abril", items: [
    { label: "Dia Mundial da Saúde", day: "07/04" },
    { label: "Abril Azul (autismo)", day: "mês todo" },
  ] },
  { month: "Maio", items: [{ label: "Maio Amarelo (trânsito)", day: "mês todo" }] },
  { month: "Julho", items: [{ label: "Julho Amarelo (hepatites)", day: "mês todo" }] },
  { month: "Agosto", items: [{ label: "Agosto Dourado (amamentação)", day: "mês todo" }] },
  { month: "Setembro", items: [{ label: "Setembro Amarelo (prevenção ao suicídio)", day: "mês todo" }] },
  { month: "Outubro", items: [{ label: "Outubro Rosa (câncer de mama)", day: "mês todo" }] },
  { month: "Novembro", items: [{ label: "Novembro Azul (câncer de próstata)", day: "mês todo" }] },
  { month: "Dezembro", items: [{ label: "Dezembro Vermelho (HIV/Aids)", day: "mês todo" }] },
];

const IMOBILIARIO: DataComemorativaGroup[] = [
  { month: "Janeiro", items: [{ label: "IPTU / planejamento da casa nova", day: "mês todo" }] },
  { month: "Maio", items: [{ label: "Dia das Mães — a casa dos sonhos", day: "2º domingo" }] },
  { month: "Agosto", items: [{ label: "Dia do Corretor de Imóveis", day: "27/08" }] },
  { month: "Dezembro", items: [
    { label: "Dia do Arquiteto", day: "15/12" },
    { label: "Planejamento de mudança pro ano novo", day: "mês todo" },
  ] },
];

export const DATAS_POR_SEGMENTO: Record<SegmentKey, DataComemorativaGroup[]> = {
  geral: GERAL,
  gastronomia: GASTRONOMIA,
  fitness: FITNESS,
  financas: FINANCAS,
  beleza: BELEZA,
  moda: MODA,
  pet: PET,
  educacao: EDUCACAO,
  saude: SAUDE,
  imobiliario: IMOBILIARIO,
};

// Junta os segmentos escolhidos numa lista única por mês, sem duplicar rótulos.
export function datasPara(segments: SegmentKey[]): DataComemorativaGroup[] {
  const porMes = new Map<string, Map<string, DataComemorativaItem>>();
  for (const seg of segments) {
    for (const g of DATAS_POR_SEGMENTO[seg] ?? []) {
      const m = porMes.get(g.month) ?? new Map<string, DataComemorativaItem>();
      for (const it of g.items) if (!m.has(it.label)) m.set(it.label, it);
      porMes.set(g.month, m);
    }
  }
  return MESES
    .filter((mes) => porMes.has(mes))
    .map((mes) => ({ month: mes, items: [...porMes.get(mes)!.values()] }));
}

// Adivinha o segmento a partir do texto livre do cadastro do cliente (campo "Segmento").
export function segmentoDoTexto(txt?: string | null): SegmentKey | null {
  const s = (txt ?? "").toLowerCase();
  if (!s) return null;
  if (/gastro|restaurante|pizza|burg|caf[eé]|food|bar|confeit|padar|doce|sorvet/.test(s)) return "gastronomia";
  if (/fit|academia|treino|personal|crossfit|pilates|muscula/.test(s)) return "fitness";
  if (/financ|investi|contab|econom|banco|cr[eé]dito|assessor/.test(s)) return "financas";
  if (/belez|est[eé]tic|sal[ãa]o|cabelo|make|maquiag|unha|spa/.test(s)) return "beleza";
  if (/moda|roupa|vestu|boutique|cal[çc]ad|joia/.test(s)) return "moda";
  if (/pet|veterin|animal|cachorro|gato/.test(s)) return "pet";
  if (/educa|escola|curso|ensino|professor|faculdade|vestibular/.test(s)) return "educacao";
  if (/sa[uú]de|cl[ií]nic|m[eé]dic|odonto|dentist|nutri|psic|fisioterap/.test(s)) return "saude";
  if (/im[oó]vel|imobili|corretor|arquitet|constru/.test(s)) return "imobiliario";
  return null;
}

// Compat: a lista padrão (geral + gastronomia) que existia antes.
export const DATAS_COMEMORATIVAS: DataComemorativaGroup[] = datasPara(["geral", "gastronomia"]);
