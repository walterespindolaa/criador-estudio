/* ═══════════════════════════════════════════════════════════════════════════
   O FORMULÁRIO QUE O CLIENTE PREENCHE

   Uma fonte só pras três pontas: a página pública que o cliente abre, o painel
   onde a social mídia confere o que voltou, e o mapa de onde cada resposta cai
   na ficha. Se as três listas fossem separadas, na primeira alteração uma
   pergunta passaria a existir num lugar e não no outro.

   O QUE ENTRA AQUI: o que só o cliente sabe (CNPJ, endereço, responsável
   legal) e o que ele responde melhor que ninguém (o que vende, pra quem, como
   quer soar).
   O QUE NÃO ENTRA: valor mensal, dia de vencimento, multa, duração do
   contrato. Isso é decisão comercial da agência, e perguntar isso ao cliente
   inverte quem conduz a negociação.
   ═══════════════════════════════════════════════════════════════════════════ */

export type TipoCampo = "texto" | "longo" | "email" | "tel" | "aniversario" | "dia" | "tags" | "escolha";

export type CampoIntake = {
  /** A mesma chave que a ficha usa (coluna do cadastro ou campo do brandbook). */
  chave: string;
  label: string;
  ajuda?: string;
  tipo?: TipoCampo;
  /** Sugestões clicáveis (tipo "tags") ou alternativas (tipo "escolha"). */
  opcoes?: string[];
  /** Só aparece quando a resposta de outro campo bate. */
  soSe?: { chave: string; valor: string };
  /** Texto de exemplo dentro do campo (vira placeholder). */
  exemplo?: string;
  obrigatorio?: boolean;
  /** Ocupa a linha inteira no desktop. */
  largo?: boolean;
};

export type EtapaIntake = { titulo: string; descricao: string; campos: CampoIntake[] };

export const TONS_INTAKE = [
  "Formal", "Informal", "Emocional", "Racional", "Otimista e positivo",
  "Sério e objetivo", "Divertido", "Acolhedor", "Provocativo", "Técnico",
];

