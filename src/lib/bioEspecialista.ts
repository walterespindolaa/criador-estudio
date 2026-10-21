/* ═══════════════════════════════════════════════════════════════════════════
   PÁGINA DE ESPECIALISTA NO MODO SITE (21/10/2026)

   Walter viu um reels de alguém "tirando especialistas do Linktree" e pediu o
   mesmo dentro do Cria, servindo pra qualquer nicho: quem abre a página dá de
   cara com a pessoa (vídeo curto em loop ou foto), o nome em assinatura, logo
   abaixo os números que provam, e um botão de ação preso no pé da tela.

   Três blocos novos do Site saem daqui:
     apresentacao  vídeo ou foto de tela cheia + assinatura + profissão
     numeros       até 4 provas (anos, clientes, cidade) + linha de rodapé
     acao_fixa     o botão que acompanha a rolagem

   Este arquivo guarda o que é regra e não desenho: as fontes de assinatura,
   as sugestões por nicho, o endereço do vídeo no Bunny e o traço desenhado.
   ═══════════════════════════════════════════════════════════════════════════ */

import { BUNNY_CRIAPOST_CDN_HOSTNAME } from "@/lib/constants";

/* ── AS FONTES DA ASSINATURA ──
   Walter pediu 4 ou 5 opções em vez de uma. Todas do Google Fonts, carregadas
   só quando a página usa (ver useFonteAssinatura). `ajuste` compensa o tamanho
   natural de cada uma: com o mesmo font-size, a Great Vibes sai bem maior que a
   Mrs Saint Delafield, e trocar de fonte não pode fazer a assinatura pular. */
export const FONTES_ASSINATURA = [
  { id: "delafield", nome: "Elegante", familia: "Mrs Saint Delafield", ajuste: 1 },
  { id: "muellerhoff", nome: "Rápida", familia: "Herr Von Muellerhoff", ajuste: 1.05 },
  { id: "great-vibes", nome: "Clássica", familia: "Great Vibes", ajuste: 0.78 },
  { id: "allura", nome: "Leve", familia: "Allura", ajuste: 0.82 },
  { id: "la-doulaise", nome: "Rebuscada", familia: "Monsieur La Doulaise", ajuste: 0.8 },
] as const;

export type FonteAssinaturaId = (typeof FONTES_ASSINATURA)[number]["id"];

export const fonteAssinatura = (id: unknown) =>
  FONTES_ASSINATURA.find((f) => f.id === id) ?? FONTES_ASSINATURA[0];

/** Endereço do CSS da fonte no Google. Só letras e espaço no nome, que é nosso. */
export const urlFonteGoogle = (familia: string) =>
  `https://fonts.googleapis.com/css2?family=${familia.replace(/ /g, "+")}&display=swap`;

/* ── A ASSINATURA ──
   Posição e tamanho em PORCENTAGEM da capa, não em pixel: a mesma página
   aparece numa prévia de 300px no editor e num celular de 430px, e a
   assinatura tem que cair no mesmo lugar nos dois. */
export type ModoAssinatura = "fonte" | "desenho" | "nenhuma";

export type Assinatura = {
  modo: ModoAssinatura;
  fonte: FonteAssinaturaId;
  /** Traço desenhado, num quadro de 440x200. */
  d: string;
  /** Canto esquerdo, em % da largura da capa. */
  x: number;
  /** Topo, em % da altura da capa. */
  y: number;
  /** Largura, em % da largura da capa. */
  escala: number;
};

export const QUADRO_W = 440;
export const QUADRO_H = 200;
export const ESCALA_MIN = 25;
export const ESCALA_MAX = 95;

const limita = (v: unknown, min: number, max: number, padrao: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : padrao;
  return Math.min(max, Math.max(min, n));
};

/** O traço vem do banco, que é jsonb livre: só comandos M e L com números. Um
 *  `d` com qualquer outra coisa é descartado em vez de ir pro SVG público. */
