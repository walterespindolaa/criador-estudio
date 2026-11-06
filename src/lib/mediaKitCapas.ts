/* CAPAS DO MEDIA KIT (Walter, 06/11/2026: "a parte superior a pessoa pode
   trocar a cor e tal pra alguns outros layouts também: cor neutra, padrão Cria,
   outras capas que já tem pré-definidas"). A escolha vale pra tela, pro link
   público e pro PDF: os três desenham o mesmo AutoMediaKit com o mesmo estilo
   que sai daqui. As capas "cria-1" a "cria-5" são as mesmas do Criakut. */

export type CapaKit = "cria" | "neutro" | "cor" | "cria-1" | "cria-2" | "cria-3" | "cria-4" | "cria-5";

export const CAPAS_KIT: { id: CapaKit; nome: string }[] = [
  { id: "cria", nome: "Padrão Cria" },
  { id: "neutro", nome: "Neutro" },
  { id: "cor", nome: "Cor livre" },
  { id: "cria-1", nome: "Laranja" },
  { id: "cria-2", nome: "Azul" },
  { id: "cria-3", nome: "Papel picado" },
  { id: "cria-4", nome: "Caderno" },
  { id: "cria-5", nome: "Verde" },
];

export function capaValida(c: string | null | undefined): CapaKit {
  return CAPAS_KIT.some((x) => x.id === c) ? (c as CapaKit) : "cria";
}

export type EstiloCapa = {
  /** Fundo da capa (cor sólida). Nas capas desenhadas o desenho vai por cima. */
  fundo: string;
  /** Desenho de fundo do Criakut, quando a capa é uma delas. */
  desenho: "cria-1" | "cria-2" | "cria-3" | "cria-4" | "cria-5" | null;
  /** Mancha no canto (padrão Cria e cor livre). */
  mancha: string | null;
  texto: string;
  /** "media kit" escrito à mão em cima do nome. */
  script: string;
  aro: string;
  /** Cor das barras, números e detalhes do corpo do kit. */
  destaque: string;
  selo: { fundo: string; texto: string };
};

const PRETO = "#0A0A0A";

/** Luminância relativa (0 escuro, 1 claro) de um #RRGGBB. */
export function luminancia(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const canal = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

const COR_DA_CAPA: Record<string, string> = {
  "cria-1": "#CE4A1D", "cria-2": "#2A4BDF", "cria-3": "#E0195A", "cria-4": "#2A4BDF", "cria-5": "#3E9152",
};

export function estiloCapa(capa: string | null | undefined, accent: string | null | undefined): EstiloCapa {
  const c = capaValida(capa);
  const cor = /^#[0-9a-f]{6}$/i.test(accent ?? "") ? (accent as string) : "#0061EE";
  if (c === "cria") {
    return { fundo: "#0061EE", desenho: null, mancha: "#FF77B9", texto: "#FFFFFF", script: "#FFCF03", aro: "#FFCF03", destaque: "#0061EE", selo: { fundo: "#FFCF03", texto: PRETO } };
  }
  if (c === "neutro") {
    return { fundo: "#F4F1EA", desenho: null, mancha: null, texto: PRETO, script: "#6E675A", aro: PRETO, destaque: "#2B2B2B", selo: { fundo: "#FFFFFF", texto: PRETO } };
  }
  if (c === "cor") {
    const claro = luminancia(cor) > 0.45;
    return {
      fundo: cor, desenho: null, mancha: claro ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.16)",
      texto: claro ? PRETO : "#FFFFFF", script: claro ? PRETO : "#FFFFFF", aro: claro ? PRETO : "#FFFFFF",
      destaque: claro ? PRETO : cor, selo: { fundo: "#FFFFFF", texto: PRETO },
    };
  }
  const principal = COR_DA_CAPA[c];
  return { fundo: "#FFFBEF", desenho: c, mancha: null, texto: PRETO, script: principal, aro: principal, destaque: principal, selo: { fundo: "#FFCF03", texto: PRETO } };
}

export type MostrarKit = { numeros: boolean; audiencia: boolean; desempenho: boolean; conteudos: boolean; valores: boolean };
export const MOSTRAR_PADRAO: MostrarKit = { numeros: true, audiencia: true, desempenho: true, conteudos: true, valores: true };

export function lerMostrar(v: unknown): MostrarKit {
  const o = (v && typeof v === "object" ? v : {}) as Partial<Record<keyof MostrarKit, unknown>>;
  const b = (k: keyof MostrarKit) => (typeof o[k] === "boolean" ? (o[k] as boolean) : MOSTRAR_PADRAO[k]);
  return { numeros: b("numeros"), audiencia: b("audiencia"), desempenho: b("desempenho"), conteudos: b("conteudos"), valores: b("valores") };
}

/** Endereço do link: minúsculo, sem acento, só letras, números, ponto, hífen e sublinhado. */
export function limparSlug(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/^@/, "").replace(/[^a-z0-9._-]+/g, "-").replace(/^[-._]+|[-._]+$/g, "").slice(0, 40);
}
export const slugValido = (s: string) => /^[a-z0-9][a-z0-9._-]{1,38}[a-z0-9]$/.test(s);

/** Nome da versão vira o pedaço do link: "Marca de moda" -> "marca-de-moda". */
export function slugDaVersao(nome: string): string {
  return limparSlug(nome).replace(/[._]+/g, "-").replace(/-+/g, "-").slice(0, 40);
}

/** Como a marca fala com a pessoa: e-mail abre o e-mail, telefone abre o WhatsApp. */
export function linkDoContato(contato: string | null | undefined, nome?: string): string | null {
  const c = (contato ?? "").trim();
  if (!c) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) {
    return `mailto:${c}?subject=${encodeURIComponent(`Parceria${nome ? ` com ${nome}` : ""}`)}`;
  }
  const digitos = c.replace(/\D/g, "");
  if (digitos.length >= 10 && digitos.length <= 13) {
    const comPais = digitos.length <= 11 ? `55${digitos}` : digitos;
    return `https://wa.me/${comPais}?text=${encodeURIComponent("Oi! Vi seu media kit e quero conversar sobre uma publi.")}`;
  }
  if (/^https?:\/\//i.test(c)) return c;
  return null;
}
