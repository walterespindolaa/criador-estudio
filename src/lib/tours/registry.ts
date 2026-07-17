/**
 * Tour guiado do CRIA, registry config-driven.
 * Adicionar um tour novo = adicionar um config aqui (ou num arquivo de área) e
 * marcar os alvos com data-tour="chave" na tela. Zero acoplamento com as páginas.
 */
import { TOURS_CRIADOR } from "./criador";
import { TOURS_GESTOR } from "./gestor";

export type TourStep = {
  /** Seletor do alvo: '[data-tour="chave"]'. Se o elemento não existir, o card aparece centrado. */
  target: string;
  /** Alvo alternativo no mobile (quando o layout mobile tem outro elemento). */
  mobileTarget?: string;
  title: string;
  body: string;
  /** Texto alternativo no mobile (quando a instrução muda, ex: gesto em vez de clique). */
  mobileBody?: string;
  /** Passo só existe numa das versões (elemento não existe na outra). */
  skipOnMobile?: boolean;
  skipOnDesktop?: boolean;
  /**
   * ABRIR ANTES DE PROCURAR.
   * Seletor de um controle (aba, acordeão, botão "mais") que precisa ser CLICADO
   * pra que o alvo exista no DOM. Sem isso, o tour não encontrava o elemento e
   * caía no modo "sem alvo": mostrava só o texto, sem destacar nada na tela.
   * É o que acontecia no editor de post no mobile, onde as abas do conteúdo vivem
   * atrás do botão "Criar conteúdo".
   */
  openFirst?: string;
  /** Idem, mas só no mobile (o desktop costuma mostrar tudo de uma vez). */
  mobileOpenFirst?: string;
  placement?: "top" | "bottom" | "left" | "right";
  /** Se presente, mostra o botão "Fazer com a Cria IA" que abre o painel com esse prompt. */
  aiPrompt?: string;
};

export type TourConfig = {
  id: string;
  /** Rota exata que ativa o tour (pathname). */
  route: string;
  /**
   * Vale também pras sub-rotas (/criacaixa/empresa/visao, /criapost/aprovacoes...).
   * Sem isso, o "?" dentro de uma seção do módulo não achava tour nenhum.
   * NÃO ligar em rotas com :id (ex.: /clientes/:id), que são OUTRA tela.
   */
  routePrefix?: boolean;
  title: string;
  /** Por que a tela existe / que problema resolve, mostrado no card de abertura. */
  valueProp: string;
  benefits: string[];
  steps: TourStep[];
};

export const TOURS: TourConfig[] = [...TOURS_CRIADOR, ...TOURS_GESTOR];

export function findTourByRoute(pathname: string): TourConfig | undefined {
  const exato = TOURS.find(t => t.route === pathname);
  if (exato) return exato;
  // Sub-rota do módulo: pega o tour de rota mais longa que seja prefixo.
  return TOURS
    .filter(t => t.routePrefix && pathname.startsWith(`${t.route}/`))
    .sort((a, b) => b.route.length - a.route.length)[0];
}

export function findTourById(id: string): TourConfig | undefined {
  return TOURS.find(t => t.id === id);
}

/** Sequência do "tour completo" (modo treinamento) por área. */
export const TRAINING_SEQUENCES: Record<"criador" | "gestor", string[]> = {
  // "estudio" saiu da sequência: a rota /app/estudio não existe mais (virou a
  // aba Arte do editor de post) e o tour completo navegava pra um 404.
  criador: [
    "dashboard",
    "ideias",
    "criando",
    "tarefas",
    "metas",
    "autopilot",
    "stories",
    "prompter",
    "tendencias",
    "feed",
    "brandbook",
    "linkinbio",
    "media-kit",
    "biblioteca",
    "collabs",
    "aprovacao",
    "historico",
    "insights",
    "configuracoes",
  ],
  gestor: [
    "gestor-dashboard",
    "gestor-clientes",
    "gestor-agenda",
    "gestor-hubcria",
    "gestor-criapost",
    "gestor-criacrm",
    "gestor-criacaixa",
    "gestor-equipe",
  ],
};

export function areaForPath(pathname: string): "criador" | "gestor" {
  return pathname.startsWith("/socialmidia") ? "gestor" : "criador";
}
