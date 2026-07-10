/**
 * Tours da área do gestor / social media (/socialmidia/*).
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
    steps: [],
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
    steps: [],
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
    steps: [],
  },
  {
    id: "gestor-hubcria",
    route: "/socialmidia/hubcria",
    title: "HUB CRIA",
    valueProp:
      "Análise de concorrentes por cliente + ideias sugeridas pro nicho dele. Você chega na reunião de pauta com inteligência, não com achismo.",
    benefits: [
      "Acompanhe os concorrentes de cada cliente",
      "Ideias baseadas no que funciona no nicho",
      "Pauta pronta sem stalkear manualmente",
    ],
    steps: [],
  },
  {
    id: "gestor-criapost",
    route: "/socialmidia/criapost",
    title: "Cria Post, aprovação por link",
    valueProp:
      "O cliente recebe um link, vê o post como vai ficar, aprova ou comenta. Com histórico. Cabou áudio de 4 minutos e print riscado no WhatsApp.",
    benefits: [
      "Cliente aprova sem precisar de conta",
      "Comentários no lugar certo, com registro",
      "Você sabe quem aprovou o quê, e quando",
    ],
    steps: [],
  },
  {
    id: "gestor-criacrm",
    route: "/socialmidia/criacrm",
    title: "Cria Gestão, seu CRM",
    valueProp:
      "Do lead ao contrato assinado: pipeline de prospecção, ficha do cliente, propostas e contratos. Sua operação comercial sai do improviso.",
    benefits: [
      "Pipeline visual: prospect → proposta → fechado",
      "Propostas enviadas direto da negociação",
      "Contratos organizados com vencimento à vista",
    ],
    steps: [],
  },
  {
    id: "gestor-criacaixa",
    route: "/socialmidia/criacaixa",
    title: "Cria Caixa, seu financeiro",
    valueProp:
      "Cachês, mensalidades, MRR e inadimplência num painel. Você sabe quanto entra, quando entra e quem está atrasado, sem abrir planilha.",
    benefits: [
      "MRR e previsão de faturamento",
      "Alerta de cobrança e reajuste esquecidos",
      "O dinheiro fecha o ciclo da operação",
    ],
    steps: [],
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
    steps: [],
  },
];