export const ETAPAS_INTAKE: EtapaIntake[] = [
  {
    titulo: "Dados pro contrato",
    descricao: "É o que a gente precisa pra emitir o contrato e a nota. Se você não souber algum, deixe em branco e a gente confere depois.",
    campos: [
      { chave: "contract_type", label: "O contrato vai ser em nome de quem?", tipo: "escolha",
        opcoes: ["Pessoa física", "Empresa (CNPJ)"], obrigatorio: true, largo: true },
      { chave: "company_name", label: "Nome completo", ajuda: "Como está no seu documento.",
        obrigatorio: true, largo: true, soSe: { chave: "contract_type", valor: "Pessoa física" } },
      { chave: "cnpj", label: "CPF", soSe: { chave: "contract_type", valor: "Pessoa física" } },
      { chave: "company_name", label: "Razão social", ajuda: "O nome que está no CNPJ.",
        obrigatorio: true, largo: true, soSe: { chave: "contract_type", valor: "Empresa (CNPJ)" } },
      { chave: "cnpj", label: "CNPJ", soSe: { chave: "contract_type", valor: "Empresa (CNPJ)" } },
      { chave: "instagram", label: "@ do Instagram" },
      { chave: "address", label: "Endereço completo", ajuda: "Rua, número, bairro, cidade, estado e CEP.", largo: true },
      { chave: "city", label: "Cidade" },
      // A forma de pagamento saiu do formulário (pedido do Walter, 01/09):
      // é assunto da negociação, não do cadastro. O dia do vencimento fica,
      // porque é o que alimenta a mensalidade no Caixa.
      { chave: "payment_day", label: "Que dia do mês fica melhor pro pagamento?",
        ajuda: "Escolha o dia que combina com o seu caixa.", tipo: "dia" },
      { chave: "marketSince", label: "Há quanto tempo você atua nesse mercado?", ajuda: "Ex.: 8 anos, desde 2018." },
      { chave: "birthday", label: "Seu aniversário", ajuda: "Só o dia e o mês. A gente gosta de lembrar.",
        tipo: "aniversario", soSe: { chave: "contract_type", valor: "Pessoa física" } },
      { chave: "birthday", label: "Aniversário da empresa", ajuda: "O dia e o mês em que ela foi fundada. Vira conteúdo todo ano.",
        tipo: "aniversario", soSe: { chave: "contract_type", valor: "Empresa (CNPJ)" } },
    ],
  },
  {
    titulo: "Contato",
    descricao: "Como a gente fala com você no dia a dia.",
    campos: [
      { chave: "owner_name", label: "Quem assina pela empresa", ajuda: "Nome completo de quem responde legalmente.",
        obrigatorio: true, largo: true, soSe: { chave: "contract_type", valor: "Empresa (CNPJ)" } },
      { chave: "email", label: "E-mail", tipo: "email", obrigatorio: true },
      { chave: "whatsapp", label: "WhatsApp", tipo: "tel", obrigatorio: true },
      { chave: "phone", label: "Outro telefone", tipo: "tel" },
    ],
  },
  {
    titulo: "O que vocês fazem e o que esperam",
    descricao: "Fale como você falaria pra um amigo. Não precisa ficar bonito, a gente organiza depois.",
    campos: [
      { chave: "mainProducts", label: "Quais produtos ou serviços vocês oferecem?", tipo: "longo", obrigatorio: true, largo: true },
      { chave: "offer", label: "O que cada um resolve pro cliente? Algum precisa de destaque?", tipo: "longo", largo: true },
      { chave: "specialty", label: "No que vocês são realmente bons?", ajuda: "A especialidade técnica, o que vocês dominam.", tipo: "longo", largo: true },
      { chave: "valueProp", label: "Por que escolher vocês e não um concorrente?", tipo: "longo", largo: true },
      { chave: "mainGoal", label: "Qual é o principal objetivo de contratar uma social mídia hoje?",
        ajuda: "Ex.: passar autoridade, transformar conhecimento em conteúdo, gerar mais oportunidades.",
        tipo: "longo", largo: true },
      { chave: "avoid", label: "O que você não quer transmitir na comunicação?",
        ajuda: "Vale citar tom, assunto ou qualquer coisa que não combina com a marca.",
        tipo: "longo", largo: true },
      { chave: "perception6m", label: "Como você gostaria que a marca fosse percebida daqui a 6 ou 12 meses?",
        tipo: "longo", largo: true },
      { chave: "successMetric", label: "Como você vai saber que o conteúdo está funcionando?",
        ajuda: "Ex.: mais vendas, marca mais forte, virar referência no assunto.",
        tipo: "longo", largo: true },
    ],
  },
  {
    titulo: "A história e o propósito",
    descricao: "É daqui que sai o conteúdo que ninguém consegue copiar.",
    campos: [
      { chave: "history", label: "Como e por que a empresa nasceu?", tipo: "longo", largo: true },
      { chave: "brandValues", label: "Quais valores vocês não abrem mão?", tipo: "longo", largo: true },
      { chave: "impact", label: "Que transformação vocês querem gerar na vida do cliente?", tipo: "longo", largo: true },
      { chave: "vision", label: "Onde vocês querem chegar nos próximos anos?", tipo: "longo", largo: true },
    ],
  },
  {
    titulo: "Pra quem vocês vendem",
    descricao: "Quanto mais específico, melhor o conteúdo. Pense num cliente real que você atendeu essa semana.",
    campos: [
      { chave: "audience", label: "Quem é o cliente ideal de vocês?", ajuda: "Idade, momento de vida, o que faz.", tipo: "longo", obrigatorio: true, largo: true },
      { chave: "pains", label: "Quais problemas ele quer resolver?", tipo: "longo", largo: true,
        exemplo: "Ex.:\nnão consegue tempo pra cuidar de si\ntem medo de ficar com aparência artificial" },
      { chave: "desires", label: "O que ele quer conquistar ou sentir?", tipo: "longo", largo: true,
        exemplo: "Ex.:\nse olhar no espelho e gostar do que vê\nse sentir mais confiante nas fotos" },
      { chave: "doubts", label: "Quais dúvidas ele sempre traz antes de fechar?", tipo: "longo", largo: true,
        exemplo: "Ex.:\ndói?\nquanto tempo dura o resultado?" },
      { chave: "objections", label: "O que costuma fazer ele desistir?", tipo: "longo", largo: true,
        exemplo: "Ex.:\nacha caro\nnão tem tempo\ntem medo de não gostar do resultado" },
    ],
  },
  {
    titulo: "Como vocês querem soar",
    descricao: "Isso define o jeito de escrever de todo post daqui pra frente.",
    campos: [
      { chave: "toneOfVoice", label: "Que tom combina com a marca?", ajuda: "Pode marcar mais de um.", tipo: "tags", opcoes: TONS_INTAKE, largo: true },
      { chave: "archetype", label: "Se a marca fosse uma pessoa, como ela seria?", tipo: "longo", largo: true },
      { chave: "admiredBrands", label: "Que marcas vocês admiram na comunicação? Por quê?", tipo: "longo", largo: true },
      { chave: "contentThemes", label: "Sobre o que vocês gostariam de falar nas redes?", tipo: "longo", largo: true },
      { chave: "colorPalette", label: "Vocês já têm cores e fontes definidas?", ajuda: "Se tiver os códigos das cores, cole aqui.", largo: true },
    ],
  },
];

