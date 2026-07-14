/* ═══════════════════════════════════════════════════════════════════════════
   PLANOS E TRAVAS — FONTE ÚNICA DE VERDADE

   Antes, a mesma regra ("isto é do Studio") estava escrita de TRÊS jeitos
   diferentes, cada um numa página:
     - CriaStories:  isStudio
     - Collabs:      tier !== "studio" → <Navigate to="/app/assinar">
     - Autopilot:    reimplementava o deriveTier na mão (profile.plan === ...)
   E o Cria Estúdio, que gasta crédito pago de geração de imagem, NÃO TINHA TRAVA
   NENHUMA: qualquer conta logada entrava pela URL e queimava dinheiro.

   Três implementações da mesma regra são três lugares pra errar — e um deles já
   tinha errado. Agora existe UM mapa: recurso → tier mínimo. A trava (UpgradeGate)
   lê daqui, o menu lê daqui, e a vitrine de venda lê daqui.

   E a trava não é mais uma porta na cara: quem clica num recurso que não tem
   vê O QUE GANHARIA, com um CTA. A pessoa clicou porque queria — isso é a
   melhor oportunidade de venda que existe, e a gente estava jogando fora com
   um redirect.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PlanId = "essencial" | "pro" | "studio";

/** Ordem da escada. Comparar por índice é o que faz `tierAtLeast` funcionar. */
export const TIER_ORDER = ["none", "essencial", "pro", "studio"] as const;
export type Tier = (typeof TIER_ORDER)[number];

export function tierRank(t: Tier): number {
  return TIER_ORDER.indexOf(t);
}

/** O tier atual dá conta do mínimo exigido? */
export function tierAtLeast(atual: Tier, minimo: Tier): boolean {
  return tierRank(atual) >= tierRank(minimo);
}

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  /** O VERBO do degrau. Cada upgrade é comprado por UM motivo, não por uma lista. */
  verbo: string;
  tagline: string;
  features: string[];
  highlighted: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "essencial",
    name: "cria Essencial",
    price: "R$ 19,90",
    verbo: "Organizar",
    tagline: "Suas ideias e sua semana num lugar só",
    features: [
      "Banco de ideias ilimitado",
      "Kanban de produção (da ideia ao publicado)",
      "Calendário, tarefas e metas",
      "Brandbook e Link in Bio",
      "500 MB de arquivos",
      "IA: 10 gerações/mês (pra experimentar)",
    ],
    highlighted: false,
  },
  {
    id: "pro",
    name: "cria Pro",
    price: "R$ 32,90",
    verbo: "Criar melhor",
    tagline: "A IA escreve com você, e os números te dizem se funcionou",
    features: [
      "Tudo do Essencial",
      "IA: 150 gerações/mês (legendas, roteiros, ideias, score)",
      "Insights do Instagram + Meu Feed",
      "Melhor horário pra postar",
      "Tendências e Relatórios",
      "Media Kit automático",
      "5 GB de arquivos",
    ],
    highlighted: true,
  },
  {
    id: "studio",
    name: "cria Studio",
    price: "R$ 49,90",
    verbo: "A IA cria por você",
    tagline: "Pra quem vive de conteúdo e não tem tempo",
    features: [
      "Tudo do Pro",
      "Cria Plano: a IA monta o seu mês inteiro",
      "Cria Stories: o plano semanal de stories",
      "Collabs: parcerias, propostas e cachê",
      "IA: 500 gerações/mês",
      "15 GB de arquivos",
      "Suporte prioritário",
    ],
    highlighted: false,
  },
];

/** Valor numérico do plano, pro pixel de conversão. Uma fonte só: um ternário
 *  que conhecia dois planos mandaria o terceiro pro funil com o preço errado. */
export const PLAN_VALUE: Record<PlanId, number> = {
  essencial: 19.9,
  pro: 32.9,
  studio: 49.9,
};

// ── Armazenamento ──────────────────────────────────────────────────────────
// Trial/sem assinatura = 500MB. (Espelhado no stripe-webhook: o Deno não
// importa o frontend, então lá existe uma cópia. Mexeu aqui, mexe lá.)
export const STORAGE_BYTES: Record<string, number> = {
  trial: 524288000,      // 500 MB
  essencial: 524288000,  // 500 MB
  pro: 5368709120,       // 5 GB
  studio: 16106127360,   // 15 GB
};

