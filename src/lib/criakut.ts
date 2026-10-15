/* ═══════════════════════════════════════════════════════════════════════════
   CRIAKUT (Walter, 14/10/2026) · doc "Criakut: ecossistema, fluxo e plano"

   A comunidade estilo Orkut do Cria: cada pessoa entra e cai na PRÓPRIA página,
   que ela personaliza; busca e mural são as ferramentas. Fase 1 = página e
   busca, só pra convidados (a rota existe, mas não está no menu ainda).

   Regra de segurança: tudo aqui lê SÓ as tabelas criakut_* e as funções
   criakut_*. Nunca posts, crm_* ou fin_* direto: as pontes com o Cria
   Parceiros e com a carteira acontecem DENTRO de criakut_aceitar, no banco.
   ═══════════════════════════════════════════════════════════════════════════ */

export type FuncaoCriakut = "social_media" | "agencia" | "criadora" | "designer" | "editor_video" | "filmmaker" | "copy";
export type CapaTipo = "cria-1" | "cria-2" | "cria-3" | "cria-4" | "cria-5" | "propria";
export type Unidade = "peca" | "mes" | "pacote" | "diaria" | "hora";

/* Agência (Walter, 15/10/2026: "a conta da social mídia já é agência"): funciona
   igual social mídia em tudo (busca, mural, "o que procuro", carteira quando uma
   criadora contrata). Criadora vai por último: ela é marcada sozinha. */
export const FUNCOES: { valor: FuncaoCriakut; nome: string }[] = [
  { valor: "social_media", nome: "Social mídia" },
  { valor: "agencia", nome: "Agência" },
  { valor: "designer", nome: "Designer" },
  { valor: "editor_video", nome: "Editor de vídeo" },
  { valor: "filmmaker", nome: "Filmmaker" },
  { valor: "copy", nome: "Copywriter" },
  { valor: "criadora", nome: "Criadora de conteúdo" },
];
/** Quem gerencia clientes (social mídia ou agência): procura parceiros e recebe criadoras na carteira. */
export const ehGestao = (f?: string | null) => f === "social_media" || f === "agencia";
export const nomeFuncao = (f?: string | null) => FUNCOES.find((x) => x.valor === f)?.nome ?? "";
/** "Designer · Editor de vídeo": a principal primeiro, depois as outras. */
export const nomesFuncoes = (f?: string | null, outras?: string[] | null) =>
  [f, ...(outras ?? []).filter((x) => x !== f)].map(nomeFuncao).filter(Boolean).join(" · ");

export const ESTILOS = ["Minimalista", "Editorial", "Colorido", "Divertido", "Luxo", "Orgânico", "Técnico", "Acolhedor"];
export const NICHOS = ["Saúde", "Estética", "Nutrição", "Fisioterapia", "Psicologia", "Odontologia", "Gastronomia",
  "Moda", "Beleza", "Imobiliário", "Educação", "Finanças", "Fitness", "Pet", "Varejo"];

export const UNIDADES: { valor: Unidade; sufixo: string }[] = [
  { valor: "peca", sufixo: "/peça" },
  { valor: "mes", sufixo: "/mês" },
  { valor: "pacote", sufixo: " o pacote" },
  { valor: "diaria", sufixo: "/diária" },
  { valor: "hora", sufixo: "/hora" },
];

export type Servico = { id?: string; titulo: string; detalhe?: string | null; preco_centavos: number | null; unidade: Unidade; ordem: number };
export type ItemPortfolio = { id: string; media_url: string; legenda?: string | null; ordem: number };
export type Seguidor = { slug: string; nome: string; foto_url: string | null };

