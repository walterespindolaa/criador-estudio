/**
 * Tours da área do gestor / social media (/socialmidia/*).
 *
 * ATENÇÃO (bug que existia aqui): todos estes tours tinham `steps: []`.
 * Resultado: o botão "?" abria o card de apresentação e ACABAVA. A pessoa lia
 * um texto bonito e não via NADA sendo apontado na tela. Era exatamente o
 * "só traz o escrito, não mostra onde é". Agora cada tela tem passos reais,
 * cada um ancorado num data-tour que existe no DOM.
 */
import type { TourConfig } from "./registry";

export const TOURS_GESTOR: TourConfig[] = [
  {
    id: "gestor-dashboard",
    route: "/socialmidia/dashboard",
    title: "O QG da sua operação",
    valueProp:
      "Aqui você enxerga a operação inteira: clientes, aprovações pendentes, o que está travado e o dinheiro entrando. É a visão de dono, não de operador.",
    benefits: [
      "Status de todos os clientes num olhar",
      "Aprovações e entregas pendentes em destaque",
      "Do caos operacional pra visão de negócio",
    ],
    steps: [
      {
        target: '[data-tour="gh-numeros"]',
        title: "Os 4 números do seu dia",
        body: "Clientes ativos, quanto entra por mês na carteira, quantos posts estão parados esperando o cliente e a sua semana. Cada card leva direto pro módulo, e a cor é a cor do módulo: rosa é Gestão, azul é Caixa, laranja é Post.",
        placement: "bottom",
      },
      {
        target: '[data-tour="gh-modulos"]',
        title: "Seus módulos",
        body: "Cria Post (aprovação por link), Cria Gestão (CRM) e Cria Caixa (financeiro). Módulo ativo abre na hora; módulo que você ainda não tem abre a vitrine mostrando o que ele resolve.",
        placement: "bottom",
      },
      {
        target: '[data-tour="gh-aprovacoes"]',
        title: "O que está travado",
        body: "As aprovações mais recentes, com há quanto tempo cada uma espera. É o seu radar de cobrança: se um cliente está sentado num post há 5 dias, você vê aqui antes de ele reclamar.",
        placement: "top",
      },
      {
        target: '[data-tour="gh-clientes"]',
        title: "Seus clientes",
        body: "Atalho pros clientes que você mais mexe. Clicou, você cai na ficha dele: brandbook, posts, cronograma, contrato e financeiro no mesmo lugar.",
        placement: "top",
      },
    ],
  },
  {
    id: "gestor-clientes",
    route: "/socialmidia/clientes",
    title: "Seus clientes",
    valueProp:
      "Cada cliente tem seu hub: brandbook, conteúdo, aprovações, contratos e financeiro. Troque de contexto em 1 clique sem se perder.",
    benefits: [
      "Tudo de cada cliente num lugar só",
      "Brandbook por cliente = IA no tom certo",
      "Histórico completo da relação",
    ],
    steps: [
      {
        target: '[data-tour="cli-novo"]',
        title: "Criar um cliente",
        body: "Nome e @ já bastam pra começar. A partir daí ele ganha ficha, posts, cronograma, contrato e financeiro. Se o cliente também usa o CRIA, a conta dele se conecta a essa ficha automaticamente.",
        placement: "bottom",
      },
      {
        target: '[data-tour="cli-filtros"]',
        title: "Dois tipos de cliente",
        body: "“Usa o Cria” é o cliente com conta própria (você vê o conteúdo dele e ele aprova de dentro do sistema). “Aprova por link” é o cliente que só recebe um link, sem cadastro. Você também filtra por ativos e inativos.",
        placement: "bottom",
      },
      {
        target: '[data-tour="cli-grid"]',
        title: "O card já entrega o recado",
        body: "Cada card mostra quantos posts estão aguardando aprovação daquele cliente. O botão de link copia a página de aprovação dele na hora, pronta pra mandar no WhatsApp.",
        placement: "top",
      },
    ],
  },
  {
    id: "gestor-agenda",
    route: "/socialmidia/agenda",
    title: "Agenda de criação",
    valueProp:
      "O calendário de todos os clientes junto: o que sai hoje, o que grava amanhã, o que falta aprovar. Sua semana de produção sem sobreposição.",
    benefits: [
      "Visão multi-cliente do calendário",
      "Nunca mais dois clientes esperando no mesmo dia",
      "Planejamento de produção realista",
    ],
    steps: [
      {
        target: '[data-tour="ag-quadro"]',
        title: "A semana inteira, todos os clientes",
        body: "Cada coluna é um dia. Os posts de todos os clientes aparecem juntos, com a cor do cliente. Arraste um card pra outro dia e a data muda de verdade, no post.",
        mobileBody: "Cada coluna é um dia e você arrasta a tira pro lado pra ver a semana. Os posts de todos os clientes aparecem juntos, com a cor de cada um. Segure e arraste um card pra outro dia e a data muda de verdade.",
        placement: "bottom",
      },
      {
        target: '[data-tour="ag-navegacao"]',
        title: "Semana ou mês",
        body: "Semana é pra executar (o que grava, o que sai). Mês é pra planejar (a distribuição do conteúdo). O botão Hoje traz você de volta pro presente.",
        placement: "bottom",
      },
      {
        target: '[data-tour="ag-captacoes"]',
        title: "Captações",
        body: "O dia de gravação: data, hora, local, equipe e qual cliente. É o que evita marcar duas captações no mesmo dia e descobrir na véspera.",
        placement: "top",
      },
    ],
  },
  {
    id: "gestor-hubcria",
    route: "/socialmidia/hubcria",
    title: "Cria Radar",
    valueProp:
      "Análise de concorrentes por cliente + ideias sugeridas pro nicho dele. Você chega na reunião de pauta com inteligência, não com achismo.",
    benefits: [
      "Acompanhe os concorrentes de cada cliente",
      "Ideias baseadas no que funciona no nicho",
      "Pauta pronta sem stalkear manualmente",
    ],
    steps: [
      {
        target: '[data-tour="hub-clientes"]',
        title: "Escolha o cliente",
        body: "Cada card mostra quantas ideias estão pendentes pra aquele cliente. Clicou, você entra na análise dele: os concorrentes que você cadastrou e o que eles estão postando que funciona.",
        placement: "bottom",
      },
      {
        target: '[data-tour="hub-avulsa"]',
        title: "Análise avulsa",
        body: "Quer espiar um perfil sem amarrar a um cliente (uma prospecção, uma referência)? Rode aqui. As ideias ficam guardadas no HUB e você pode aproveitar depois.",
        placement: "top",
      },
    ],
  },
  {
    id: "gestor-criapost",
    route: "/socialmidia/criapost",
    routePrefix: true,
    title: "Cria Post, aprovação por link",
    valueProp:
      "O cliente recebe um link, vê o post como vai ficar, aprova ou comenta. Com histórico. Cabou áudio de 4 minutos e print riscado no WhatsApp.",
    benefits: [
      "Cliente aprova sem precisar de conta",
      "Comentários no lugar certo, com registro",
      "Você sabe quem aprovou o quê, e quando",
    ],
    steps: [
      {
        target: '[data-tour="hero-tabs"]',
        title: "As duas seções do Cria Post",
        body: "Aprovações mostra tudo que está na mão dos clientes: o que está esperando, o que voltou com ajuste, o que já foi aprovado. Calendário geral junta os posts de todos os clientes num mês só.",
        mobileBody: "Aprovações mostra tudo que está na mão dos clientes: o que espera, o que voltou com ajuste, o que foi aprovado. Calendário geral junta os posts de todos os clientes num mês só.",
        placement: "bottom",
      },
      {
        target: '[data-tour="hero-actions"]',
        title: "Os posts moram no cliente",
        body: "Pra criar ou editar post, você entra no cliente. Este botão te leva pra lá. Lá dentro sai o link de aprovação: público, sem senha, o cliente abre no celular, vê a arte e a legenda, e aprova ou pede ajuste, e você é avisado na hora.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "gestor-criacrm",
    route: "/socialmidia/criacrm",
    routePrefix: true,
    title: "Cria Gestão, seu CRM",
    valueProp:
      "Do lead ao contrato assinado: pipeline de prospecção, ficha do cliente, propostas e contratos. Sua operação comercial sai do improviso.",
    benefits: [
      "Pipeline visual: prospect → proposta → fechado",
      "Propostas enviadas direto da negociação",
      "Contratos organizados com vencimento à vista",
    ],
    steps: [
      {
        target: '[data-tour="hero-tabs"]',
        title: "As seções do Cria Gestão",
        body: "Clientes é a carteira. Pipeline é a venda (do lead ao fechado, arrastando o card). Tarefas é o que fazer por cliente. Calendário junta tudo na semana. Contratos guarda o que foi assinado, com vencimento.",
        mobileBody: "Arraste essa tira pro lado pra ver todas as seções. Clientes é a carteira. Pipeline é a venda. Tarefas é o que fazer por cliente. Calendário junta tudo na semana. Contratos guarda o assinado, com vencimento.",
        placement: "bottom",
      },
      {
        target: '[data-tour="hero"]',
        title: "Tudo pendura na ficha do cliente",
        body: "Tarefa, proposta, contrato, brandbook e financeiro nascem colados no cliente. Por isso vale cadastrar direito uma vez: depois é só ir pendurando, e a ficha vira o histórico inteiro da relação.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "gestor-criacaixa",
    route: "/socialmidia/criacaixa",
    routePrefix: true,
    title: "Cria Caixa, seu financeiro",
    valueProp:
      "Cachês, mensalidades, MRR e inadimplência num painel. Você sabe quanto entra, quando entra e quem está atrasado, sem abrir planilha.",
    benefits: [
      "MRR e previsão de faturamento",
      "Alerta de cobrança e reajuste esquecidos",
      "O dinheiro fecha o ciclo da operação",
    ],
    steps: [
      {
        target: '[data-tour="hero"]',
        title: "Empresa e Pessoal, separados",
        body: "Aqui em cima você troca entre o dinheiro da EMPRESA (o que os clientes pagam, os custos, o imposto) e o seu dinheiro PESSOAL (contas fixas, gastos, reserva). Nunca mais misturar os dois é metade do trabalho.",
        placement: "bottom",
      },
      {
        target: '[data-tour="hero-tabs"]',
        title: "As seções do Caixa",
        body: "Visão traz o resumo do mês (recebido, a receber, o que sobra). Lançamentos é onde você registra. Recorrentes cadastra o que se repete todo mês. Calendário mostra o que vence em cada dia. Clientes mostra a margem de lucro de cada um.",
        mobileBody: "Arraste essa tira pro lado pra ver todas as seções. Visão é o resumo do mês. Lançamentos é onde você registra. Recorrentes cadastra o que se repete. Calendário mostra o que vence em cada dia. Clientes mostra a margem de cada um.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "gestor-equipe",
    route: "/socialmidia/equipe",
    title: "Equipe",
    valueProp:
      "Convide colaboradores, defina o que cada um acessa e distribua a operação sem perder o controle do todo.",
    benefits: [
      "Acessos por colaborador",
      "Cada um vê só o que precisa",
      "A operação escala sem virar bagunça",
    ],
    steps: [
      {
        target: '[data-tour="eq-assentos"]',
        title: "Assentos",
        body: "O 1º colaborador é grátis. A partir do 2º, cada assento é R$ 29,90/mês. Você compra e libera quando quiser, sem falar com ninguém.",
        placement: "bottom",
      },
      {
        target: '[data-tour="eq-convidar"]',
        title: "Convidar com o acesso certo",
        body: "No convite você escolhe QUAIS MÓDULOS e QUAIS CLIENTES a pessoa acessa. O designer vê só os posts dos clientes dele; ninguém esbarra no seu financeiro.",
        placement: "bottom",
      },
    ],
  },
];
