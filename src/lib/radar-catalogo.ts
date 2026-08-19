import type { ScrapeType } from "@/hooks/useHubCria";

/* ═══════════════════════════════════════════════════════════════════════════
   O CATÁLOGO DO CRIA RADAR

   Antes o módulo tinha OITO caixinhas de seleção e uma frase de 12 palavras em
   cada. A pessoa marcava três, aparecia um formulário genérico com todos os
   campos possíveis, e ela não sabia:
     · o que ia receber de volta,
     · quanto tempo ia esperar,
     · o que ela precisava ter em mãos,
     · nem por que aquela pesquisa serviria pro cliente dela.

   Aqui cada pesquisa é uma coisa só, com PERGUNTA própria, formulário próprio e
   promessa de entrega escrita. A tela não decide nada: ela lê este arquivo.

   Mexeu no custo em créditos? Tem que mexer também em CREDITOS_POR_TIPO
   (src/hooks/useHubCria.ts) e no CREDITOS da edge apify-scrape. As três precisam
   contar a mesma história.
   ═══════════════════════════════════════════════════════════════════════════ */

export type CampoId = "handle" | "url" | "hashtag" | "limit" | "since" | "reelLinks";

export type CampoRadar = {
  id: CampoId;
  /** A pergunta que aparece no formulário. Sempre em forma de pergunta. */
  label: string;
  ajuda?: string;
  placeholder?: string;
  tipo: "texto" | "numero" | "data" | "lista";
  obrigatorio: boolean;
  min?: number;
  max?: number;
  padrao?: number;
  /**
   * Esconde este campo quando OUTRO campo já tem valor. Caso real: na
   * transcrição, com links de reels colados a quantidade é ignorada, então
   * perguntá-la ("Quantos reels recentes?") só confundia. Some da tela.
   */
  ocultarSeTemValor?: CampoId;
};

export type GrupoRadar = "conteudo" | "publico" | "mercado";

export type PesquisaDef = {
  key: ScrapeType;
  grupo: GrupoRadar;
  /** Nome curto, do jeito que a social mídia falaria. */
  nome: string;
  /** A pergunta que ESTA pesquisa responde. É o que decide a escolha. */
  pergunta: string;
  /** O que a pessoa recebe. Concreto, item por item. */
  entrega: string[];
  /** O que ela precisa ter em mãos antes de clicar. */
  precisa: string;
  /** A limitação honesta. Botão que falha calado destrói a confiança no módulo. */
  limite?: string;
  /** Quanto costuma demorar. */
  tempo: string;
  creditos: number;
  /** Um caso de uso real, pra pessoa reconhecer a situação dela. */
  exemplo: string;
  /** Gera pautas automáticas no fim? (perfil não gera) */
  geraPautas: boolean;
  campos: CampoRadar[];
  /**
   * Quando a pesquisa aceita CAMINHOS alternativos de entrada (a transcrição
   * aceita o @ ou os links dos reels), a validação exige um dos dois, não os
   * dois. Sem isso a tela pedia o @ mesmo com 5 links colados.
   */
  exigeUmDe?: CampoId[];
};

const campoHandle = (label: string, ajuda?: string): CampoRadar => ({
  id: "handle",
  label,
  ajuda,
  placeholder: "@concorrente",
  tipo: "texto",
  obrigatorio: true,
});

const campoQuantos = (label: string, ajuda?: string): CampoRadar => ({
  id: "limit",
  label,
  ajuda,
  tipo: "numero",
  obrigatorio: false,
  min: 1,
  max: 20,
  padrao: 10,
});

const campoDesde: CampoRadar = {
  id: "since",
  label: "Quer olhar só a partir de uma data?",
  ajuda: "Deixe em branco pra pegar os mais recentes, sem corte de período.",
  tipo: "data",
  obrigatorio: false,
};