export const TODOS_CAMPOS_INTAKE = ETAPAS_INTAKE.flatMap((e) => e.campos);

/* ── QUAIS ETAPAS ESTE ENVIO LEVA ──
   `steps` guarda os índices escolhidos na hora de gerar o link. Vazio ou null
   significa TODAS: é o que vale pros links criados antes disso existir, e é o
   padrão de quem não quiser escolher nada. */
export function etapasDoEnvio(steps?: number[] | null): EtapaIntake[] {
  if (!steps || steps.length === 0) return ETAPAS_INTAKE;
  const escolhidas = steps
    .filter((i) => i >= 0 && i < ETAPAS_INTAKE.length)
    .sort((a, b) => a - b);
  return escolhidas.length ? escolhidas.map((i) => ETAPAS_INTAKE[i]) : ETAPAS_INTAKE;
}

/** Presets pra não obrigar ninguém a marcar caixinha uma a uma. */
export const ATALHOS_ETAPAS: { nome: string; steps: number[]; explica: string }[] = [
  { nome: "Tudo", steps: [0, 1, 2, 3, 4, 5], explica: "cadastro completo e briefing de marca" },
  { nome: "Só o cadastro", steps: [0, 1], explica: "dados do contrato e contato" },
  { nome: "Só o briefing", steps: [2, 3, 4, 5], explica: "marca, público e tom de voz" },
];

/** Chaves que viram COLUNA do cadastro (o resto vai pro brandbook/persona). */
export const CAMPOS_CADASTRO = new Set([
  // contract_type não é coluna: ele só decide quais campos aparecem e vai pro
  // brandbook como referência na hora de escrever o contrato.
  "company_name", "cnpj", "owner_name", "email", "phone", "whatsapp",
  "address", "city", "instagram", "birthday", "payment_method", "payment_day",
]);

/** O campo está visível pra estas respostas? (o `soSe` é o que esconde o resto) */
export function campoVisivel(c: CampoIntake, respostas: Record<string, string>): boolean {
  if (!c.soSe) return true;
  return (respostas[c.soSe.chave] || "").trim() === c.soSe.valor;
}

/** Faltou algum obrigatório VISÍVEL? Campo escondido não pode travar o envio.
 *  Só cobra o que está NAS ETAPAS DESTE ENVIO: exigir resposta de uma etapa que
 *  a pessoa nem viu é o jeito mais rápido de deixar o formulário travado. */
export function faltandoObrigatorios(respostas: Record<string, string>, steps?: number[] | null): string[] {
  return etapasDoEnvio(steps).flatMap((e) => e.campos)
    .filter((c) => c.obrigatorio && campoVisivel(c, respostas) && !(respostas[c.chave] || "").trim())
    .map((c) => c.label);
}

function camposVistos(respostas: Record<string, string>, steps?: number[] | null): CampoIntake[] {
  const vistas = new Set<string>();
  return etapasDoEnvio(steps).flatMap((e) => e.campos).filter((c) => {
    if (!campoVisivel(c, respostas) || vistas.has(c.chave)) return false;
    vistas.add(c.chave);
    return true;
  });
}

export function quantasRespondidas(respostas: Record<string, string>, steps?: number[] | null): number {
  return camposVistos(respostas, steps).filter((c) => (respostas[c.chave] || "").trim()).length;
}

/** Quantos campos a pessoa vai ver de fato (PF e PJ não somam juntos). */
export function totalVisivel(respostas: Record<string, string>, steps?: number[] | null): number {
  return camposVistos(respostas, steps).length;
}
