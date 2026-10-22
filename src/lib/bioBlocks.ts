/* ═══════════════════════════════════════════════════════════════════════════
   O CATÁLOGO DE BLOCOS DO LINK NA BIO

   Uma fonte só pras três pontas: a paleta de "adicionar bloco", o formulário de
   cada tipo e o desenho na página pública. Se as três listas fossem separadas,
   na primeira alteração um tipo passaria a existir num lugar e não no outro.

   Adicionar um tipo novo é: entrar aqui, escrever o formulário no editor e o
   desenho na página pública. Nada de migration, porque o conteúdo de cada
   bloco mora num jsonb livre.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  AlignLeft, CalendarClock, Contact, HelpCircle, Image as ImageIcon, Images,
  Layers, Link2, MapPin, MessageCircle, PenLine, PlayCircle, Quote, Send,
  ShoppingBag, Type, UserRound, Clapperboard, BadgeCheck, MousePointerClick, MapPinned, Handshake, UtensilsCrossed, Clock, Sparkles, Rows3, type LucideIcon,
} from "lucide-react";
import { lerAtendimento, resumoAtendimento, temAlgumAtendimento } from "@/lib/bioEspecialista";

export type EstiloBio = "classico" | "site";

export type TipoBloco =
  | "link" | "titulo" | "texto" | "video" | "galeria"
  | "faq" | "contagem" | "whatsapp" | "mapa" | "captura" | "spotify"
  // Só no modo Site: são SEÇÕES de largura cheia, não botões numa coluna.
  | "capa" | "sobre" | "produtos" | "blog" | "depoimentos" | "contato"
  // Página de especialista (21/10/2026), ver lib/bioEspecialista.
  | "apresentacao" | "numeros" | "acao_fixa" | "atendimento"
  // Contatos (22/10/2026): proposta de parceria que cai no funil.
  | "parceria"
  // Modelo Loja (22/10/2026), ver lib/bioLoja.
  | "cardapio" | "horarios" | "destaque" | "vantagens";

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
  /** Ícone do card da paleta e da lista. Lucide, nunca emoji: emoji é desenhado
   *  pelo sistema, então a mesma tela fica com cara de iPhone no Mac, de
   *  Android no Android e de bloco quadrado no Windows. O ícone é nosso e é
   *  igual em todo lugar. */
  Icone: LucideIcon;
  padrao: DadosBloco;
  /** Em quais estilos ele aparece. Vazio = nos dois. */
  estilos?: EstiloBio[];
  /** Bloco que leva a pessoa pra fora (conta clique). */
  clicavel?: boolean;
};