export const PESQUISAS: PesquisaDef[] = [
  {
    key: "posts",
    grupo: "conteudo",
    nome: "Posts do feed",
    pergunta: "O que esse perfil publica e o que o público dele curte de verdade?",
    entrega: [
      "Os posts que mais engajaram, do maior pro menor",
      "Capa, legenda inteira, curtidas e comentários de cada um",
      "Qual formato ele mais usa (reels, carrossel ou foto)",
      "Pautas prontas tiradas do que funcionou",
    ],
    precisa: "O @ do perfil (público).",
    limite: "Perfil privado não pode ser lido: o Instagram não entrega nada de fora.",
    tempo: "20 segundos a 1 minuto",
    creditos: 1,
    exemplo: "A clínica concorrente cresceu e você quer saber qual assunto puxou.",
    geraPautas: true,
    campos: [
      campoHandle("De qual perfil?"),
      campoQuantos("Quantos posts recentes?", "Entre 1 e 20. Dez já mostra o padrão."),
      campoDesde,
    ],
  },
  {
    key: "reels",
    grupo: "conteudo",
    nome: "Reels",
    pergunta: "Quais vídeos desse perfil realmente rodaram?",
    entrega: [
      "Só os reels, ordenados pelo que mais rodou",
      "Views, curtidas, comentários e a capa de cada um",
      "A legenda completa, pra você ver o gancho escrito",
      "Pautas prontas tiradas dos que performaram",
    ],
    precisa: "O @ do perfil (público).",
    limite: "Se o perfil quase não posta reels, a leitura volta curta.",
    tempo: "20 segundos a 1 minuto",
    creditos: 1,
    exemplo: "Seu cliente vai começar a postar reels e você precisa de referência do nicho.",
    geraPautas: true,
    campos: [
      campoHandle("De qual perfil?"),
      campoQuantos("Quantos reels recentes?", "Entre 1 e 20."),
      campoDesde,
    ],
  },
  {
    key: "transcription",
    grupo: "conteudo",
    nome: "Reels com o roteiro transcrito",
    pergunta: "O que exatamente é falado no reel que bombou?",
    entrega: [
      "O áudio do reel virado em texto, do início ao fim",
      "Um resumo em uma frase, pra decidir se vale ler tudo",
      "O gancho dos primeiros segundos, que é onde a retenção se ganha",
      "Botão de copiar o roteiro, pra adaptar pro seu cliente",
    ],
    precisa: "O @ do perfil ou os links dos reels que você quer transcrever.",
    limite: "É a pesquisa mais cara e a mais demorada. Reel sem fala (só música) volta vazio.",
    tempo: "1 a 3 minutos",
    creditos: 3,
    exemplo: "Achou um reel de 400 mil views no nicho e quer entender a estrutura da fala.",
    geraPautas: true,
    exigeUmDe: ["handle", "reelLinks"],
    campos: [
      { ...campoHandle("De qual perfil?", "Ou cole os links ali embaixo e deixe este campo vazio."), obrigatorio: false },
      {
        id: "reelLinks",
        label: "Ou cole os links dos reels",
        ajuda: "Um por linha. Com links, o CRIA transcreve exatamente esses e ignora a quantidade.",
        placeholder: "https://instagram.com/reel/...",
        tipo: "lista",
        obrigatorio: false,
      },
      // Só faz sentido no caminho do @ (pegar os N mais recentes do perfil).
      // Com links colados o campo some, porque a quantidade é ignorada.
      { ...campoQuantos("Quantos reels recentes do perfil?", "Cada reel a mais é mais tempo de espera."), ocultarSeTemValor: "reelLinks" },
    ],
  },
  {
    key: "comments",
    grupo: "publico",
    nome: "Comentários de um post",
    pergunta: "O que o público está perguntando e reclamando embaixo desse post?",
    entrega: [
      "Os comentários mais curtidos do post, em ordem",
      "As dúvidas que se repetem, que são pauta pronta",
      "As objeções, que são o roteiro do seu próximo conteúdo de venda",
    ],
    precisa: "O link (URL) de um post específico, não o @ do perfil.",
    limite: "Post com comentários desativados volta vazio.",
    tempo: "20 a 40 segundos",
    creditos: 1,
    exemplo: "Um post do concorrente encheu de pergunta. Cada pergunta dessas é um reel do seu cliente.",
    geraPautas: true,
    campos: [
      {
        id: "url",
        label: "Qual é o link do post?",
        ajuda: "Abra o post no Instagram e copie o endereço da barra do navegador.",
        placeholder: "https://instagram.com/p/...",
        tipo: "texto",
        obrigatorio: true,
      },
    ],
  },
  {
    key: "hashtag",
    grupo: "publico",
    nome: "Hashtag do nicho",
    pergunta: "O que está bombando nessa hashtag agora?",
    entrega: [
      "Os posts com mais engajamento dentro da hashtag",
      "De quais perfis eles são (bons candidatos a entrar no seu radar)",
      "O tipo de conteúdo que está ganhando ali",
      "Pautas prontas tiradas do que apareceu",
    ],
    precisa: "Uma hashtag, sem o #.",
    limite: "Hashtag muito genérica traz ruído. Prefira as específicas do nicho e da cidade.",
    tempo: "30 segundos a 1 minuto",
    creditos: 1,
    exemplo: "Cliente novo, nicho que você ainda não domina: a hashtag mostra o terreno em 1 minuto.",
    geraPautas: true,
    campos: [
      {
        id: "hashtag",
        label: "Qual hashtag?",
        ajuda: "Sem o #. Uma por vez.",
        placeholder: "harmonizacaofacial",
        tipo: "texto",
        obrigatorio: true,
      },
      campoQuantos("Quantos posts da hashtag?"),
      campoDesde,
    ],
  },
  {
    key: "mentions",
    grupo: "publico",
    nome: "Quem marca esse perfil",
    pergunta: "Quem está falando desse perfil e postando com ele?",
    entrega: [
      "Os posts em que o @ aparece marcado",
      "Clientes reais mostrando o resultado (isso é prova social de graça)",
      "Parceiros e permutas que já rolam no nicho",
    ],
    precisa: "O @ do perfil (público).",
    limite: "Perfil pequeno costuma ter poucas menções: a leitura volta curta.",
    tempo: "30 segundos a 1 minuto",
    creditos: 1,
    exemplo: "Você quer montar um mural de prova social do seu cliente e não sabe quem já postou com ele.",
    geraPautas: true,
    campos: [
      campoHandle("De qual perfil?"),
      campoQuantos("Quantas menções?"),
      campoDesde,
    ],
  },
  {
    key: "ads",
    grupo: "mercado",
    nome: "Anúncios que ele paga (Meta)",
    pergunta: "Onde esse concorrente está colocando dinheiro?",
    entrega: [
      "Os anúncios ATIVOS da página, com o criativo",
      "O texto, o título e o botão (CTA) de cada um",
      "Desde quando cada anúncio está no ar (quanto mais tempo, mais ele converte)",
      "Pra onde o anúncio leva: site, WhatsApp ou direct",
    ],
    precisa: "O @ ou o nome da página no Facebook.",
    limite: "Só encontra quem tem página na Biblioteca de Anúncios da Meta. Se não achar, o crédito volta.",
    tempo: "40 segundos a 2 minutos",
    creditos: 2,
    exemplo: "Anúncio no ar há 6 meses é oferta validada. Você não precisa adivinhar o que converte no nicho.",
    geraPautas: true,
    campos: [
      campoHandle("Qual é a página?", "Pode ser o @ do Instagram ou o nome da empresa."),
      campoQuantos("Quantos anúncios?"),
    ],
  },
  {
    key: "profile",
    grupo: "mercado",
    nome: "Raio-x do perfil",
    pergunta: "Quem é esse perfil em números?",
    entrega: [
      "Seguidores, seguindo e total de publicações",
      "A bio inteira e o link da bio",
      "Categoria e se é conta comercial ou verificada",
    ],
    precisa: "O @ do perfil (público).",
    limite: "Esta é a única que NÃO gera pautas. Ela é foto do momento, pra comparar tamanho de player.",
    tempo: "10 a 30 segundos",
    creditos: 1,
    exemplo: "Montando a aba Concorrência da ficha do cliente e precisa do porte de cada player.",
    geraPautas: false,
    campos: [campoHandle("De qual perfil?")],
  },
];

