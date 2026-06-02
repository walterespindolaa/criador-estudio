export const PLATFORMS = ["instagram", "tiktok", "youtube"] as const;

export const BUNNY_CDN_HOSTNAME = "vz-4f7de422-7aa.b-cdn.net";

export const FORMAT_LABELS: Record<string, string> = {
  reels: "Reels",
  carrossel: "Carrossel",
  foto: "Foto",
  story: "Story",
  video: "Vídeo",
  shorts: "Shorts",
  live: "Live",
};

export const FORMATS = ["reels", "carrossel", "foto", "story", "video", "shorts", "live"] as const;

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