export type PerfilCriakut = {
  user_id: string;
  slug: string;
  nome: string;
  funcao: FuncaoCriakut;
  cidade: string | null;
  atende_remoto: boolean;
  sobre: string | null;
  status_texto: string | null;
  recado_do_dia: string | null;
  foto_url: string | null;
  capa_tipo: CapaTipo;
  capa_url: string | null;
  estilos: string[];
  nichos: string[];
  instagram: string | null;
  publicado: boolean;
  mostrar_visitas?: boolean;
  /* Perfil por função (Walter, 14/10/2026): criadora mostra Instagram e o que
     procura; prestador mostra serviços e portfólio; social mídia, os dois. */
  mostrar_cidade?: boolean;
  mostrar_instagram?: boolean;
  busco?: FuncaoCriakut[];
  busco_texto?: string | null;
  /** Além da principal (até 3). Criadora não tem. */
  outras_funcoes?: FuncaoCriakut[];
};

/** O que a função criakut_perfil devolve: o perfil + listas + números. */
export type PaginaCriakutDados = PerfilCriakut & {
  eh_meu: boolean;
  eu_sigo: boolean;
  seguidores: number;
  servicos: Servico[];
  portfolio: ItemPortfolio[];
  quem_segue: Seguidor[];
  entregas_no_cria?: number;
  trabalhos_concluidos?: number;
  reputacao?: Reputacao;
  /* Fase 3 (mostrar_visitas só vem na minha página) */
  destaque?: boolean;
  comunidades?: ComunidadeMini[];
  instagram_posts?: { thumb: string; link: string; tipo: string; em: string | null }[];
  instagram_seguidores?: number | null;
  contratacoes?: number;
  pedidos_abertos?: { id: string; titulo: string; funcao: FuncaoCriakut; tipo: "recorrente" | "avulso"; valor_min_centavos: number | null; valor_max_centavos: number | null; unidade: Unidade }[];
};

/* ── FASE 2: orçamento, mural, propostas, conversa, avaliação ─────────────── */

export type Depoimento = {
  nota: number; depoimento: string; criado_em: string; papel: "contratado" | "contratante";
  autor_nome: string | null; autor_slug: string | null; autor_foto: string | null; trabalho: string;
};
export type Reputacao = {
  nota: number | null; avaliacoes: number; nota_contratante: number | null;
  no_prazo: number | null; criatividade: number | null; comunicacao: number | null;
  depoimentos: Depoimento[];
};

export type StatusProposta = "aberta" | "fechada" | "recusada" | "cancelada" | "concluida";
export type Ponte = "parceiros" | "carteira" | "conversa";

export type PedidoMural = {
  id: string; funcao: FuncaoCriakut; titulo: string; descricao: string | null; nicho: string | null; estilos: string[];
  valor_min_centavos: number | null; valor_max_centavos: number | null; unidade: Unidade; prazo_texto: string | null;
  tipo: "recorrente" | "avulso"; presencial: boolean; cidade: string | null; criado_em: string;
  autor_id: string; autor_nome: string; autor_slug: string; autor_foto: string | null; autor_funcao: FuncaoCriakut;
  propostas: number; ja_propus: boolean; eh_meu: boolean; status: "aberto" | "fechado" | "cancelado";
};

export type ResumoProposta = {
  id: string; papel: "contratante" | "contratado"; outro_nome: string; outro_slug: string; outro_foto: string | null;
  titulo: string; valor_centavos: number | null; unidade: Unidade; prazo: string | null; status: StatusProposta;
  minha_vez: boolean; ponte: Ponte | null; atualizado_em: string; ultima_msg: string | null; parada: boolean; ja_avaliei: boolean;
};

export type Mensagem = {
  id: string; meu: boolean; texto: string | null; anexo_url: string | null; anexo_nome: string | null;
  eh_entrega: boolean; sistema: boolean; tem_contato: boolean; criado_em: string;
};