export const BLOCOS: MetaBloco[] = [
  {
    tipo: "link", nome: "Link", Icone: Link2, clicavel: true,
    explica: "Botão pra qualquer endereço, com ou sem imagem de capa.",
    padrao: { titulo: "", url: "", icone: "", capa: "" },
  },
  {
    tipo: "whatsapp", nome: "WhatsApp", Icone: MessageCircle, clicavel: true,
    explica: "Abre a conversa já com a mensagem escrita.",
    padrao: { titulo: "Vamos conversar?", telefone: "", mensagem: "Oi! Vim pelo link da bio." },
  },
  {
    tipo: "titulo", nome: "Título de seção", Icone: Type,
    explica: "Separa os botões em grupos.",
    padrao: { titulo: "" },
  },
  {
    tipo: "texto", nome: "Texto", Icone: AlignLeft,
    explica: "Um parágrafo livre entre os botões, com foto se quiser.",
    padrao: { titulo: "", texto: "", imagem: "" },
  },
  {
    tipo: "video", nome: "Vídeo", Icone: PlayCircle,
    explica: "YouTube, Instagram ou TikTok tocando na própria página.",
    padrao: { titulo: "", url: "" },
  },
  {
    tipo: "galeria", nome: "Galeria", Icone: Images,
    explica: "Fotos do trabalho, em grade.",
    padrao: { titulo: "", imagens: [] },
  },
  {
    tipo: "spotify", nome: "Spotify", Icone: PlayCircle,
    explica: "Playlist, álbum, faixa ou podcast tocando na página.",
    padrao: { titulo: "", url: "" },
  },
  {
    tipo: "faq", nome: "Perguntas frequentes", Icone: HelpCircle,
    explica: "Abre e fecha. Tira a dúvida antes da pessoa desistir.",
    padrao: { titulo: "Perguntas frequentes", itens: [{ p: "", r: "" }] },
  },
  {
    tipo: "contagem", nome: "Contagem regressiva", Icone: CalendarClock,
    explica: "Turma, promoção ou evento com hora pra acabar.",
    padrao: { titulo: "Faltam", ate: "" },
  },
  {
    tipo: "mapa", nome: "Endereço e mapa", Icone: MapPin, clicavel: true,
    explica: "Pra loja física: mapa, rota no Waze e endereço pra copiar.",
    padrao: { titulo: "Onde estamos", endereco: "", horario: "", mostrarMapa: true },
  },
  {
    tipo: "captura", nome: "Captura de contato", Icone: Send,
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
  {
    tipo: "parceria", nome: "Proposta de parceria", Icone: Handshake,
    explica: "Formulário pra marca ou cliente pedir orçamento. Cai no seu funil e chega por e-mail.",
    padrao: {
      titulo: "Vamos trabalhar juntos?",
      subtitulo: "Conta o que você tem em mente. Respondo em até 2 dias úteis.",
      pedirEmpresa: true,
      botao: "Enviar proposta",
      consentimento: "Ao enviar, você autoriza o uso dos seus dados para eu responder sua proposta.",
      paraPipeline: true,
    },
  },
];

/* ── SÓ NO MODO SITE ──
   Estes não são botões: são seções de largura cheia. Por isso ficam trancados
   no estilo "site", senão a coluna estreita do Clássico tentaria desenhar uma
   grade de produtos em 390px e ficaria ilegível. */
export const BLOCOS_SITE: MetaBloco[] = [
  {
    tipo: "apresentacao", nome: "Capa com vídeo e assinatura", Icone: Clapperboard, estilos: ["site"],
    explica: "A pessoa em tela cheia, em vídeo curto ou foto, com o nome em assinatura.",
    padrao: { midia: "video", imagem: "", video_guid: "", nome: "", profissao: "", tema: "escuro",
      assinatura: { modo: "fonte", fonte: "delafield", d: "", x: 6, y: 62, escala: 70 } },
  },
  {
    tipo: "numeros", nome: "Números de prova", Icone: BadgeCheck, estilos: ["site"],
    explica: "Anos, clientes, cidade. O que faz a pessoa confiar antes de chamar.",
    padrao: { itens: [{ valor: "", rotulo: "" }, { valor: "", rotulo: "" }, { valor: "", rotulo: "" }], local: "", registro: "", tema: "escuro" },
  },
  {
    tipo: "atendimento", nome: "Onde atende", Icone: MapPinned, estilos: ["site"],
    explica: "Endereço, vários locais, online, em casa ou entrega. Pode marcar mais de um.",
    padrao: { titulo: "Onde atendo", formas: { presencial: true, online: false, domicilio: false, entrega: false },
      locais: [{ nome: "", endereco: "", cidade: "", horario: "" }], online_texto: "", regiao: "", entrega_texto: "", retirada: "", tema: "escuro" },
  },
  {
    tipo: "acao_fixa", nome: "Botão fixo", Icone: MousePointerClick, estilos: ["site"], clicavel: true,
    explica: "Agendar, encomendar ou chamar: fica preso no pé da tela enquanto a pessoa rola.",
    padrao: { texto: "Agendar consulta", destino: "whatsapp", telefone: "", mensagem: "Oi! Vim pelo seu link.", url: "" },
  },
  {
    tipo: "capa", nome: "Capa", Icone: ImageIcon, estilos: ["site"],
    explica: "O topo do site: título, uma frase e dois botões.",
    padrao: { titulo: "", frase: "", imagem: "", botao1: "Fale comigo", url1: "", botao2: "", url2: "", layout: "padrao" },
  },
  {
    tipo: "cardapio", nome: "Cardápio ou catálogo", Icone: UtensilsCrossed, estilos: ["site"],
    explica: "Itens com foto, preço e categoria. Com WhatsApp, vira sacola que manda o pedido pronto.",
    padrao: { titulo: "Cardápio", categorias: [], itens: [], pedidos: true, telefone: "" },
  },
  {
    tipo: "horarios", nome: "Horários", Icone: Clock, estilos: ["site"],
    explica: "A semana com o dia de hoje marcado. Põe o \"Aberto agora\" na capa sozinho.",
    padrao: { titulo: "Horários", dias: [
      { aberto: false, abre: "08:00", fecha: "18:00" },
      { aberto: true, abre: "08:00", fecha: "18:00" }, { aberto: true, abre: "08:00", fecha: "18:00" },
      { aberto: true, abre: "08:00", fecha: "18:00" }, { aberto: true, abre: "08:00", fecha: "18:00" },
      { aberto: true, abre: "08:00", fecha: "18:00" }, { aberto: true, abre: "08:00", fecha: "13:00" },
    ], observacao: "" },
  },
  {
    tipo: "destaque", nome: "Destaque da semana", Icone: Sparkles, estilos: ["site"],
    explica: "Uma novidade ou promoção com foto e botão de reservar.",
    padrao: { etiqueta: "Só essa semana", titulo: "", texto: "", imagem: "", botao: "Reservar o meu", destino: "whatsapp", telefone: "", mensagem: "", url: "" },
  },
  {
    tipo: "vantagens", nome: "Faixa de vantagens", Icone: Rows3, estilos: ["site"],
    explica: "Três motivos curtos logo abaixo da capa: entrega, encomenda, pagamento.",
    padrao: { itens: [{ titulo: "", sub: "" }, { titulo: "", sub: "" }, { titulo: "", sub: "" }] },
  },
  {
    tipo: "sobre", nome: "Sobre", Icone: UserRound, estilos: ["site"],
    explica: "Foto ao lado de um texto longo. É onde a história é contada.",
    padrao: { rotulo: "Quem sou", titulo: "", texto: "", imagem: "" },
  },
  {
    tipo: "produtos", nome: "Produtos e serviços", Icone: ShoppingBag, estilos: ["site"],
    explica: "Grade com preço. Cada item ganha página própria pra mandar no WhatsApp.",
    padrao: { rotulo: "O que eu faço", titulo: "Serviços", subtitulo: "" },
  },
  {
    tipo: "blog", nome: "Blog", Icone: PenLine, estilos: ["site"],
    explica: "Os textos publicados, do mais novo pro mais antigo.",
    padrao: { rotulo: "Escrevo por aqui", titulo: "Blog", quantos: 6 },
  },
  {
    tipo: "depoimentos", nome: "Depoimentos", Icone: Quote, estilos: ["site"],
    explica: "O que os clientes falam. Prova social sem precisar de print.",
    padrao: { rotulo: "Quem já passou por aqui", titulo: "Depoimentos", itens: [{ texto: "", autor: "" }] },
  },
  {
    tipo: "contato", nome: "Contato e rodapé", Icone: Contact, estilos: ["site"],
    explica: "Fecha o site com telefone, e-mail, endereço e redes.",
    padrao: { titulo: "", telefone: "", email: "", endereco: "", instagram: "", assinatura: "" },
  },
];

const TODOS_BLOCOS = [...BLOCOS, ...BLOCOS_SITE];

export const metaDoBloco = (t: string): MetaBloco =>
  TODOS_BLOCOS.find((b) => b.tipo === t) ?? {
    tipo: "link", nome: "Bloco", Icone: Layers, explica: "", padrao: {},
  };

/** No Site as seções vêm primeiro, porque é por elas que a montagem começa. */
export const blocosDoEstilo = (e: EstiloBio): MetaBloco[] =>
  e === "site"
    ? [...BLOCOS_SITE, ...BLOCOS.filter((b) => !b.estilos || b.estilos.includes(e))]
    : BLOCOS.filter((b) => !b.estilos || b.estilos.includes(e));

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
/* Além de garantir que é array, joga fora os buracos. Um `null` no meio da
   lista fazia `i.texto` lançar e, sem rede de segurança na rota pública, isso
   virava tela branca pro seguidor. */
export const lista = <T,>(d: DadosBloco, k: string): T[] => {
  const v = d?.[k];
  return Array.isArray(v) ? (v.filter((x) => x !== null && x !== undefined) as T[]) : [];
};

/* ── O NOME DA MARCA NO MODO SITE ──
   No Site, o card "Quem aparece no topo" saiu da tela: a bio dele não era usada
   em lugar nenhum ali (quem conta a história é o bloco Sobre) e o campo só
   gerava a pergunta "pra onde vai isso?". Sobraram nome e foto, que viram a
   marca no menu do site.

   A ordem aqui é do mais explícito pro mais genérico: o que a pessoa digitou
   um dia naquele campo continua valendo, senão o título da Capa (que é o nome
   grande que ela mesma escreveu no topo do site), senão o nome do perfil. */
export function nomeDaMarcaSite(
  blocos: { kind: string; data?: DadosBloco | null }[],
  nomeDoCampo?: string | null,
  nomeDoPerfil?: string | null,
): string {
  const digitado = (nomeDoCampo ?? "").trim();
  if (digitado) return digitado;
  const capa = blocos.find((b) => b.kind === "capa");
  const tituloDaCapa = txt(capa?.data ?? {}, "titulo").trim();
  // Título comprido é manchete, não marca: no menu ele viraria uma linha só de
  // texto espremida. Aí é melhor o nome do perfil.
  if (tituloDaCapa && tituloDaCapa.length <= 28) return tituloDaCapa;
  return (nomeDoPerfil ?? "").trim() || tituloDaCapa || "Sua marca";
}

/** O que aparece na lista do editor como resumo do bloco. */
export function resumoDoBloco(b: { kind: string; data: DadosBloco }): string {
  const d = b.data ?? {};
  switch (b.kind) {
    case "link": return txt(d, "url") || "sem endereço ainda";
    case "whatsapp": return txt(d, "telefone") || "sem telefone ainda";
    case "texto": return txt(d, "texto").slice(0, 60) || (txt(d, "imagem") ? "só a foto" : "sem texto ainda");
    case "video": return txt(d, "url") || "sem vídeo ainda";
    case "spotify": return txt(d, "url") || "sem link ainda";
    case "galeria": return `${lista(d, "imagens").length} foto(s)`;
    case "faq": return `${lista(d, "itens").length} pergunta(s)`;
    case "contagem": return txt(d, "ate") ? `até ${txt(d, "ate").slice(0, 10).split("-").reverse().join("/")}` : "sem data ainda";
    case "mapa": return txt(d, "endereco") || "sem endereço ainda";
    case "captura": return bool(d, "paraPipeline") ? "vai pro pipeline" : "só na lista de leads";
    case "parceria": return bool(d, "paraPipeline") ? "vai pro funil e por e-mail" : "chega por e-mail";
    case "cardapio": {
      const n = lista<{ nome?: string }>(d, "itens").filter((i) => (i?.nome ?? "").trim()).length;
      return `${n} ${n === 1 ? "item" : "itens"}` + (bool(d, "pedidos", true) ? " · pedido pelo WhatsApp" : " · só vitrine");
    }
    case "horarios": return `${lista<{ aberto?: boolean }>(d, "dias").filter((x) => x?.aberto).length} dias abertos`;
    case "destaque": return txt(d, "titulo") || "sem título ainda";
    case "vantagens": return lista<{ titulo?: string }>(d, "itens").map((i) => i?.titulo ?? "").filter(Boolean).join(" · ") || "sem itens ainda";
    case "capa": return txt(d, "frase").slice(0, 60) || "sem frase ainda";
    case "sobre": return txt(d, "texto").slice(0, 60) || "sem texto ainda";
    case "produtos": return "puxa os produtos cadastrados";
    case "blog": return "puxa os posts publicados";
    case "depoimentos": return `${lista(d, "itens").length} depoimento(s)`;
    case "contato": return txt(d, "telefone") || txt(d, "email") || "sem contato ainda";
    case "apresentacao": return txt(d, "midia") === "imagem" ? "foto fixa" : (txt(d, "video_guid") ? "vídeo em loop" : "sem vídeo ainda");
    case "numeros": return lista<{ valor?: string }>(d, "itens").map((i) => i?.valor ?? "").filter(Boolean).join(" · ") || "sem números ainda";
    case "acao_fixa": return txt(d, "texto") || "sem texto ainda";
    case "atendimento": return resumoAtendimento(lerAtendimento(d)) || "nenhuma forma marcada";
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
    case "spotify": return txt(d, "url").trim() ? null : "falta o link do Spotify";
    case "galeria": return lista(d, "imagens").length ? null : "nenhuma foto";
    case "contagem": return txt(d, "ate").trim() ? null : "falta a data";
    case "mapa": return txt(d, "endereco").trim() ? null : "falta o endereço";
    case "texto": return (txt(d, "texto").trim() || txt(d, "imagem").trim()) ? null : "falta o texto";
    case "faq": return lista<{ p?: string }>(d, "itens").some((i) => (i?.p ?? "").trim()) ? null : "nenhuma pergunta";
    case "capa": return txt(d, "titulo").trim() ? null : "falta o título";
    case "sobre": return txt(d, "texto").trim() ? null : "falta o texto";
    case "apresentacao": {
      const midia = txt(d, "midia", "video");
      if (midia === "imagem") return txt(d, "imagem").trim() ? null : "falta a foto";
      return txt(d, "video_guid").trim() || txt(d, "imagem").trim() ? null : "falta o vídeo";
    }
    case "numeros": return lista<{ valor?: string }>(d, "itens").some((i) => (i?.valor ?? "").trim()) ? null : "nenhum número";
    case "cardapio": return lista<{ nome?: string }>(d, "itens").some((i) => (i?.nome ?? "").trim()) ? null : "nenhum item";
    case "horarios": return lista<{ aberto?: boolean }>(d, "dias").some((x) => x?.aberto) ? null : "nenhum dia aberto";
    case "destaque": return txt(d, "titulo").trim() ? null : "falta o título";
    case "vantagens": return lista<{ titulo?: string }>(d, "itens").some((i) => (i?.titulo ?? "").trim()) ? null : "nenhum item";
    case "atendimento": {
      const a = lerAtendimento(d);
      if (!temAlgumAtendimento(a)) return "marque como atende";
      if (a.presencial && !a.locais.some((l) => l.endereco.trim() || l.cidade.trim())) return "falta o endereço";
      return null;
    }
    case "acao_fixa": {
      if (!txt(d, "texto").trim()) return "falta o texto do botão";
      if (txt(d, "destino", "whatsapp") === "whatsapp") return txt(d, "telefone").replace(/\D/g, "").length >= 10 ? null : "falta o telefone";
      return linkSeguro(txt(d, "url")) ? null : "falta o endereço";
    }
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

/* ── SPOTIFY ──
   A pessoa cola o link do "Compartilhar" (playlist, álbum, faixa, podcast) e a
   página toca no player oficial. Faixa e episódio ganham o player baixo. */
export function embedDeSpotify(url: string): { src: string; compacto: boolean } | null {
  const m = (url || "").trim().match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/);
  if (!m) return null;
  return {
    src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`,
    compacto: m[1] === "track" || m[1] === "episode",
  };
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
/* embedGoogleMaps saiu daqui de propósito. O modo `q=...&output=embed` era
   público e o Google fechou: hoje ele responde com bloqueio de enquadramento e
   o visitante vê "Este conteúdo está bloqueado" no lugar do mapa. Pra ter mapa
   DENTRO da página de novo é preciso uma chave da Maps Embed API. Até lá, as
   duas telas mandam pro app de mapas em vez de mostrar um erro. */

/* ── O ENDEREÇO DE CADA ITEM ──
   "Engenharia de Cardápio" vira "engenharia-de-cardapio". Sem acento porque
   endereço com acento vira aquele monte de %C3%A7 quando alguém cola no
   WhatsApp, e aí ninguém entende o que é o link. */
export function enderecoDoTitulo(t: string): string {
  return (t || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** R$ 3.900 quando tem número, o texto livre quando não tem. */
export function precoVisivel(preco: number | null | undefined, texto: string | null | undefined): string {
  if (typeof preco === "number" && Number.isFinite(preco) && preco > 0) {
    return preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: preco % 1 === 0 ? 0 : 2 });
  }
  return (texto || "").trim();
}

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

/* ═══════════════════════════════════════════════════════════════════════════
   LEITURA DA COR DA MARCA

   A cor de destaque vem do brandbook, e brandbook não pergunta se a cor dá
   pra ler. Amarelo em cima de branco some; roxo escuro em cima de roxo escuro
   some também. Estas três contas resolvem antes de a cor chegar na tela.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Luminância relativa simplificada, de 0 (preto) a 1 (branco). */
export function claridade(hex: string): number {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return 1;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A cor serve pra escrever em cima de branco? */
export const corLegivelSobreBranco = (hex: string) => claridade(hex) < 0.62;

/** Preto ou branco, o que for legível em cima desta cor. */
export const corSobre = (hex: string) => (claridade(hex) < 0.6 ? "#FFFFFF" : "#1A1626");

/** A cor da marca já corrigida pra uso como texto e detalhe sobre branco.
 *  Cor clara demais cai pro grafite da identidade, em vez de sumir. */
export const corDeDestaque = (hex: string) => (corLegivelSobreBranco(hex) ? hex : "#1A1626");


/* ═══════════════════════════════════════════════════════════════════════════
   ENDEREÇO QUE PODE VIRAR href

   O `data` do bloco é jsonb livre e quem escreve nele é a pessoa logada. Só que
   o resultado é uma página PÚBLICA: um "javascript:" salvo ali roda no navegador
   de todo seguidor que clicar. O formato antigo de links já passava por
   sanitizeUrl; os blocos novos tinham escapado, e a mesma página ficou com dois
   pesos e duas medidas. Aqui é o único caminho.

   Devolve string vazia quando não presta, pra quem chama poder simplesmente não
   desenhar o botão em vez de desenhar um botão que não leva a lugar nenhum.
   ═══════════════════════════════════════════════════════════════════════════ */
/** Botão de seção do site: além do que o linkSeguro aceita, aceita âncora da
 *  própria página (#cardapio, #atendimento). Só letra, número, - e _: nada
 *  que feche o atributo ou vire script. Sem isto o "#servicos" dos modelos
 *  era descartado e o botão sumia da capa. */
export function linkDoBotao(url: unknown): string {
  const u = typeof url === "string" ? url.trim() : "";
  if (/^#[a-z0-9_-]{1,40}$/i.test(u)) return u;
  return linkSeguro(u);
}

export function linkSeguro(url: unknown): string {
  const u = typeof url === "string" ? url.trim() : "";
  if (!u) return "";
  const testa = (v: string): string => {
    try {
      const p = new URL(v);
      // mailto: e tel: são uso legítimo num botão de contato. javascript: e
      // data: são os que precisam morrer aqui.
      return ["http:", "https:", "mailto:", "tel:"].includes(p.protocol) ? p.toString() : "";
    } catch { return ""; }
  };
  const direto = testa(u);
  if (direto) return direto;
  /* Muita gente cola "instagram.com/fulano" ou "wa.me/5541..." sem o https://,
     e o campo é texto livre, então já tem link assim salvo. Descartar todos
     esses faria botões que funcionavam simplesmente sumirem da página no dia
     do deploy. Uma barra no meio e nenhum espaço: é endereço, completa. */
  if (!u.includes(" ") && /^[\w.-]+\.[a-z]{2,}(\/|$|\?)/i.test(u)) return testa(`https://${u}`);
  return "";
}

/** Âncora rola na mesma aba; endereço de fora abre em outra. */
export const alvoDoLink = (href: string) =>
  href.startsWith("#") ? {} : { target: "_blank", rel: "noopener noreferrer" };
