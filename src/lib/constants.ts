const PLATFORM_ICONS: Record<string, string> = {
  instagram: "📸",
  tiktok: "🎵",
  youtube: "🎬",
};

const FORMAT_LABELS: Record<string, string> = {
  reels: "Reels",
  carrossel: "Carrossel",
  story: "Story",
  video: "Vídeo",
  shorts: "Shorts",
  live: "Live",
};

const PLATFORMS = ["instagram", "tiktok", "youtube"];
const FORMATS = ["reels", "carrossel", "story", "video", "shorts", "live"];

const STATUS_OPTIONS = [
  { key: "ideia", label: "💡 Ideia" },
  { key: "roteiro", label: "✍️ Roteiro" },
  { key: "gravando", label: "🎬 Gravando" },
  { key: "editando", label: "✂️ Editando" },
  { key: "agendado", label: "📅 Agendado" },
  { key: "publicado", label: "✅ Publicado" },
];

const PILLAR_COLORS = ["#C4622D", "#5C7A6B", "#8B6F4E", "#A4785C", "#6B8E7B", "#D4956A"];

export { PLATFORM_ICONS, FORMAT_LABELS, PLATFORMS, FORMATS, STATUS_OPTIONS, PILLAR_COLORS };