export const tracoValido = (d: unknown): string =>
  typeof d === "string" && d.length <= 40000 && /^[ML0-9.\s-]*$/.test(d) ? d.trim() : "";

export function lerAssinatura(v: unknown): Assinatura {
  const a = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const modo: ModoAssinatura = a.modo === "desenho" || a.modo === "nenhuma" ? a.modo : "fonte";
  return {
    modo,
    fonte: fonteAssinatura(a.fonte).id,
    d: tracoValido(a.d),
    x: limita(a.x, 0, 90, 6),
    y: limita(a.y, 0, 92, 62),
    escala: limita(a.escala, ESCALA_MIN, ESCALA_MAX, 70),
  };
}

export type Ponto = { x: number; y: number };

/** Junta os traços num `d` só. Ponto a menos de 1,5 unidade do anterior é
 *  descartado: o dedo parado gera dezenas de pontos iguais e o texto do traço
 *  cresceria sem ganhar nada de desenho. */
export function tracosParaD(tracos: Ponto[][]): string {
  const partes: string[] = [];
  for (const t of tracos) {
    const pts: Ponto[] = [];
    for (const p of t) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const ult = pts[pts.length - 1];
      if (!ult || Math.hypot(p.x - ult.x, p.y - ult.y) >= 1.5) pts.push(p);
    }
    if (!pts.length) continue;
    const f = (p: Ponto) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    // Um toque só vira um pontinho visível (M e L no mesmo lugar).
    partes.push(`M${f(pts[0])} ` + (pts.length === 1 ? `L${f(pts[0])}` : pts.slice(1).map((p) => `L${f(p)}`).join(" ")));
  }
  return partes.join(" ");
}

/* ── O VÍDEO DA CAPA NO BUNNY ──
   O vídeo vai pra biblioteca do Cria Post, que tem a cópia em MP4 ligada
   (conferido em 21/10/2026: play_720p.mp4 responde lá; na outra biblioteca
   não). MP4 direto porque vídeo de fundo não pode depender de player nem de
   HLS: o Safari toca HLS, o Chrome do Android não.

   Ordem 720, 480, 360: o navegador tenta o próximo se um não existir. Vídeo
   gravado em resolução baixa não ganha a versão de 720. */
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const guidValido = (g: unknown): string => (typeof g === "string" && GUID.test(g) ? g.toLowerCase() : "");

export function videoDaCapa(guid: unknown): { fontes: string[]; poster: string } | null {
  const g = guidValido(guid);
  if (!g) return null;
  const base = `https://${BUNNY_CRIAPOST_CDN_HOSTNAME}/${g}`;
  return {
    fontes: [`${base}/play_720p.mp4`, `${base}/play_480p.mp4`, `${base}/play_360p.mp4`],
    poster: `${base}/thumbnail.jpg`,
  };
}

/** Limite do vídeo da capa. Cada visita baixa o arquivo inteiro e o Bunny
 *  cobra por GB entregue: 8 segundos em 720p dá perto de 2 MB por visita. */
export const VIDEO_MAX_SEGUNDOS = 8;
export const VIDEO_MAX_MB = 80;

/** Quem pediu economia de dados ou está em rede lenta fica só com a imagem. */
export function podeTocarVideoDeFundo(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (c?.saveData) return false;
  if (c?.effectiveType && /(^|-)2g$/.test(c.effectiveType)) return false;
  return true;
}

/* ── SUGESTÕES POR NICHO ──
   Página de especialista muda pouco de estrutura e muito de conteúdo. Aqui fica
   o ponto de partida de cada nicho: o que costuma provar autoridade, que
   registro aparece no rodapé e o que o botão pede. Os números são exemplos
   entre colchetes, pra ninguém publicar um número que não é dele. */
export type Nicho = {
  id: string;
  nome: string;
  profissao: string;
  numeros: { valor: string; rotulo: string }[];
  local: string;
  registro: string;
  cta: string;
  /** Regra do conselho de classe que pesa nesse nicho. */
  aviso?: string;
};

