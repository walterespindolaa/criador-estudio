export const PLATFORMS = ["instagram", "tiktok", "youtube"] as const;

export const FORMAT_LABELS: Record<string, string> = {
  reels: "Reels",
  carrossel: "Carrossel",
  story: "Story",
  video: "Vídeo",
  shorts: "Shorts",
  live: "Live",
};

export const FORMATS = ["reels", "carrossel", "story", "video", "shorts", "live"] as const;

export const STATUS_OPTIONS = [
  { key: "ideia", label: "Ideia" },
  { key: "roteiro", label: "Roteiro" },
  { key: "gravando", label: "Gravando" },
  { key: "editando", label: "Editando" },
  { key: "agendado", label: "Agendado" },
  { key: "publicado", label: "Publicado" },
];

export const PILLAR_COLORS = ["#C4622D", "#5C7A6B", "#8B6F4E", "#A4785C", "#6B8E7B", "#D4956A"];
