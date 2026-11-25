/* ═══════════════════════════════════════════════════════════════════════════
   POST DE YOUTUBE (Walter, 25/11/2026, mockup aprovado: "ja adaptado para o
   youtube com tags, hashtags, etc?").

   Regras tiradas da documentação oficial, lida em 25/11/2026:
   - título até 100 caracteres (developers.google.com/youtube/v3/docs/videos);
   - tags somam no máximo 500 caracteres; a vírgula entre elas conta e tag com
     espaço conta as aspas que a API põe em volta ("Foo Baz" = 9);
   - as 3 primeiras hashtags da descrição aparecem em cima do título; com mais
     de 60 o YouTube ignora todas (support.google.com/youtube/answer/6390658);
   - capítulos: primeiro em 00:00, no mínimo 3, em ordem, cada um com 10 s ou
     mais (support.google.com/youtube/answer/9884579).
   O corte do "mais" e os ~70 caracteres do título no celular não estão na doc:
   são o que o app do YouTube mostra hoje, por isso são só aviso, nunca trava.
   ═══════════════════════════════════════════════════════════════════════════ */

export const YT_TITULO_MAX = 100;
export const YT_TITULO_VISIVEL = 70;
export const YT_TAGS_MAX = 500;
export const YT_DESCRICAO_MAX = 5000;
/** Aproximado: o app do YouTube mostra umas 2 linhas da descrição antes do "mais". */
export const YT_CORTE_MAIS = 150;

export type YoutubeDoPost = {
  titulo?: string | null;
  tags?: string[] | null;
  categoria?: string | null;
  idioma?: string | null;
  miniatura_url?: string | null;
  miniatura_path?: string | null;
};

/* Categorias que dá pra escolher num vídeo no Brasil (videoCategories.list,
   regionCode=BR). Lista fixa: muda raramente e evita uma chamada à API por tela. */
export const YT_CATEGORIAS: Array<{ id: string; nome: string }> = [
  { id: "22", nome: "Pessoas e blogs" },
  { id: "27", nome: "Educação" },
  { id: "26", nome: "Guias e estilo" },
  { id: "24", nome: "Entretenimento" },
  { id: "28", nome: "Ciência e tecnologia" },
  { id: "23", nome: "Comédia" },
  { id: "10", nome: "Música" },
  { id: "17", nome: "Esportes" },
  { id: "19", nome: "Viagens e eventos" },
  { id: "20", nome: "Jogos" },
  { id: "1", nome: "Filmes e animação" },
  { id: "2", nome: "Autos e veículos" },
  { id: "15", nome: "Animais" },
  { id: "25", nome: "Notícias e política" },
  { id: "29", nome: "Sem fins lucrativos e ativismo" },
];

export const YT_IDIOMAS: Array<{ id: string; nome: string }> = [
  { id: "pt-BR", nome: "Português" },
  { id: "en", nome: "Inglês" },
  { id: "es", nome: "Espanhol" },
];

const NICHO_CATEGORIA: Array<[RegExp, string]> = [
  [/educa|ensino|professor|curso|aula|finan|invest|dinheiro|marketing|negócio|negocio|empreend/i, "27"],
  [/moda|beleza|make|estilo|decora|casa|receita|culin|gastr|maternidade|lifestyle/i, "26"],
  [/tecno|program|dev|software|ia\b|intelig|ciênc|cienc/i, "28"],
  [/humor|comédia|comedia/i, "23"],
  [/músic|music|cantor|banda/i, "10"],
  [/fitness|academia|esporte|treino|corrida|futebol/i, "17"],
  [/viage|turismo/i, "19"],
  [/game|jogo/i, "20"],
  [/pet|cachorro|gato|animal/i, "15"],
];

/** Categoria inicial pelo nicho do perfil. Sem pista, "Pessoas e blogs". */
export function categoriaDoNicho(nicho?: string | null): string {
  const n = String(nicho ?? "");
  for (const [re, id] of NICHO_CATEGORIA) if (re.test(n)) return id;
  return "22";
}

/** Caracteres que as tags ocupam na conta do YouTube. */
export function contarTags(tags: string[]): number {
  const limpas = tags.map((t) => t.trim()).filter(Boolean);
  if (!limpas.length) return 0;
  const soma = limpas.reduce((n, t) => n + t.length + (/\s/.test(t) ? 2 : 0), 0);
  return soma + (limpas.length - 1);
}

