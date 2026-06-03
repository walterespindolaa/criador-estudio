export type MediaOrigin = "storage" | "bunny" | "drive" | "none";

export function detectMediaOrigin(url?: string | null): MediaOrigin {
  if (!url) return "none";
  if (url.includes("drive.google.com") || url.includes("googleusercontent.com")) return "drive";
  if (url.includes("iframe.mediadelivery.net") || url.includes("b-cdn.net")) return "bunny";
  return "storage";
}

const BUNNY_PULLZONE = import.meta.env.VITE_BUNNY_STREAM_PULLZONE as string | undefined;

export function resolveShareableUrl(url: string, origin: MediaOrigin): string | null {
  if (origin === "storage") return url;
  if (origin === "bunny") {
    if (!BUNNY_PULLZONE) return null;
    const m = url.match(/embed\/\d+\/([a-f0-9-]+)/i) || url.match(/b-cdn\.net\/([a-f0-9-]+)/i);
    const guid = m?.[1];
    if (!guid) return null;
    return `https://${BUNNY_PULLZONE}/${guid}/play_720p.mp4`;
  }
  return null;
}

export function isMobileDevice(): boolean {
  return typeof navigator !== "undefined" && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

export async function buildShareFile(fileUrl: string, mediaType?: string | null): Promise<File | null> {
  try {
    const res = await fetch(fileUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const isVideo = mediaType === "video" || blob.type.startsWith("video");
    const ext = isVideo ? "mp4" : (blob.type.split("/")[1] || "jpg");
    return new File([blob], `cria-post.${ext}`, {
      type: blob.type || (isVideo ? "video/mp4" : "image/jpeg"),
    });
  } catch {
    return null;
  }
}