export type Conversa = {
  proposta: {
    id: string; titulo: string; escopo: string | null; valor_centavos: number | null; unidade: Unidade; prazo: string | null;
    recorrente: boolean; status: StatusProposta; origem: "pedido" | "mural"; ponte: Ponte | null;
    fechado_em: string | null; contratado_entregou_em: string | null; concluido_em: string | null;
    pago_em: string | null; recebido_em: string | null; criado_em: string;
  };
  papel: "contratante" | "contratado";
  outro: { nome: string; slug: string; foto_url: string | null; funcao: FuncaoCriakut };
  minha_vez: boolean; tem_entrega: boolean; ja_avaliei: boolean;
  mensagens: Mensagem[];
};

export const STATUS_PROPOSTA: Record<StatusProposta, { nome: string; cor: string }> = {
  aberta: { nome: "Negociando", cor: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300" },
  fechada: { nome: "Fechado", cor: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-300" },
  concluida: { nome: "Concluído", cor: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300" },
  recusada: { nome: "Recusada", cor: "bg-muted text-muted-foreground" },
  cancelada: { nome: "Retirada", cor: "bg-muted text-muted-foreground" },
};

export const PONTE_TEXTO: Record<Ponte, string> = {
  parceiros: "Ligados no Cria Parceiros",
  carteira: "Entrou na carteira da social mídia",
  conversa: "Trabalho segue pela conversa",
};

/** "1.500" / "1500,50" -> centavos. Vazio ou inválido = null ("a combinar"). */
export function reaisParaCentavos(txt: string): number | null {
  const limpo = txt.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) && n >= 0 && n < 10_000_000 ? Math.round(n * 100) : null;
}

export function faixaTexto(min: number | null, max: number | null, unidade: Unidade): string {
  if (min == null && max == null) return "a combinar";
  if (min != null && max != null && min !== max) return `${precoTexto(min, unidade).replace(/(\/.*| o pacote)$/, "")} a ${precoTexto(max, unidade)}`;
  return precoTexto(min ?? max, unidade);
}

/** Handle do Instagram limpo (o banco só aceita letras, números, ponto e _). */
export function limparInstagram(v?: string | null): string | null {
  const s = (v ?? "").trim().replace(/^@+/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").split(/[/?#\s]/)[0];
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s : null;
}

export function precoTexto(centavos: number | null | undefined, unidade: Unidade): string {
  if (centavos == null) return "a combinar";
  const reais = (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: centavos % 100 ? 2 : 0 });
  return reais + (UNIDADES.find((u) => u.valor === unidade)?.sufixo ?? "");
}

/** "Luana Moraes" -> "luana-moraes" (endereço da página). */
export function slugDe(texto: string): string {
  const s = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return s.length >= 3 ? s : (s + "-cria").slice(0, 40);
}
export const slugValido = (s: string) => /^[a-z0-9][a-z0-9-]{2,39}$/.test(s);

export function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

/** Mesmo filtro do banco (criakut_url_ok): só imagem de host conhecido. */
export const urlConfiavel = (u?: string | null): string | null =>
  u && /^https:\/\/((ecbzfjzoqidowrsfsfih|exuxlwdnkgmhtnwoyvwo)\.supabase\.co\/storage\/v1\/object\/public\/|d8j0ntlcm91z4\.cloudfront\.net\/|[a-z0-9-]+\.googleusercontent\.com\/)/.test(u) ? u : null;

/* ═══ FASE 3: recados, visitas, comunidades, Destaque, admin ═══════════════ */

export type AutorMini = { nome: string; slug: string; foto_url: string | null; funcao: FuncaoCriakut; destaque: boolean } | null;
export type ComunidadeMini = { slug: string; nome: string; emoji: string; cor: string };

export type Recado = { id: string; texto: string; criado_em: string; autor: AutorMini; posso_apagar: boolean; meu: boolean };
export type RecadosDados = { total: number; itens: Recado[] };

export type Visitante = { nome: string; slug: string; foto_url: string | null; funcao: FuncaoCriakut; ultima: string };
export type MinhasVisitas = { mostrar: boolean; total_mes: number; lista: Visitante[] };

export type PublicoComunidade = "todos" | "criadores" | "prestadores";
export const PUBLICOS: { valor: PublicoComunidade; nome: string }[] = [
  { valor: "criadores", nome: "Criadores" }, { valor: "prestadores", nome: "Prestadores" }, { valor: "todos", nome: "Todos" },
];
export type ComunidadeItem = ComunidadeMini & {
  id: string; descricao: string | null; publico: PublicoComunidade; membros: number; topicos: number; sou_membro: boolean; ativa: boolean;
  status: "pendente" | "aprovada" | "recusada"; motivo_recusa: string | null; minha_sugestao: boolean;
};
export type ComunidadeParecida = ComunidadeMini & { publico: PublicoComunidade; status: string };
export type TopicoItem = { id: string; titulo: string; fixo: boolean; respostas: number; criado_em: string; ultima_em: string; oculto: boolean; autor: AutorMini };
export type ComunidadeDados = ComunidadeMini & {
  id: string; descricao: string | null; ativa: boolean; ordem: number; sou_membro: boolean; membros: number;
  amostra: { nome: string; slug: string; foto_url: string | null }[];
  topicos: TopicoItem[];
};
export type RespostaItem = { id: string; texto: string; criado_em: string; oculto: boolean; autor: AutorMini; meu: boolean };
export type TopicoDados = {
  id: string; titulo: string; texto: string | null; fixo: boolean; oculto: boolean; criado_em: string; autor: AutorMini; meu: boolean;
  comunidade: ComunidadeMini & { id: string }; sou_membro: boolean; respostas: RespostaItem[];
};

export type MeuDestaque = {
  ativo: boolean; status: string | null; ate: string | null; desde: string | null; a_venda: boolean; pode_comprar: boolean;
  motivo: "desligado" | "sem_pagina" | "escondida" | "criadora" | null; visitas_30d: number; pedidos_30d: number;
};
export const PRECO_DESTAQUE = "R$ 14,90";

export type DenunciaAdmin = {
  tipo: "recado" | "topico" | "resposta" | "perfil"; alvo_id: string; quantas: number; ultima: string;
  motivos: string[] | null; texto: string | null; oculto: boolean | null; autor: AutorMini;
};
export type PainelAdminCriakut = {
  aberto: boolean; destaque_ativo: boolean; convidados: number; paginas: number; paginas_total: number;
  propostas_mes: number; fechadas_mes: number; concluidas_mes: number; paradas: number; destaques: number;
  pontes: Record<string, number> | null; denuncias: DenunciaAdmin[];
  comunidades_pendentes?: { id: string; nome: string; descricao: string | null; emoji: string; publico: PublicoComunidade; criado_em: string; autor: AutorMini }[];
};
export type FunilLinha = { nome: string; slug: string; propostas: number; fechadas: number; concluidas: number; pagas: number; avaliadas: number; paradas: number; avisos_contato: number };

export function quandoFoi(iso: string): string {
  const min = (Date.now() - new Date(iso).getTime()) / 60000;
  if (min < 2) return "agora";
  if (min < 60) return `há ${Math.floor(min)} min`;
  if (min < 60 * 24) return `há ${Math.floor(min / 60)} h`;
  const d = Math.floor(min / 1440);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

/** Quem só contrata (criadora) tem página de "quem eu sou e o que procuro";
 *  quem presta serviço tem página de vitrine. Social mídia faz os dois. */
export const ehContratante = (f?: string | null) => f === "criadora";
export const ofereceServico = (f?: string | null) => f !== "criadora";
export const PODE_BUSCAR = FUNCOES.filter((x) => x.valor !== "criadora");

export function numeroCurto(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "").replace(".", ",") + " mi";
  if (n >= 10_000) return Math.round(n / 1000) + " mil";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "").replace(".", ",") + " mil";
  return String(n);
}
