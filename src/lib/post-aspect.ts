export function postAspect(platform: string, format: string): string {
  const f = (format || "").toLowerCase();
  const p = (platform || "").toLowerCase();
  if (f === "story" || f === "reels" || f === "shorts") return "9 / 16";
  if (p === "youtube" && (f === "video" || f === "")) return "16 / 9";
  if (p === "tiktok") return "9 / 16";
  return "4 / 5"; // foto, carrossel e default
}
