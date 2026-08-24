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

export type TipoCampo = "texto" | "longo" | "email" | "tel" | "aniversario" | "tags";

export type CampoIntake = {
  /** A mesma chave que a ficha usa (coluna do cadastro ou campo do brandbook). */
  chave: string;
  label: string;
  ajuda?: string;
  tipo?: TipoCampo;
  /** Sugestões clicáveis (tipo "tags"). */
  opcoes?: string[];
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
    titulo: "Dados da empresa",
    descricao: "É o que a gente precisa pra emitir o contrato e a nota. Se você não souber algum, deixe em branco e a gente confere depois.",
    campos: [
      { chave: "company_name", label: "Razão social", ajuda: "O nome que está no CNPJ.", obrigatorio: true, largo: true },
      { chave: "cnpj", label: "CNPJ", ajuda: "Se você é pessoa física, pode colocar o CPF." },
      { chave: "instagram", label: "@ do Instagram" },
      { chave: "address", label: "Endereço completo", ajuda: "Rua, número, bairro, cidade, estado e CEP.", largo: true },
      { chave: "city", label: "Cidade" },
      { chave: "marketSince", label: "Há quanto tempo a empresa existe?", ajuda: "Ex.: 8 anos, desde 2018." },
    ],
  },
  {
    titulo: "Quem responde pela empresa",
    descricao: "A pessoa que assina o contrato e que a gente procura no dia a dia.",
    campos: [
      { chave: "owner_name", label: "Nome completo", obrigatorio: true, largo: true },
      { chave: "email", label: "E-mail", tipo: "email", obrigatorio: true },
      { chave: "whatsapp", label: "WhatsApp", tipo: "tel", obrigatorio: true },
      { chave: "phone", label: "Outro telefone", tipo: "tel" },
      { chave: "birthday", label: "Aniversário", ajuda: "Só o dia e o mês. A gente gosta de lembrar.", tipo: "aniversario" },
    ],
  },
  {
    titulo: "O que a empresa faz",
    descricao: "Fale como você falaria pra um amigo. Não precisa ficar bonito, a gente organiza depois.",
    campos: [
      { chave: "mainProducts", label: "Quais produtos ou serviços vocês oferecem?", tipo: "longo", obrigatorio: true, largo: true },
      { chave: "offer", label: "O que cada um resolve pro cliente? Algum precisa de destaque?", tipo: "longo", largo: true },
      { chave: "specialty", label: "No que vocês são realmente bons?", ajuda: "A especialidade técnica, o que vocês dominam.", tipo: "longo", largo: true },
      { chave: "valueProp", label: "Por que escolher vocês e não um concorrente?", tipo: "longo", largo: true },
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
      { chave: "pains", label: "Quais problemas ele quer resolver?", ajuda: "Um por linha.", tipo: "longo", largo: true },
      { chave: "desires", label: "O que ele quer conquistar ou sentir?", ajuda: "Um por linha.", tipo: "longo", largo: true },
      { chave: "doubts", label: "Quais dúvidas ele sempre traz antes de fechar?", ajuda: "Um por linha.", tipo: "longo", largo: true },
      { chave: "objections", label: "O que costuma fazer ele desistir?", ajuda: "Um por linha. Ex.: acha caro, não tem tempo, tem medo do resultado.", tipo: "longo", largo: true },
    ],
  },
  {
    titulo: "Como vocês querem soar",
    descricao: "Isso define o jeito de escrever de todo post daqui pra frente.",
    campos: [
      { chave: "toneOfVoice", label: "Que tom combina com a marca?", ajuda: "Pode marcar mais de um.", tipo: "tags", opcoes: TONS_INTAKE, largo: true },
      { chave: "archetype", label: "Se a marca fosse uma pessoa, como ela seria?", tipo: "longo", largo: true },
      { chave: "admiredBrands", label: "Que marcas vocês admiram na comunicação? Por quê?", tipo: "longo", largo: true },
      { chave: "avoid", label: "O que a marca nunca deve dizer ou fazer?", tipo: "longo", largo: true },
      { chave: "contentThemes", label: "Sobre o que vocês gostariam de falar nas redes?", tipo: "longo", largo: true },
      { chave: "colorPalette", label: "Vocês já têm cores e fontes definidas?", ajuda: "Se tiver os códigos das cores, cole aqui.", largo: true },
    ],
  },
];

export const TODOS_CAMPOS_INTAKE = ETAPAS_INTAKE.flatMap((e) => e.campos);

/** Chaves que viram COLUNA do cadastro (o resto vai pro brandbook/persona). */
export const CAMPOS_CADASTRO = new Set([
  "company_name", "cnpj", "owner_name", "email", "phone", "whatsapp",
  "address", "city", "instagram", "birthday",
]);

/** Faltou algum obrigatório? Devolve os rótulos, pra dizer qual é. */
export function faltandoObrigatorios(respostas: Record<string, string>): string[] {
  return TODOS_CAMPOS_INTAKE
    .filter((c) => c.obrigatorio && !(respostas[c.chave] || "").trim())
    .map((c) => c.label);
}

export function quantasRespondidas(respostas: Record<string, string>): number {
  return TODOS_CAMPOS_INTAKE.filter((c) => (respostas[c.chave] || "").trim()).length;
}