export const NICHOS: Nicho[] = [
  { id: "saude", nome: "Saúde (nutrição, fisio, psicologia)", profissao: "Nutrição esportiva",
    numeros: [{ valor: "[anos]", rotulo: "anos de consultório" }, { valor: "[pacientes]", rotulo: "pacientes atendidos" }, { valor: "[cidade]", rotulo: "e online" }],
    local: "[Clínica], [bairro]", registro: "CRN [número]", cta: "Agendar consulta",
    aviso: "Conselhos de saúde limitam antes e depois e promessa de resultado. Confira a regra do conselho antes de publicar." },
  { id: "estetica", nome: "Odontologia e estética", profissao: "Odontologia estética",
    numeros: [{ valor: "[anos]", rotulo: "anos de estética" }, { valor: "[procedimentos]", rotulo: "procedimentos feitos" }, { valor: "[cidade]", rotulo: "[bairro]" }],
    local: "[Clínica], [bairro]", registro: "CRO [número]", cta: "Agendar avaliação",
    aviso: "O CFO tem regra própria pra antes e depois. Confira antes de publicar fotos de paciente." },
  { id: "advocacia", nome: "Advocacia", profissao: "Direito de família",
    numeros: [{ valor: "[anos]", rotulo: "anos de advocacia" }, { valor: "[estado]", rotulo: "atendimento no estado" }, { valor: "Online", rotulo: "reunião por vídeo" }],
    local: "[Escritório], [cidade]", registro: "OAB/[UF] [número]", cta: "Falar com o escritório",
    aviso: "A OAB não permite divulgar resultado nem quantidade de causas. Use anos de atuação, área e onde atende." },
  { id: "fitness", nome: "Personal e esporte", profissao: "Personal trainer",
    numeros: [{ valor: "[anos]", rotulo: "anos treinando gente" }, { valor: "[alunos]", rotulo: "alunos" }, { valor: "[cidade]", rotulo: "presencial e online" }],
    local: "[Studio], [bairro]", registro: "CREF [número]", cta: "Quero uma aula experimental" },
  { id: "beleza", nome: "Beleza (cabelo, unha, maquiagem)", profissao: "Cabelo e coloração",
    numeros: [{ valor: "[anos]", rotulo: "anos de salão" }, { valor: "[especialidade]", rotulo: "o que mais faço" }, { valor: "[cidade]", rotulo: "[bairro]" }],
    local: "[Salão], [bairro]", registro: "[dias e horário]", cta: "Agendar horário" },
  { id: "comida", nome: "Confeitaria e comida", profissao: "Confeitaria artesanal",
    numeros: [{ valor: "[quantidade]", rotulo: "encomendas entregues" }, { valor: "[prazo]", rotulo: "de antecedência" }, { valor: "[cidade]", rotulo: "entrega na região" }],
    local: "[Ateliê ou cozinha]", registro: "[até quando aceita encomenda]", cta: "Fazer encomenda" },
  { id: "imoveis", nome: "Imóveis", profissao: "Corretor de imóveis",
    numeros: [{ valor: "[anos]", rotulo: "anos de mercado" }, { valor: "[famílias]", rotulo: "famílias com a chave na mão" }, { valor: "[cidades]", rotulo: "onde atuo" }],
    local: "[Imobiliária], [bairro]", registro: "CRECI [número]", cta: "Ver imóveis disponíveis" },
  { id: "educacao", nome: "Cursos, mentoria e consultoria", profissao: "Mentoria de carreira",
    numeros: [{ valor: "[anos]", rotulo: "anos de mercado" }, { valor: "[alunos]", rotulo: "alunos e mentorados" }, { valor: "[formato]", rotulo: "online e ao vivo" }],
    local: "[cidade] e online", registro: "[empresa ou certificação]", cta: "Quero saber como funciona" },
];

export const nichoPorId = (id: unknown) => NICHOS.find((n) => n.id === id) ?? null;
