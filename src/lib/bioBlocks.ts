/* ═══════════════════════════════════════════════════════════════════════════
   O CATÁLOGO DE BLOCOS DO LINK NA BIO

   Uma fonte só pras três pontas: a paleta de "adicionar bloco", o formulário de
   cada tipo e o desenho na página pública. Se as três listas fossem separadas,
   na primeira alteração um tipo passaria a existir num lugar e não no outro.

   Adicionar um tipo novo é: entrar aqui, escrever o formulário no editor e o
   desenho na página pública. Nada de migration, porque o conteúdo de cada
   bloco mora num jsonb livre.
   ═══════════════════════════════════════════════════════════════════════════ */

export type EstiloBio = "classico" | "site";

export type TipoBloco =
  | "link" | "titulo" | "texto" | "video" | "galeria"
  | "faq" | "contagem" | "whatsapp" | "mapa" | "captura";

export type CamposCaptura = "email" | "telefone" | "ambos";

export type DadosBloco = Record<string, unknown>;

export type BioBloco = {
  id: string;
  user_id: string;
  page_id: string | null;
  estilo: EstiloBio;
  kind: TipoBloco;
  data: DadosBloco;
  position: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  clicks: number;
  created_at: string;
  updated_at: string;
};

export type MetaBloco = {
  tipo: TipoBloco;
  nome: string;
  /** Frase da paleta: o que este bloco resolve, não o que ele é. */
  explica: string;
  /** Emoji do card da paleta e da lista. Emoji e não ícone pra a paleta ficar
   *  legível de longe e não pesar com 10 imports do lucide. */
  emoji: string;
  padrao: DadosBloco;
  /** Em quais estilos ele aparece. Vazio = nos dois. */
  estilos?: EstiloBio[];
  /** Bloco que leva a pessoa pra fora (conta clique). */
  clicavel?: boolean;
};

export const BLOCOS: MetaBloco[] = [
  {
    tipo: "link", nome: "Link", emoji: "🔗", clicavel: true,
    explica: "Botão pra qualquer endereço, com ou sem imagem de capa.",
    padrao: { titulo: "", url: "", icone: "", capa: "" },
  },
  {
    tipo: "whatsapp", nome: "WhatsApp", emoji: "💬", clicavel: true,
    explica: "Abre a conversa já com a mensagem escrita.",
    padrao: { titulo: "Vamos conversar?", telefone: "", mensagem: "Oi! Vim pelo link da bio." },
  },
  {
    tipo: "titulo", nome: "Título de seção", emoji: "🔠",
    explica: "Separa os botões em grupos.",
    padrao: { titulo: "" },
  },
  {
    tipo: "texto", nome: "Texto", emoji: "✍️",
    explica: "Um parágrafo livre entre os botões.",
    padrao: { titulo: "", texto: "" },
  },
  {
    tipo: "video", nome: "Vídeo", emoji: "▶️",
    explica: "YouTube, Instagram ou TikTok tocando na própria página.",
    padrao: { titulo: "", url: "" },
  },
  {
    tipo: "galeria", nome: "Galeria", emoji: "🖼️",
    explica: "Fotos do trabalho, em grade.",
    padrao: { titulo: "", imagens: [] },
  },
  {
    tipo: "faq", nome: "Perguntas frequentes", emoji: "❓",
    explica: "Abre e fecha. Tira a dúvida antes da pessoa desistir.",
    padrao: { titulo: "Perguntas frequentes", itens: [{ p: "", r: "" }] },
  },
  {
    tipo: "contagem", nome: "Contagem regressiva", emoji: "⏳",
    explica: "Turma, promoção ou evento com hora pra acabar.",
    padrao: { titulo: "Faltam", ate: "" },
  },
  {
    tipo: "mapa", nome: "Endereço e mapa", emoji: "📍", clicavel: true,
    explica: "Pra loja física: mapa, rota no Waze e endereço pra copiar.",
    padrao: { titulo: "Onde estamos", endereco: "", horario: "", mostrarMapa: true },
  },
  {
    tipo: "captura", nome: "Captura de contato", emoji: "📩",
    explica: "Nome, e-mail e telefone. Pode cair direto no seu pipeline.",
    padrao: {
      titulo: "Deixe seu contato",
      subtitulo: "A gente te chama.",
      campos: "ambos" as CamposCaptura,
      botao: "Enviar",
      consentimento: "Ao enviar, você autoriza o uso dos seus dados para contato e para fins de marketing.",
      paraPipeline: false,
    },
  },
];

export const metaDoBloco = (t: string): MetaBloco =>
  BLOCOS.find((b) => b.tipo === t) ?? {
    tipo: "link", nome: "Bloco", emoji: "🔗", explica: "", padrao: {},
  };

export const blocosDoEstilo = (e: EstiloBio): MetaBloco[] =>
  BLOCOS.filter((b) => !b.estilos || b.estilos.includes(e));

/* ── LEITURA SEGURA ──
   O `data` é jsonb livre, então tudo que vem de lá pode ser qualquer coisa.
   Estes ajudantes evitam espalhar `as string` por toda a tela. */
