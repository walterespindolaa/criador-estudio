export const PLATFORMS = ["instagram", "tiktok", "youtube"] as const;

export const BUNNY_CDN_HOSTNAME = "vz-4f7de422-7aa.b-cdn.net";

export const BUNNY_CRIAPOST_CDN_HOSTNAME = "vz-86788381-03e.b-cdn.net";

export const FORMAT_LABELS: Record<string, string> = {
  reels: "Reels",
  carrossel: "Carrossel",
  foto: "Estático", // rótulo exibido; o code gravado no banco segue "foto"
  story: "Story",
  video: "Vídeo",
  shorts: "Shorts",
  live: "Live",
};

export const FORMATS = ["reels", "carrossel", "foto", "story", "video", "shorts", "live"] as const;

// Variações que caem no MESMO código canônico. A chave já vem sem acento e em
// minúsculo (ver normalizarFormato). Cobre plural/singular, inglês e o rótulo
// novo "Estático" (que continua gravando o code "foto"). Sem isso, "Reels" e
// "reels" viravam dois baldes no filtro e no relatório (formato duplicado).
const FORMAT_SINONIMOS: Record<string, string> = {
  reel: "reels", reels: "reels",
  carrossel: "carrossel", carrosel: "carrossel", carousel: "carrossel", carrocel: "carrossel", album: "carrossel",
  foto: "foto", fotos: "foto", imagem: "foto", imagens: "foto", image: "foto", photo: "foto",
  estatico: "foto", "estático": "foto", estaticos: "foto",
  story: "story", stories: "story", storie: "story", stori: "story",
  video: "video", "vídeo": "video", videos: "video", "vídeos": "video",
  shorts: "shorts", short: "shorts",
  live: "live", lives: "live",
};

// Canoniza um formato pro code oficial (reels, carrossel, foto, story, video,
// shorts, live). Faz trim + minúsculo + resolve sinônimo (inclui plural, inglês
// e os rótulos com acento). Formato desconhecido volta ele mesmo, virando um
// balde próprio em vez de sumir. String vazia/nula -> "".
export function normalizarFormato(f?: string | null): string {
  if (!f) return "";
  const base = String(f).trim().toLowerCase().replace(/\s+/g, " ");
  if (!base) return "";
  return FORMAT_SINONIMOS[base] ?? base;
}

export const FORMATS_BY_PLATFORM: Record<string, string[]> = {
  instagram: ["reels", "carrossel", "foto", "story"],
  tiktok: ["video", "foto", "story"],
  youtube: ["video", "shorts"],
};

export const STATUS_OPTIONS = [
  { key: "ideia", label: "Ideia" },
  { key: "roteiro", label: "Planejamento" },
  { key: "gravando", label: "Produzindo" },
  { key: "editando", label: "Pronto" },
  { key: "agendado", label: "Agendado" },
  { key: "publicado", label: "Publicado" },
];

export const PILLAR_COLORS = [
  "#7C3AED", // Roxo vibrante
  "#2563EB", // Azul elétrico
  "#059669", // Verde esmeralda
  "#DC2626", // Vermelho coral
  "#D97706", // Amarelo âmbar
  "#DB2777", // Rosa magenta
  "#0891B2", // Ciano profundo
];
