/* ═══════════════════════════════════════════════════════════════════════════
   CRIAKUT (Walter, 14/10/2026) · doc "Criakut: ecossistema, fluxo e plano"

   A comunidade estilo Orkut do Cria: cada pessoa entra e cai na PRÓPRIA página,
   que ela personaliza; busca e mural são as ferramentas. Fase 1 = página e
   busca, só pra convidados (a rota existe, mas não está no menu ainda).

   Regra de segurança: tudo aqui lê SÓ as tabelas criakut_* (e as funções
   criakut_buscar / criakut_perfil). Nunca posts, crm_* ou fin_*.
   ═══════════════════════════════════════════════════════════════════════════ */

export type FuncaoCriakut = "social_media" | "criadora" | "designer" | "editor_video" | "filmmaker" | "copy";
export type CapaTipo = "cria-1" | "cria-2" | "cria-3" | "cria-4" | "cria-5" | "propria";
export type Unidade = "peca" | "mes" | "pacote" | "diaria" | "hora";

export const FUNCOES: { valor: FuncaoCriakut; nome: string }[] = [
  { valor: "social_media", nome: "Social mídia" },
  { valor: "criadora", nome: "Criadora de conteúdo" },
  { valor: "designer", nome: "Designer" },
  { valor: "editor_video", nome: "Editor de vídeo" },
  { valor: "filmmaker", nome: "Filmmaker" },
  { valor: "copy", nome: "Copywriter" },
];
export const nomeFuncao = (f?: string | null) => FUNCOES.find((x) => x.valor === f)?.nome ?? "";

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
};

/** O que a função criakut_perfil devolve: o perfil + listas + números. */
export type PaginaCriakutDados = PerfilCriakut & {
  eh_meu: boolean;
  eu_sigo: boolean;
  seguidores: number;
  servicos: Servico[];
  portfolio: ItemPortfolio[];
  quem_segue: Seguidor[];
};

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