export const GRUPOS: { id: GrupoRadar; nome: string; frase: string }[] = [
  { id: "conteudo", nome: "O que ele posta", frase: "Pra você entender o formato e o gancho que funcionam no nicho." },
  { id: "publico", nome: "O que o público quer", frase: "Pra tirar pauta da boca de quem compra, não do seu achismo." },
  { id: "mercado", nome: "Onde entra dinheiro", frase: "O que o concorrente PAGA pra promover já foi testado por ele." },
];

export const PESQUISA_POR_TIPO: Record<string, PesquisaDef> = Object.fromEntries(
  PESQUISAS.map((p) => [p.key, p]),
);

/* ═══════════════════════════════════════════════════════════════════════════
   O QUE PESQUISAR, DEPENDENDO DO NICHO DO CLIENTE

   A tela em branco é o real motivo de o módulo não ser usado: a pessoa abre,
   vê oito opções e não sabe por onde começar NAQUELE cliente. Aqui o segmento
   escrito na ficha (campo livre) vira um roteiro de 3 ou 4 leituras, na ordem,
   com hashtags do nicho já sugeridas.

   O casamento é por palavra-chave porque `crm_clients.segment` é texto livre:
   a pessoa escreve "clínica de estética" ou "harmonização facial", e as duas
   precisam cair no mesmo lugar.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PassoSugerido = {
  tipo: ScrapeType;
  titulo: string;
  motivo: string;
  /** Preenche o campo do formulário automaticamente (hashtag sugerida). */
  valor?: string;
};