export function storageBytesForPlan(plan?: string | null, active?: boolean): number {
  if (active && plan && STORAGE_BYTES[plan] != null) return STORAGE_BYTES[plan];
  return STORAGE_BYTES.trial;
}

export function formatStorage(bytes: number): string {
  if (bytes >= 1073741824) {
    const gb = bytes / 1073741824;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  }
  return `${Math.round(bytes / 1048576)} MB`;
}

// ═══════════════════════════════════════════════════════════════════════════
// O MAPA: RECURSO → TIER MÍNIMO
// ═══════════════════════════════════════════════════════════════════════════

export type FeatureKey =
  | "insights"
  | "feed"
  | "relatorios"
  | "tendencias"
  | "media-kit"
  | "biblioteca"
  | "historico"
  | "cria-plano"
  | "stories"
  | "collabs"
  | "estudio";

export type FeatureDef = {
  /** Tier mínimo. "admin" = só admin (recurso caro, ainda não é produto). */
  minimo: Tier | "admin";
  /** Título da vitrine, em benefício. Nada de "recurso indisponível". */
  titulo: string;
  linha: string;
  ganhos: string[];
};

export const FEATURES: Record<FeatureKey, FeatureDef> = {
  insights: {
    minimo: "pro",
    titulo: "Descubra o que realmente funcionou",
    linha: "Você posta e o número some no app do Instagram. Aqui o desempenho de cada post fica colado no post, no seu histórico, pra sempre.",
    ganhos: [
      "Alcance, salvamentos e compartilhamentos post a post",
      "Qual formato performa melhor pro SEU público",
      "Seu perfil crescendo (ou não), semana a semana",
    ],
  },
  feed: {
    minimo: "pro",
    titulo: "Veja o feed antes de publicar",
    linha: "O post sozinho é bonito. No meio dos outros, às vezes não. O Meu Feed mostra a grade como ela vai ficar de verdade.",
    ganhos: [
      "Prévia do feed com os posts agendados",
      "Cores e ritmo do perfil num olhar",
      "Chega de descobrir o desencaixe depois de publicar",
    ],
  },
  relatorios: {
    minimo: "pro",
    titulo: "O mês inteiro numa página",
    linha: "O que você publicou, o que engajou, o que cresceu. Pronto pra você entender, ou pra mandar pra uma marca.",
    ganhos: ["Evolução de seguidores e engajamento", "Seus melhores posts do período", "Exportável"],
  },
  tendencias: {
    minimo: "pro",
    titulo: "O que está bombando no seu nicho",
    linha: "Achar tendência hoje é rolar o feed por 40 minutos e torcer. Aqui elas chegam separadas pelo seu nicho, com o gancho pronto.",
    ganhos: ["Tendências atualizadas por nicho", "O gancho já escrito pra você adaptar", "Vira post no seu quadro em 1 clique"],
  },
  "media-kit": {
    minimo: "pro",
    titulo: "Seu media kit pronto pra fechar publi",
    linha: "A marca pediu o media kit e você tem 20 minutos. Aqui ele já existe, atualizado com os seus números de verdade.",
    ganhos: ["Gerado sozinho com os dados do seu Instagram", "Com a sua cara e a sua marca", "Vira PDF ou link na hora"],
  },
  biblioteca: {
    minimo: "pro",
    titulo: "Sua biblioteca de referências",
    linha: "Tudo que te inspirou, guardado e organizado, em vez de perdido nos salvos do Instagram.",
    ganhos: ["Referências separadas por tema", "Busca no que você salvou", "Vira ideia num clique"],
  },
  historico: {
    minimo: "pro",
    titulo: "Tudo que você já publicou",
    linha: "Seu arquivo. Pra reciclar o que funcionou e não repetir o que não funcionou.",
    ganhos: ["Histórico completo com desempenho", "Reciclar conteúdo perene", "Nada se perde"],
  },
  "cria-plano": {
    minimo: "studio",
    titulo: "A IA monta o seu mês inteiro",
    linha: "Domingo à noite, olhando o calendário vazio, sem saber o que postar na segunda. O Cria Plano acaba com isso: ele monta o mês com os seus pilares, no seu tom.",
    ganhos: [
      "Um mês de conteúdo em minutos, não em domingos",
      "Baseado nos SEUS pilares e no seu brandbook",
      "Você edita o que quiser: é ponto de partida, não camisa de força",
    ],
  },
  stories: {
    minimo: "studio",
    titulo: "Nunca mais 'o que eu posto no story hoje?'",
    linha: "O story é diário e é onde a audiência realmente te vê. É também o que mais dá branco. O Cria Stories entrega o plano da semana pronto.",
    ganhos: ["Plano semanal de stories, dia a dia", "No seu tom, com tendências do seu nicho", "Com lembrete na hora certa"],
  },
  collabs: {
    minimo: "studio",
    titulo: "Transforme audiência em dinheiro",
    linha: "Publi combinada por áudio, valor no bloco de notas, e você esquecendo de cobrar. O Collabs organiza a parte que paga suas contas.",
    ganhos: [
      "Propostas e contratos com a marca",
      "Cachê registrado: quanto foi combinado e quanto entrou",
      "Entregas da campanha, sem esquecer nenhuma",
    ],
  },
  estudio: {
    // O Estúdio deixou de ser uma TELA (rota /app/estudio, item de menu) que
    // gerava imagem por IA — cara, fora da identidade da pessoa, e que ela ia
    // refazer no Canva de qualquer jeito. Virou uma ABA dentro do post, que
    // devolve o PROMPT. Custa uma geração da cota de IA, e é do Pro pra cima.
    minimo: "pro",
    titulo: "O prompt da arte, na sua marca",
    linha: "Você escreveu o post e travou na arte. O Estúdio lê o que você escreveu e devolve o prompt da imagem — nas suas cores, na sua fonte, no seu tom.",
    ganhos: [
      "Um prompt por página do carrossel, todos no mesmo estilo",
      "Em português pra você conferir, em inglês pra colar no gerador",
      "Você usa o gerador que já tem: Midjourney, Canva, ChatGPT",
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// ROTA → RECURSO  (é isto que faz o MENU saber de que plano cada coisa é)
//
// O menu marcava "PRO" na mão, item por item — e por isso só o Cria Estúdio
// tinha selo. Insights, Tendências, Media Kit, Relatórios, Collabs: nenhum
// avisava que era de outro plano. A pessoa clicava, batia numa trava e
// descobria ali que não tinha. Descobrir o preço depois de querer é a pior
// hora possível.
//
// Agora o selo sai DAQUI, do mesmo mapa que a trava usa. Recurso que muda de
// plano no código muda de selo no menu junto, sem ninguém lembrar de nada.
// ═══════════════════════════════════════════════════════════════════════════

export const ROUTE_FEATURE: Record<string, FeatureKey> = {
  "/app/insights": "insights",
  "/app/feed": "feed",
  "/app/relatorios": "relatorios",
  "/app/tendencias": "tendencias",
  "/app/media-kit": "media-kit",
  "/app/biblioteca": "biblioteca",
  "/app/historico": "historico",
  "/app/autopilot": "cria-plano",
  "/app/stories": "stories",
  "/app/collabs": "collabs",
  // Não existe mais "/app/estudio": o Estúdio virou aba do post. Ele não é
  // destino nenhum — por isso não tem rota e não tem selo de menu.
};

/** O nome do plano como a pessoa lê. */
export const TIER_LABEL: Record<PlanId, string> = {
  essencial: "Essencial",
  pro: "Pro",
  studio: "Studio",
};

/** Tier mínimo exigido por uma rota. `null` = está em todos os planos. */
export function minimoDaRota(to: string): Tier | "admin" | null {
  const key = ROUTE_FEATURE[to];
  return key ? FEATURES[key].minimo : null;
}

/**
 * O selo que o menu deve mostrar nesta rota, pra QUEM está olhando.
 *
 * Regra: só marca o que a pessoa AINDA NÃO TEM. Escrever "PRO" ao lado de um
 * item que o assinante Pro já usa não informa nada — é ruído, e ruído em menu
 * a pessoa aprende a ignorar (aí quando o selo importar, ela não vê).
 * `admin` nunca vira selo: não é plano, é obra.
 */
export function seloDaRota(to: string, atual: Tier): string | null {
  const minimo = minimoDaRota(to);
  if (!minimo || minimo === "admin" || minimo === "none") return null;
  if (tierAtLeast(atual, minimo)) return null;
  return TIER_LABEL[minimo as PlanId];
}
