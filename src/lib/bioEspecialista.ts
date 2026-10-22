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

import { ehMarcador } from "@/lib/bioMovimento";
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

/* ── ONDE ATENDE (22/10/2026) ──
   "Onde atende" era um campo de texto que só servia pra quem tem um endereço.
   Especialista atende de jeitos diferentes, e às vezes de mais de um:
   consultório em Itajaí E online pro Brasil, personal que vai na casa do
   aluno, confeitaria que entrega. Cada forma marcada vira um pedaço do bloco,
   e o resumo curto embaixo dos números sai daqui, sem digitar duas vezes. */
export type LocalAtendimento = { nome: string; endereco: string; cidade: string; horario: string };

export type Atendimento = {
  presencial: boolean;
  online: boolean;
  domicilio: boolean;
  entrega: boolean;
  locais: LocalAtendimento[];
  online_texto: string;
  regiao: string;
  entrega_texto: string;
  retirada: string;
};

const s_ = (v: unknown) => (typeof v === "string" ? v : "");

export function lerAtendimento(d: Record<string, unknown> | null | undefined): Atendimento {
  const x = d ?? {};
  const f = (x.formas && typeof x.formas === "object" ? x.formas : {}) as Record<string, unknown>;
  const locais = (Array.isArray(x.locais) ? x.locais : [])
    .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
    .map((l) => ({ nome: s_(l.nome), endereco: s_(l.endereco), cidade: s_(l.cidade), horario: s_(l.horario) }));
  return {
    presencial: f.presencial === true,
    online: f.online === true,
    domicilio: f.domicilio === true,
    entrega: f.entrega === true,
    locais,
    online_texto: s_(x.online_texto),
    regiao: s_(x.regiao),
    entrega_texto: s_(x.entrega_texto),
    retirada: s_(x.retirada),
  };
}

/** O mesmo Atendimento, sem o que ainda é marcador ("[cidade]", "[Nome do
 *  local]"). É o que a página PÚBLICA desenha: o modelo aplicado vem com
 *  marcadores pra a pessoa saber o que trocar, e esquecido um, o visitante
 *  não pode ver colchete. O editor continua lendo o original. */
export function atendimentoPublico(d: Record<string, unknown> | null | undefined): Atendimento {
  const a = lerAtendimento(d);
  const l = (t: string) => (ehMarcador(t) ? "" : t);
  return {
    ...a,
    locais: a.locais.map((x) => ({ nome: l(x.nome), endereco: l(x.endereco), cidade: l(x.cidade), horario: l(x.horario) })),
    online_texto: l(a.online_texto), regiao: l(a.regiao), entrega_texto: l(a.entrega_texto), retirada: l(a.retirada),
  };
}

/** "a", "a e b", "a, b e c". */
export const juntarComE = (xs: string[]) => {
  const v = xs.map((x) => x.trim()).filter(Boolean);
  return v.length <= 1 ? (v[0] ?? "") : `${v.slice(0, -1).join(", ")} e ${v[v.length - 1]}`;
};

/** A linha curta que vai embaixo dos números: "Itajaí e online",
 *  "Atende em casa em Itajaí e BC", "Entrega em Navegantes". */