export type SugestaoNicho = {
  id: string;
  nome: string;
  chaves: string[];
  frase: string;
  hashtags: string[];
  passos: PassoSugerido[];
};

const PASSO_CONCORRENTE: PassoSugerido = {
  tipo: "posts",
  titulo: "Leia o feed do concorrente mais forte",
  motivo: "É o retrato mais rápido do que já funciona no nicho, sem achismo.",
};

export const NICHOS: SugestaoNicho[] = [
  {
    id: "estetica",
    nome: "Estética e beleza",
    chaves: ["estetic", "beleza", "harmoniza", "botox", "sobrancelh", "cabelo", "salão", "salao", "cilios", "cílios", "unha", "spa", "depila", "micropigment"],
    frase: "Nicho de resultado visível: o antes e depois manda, e a objeção é sempre preço e dor.",
    hashtags: ["harmonizacaofacial", "esteticaavancada", "antesedepois", "protocoloestetico"],
    passos: [
      PASSO_CONCORRENTE,
      { tipo: "comments", titulo: "Leia os comentários de um antes e depois que bombou", motivo: "É onde aparecem as perguntas de dor, preço e tempo de recuperação. Cada uma vira um reel." },
      { tipo: "hashtag", titulo: "Veja a hashtag do procedimento", valor: "harmonizacaofacial", motivo: "Mostra quem está crescendo na região e qual procedimento está em alta." },
      { tipo: "ads", titulo: "Veja os anúncios das clínicas grandes", motivo: "A oferta que elas pagam pra rodar é a que converte agendamento." },
    ],
  },
  {
    id: "saude",
    nome: "Saúde e consultório",
    chaves: ["odonto", "dentist", "nutri", "psic", "fisioter", "médic", "medic", "clinic", "clínic", "saude", "saúde", "terapeut", "fono", "vetern"],
    frase: "Aqui a compra é por confiança. Conteúdo que educa vale mais que conteúdo que vende.",
    hashtags: ["saudeintegrativa", "consultorio", "dicasdesaude"],
    passos: [
      PASSO_CONCORRENTE,
      { tipo: "comments", titulo: "Leia as dúvidas embaixo de um post educativo", motivo: "As perguntas que se repetem são exatamente o conteúdo que falta no perfil do seu cliente." },
      { tipo: "transcription", titulo: "Transcreva um reel educativo que rodou", motivo: "Você vê como o profissional explica sem parecer aula chata. É o roteiro que seu cliente vai adaptar." },
    ],
  },
  {
    id: "juridico",
    nome: "Direito, contabilidade e consultoria",
    chaves: ["advoca", "advog", "jurid", "juríd", "contab", "consultor", "escritóri", "escritori", "tributár", "tributar"],
    frase: "Conteúdo de autoridade e limite ético. Ganha quem simplifica o que assusta o cliente.",
    hashtags: ["direitodotrabalho", "advocacia", "contabilidadeconsultiva"],
    passos: [
      PASSO_CONCORRENTE,
      { tipo: "transcription", titulo: "Transcreva um reel de explicação jurídica", motivo: "A estrutura da fala é o ativo aqui: como abrir, quanto explicar e onde parar." },
      { tipo: "comments", titulo: "Leia os comentários de um post sobre direito do consumidor", motivo: "É a dúvida real de quem vai contratar, escrita com as palavras dele." },
    ],
  },
  {
    id: "imobiliario",
    nome: "Imobiliário e arquitetura",
    chaves: ["imobil", "imóve", "imove", "corretor", "arquitet", "constru", "engenh", "design de interior", "interiores", "reforma"],
    frase: "Ticket alto e decisão longa: o conteúdo precisa mostrar processo, não só o resultado final.",
    hashtags: ["arquiteturadeinteriores", "apartamentodecorado", "obraemandamento"],
    passos: [
      PASSO_CONCORRENTE,
      { tipo: "reels", titulo: "Veja os reels de tour e de obra", motivo: "Tour e bastidor de obra são os formatos que mais rodam no nicho. Vale copiar a estrutura." },
      { tipo: "ads", titulo: "Veja os anúncios das construtoras da região", motivo: "Mostra a oferta e a condição de pagamento que estão puxando lead agora." },
    ],
  },
  {
    id: "alimentacao",
    nome: "Alimentação e restaurante",
    chaves: ["restaurant", "hamburgu", "pizzar", "cafeteria", "confeit", "padar", "bar ", "gastro", "food", "doceria", "aliment", "delivery"],
    frase: "Nicho de desejo imediato. Imagem boa e horário certo valem mais que legenda longa.",
    hashtags: ["ondecomer", "gastronomia", "delivery"],
    passos: [
      PASSO_CONCORRENTE,
      { tipo: "mentions", titulo: "Veja quem marca o perfil", motivo: "Cliente postando o prato é prova social pronta e material de repost pro seu cliente." },
      { tipo: "hashtag", titulo: "Veja a hashtag de onde comer na cidade", valor: "ondecomer", motivo: "Mostra o que está atraindo público na região agora." },
    ],
  },
  {
    id: "fitness",
    nome: "Fitness e academia",
    chaves: ["academ", "crossfit", "person", "pilates", "musculação", "musculacao", "treino", "fitness", "esport", "yoga", "danç", "danc"],
    frase: "Transformação vende. O conteúdo que converte é o que mostra rotina, não só resultado.",
    hashtags: ["treinofuncional", "personaltrainer", "transformacaocorporal"],
    passos: [
      PASSO_CONCORRENTE,
      { tipo: "reels", titulo: "Veja os reels de treino que mais rodaram", motivo: "Formato curto e repetível: dá pra montar um mês de conteúdo em cima de uma boa referência." },
      { tipo: "comments", titulo: "Leia os comentários de um post de transformação", motivo: "As objeções aparecem inteiras: falta de tempo, dor, vergonha de começar." },
    ],
  },
  {
    id: "educacao",
    nome: "Educação, cursos e mentoria",
    chaves: ["curso", "escola", "ensino", "educa", "mentori", "infoprod", "professor", "aula", "idioma", "concurso", "faculdade", "treinamento"],
    frase: "O conteúdo é a amostra grátis do método. Quem entrega demais na frente vende atrás.",
    hashtags: ["dicasdeestudo", "mentoria", "metodo"],
    passos: [
      PASSO_CONCORRENTE,
      { tipo: "ads", titulo: "Veja os anúncios de quem vende o mesmo curso", motivo: "A promessa e a quebra de objeção do anúncio são a base da sua página de vendas." },
      { tipo: "transcription", titulo: "Transcreva a aula-isca em reel", motivo: "Você vê onde o concorrente corta a informação pra puxar o clique." },
    ],
  },
  {
    id: "varejo",
    nome: "Moda, varejo e e-commerce",
    chaves: ["moda", "loja", "boutique", "roupa", "calçad", "calcad", "acessóri", "acessori", "ecommerce", "e-commerce", "varejo", "joalher", "óticas", "otica"],
    frase: "Aqui o catálogo não vende sozinho. Vende quem mostra a peça em uso e cria desejo.",
    hashtags: ["lookdodia", "modafeminina", "novacolecao"],
    passos: [
      PASSO_CONCORRENTE,
      { tipo: "ads", titulo: "Veja os anúncios de quem vende parecido", motivo: "Mostra a oferta, o desconto e o criativo que estão rodando agora no seu segmento." },
      { tipo: "mentions", titulo: "Veja quem marca a loja", motivo: "Cliente usando a peça é o melhor criativo e não custa produção." },
    ],
  },
  {
    id: "pet",
    nome: "Pet",
    chaves: ["pet", "veterin", "banho e tosa", "canil", "gato", "cachorro", "aquári", "aquari"],
    frase: "Emoção alta e compartilhamento fácil. O tutor se vê no conteúdo antes de comprar.",
    hashtags: ["petshop", "cuidadocompet", "adotenaocompre"],
    passos: [
      PASSO_CONCORRENTE,
      { tipo: "reels", titulo: "Veja os reels que mais rodaram", motivo: "No pet o formato engraçado ou fofo carrega o alcance. Vale mapear o que já viralizou." },
      { tipo: "comments", titulo: "Leia os comentários de um post de cuidados", motivo: "É onde o tutor pergunta o que ele realmente não sabe." },
    ],
  },
  {
    id: "eventos",
    nome: "Casamento e eventos",
    chaves: ["casament", "event", "festa", "buffet", "noiv", "cerimon", "aniversári", "aniversari", "fotograf", "filmagem"],
    frase: "Decisão emocional e sazonal. O portfólio é o produto e o depoimento fecha.",
    hashtags: ["casamento", "noivas", "decoracaodecasamento"],
    passos: [
      PASSO_CONCORRENTE,
      { tipo: "mentions", titulo: "Veja quem marca o perfil", motivo: "Noiva e fornecedor marcando é a rede de indicação inteira aparecendo de graça." },
      { tipo: "hashtag", titulo: "Veja a hashtag de casamento da região", valor: "casamento", motivo: "Mostra a estética da temporada e quem está dominando o mercado local." },
    ],
  },
  {
    id: "servicos",
    nome: "Serviço local e prestador",
    chaves: ["assistênc", "assistenc", "manutenç", "manutenc", "limpeza", "jardin", "chavei", "eletric", "encanad", "dedetiz", "oficina", "automotiv", "funilar", "lavagem"],
    frase: "Aqui ganha quem parece confiável e responde rápido. Bastidor de serviço converte.",
    hashtags: ["servicolocal", "antesedepois", "atendimento"],
    passos: [
      PASSO_CONCORRENTE,
      { tipo: "reels", titulo: "Veja os reels de serviço em execução", motivo: "Antes e depois de serviço é o formato mais barato de produzir e o que mais salva." },
      { tipo: "ads", titulo: "Veja os anúncios da concorrência local", motivo: "Mostra a chamada e a promessa de prazo que estão trazendo orçamento." },
    ],
  },
  {
    id: "geral",
    nome: "Geral",
    chaves: [],
    frase: "Sem segmento preenchido na ficha. Comece pelo básico e volte aqui depois de preencher.",
    hashtags: [],
    passos: [
      PASSO_CONCORRENTE,
      { tipo: "comments", titulo: "Leia os comentários do post que mais bombou", motivo: "Pauta vinda da dúvida do público funciona em qualquer nicho." },
      { tipo: "reels", titulo: "Veja os reels do concorrente", motivo: "Mostra o formato que já roda e evita você começar do zero." },
    ],
  },
];

const GERAL = NICHOS[NICHOS.length - 1];

/**
 * Casa o segmento escrito na ficha (texto livre) com um nicho do catálogo.
 * Sem correspondência, devolve o roteiro geral: nunca uma tela vazia.
 */
export function sugerirParaSegmento(segmento?: string | null): SugestaoNicho {
  const t = (segmento ?? "").toLowerCase().trim();
  if (!t) return GERAL;
  for (const n of NICHOS) {
    if (n.chaves.some((k) => t.includes(k))) return n;
  }
  return GERAL;
}

/** Nome curto do tipo, pros lugares onde só cabe o rótulo. */
export function nomeDaPesquisa(tipo: string): string {
  return PESQUISA_POR_TIPO[tipo]?.nome ?? "Pesquisa";
}
