/**
 * Tours da área do criador (/app/*).
 * Regra pedagógica: contexto → benefício → passos curtos → gancho de IA.
 * Texto em PT-BR centralizado aqui (i18n-ready: basta trocar por chaves depois).
 */
import type { TourConfig } from "./registry";

export const TOURS_CRIADOR: TourConfig[] = [
  {
    id: "dashboard",
    route: "/app",
    title: "Seu dia começa aqui",
    valueProp:
      "O Dashboard é o seu quartel-general: em 10 segundos você sabe o que tem pra hoje, o que tá travado e qual o próximo passo — sem abrir 6 abas.",
    benefits: [
      "Veja tudo que importa do seu conteúdo num lugar só",
      "Saiba sempre qual é a próxima melhor ação",
      "Capture ideias em 2 segundos antes que elas fujam",
    ],
    steps: [
      {
        target: '[data-tour="dash-primeiros-passos"]',
        title: "Primeiros passos",
        body: "Esse checklist te guia pela configuração inicial. Cada item concluído destrava mais valor do CRIA — vale completar os 6.",
        placement: "bottom",
      },
      {
        target: '[data-tour="dash-acao"]',
        title: "Sua próxima melhor ação",
        body: "O CRIA analisa seu fluxo e te diz o que fazer AGORA pra manter a constância. Se bater dúvida do que fazer, é aqui que você olha.",
        placement: "bottom",
      },
      {
        target: '[data-tour="dash-tiles"]',
        title: "Seu conteúdo em números",
        body: "Ideias, posts em criação, publicados, agendados, tarefas e hábitos. Cada card é clicável e te leva direto pra área correspondente.",
        placement: "bottom",
      },
      {
        target: '[data-tour="dash-posts"]',
        title: "Próximos posts",
        body: "O que vem pela frente, em ordem. Post atrasado ou sem data aparece aqui antes de virar problema.",
        placement: "top",
      },
      {
        target: '[data-tour="dash-captura"]',
        title: "Captura Rápida",
        body: "Ideia boa não espera. Digitou, capturou — ela vai direto pro seu banco de ideias, e você organiza depois.",
        placement: "top",
        aiPrompt:
          "Me sugira 5 ideias de post no tom da minha marca, usando meu brandbook como referência.",
      },
    ],
  },
  {
    id: "ideias",
    route: "/app/ideias",
    title: "Banco de Ideias",
    valueProp:
      "Chega de ideia morrendo em print perdido. Aqui vive o seu estoque criativo: tudo que você pensar fica guardado, organizado e pronto pra virar post.",
    benefits: [
      "Nunca mais comece um post do zero",
      "A Cria IA sugere ideias no tom da SUA marca",
      "Da ideia pro kanban de criação em 1 clique",
    ],
    steps: [],
  },
  {
    id: "criando",
    route: "/app/criando",
    title: "Kanban Criando",
    valueProp:
      "Cada post é um card que anda: rascunho → produzindo → pronto → publicado. Bateu o olho, você sabe exatamente onde cada conteúdo parou.",
    benefits: [
      "Nada se perde entre a ideia e o post publicado",
      "Arraste os cards conforme avança — simples assim",
      "Agende a data e acompanhe pelo calendário",
    ],
    steps: [],
  },
  {
    id: "tarefas",
    route: "/app/tarefas",
    title: "Tarefas",
    valueProp:
      "Gravar, editar, responder, entregar: a vida de criador é cheia de micro-tarefas. Aqui elas têm prazo e dono — e param de morar na sua cabeça.",
    benefits: [
      "Tudo que precisa ser feito, com data",
      "Conectado ao seu conteúdo e collabs",
      "O resumo diário te lembra do que vence hoje",
    ],
    steps: [],
  },
  {
    id: "stories",
    route: "/app/stories",
    title: "Cria Stories",
    valueProp:
      "O plano semanal de stories pronto pra você nunca mais abrir o Instagram sem saber o que postar. Uma semana inteira de pauta, gerada pra sua marca.",
    benefits: [
      "Pauta de stories da semana inteira de uma vez",
      "Sugestões alinhadas ao seu nicho e tom",
      "Constância nos stories sem esforço criativo diário",
    ],
    steps: [],
  },
  {
    id: "brandbook",
    route: "/app/brandbook",
    title: "Brandbook",
    valueProp:
      "Aqui mora a alma da sua marca: nicho, tom de voz, público. É daqui que a Cria IA aprende a escrever COMO VOCÊ — quanto mais completo, melhor ela fica.",
    benefits: [
      "A IA escreve no seu tom, não no tom de robô",
      "Decisões de conteúdo mais rápidas e coerentes",
      "Base pra tudo: legendas, roteiros, stories e ideias",
    ],
    steps: [],
  },
  {
    id: "insights",
    route: "/app/insights",
    title: "Insights",
    valueProp:
      "Dados reais do seu Instagram, sem achismo: o que cresceu, o que engajou, o que repetir. Feche o ciclo — analise, aprenda e comece a próxima semana na frente.",
    benefits: [
      "Métricas reais do seu perfil dentro do CRIA",
      "Descubra o que funciona e recicle o que deu certo",
      "Pare de decidir conteúdo no escuro",
    ],
    steps: [],
  },
];