export function resumoAtendimento(a: Atendimento): string {
  const partes: string[] = [];
  if (a.presencial) {
    const cidades = Array.from(new Set(a.locais.map((l) => l.cidade.trim()).filter(Boolean)));
    partes.push(cidades.length ? juntarComE(cidades) : "Presencial");
  }
  if (a.domicilio) partes.push(a.regiao.trim() ? `em casa em ${a.regiao.trim()}` : "em casa");
  if (a.entrega) partes.push(a.regiao.trim() ? `entrega em ${a.regiao.trim()}` : "entrega");
  if (a.online) partes.push("online");
  const t = juntarComE(partes);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

export const temAlgumAtendimento = (a: Atendimento) => a.presencial || a.online || a.domicilio || a.entrega;

/* ── MAPA DE VERDADE ──
   O mapa embutido sem chave o Google fechou (conferido em 21/10/2026: responde
   404 com X-Frame-Options SAMEORIGIN). A Maps Embed API é gratuita e sem limite
   de uso, mas pede uma chave. Sem a chave no ambiente, nada muda: a página
   mostra o mapinha desenhado e os botões de rota, como sempre. */
export const chaveMapa = (): string =>
  ((import.meta.env as Record<string, string | undefined>).VITE_GOOGLE_MAPS_EMBED_KEY ?? "").trim();

export const urlMapaEmbutido = (endereco: string, chave = chaveMapa()): string =>
  chave && endereco.trim()
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(chave)}&q=${encodeURIComponent(endereco.trim())}&language=pt-BR`
    : "";

/* ── SUGESTÕES POR NICHO ──
   Página de especialista muda pouco de estrutura e muito de conteúdo. Aqui fica
   o ponto de partida de cada nicho: o que costuma provar autoridade, que
   registro aparece no rodapé, o que o botão pede, como atende, as cores e a
   pergunta que o cliente desse ramo faz antes de marcar. Números e nomes vêm
   entre colchetes, pra ninguém publicar um número que não é dele. */
export type Nicho = {
  id: string;
  nome: string;
  profissao: string;
  numeros: { valor: string; rotulo: string }[];
  local: string;
  registro: string;
  cta: string;
  mensagem: string;
  tema: "escuro" | "claro";
  /** Cor do botão fixo e dos botões da página, com o texto que lê em cima. */
  cor: string;
  corTexto: string;
  sobre: { titulo: string; texto: string };
  atendimento: {
    formas: Partial<Record<"presencial" | "online" | "domicilio" | "entrega", boolean>>;
    online_texto?: string;
    regiao?: string;
    entrega_texto?: string;
  };
  /** Regra do conselho de classe que pesa nesse nicho. */
  aviso?: string;
};

export const NICHOS: Nicho[] = [
  { id: "saude", nome: "Saúde (nutrição, fisio, psicologia)", profissao: "Nutrição esportiva",
    numeros: [{ valor: "[anos]", rotulo: "anos de consultório" }, { valor: "[pacientes]", rotulo: "pacientes atendidos" }, { valor: "[cidade]", rotulo: "e online" }],
    local: "", registro: "CRN [número]", cta: "Agendar consulta", mensagem: "Oi! Vim pelo seu link e quero agendar uma consulta.",
    tema: "escuro", cor: "#2F6B4F", corTexto: "#FFFFFF",
    sobre: { titulo: "Como é o acompanhamento", texto: "Pra quem é o seu trabalho, como é a primeira consulta, quanto tempo dura e como funciona o retorno.\n\nTermine dizendo o que o paciente leva da primeira consulta." },
    atendimento: { formas: { presencial: true, online: true }, online_texto: "Consulta por vídeo, com o mesmo acompanhamento do consultório." },
    aviso: "Conselhos de saúde limitam antes e depois e promessa de resultado. Confira a regra do conselho antes de publicar." },
  { id: "estetica", nome: "Odontologia e estética", profissao: "Odontologia estética",
    numeros: [{ valor: "[anos]", rotulo: "anos de estética" }, { valor: "[procedimentos]", rotulo: "procedimentos feitos" }, { valor: "[cidade]", rotulo: "[bairro]" }],
    local: "", registro: "CRO [número]", cta: "Agendar avaliação", mensagem: "Oi! Vim pelo seu link e quero agendar uma avaliação.",
    tema: "escuro", cor: "#2A4B7C", corTexto: "#FFFFFF",
    sobre: { titulo: "Antes de você marcar", texto: "Como é a avaliação, se ela é paga, quanto tempo leva e o que acontece depois.\n\nQuem tem medo de dentista quer ler isso antes de chamar." },
    atendimento: { formas: { presencial: true } },
    aviso: "O CFO tem regra própria pra antes e depois. Confira antes de publicar fotos de paciente." },
  { id: "advocacia", nome: "Advocacia", profissao: "Direito de família",
    numeros: [{ valor: "[anos]", rotulo: "anos de advocacia" }, { valor: "[estado]", rotulo: "atendimento no estado" }, { valor: "Online", rotulo: "reunião por vídeo" }],
    local: "", registro: "OAB/[UF] [número]", cta: "Falar com o escritório", mensagem: "Olá! Vim pelo link e gostaria de falar com o escritório.",
    tema: "escuro", cor: "#7A5A2E", corTexto: "#FFFFFF",
    sobre: { titulo: "Como funciona o primeiro contato", texto: "Em quais áreas você atua, como é a primeira reunião e o que a pessoa precisa levar ou separar.\n\nSem citar resultado de causa: a OAB não permite." },
    atendimento: { formas: { presencial: true, online: true }, online_texto: "Reunião por vídeo, com o mesmo sigilo do escritório." },
    aviso: "A OAB não permite divulgar resultado nem quantidade de causas. Use anos de atuação, área e onde atende." },
  { id: "fitness", nome: "Personal e esporte", profissao: "Personal trainer",
    numeros: [{ valor: "[anos]", rotulo: "anos treinando gente" }, { valor: "[alunos]", rotulo: "alunos" }, { valor: "[cidade]", rotulo: "presencial e online" }],
    local: "", registro: "CREF [número]", cta: "Quero uma aula experimental", mensagem: "Oi! Vim pelo seu link e quero marcar uma aula experimental.",
    tema: "escuro", cor: "#3F7D20", corTexto: "#FFFFFF",
    sobre: { titulo: "Pra quem é o treino", texto: "Quem você treina (iniciante, emagrecimento, performance), como é a primeira aula e como você acompanha a evolução." },
    atendimento: { formas: { presencial: true, online: true, domicilio: true }, regiao: "[bairros ou cidades]", online_texto: "Treino montado pra você, com acompanhamento pelo WhatsApp." } },
  { id: "beleza", nome: "Beleza (cabelo, unha, maquiagem)", profissao: "Cabelo e coloração",
    numeros: [{ valor: "[anos]", rotulo: "anos de salão" }, { valor: "[especialidade]", rotulo: "o que mais faço" }, { valor: "[cidade]", rotulo: "[bairro]" }],
    local: "", registro: "[dias e horário]", cta: "Agendar horário", mensagem: "Oi! Vim pelo seu link e quero agendar um horário.",
    tema: "claro", cor: "#A8546B", corTexto: "#FFFFFF",
    sobre: { titulo: "Como eu trabalho", texto: "Sua especialidade, quanto tempo leva um atendimento e o que a cliente precisa saber antes de vir (cabelo lavado? sem esmalte?)." },
    atendimento: { formas: { presencial: true } } },
  { id: "comida", nome: "Confeitaria e comida", profissao: "Confeitaria artesanal",
    numeros: [{ valor: "[quantidade]", rotulo: "encomendas entregues" }, { valor: "[prazo]", rotulo: "de antecedência" }, { valor: "[cidade]", rotulo: "entrega na região" }],
    local: "", registro: "[até quando aceita encomenda]", cta: "Fazer encomenda", mensagem: "Oi! Vim pelo seu link e quero fazer uma encomenda.",
    tema: "claro", cor: "#7A3E22", corTexto: "#FFFFFF",
    sobre: { titulo: "Como fazer sua encomenda", texto: "Com quantos dias de antecedência, como funciona o pagamento, se tem tamanho mínimo e como é a entrega." },
    atendimento: { formas: { entrega: true }, regiao: "[cidades]", entrega_texto: "Entrega com [prazo] de antecedência. Taxa conforme o bairro." } },
  { id: "imoveis", nome: "Imóveis", profissao: "Corretor de imóveis",
    numeros: [{ valor: "[anos]", rotulo: "anos de mercado" }, { valor: "[famílias]", rotulo: "famílias com a chave na mão" }, { valor: "[cidades]", rotulo: "onde atuo" }],
    local: "", registro: "CRECI [número]", cta: "Ver imóveis disponíveis", mensagem: "Olá! Vim pelo seu link e quero ver imóveis.",
    tema: "escuro", cor: "#1F5F7A", corTexto: "#FFFFFF",
    sobre: { titulo: "Como eu ajudo", texto: "Que tipo de imóvel você trabalha (lançamento, usado, alto padrão), em quais bairros e como é a primeira conversa." },
    atendimento: { formas: { domicilio: true, online: true }, regiao: "[cidades]", online_texto: "Apresentação de imóveis por vídeo pra quem é de fora." } },
  { id: "educacao", nome: "Cursos, mentoria e consultoria", profissao: "Mentoria de carreira",
    numeros: [{ valor: "[anos]", rotulo: "anos de mercado" }, { valor: "[alunos]", rotulo: "alunos e mentorados" }, { valor: "[formato]", rotulo: "online e ao vivo" }],
    local: "", registro: "[empresa ou certificação]", cta: "Quero saber como funciona", mensagem: "Oi! Vim pelo seu link e quero saber como funciona.",
    tema: "escuro", cor: "#B4532A", corTexto: "#FFFFFF",
    sobre: { titulo: "Como funciona", texto: "Pra quem é, quanto tempo dura, se é em grupo ou individual e o que a pessoa sai sabendo fazer." },
    atendimento: { formas: { online: true }, online_texto: "Encontros ao vivo por vídeo, com gravação." } },
];

export const nichoPorId = (id: unknown) => NICHOS.find((n) => n.id === id) ?? null;

/** Dados do bloco "Onde atende" com o ponto de partida do nicho. */
export function atendimentoDoNicho(n: Nicho): Record<string, unknown> {
  return {
    // Quem só entrega ou só atende online não tem "onde": o título acompanha.
    titulo: n.atendimento.formas.presencial || n.atendimento.formas.domicilio ? "Onde atendo"
      : n.atendimento.formas.entrega ? "Entrega" : "Como atendo",
    formas: { presencial: false, online: false, domicilio: false, entrega: false, ...n.atendimento.formas },
    locais: n.atendimento.formas.presencial ? [{ nome: "[Nome do local]", endereco: "", cidade: "[cidade]", horario: "[dias e horário]" }] : [],
    online_texto: n.atendimento.online_texto ?? "",
    regiao: n.atendimento.regiao ?? "",
    entrega_texto: n.atendimento.entrega_texto ?? "",
    retirada: "",
    tema: n.tema,
  };
}

/** A página inteira do modelo de especialista, já no nicho escolhido. */
export function blocosDoNicho(n: Nicho): { kind: string; data: Record<string, unknown> }[] {
  return [
    { kind: "apresentacao", data: {
      midia: "video", imagem: "", video_guid: "", nome: "", profissao: n.profissao, tema: n.tema,
      assinatura: { modo: "fonte", fonte: "delafield", d: "", x: 6, y: 62, escala: 70 },
    } },
    // `local` vazio: a linha embaixo dos números se monta pelo bloco Onde atende.
    { kind: "numeros", data: { nicho: n.id, itens: n.numeros.map((x) => ({ ...x })), local: "", registro: n.registro, tema: n.tema } },
    { kind: "sobre", data: { rotulo: "Antes de marcar", titulo: n.sobre.titulo, texto: n.sobre.texto, imagem: "", fundo: n.tema === "escuro" ? "escuro" : "creme" } },
    { kind: "atendimento", data: atendimentoDoNicho(n) },
    { kind: "depoimentos", data: {
      rotulo: "Quem já passou por aqui", titulo: "Depoimentos", fundo: n.tema === "escuro" ? "creme" : "claro",
      itens: [{ texto: "", autor: "" }, { texto: "", autor: "" }],
    } },
    { kind: "contato", data: { titulo: "", telefone: "", email: "", endereco: "", instagram: "", assinatura: "" } },
    { kind: "acao_fixa", data: { texto: n.cta, destino: "whatsapp", telefone: "", mensagem: n.mensagem, url: "" } },
  ];
}