/** Separa o que a pessoa digitou (vírgula ou Enter) em tags limpas, sem repetir. */
export function separarTags(texto: string): string[] {
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const bruta of texto.split(/[,\n]+/)) {
    const t = bruta.replace(/^#/, "").replace(/[<>]/g, "").trim();
    const k = t.toLowerCase();
    if (t && !vistas.has(k)) { vistas.add(k); out.push(t); }
  }
  return out;
}

/** Hashtags da descrição, na ordem. As 3 primeiras aparecem em cima do título. */
export function hashtagsDaDescricao(texto: string): string[] {
  return Array.from(String(texto ?? "").matchAll(/(^|\s)#([\p{L}\p{N}_]+)/gu)).map((m) => `#${m[2]}`);
}

/** "1:05", "01:05" ou "1:02:03" em segundos. Null se não for um tempo. */
export function segundosDe(minuto: string | null | undefined): number | null {
  const m = String(minuto ?? "").trim().match(/^(?:(\d{1,2}):)?(\d{1,3}):(\d{2})$/);
  if (!m) return null;
  const s = Number(m[3]);
  if (s >= 60) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + s;
}

export function formatarMinuto(seg: number): string {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type Capitulo = { seg: number; minuto: string; titulo: string };

/** Capítulos a partir dos blocos do roteiro que têm minuto e texto. */
export function capitulosDoRoteiro(blocos: Array<{ text?: string | null; minuto?: string | null }>): Capitulo[] {
  const out: Capitulo[] = [];
  for (const b of blocos) {
    const seg = segundosDe(b.minuto);
    const titulo = String(b.text ?? "").split("\n")[0].trim().slice(0, 80);
    if (seg === null || !titulo) continue;
    out.push({ seg, minuto: formatarMinuto(seg), titulo });
  }
  return out;
}

/** O que falta pra os capítulos valerem no YouTube. Vazio = tudo certo. */
export function problemasDosCapitulos(caps: Capitulo[]): string[] {
  if (!caps.length) return [];
  const p: string[] = [];
  if (caps[0].seg !== 0) p.push("O primeiro capítulo precisa começar em 00:00.");
  if (caps.length < 3) p.push("O YouTube pede no mínimo 3 capítulos.");
  for (let i = 1; i < caps.length; i++) {
    if (caps[i].seg <= caps[i - 1].seg) { p.push("Os minutos precisam estar em ordem crescente."); break; }
    if (caps[i].seg - caps[i - 1].seg < 10) { p.push("Cada capítulo precisa de 10 segundos ou mais."); break; }
  }
  return p;
}

export function textoDosCapitulos(caps: Capitulo[]): string {
  return caps.map((c) => `${c.minuto} ${c.titulo}`).join("\n");
}

const MARCA_CAPITULOS = /\n*Capítulos\n(?:\d{1,2}:\d{2}(?::\d{2})? .*(?:\n|$))+/;

/** Põe (ou troca) o bloco "Capítulos" na descrição, antes das hashtags do fim. */
export function descricaoComCapitulos(descricao: string, caps: Capitulo[]): string {
  const bloco = `Capítulos\n${textoDosCapitulos(caps)}`;
  const base = String(descricao ?? "").replace(MARCA_CAPITULOS, "\n").trimEnd();
  const fimHash = base.match(/\n+((?:#[\p{L}\p{N}_]+\s*)+)$/u);
  if (fimHash && fimHash.index !== undefined) {
    return `${base.slice(0, fimHash.index).trimEnd()}\n\n${bloco}\n\n${fimHash[1].trim()}`;
  }
  return base ? `${base}\n\n${bloco}` : bloco;
}

/** Duração em segundos vira "8:40" (ou "1:02:03"), como no YouTube. */
export function duracaoYouTube(seg: number | null | undefined): string | null {
  if (!seg || !Number.isFinite(seg) || seg <= 0) return null;
  const t = Math.round(seg);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** Lê o jsonb do post sem confiar no formato. */
export function lerYoutube(v: unknown): YoutubeDoPost {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const str = (x: unknown) => (typeof x === "string" ? x : null);
  return {
    titulo: str(o.titulo),
    tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === "string") : [],
    categoria: str(o.categoria),
    idioma: str(o.idioma),
    miniatura_url: str(o.miniatura_url),
    miniatura_path: str(o.miniatura_path),
  };
}
