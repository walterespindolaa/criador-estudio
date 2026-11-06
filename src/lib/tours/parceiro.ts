import type { TourConfig } from "./registry";

/* TOURS DO PRESTADOR (designer, editor, filmmaker, copy), 06/11/2026.
   A home dele (parceiro-home) mora em gestor.ts, porque divide a rota com a
   home da social mídia. Estas são as telas da bancada: só ele vê, então cada
   tour tem a sua rota própria. A sequência do tour completo do prestador está
   em TRAINING_SEQUENCES.parceiro. */
export const TOURS_PARCEIRO: TourConfig[] = [
  {
    id: "parceiro-demandas",
    route: "/socialmidia/demandas",
    title: "Minhas demandas",
    valueProp:
      "Tudo que as agências te pediram, com prazo, material e conversa no mesmo card. É aqui que você trabalha o dia inteiro.",
    benefits: [
      "O que está atrasado e o que vence hoje, no topo",
      "Cinco jeitos de ver a fila: Por prazo, Quadro, Por cliente, Semana e Mês",
      "Entrega com arquivo ou link, sem mandar nada pelo WhatsApp",
    ],
    steps: [
      {
        target: '[data-tour="pd-resumo"]',
        title: "Como está o seu dia",
        body: "O anel mostra quantas peças estão no prazo. Os quatro números dizem o que está atrasado, o que vence hoje (ou voltou pra ajuste), o que você está fazendo agora e quanto entregou nos últimos 30 dias.",
        placement: "bottom",
      },
      {
        skipIfMissing: true,
        target: '[data-tour="pd-agencias"]',
        title: "As agências que trabalham com você",
        body: "Cada cartão mostra o seu papel, quantas peças estão na sua mão e quanto você tem a receber daquela agência. Toque numa agência pra ver só os clientes dela; toque de novo pra voltar a ver todas.",
        placement: "bottom",
      },
      {
        target: '[data-tour="pd-visoes"]',
        title: "Escolha como ver a fila",
        body: "Por prazo agrupa por dia de entrega. Quadro mostra as etapas da produção. Por cliente junta as peças de cada marca. Semana e Mês põem os prazos no calendário.",
        mobileBody: "Por prazo agrupa por dia de entrega. Quadro mostra as etapas. Por cliente junta por marca. Semana e Mês mostram o calendário.",
        placement: "bottom",
      },
      {
        target: '[data-tour="pd-fila"]',
        title: "Abra o card pra trabalhar",
        body: "No card está o material e as referências, a ficha da marca e as observações da social mídia. Lá você aceita o prazo ou propõe outra data, conversa com a social mídia, marca \"Estou fazendo\" e, no fim, sobe a arte ou o vídeo e marca como entregue. Arquivo acima de 80 MB vai por link.",
        mobileBody: "No card: material, ficha da marca e observações. Aceite ou proponha o prazo, converse, marque \"Estou fazendo\" e suba a arte ou o vídeo pra entregar. Acima de 80 MB, mande o link.",
        placement: "top",
      },
    ],
  },
  {
    id: "parceiro-agenda",
    route: "/socialmidia/minha-agenda",
    title: "Minha agenda",
    valueProp:
      "Os prazos das suas entregas, as gravações em que te escalaram e o que você anotar, num calendário só.",
    benefits: [
      "Entregas e gravações caem aqui sozinhas",
      "Tarefa e compromisso seus, anotados no mesmo lugar",
      "O mês resumido em três números",
    ],
    steps: [
      {
        target: '[data-tour="pa-mes"]',
        title: "Troque de mês",
        body: "As setas andam entre os meses e o Hoje volta pro mês atual.",
        placement: "bottom",
      },
      {
        target: '[data-tour="pa-anotar"]',
        title: "Anote o que é seu",
        body: "Tarefa tem prazo e pode não ter dia. Compromisso tem dia e hora. Dá pra amarrar a anotação numa peça e numa agência.",
        placement: "bottom",
      },
      {
        target: '[data-tour="pa-numeros"]',
        title: "O mês em três números",
        body: "Quantas entregas e gravações caem neste mês e quantas coisas ainda estão em aberto.",
        placement: "bottom",
      },
      {
        skipOnMobile: true,
        skipIfMissing: true,
        target: '[data-tour="pa-calendario"]',
        title: "O calendário",
        body: "Cada ponto é uma coisa naquele dia, com a cor do tipo: entrega, gravação, tarefa ou compromisso. Clique no dia pra descer até a lista dele.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "parceiro-entregues",
    route: "/socialmidia/entregues",
    title: "Entregues",
    valueProp:
      "O seu histórico de trabalho, separado por agência. É o que você usa pra cobrar no fim do mês.",
    benefits: [
      "Cada peça com data de entrega e cachê",
      "Você vê se o cliente já aprovou, pediu ajuste ou se já foi postado",
      "Abre o card de novo quando precisar",
    ],
    steps: [
      {
        target: '[data-tour="pt-lista"]',
        title: "Tudo que você entregou",
        body: "Separado por agência, com o cliente, o formato, o cachê e a data em que você entregou. A etiqueta mostra onde a peça está agora: com a social mídia, cliente avaliando, cliente pediu ajuste, aprovado ou postado. Toque numa peça pra abrir o card.",
        placement: "top",
      },
    ],
  },
  {
    id: "parceiro-extrato",
    route: "/socialmidia/extrato",
    title: "Extrato do mês",
    valueProp:
      "O que você fez no período, por cliente e agência, pronto pra mandar em PDF na hora de cobrar.",
    benefits: [
      "Mês fechado ou datas que você escolher",
      "Valores aparecem ou somem com um toque",
      "PDF igual ao que está na tela",
    ],
    steps: [
      {
        target: '[data-tour="pe-periodo"]',
        title: "Escolha o período",
        body: "As setas trocam o mês e o nome do mês abre a grade do ano. Em Escolher datas você marca o começo e o fim de qualquer intervalo.",
        placement: "bottom",
      },
      {
        target: '[data-tour="pe-valores"]',
        title: "Com ou sem valores",
        body: "Esconda os valores quando o extrato for só pra mostrar o que foi feito. O botão mostra de volta.",
        placement: "bottom",
      },
      {
        target: '[data-tour="pe-folha"]',
        skipIfMissing: true,
        title: "A folha",
        body: "O que está aqui é exatamente o que vai pro PDF. O ✓ ao lado do valor quer dizer que a agência já registrou aquele cachê como pago no Caixa dela.",
        placement: "top",
      },
      {
        target: '[data-tour="pe-pdf"]',
        title: "Baixar PDF",
        body: "Gera o arquivo da folha pra você mandar pra agência.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "parceiro-marcas",
    route: "/socialmidia/marcas",
    title: "Marcas que atendo",
    valueProp:
      "A ficha de cada marca que passa pela sua mão: cores, fontes, hashtags, tom de voz, o que evitar e as referências. Sem pedir de novo em cada peça.",
    benefits: [
      "Copia cor e hashtag com um toque",
      "O recado fixo da agência pra aquela marca",
      "Quem te acoplou e com qual papel",
    ],
    steps: [
      {
        target: '[data-tour="pm-marcas"]',
        title: "Abra a ficha antes de começar",
        body: "Toque numa marca pra ver cores, fontes, hashtags, tom de voz, o que evitar, as referências visuais e o recado fixo da agência. Cor e hashtag copiam com um toque.",
        placement: "bottom",
      },
      {
        skipIfMissing: true,
        target: '[data-tour="pm-agencias"]',
        title: "Quem te acoplou",
        body: "As agências que trabalham com você e o seu papel em cada uma.",
        placement: "top",
      },
    ],
  },
  {
    id: "parceiro-caches",
    route: "/socialmidia/caches",
    title: "Meus cachês",
    valueProp:
      "O que você tem a receber, entrega por entrega, e o que já caiu. Sem planilha e sem depender da memória.",
    benefits: [
      "O cachê aparece quando você entrega",
      "Você confirma quando o pagamento cai",
      "Trabalho de fora do Cria também entra, lançado por você",
    ],
    steps: [
      {
        target: '[data-tour="pc-totais"]',
        title: "A receber e já recebido",
        body: "O cachê entra no Caixa da agência quando você entrega, e quem marca como pago é ela. Aqui você vê o total que falta e o que ela já quitou.",
        placement: "bottom",
      },
      {
        skipIfMissing: true,
        target: '[data-tour="pc-pagamentos"]',
        title: "Confirme o pagamento",
        body: "Quando a agência marca um pagamento, ele aparece aqui com o valor e o período. Toque em Recebi quando cair. Se não caiu, avise: a agência fica sabendo na hora.",
        placement: "bottom",
      },
      {
        target: '[data-tour="pc-entregas"]',
        title: "De onde vem esse valor",
        body: "As entregas uma a uma, por agência, com filtro Em aberto, Pagos ou Tudo. É a lista que você manda quando cobra.",
        placement: "top",
      },
      {
        target: '[data-tour="pc-adicionar"]',
        title: "Cachê de fora do Cria",
        body: "Pacote fechado, agência que não usa o Cria, valor combinado por mensagem: lance aqui com cliente, valor e quanto já entrou, e ele soma junto.",
        placement: "bottom",
      },
    ],
  },
];
