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
   * PULAR QUANDO O ALVO NÃO EXISTE.
   * Pra passo que fala de algo CONDICIONAL, que só aparece em certo estado da tela:
   * os KPIs do Insights (só depois de conectar o Instagram), o card do Kanban no
   * cockpit (só pra cliente com conta Cria), a faixa "Em produção" da agenda (só
   * quando há post sem data). Sem isso o passo caía no card centrado explicando
   * uma coisa que a pessoa não tem na tela, o que confunde mais do que ajuda.
   * Com isso o passo simplesmente não entra no tour naquele estado.
   */
  skipIfMissing?: boolean;
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
  /**
   * A `route` tem parâmetro no nome (ex.: `/socialmidia/clientes/:id`) e deve casar
   * por SEGMENTO, não por texto igual. É o caso do cockpit do cliente: a rota nunca
   * é literal e o routePrefix não serve (ele é pra sub-rota de módulo, e agora ignora
   * de propósito segmentos que parecem id). Ver `casaPadrao`.
   */
  routePattern?: boolean;
  title: string;
  /** Por que a tela existe / que problema resolve, mostrado no card de abertura. */
  valueProp: string;
  benefits: string[];
  steps: TourStep[];
};

export const TOURS: TourConfig[] = [...TOURS_CRIADOR, ...TOURS_GESTOR];

/** Começo de UUID (o formato dos ids do banco). */
const UUID_INICIO = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
/**
 * O segmento "parece um id"?
 * Serve pra separar SUB-ROTA DO MÓDULO (/criacaixa/empresa/visao, /criacrm/tarefas,
 * /criapost/aprovacoes) de FICHA DE UM REGISTRO (/criacrm/8f3a1c2e-…), que é OUTRA
 * tela. Sem isso, o routePrefix vazava: a ficha do cliente herdava o tour do CRM e
 * apontava passos pra elementos que não existem lá.
 * Rótulo de sub-rota é sempre palavra (tem letra fora do hex ou é curto), então
 * nunca cai aqui; id é UUID ou token longo só de hex/dígitos/traço.
 */
function pareceId(seg: string): boolean {
  if (UUID_INICIO.test(seg)) return true;
  return seg.length >= 12 && /^[0-9a-f-]+$/i.test(seg);
}

/**
 * Rota com curinga casa por SEGMENTO: cada pedaço que começa com ":" aceita o
 * valor do parâmetro. Segmentos sobrando no fim são aceitos DE PROPÓSITO, porque
 * `/clientes/:id/relatorio` é a MESMA tela do `/clientes/:id` (o cockpit só troca
 * de aba) e o "?" precisa achar o mesmo tour em qualquer sub-página.
 *
 * O curinga só aceita segmento que PAREÇA ID (mesmo `pareceId` do routePrefix).
 * Sem isso, `/criacrm/:id` (a ficha do cliente) engoliria `/criacrm/tarefas` e
 * `/criacrm/pipeline`, que são seções do módulo, e o tour da ficha apontaria
 * passos pra elementos que não existem lá.
 */
function casaPadrao(pattern: string, pathname: string): boolean {
  const alvo = pattern.split("/").filter(Boolean);
  const atual = pathname.split("/").filter(Boolean);
  if (atual.length < alvo.length) return false;
  return alvo.every((seg, i) => (seg.startsWith(":") ? pareceId(atual[i]) : seg === atual[i]));
}

export function findTourByRoute(pathname: string): TourConfig | undefined {
  const exato = TOURS.find(t => t.route === pathname);
  if (exato) return exato;
  // Rota com :id (cockpit do cliente). Vem ANTES do prefixo: é a tela mais
  // específica, e a checagem de prefixo já descarta caminho com id.
  const porPadrao = TOURS
    .filter(t => t.routePattern && casaPadrao(t.route, pathname))
    .sort((a, b) => b.route.length - a.route.length)[0];
  if (porPadrao) return porPadrao;
  // Sub-rota do módulo: pega o tour de rota mais longa que seja prefixo.
  // Se qualquer segmento do RESTO do caminho parecer id, não casa: é a ficha de
  // um registro, não uma seção do módulo.
  return TOURS
    .filter(t => {
      if (!t.routePrefix || !pathname.startsWith(`${t.route}/`)) return false;
      const resto = pathname.slice(t.route.length + 1).split("/").filter(Boolean);
      return !resto.some(pareceId);
    })
    .sort((a, b) => b.route.length - a.route.length)[0];
}

export function findTourById(id: string): TourConfig | undefined {
  return TOURS.find(t => t.id === id);
}

/** Sequência do "tour completo" (modo treinamento) por área. */
export const TRAINING_SEQUENCES: Record<"criador" | "gestor", string[]> = {
  // "estudio" saiu da sequência: a rota /app/estudio não existe mais (virou a
  // aba Arte do editor de post) e o tour completo navegava pra um 404.
  // "cria-ia" também fica fora: é um painel global, a `route` dele é um marcador
  // que não existe como caminho, e o tour abre pelo "?" de dentro do painel.
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
  // FICAM FORA DA SEQUÊNCIA DE PROPÓSITO:
  // - "gestor-cliente-hub" e "gestor-crm-cliente": o modo treinamento navega pra
  //   `tour.route`, e essas rotas são padrões com :id, não caminhos navegáveis.
  //   Sem um id de cliente real cairiam em tela vazia e travariam a fila. Os dois
  //   abrem pelo "?" dentro da ficha de um cliente.
  // - "gestor-parceria" e "gestor-contas": são back-office (indicação e assentos),
  //   não a operação do dia a dia. As rotas são navegáveis, então caberiam aqui,
  //   mas esticariam o tour completo com assunto que ninguém está tentando
  //   aprender quando pede "me mostra o sistema".
  gestor: [
    "gestor-dashboard",
    "gestor-clientes",
    "gestor-agenda",
    "gestor-aprovacoes",
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