export const txt = (d: DadosBloco, k: string, padrao = ""): string => {
  const v = d?.[k];
  return typeof v === "string" ? v : padrao;
};
export const bool = (d: DadosBloco, k: string, padrao = false): boolean => {
  const v = d?.[k];
  return typeof v === "boolean" ? v : padrao;
};
export const lista = <T,>(d: DadosBloco, k: string): T[] => {
  const v = d?.[k];
  return Array.isArray(v) ? (v as T[]) : [];
};

/** O que aparece na lista do editor como resumo do bloco. */
export function resumoDoBloco(b: { kind: string; data: DadosBloco }): string {
  const d = b.data ?? {};
  switch (b.kind) {
    case "link": return txt(d, "url") || "sem endereço ainda";
    case "whatsapp": return txt(d, "telefone") || "sem telefone ainda";
    case "texto": return txt(d, "texto").slice(0, 60) || "sem texto ainda";
    case "video": return txt(d, "url") || "sem vídeo ainda";
    case "galeria": return `${lista(d, "imagens").length} foto(s)`;
    case "faq": return `${lista(d, "itens").length} pergunta(s)`;
    case "contagem": return txt(d, "ate") ? `até ${txt(d, "ate").slice(0, 10).split("-").reverse().join("/")}` : "sem data ainda";
    case "mapa": return txt(d, "endereco") || "sem endereço ainda";
    case "captura": return bool(d, "paraPipeline") ? "vai pro pipeline" : "só na lista de leads";
    default: return "";
  }
}

/** Falta alguma coisa pro bloco funcionar de verdade na página? */
export function faltaNoBloco(b: { kind: string; data: DadosBloco }): string | null {
  const d = b.data ?? {};
  switch (b.kind) {
    case "link": return txt(d, "url").trim() ? null : "falta o endereço";
    case "whatsapp": return txt(d, "telefone").replace(/\D/g, "").length >= 10 ? null : "falta o telefone";
    case "video": return txt(d, "url").trim() ? null : "falta o link do vídeo";
    case "galeria": return lista(d, "imagens").length ? null : "nenhuma foto";
    case "contagem": return txt(d, "ate").trim() ? null : "falta a data";
    case "mapa": return txt(d, "endereco").trim() ? null : "falta o endereço";
    case "texto": return txt(d, "texto").trim() ? null : "falta o texto";
    default: return null;
  }
}

/* ── VÍDEO ──
   Aceita o link que a pessoa copia da barra do navegador ou do botão de
   compartilhar, sem pedir "cole o código do embed" (ninguém sabe o que é). */
export function embedDeVideo(url: string): { src: string; alto: boolean } | null {
  const u = (url || "").trim();
  if (!u) return null;

  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (yt) return { src: `https://www.youtube-nocookie.com/embed/${yt[1]}`, alto: /shorts\//.test(u) };

  const ig = u.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (ig) return { src: `https://www.instagram.com/p/${ig[1]}/embed`, alto: true };

  const vm = u.match(/vimeo\.com\/(\d+)/);
  if (vm) return { src: `https://player.vimeo.com/video/${vm[1]}`, alto: false };

  const tk = u.match(/tiktok\.com\/.*\/video\/(\d+)/);
  if (tk) return { src: `https://www.tiktok.com/embed/v2/${tk[1]}`, alto: true };

  return null;
}

/* ── MAPA E ROTA ──
   Três apps porque o celular de cada pessoa tem um: iPhone abre o Apple Maps,
   Android abre o Google Maps, e quem dirige no Brasil costuma querer o Waze.
   Todos aceitam endereço em texto, então não precisamos guardar coordenada. */
export const linkGoogleMaps = (endereco: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
export const linkWaze = (endereco: string) =>
  `https://www.waze.com/ul?q=${encodeURIComponent(endereco)}&navigate=yes`;
export const linkAppleMaps = (endereco: string) =>
  `https://maps.apple.com/?q=${encodeURIComponent(endereco)}`;
/** Mapa embutido sem chave de API: o modo `q=` do embed é público. */
export const embedGoogleMaps = (endereco: string) =>
  `https://maps.google.com/maps?q=${encodeURIComponent(endereco)}&output=embed&hl=pt-BR&z=15`;

/** (00) 00000-0000 conforme digita. */
export function mascaraTelefone(v: string): string {
  const d = (v || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Link do WhatsApp com a mensagem pronta. 55 na frente quando faltar. */
export function linkWhatsapp(telefone: string, mensagem?: string): string {
  const d = (telefone || "").replace(/\D/g, "");
  const num = d.startsWith("55") ? d : `55${d}`;
  const m = (mensagem || "").trim();
  return `https://api.whatsapp.com/send?phone=${num}${m ? `&text=${encodeURIComponent(m)}` : ""}`;
}

/** Quanto falta até a data, já quebrado em dias, horas e minutos. */
export function faltaAte(iso: string, agora = Date.now()): { d: number; h: number; m: number; s: number; acabou: boolean } {
  const alvo = new Date(iso).getTime();
  const ms = alvo - agora;
  if (!Number.isFinite(alvo) || ms <= 0) return { d: 0, h: 0, m: 0, s: 0, acabou: true };
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60, acabou: false };
}
