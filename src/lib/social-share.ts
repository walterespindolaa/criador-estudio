export type MediaOrigin = "storage" | "bunny" | "drive" | "none";

export function detectMediaOrigin(url?: string | null): MediaOrigin {
  if (!url) return "none";
  if (url.includes("drive.google.com") || url.includes("googleusercontent.com")) return "drive";
  if (url.includes("iframe.mediadelivery.net") || url.includes("b-cdn.net")) return "bunny";
  return "storage";
}

const BUNNY_PULLZONE =
  (import.meta.env.VITE_BUNNY_STREAM_PULLZONE as string | undefined) ||
  "vz-4f7de422-7aa.b-cdn.net";

const SHARE_CACHE = "cria-share-media-v1";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h

export async function cacheShareFile(shareUrl: string, file: Blob): Promise<void> {
  try {
    if (typeof caches === "undefined") return;
    const cache = await caches.open(SHARE_CACHE);
    const headers = new Headers();
    headers.set("x-cria-cached-at", String(Date.now()));
    headers.set("Content-Type", file.type || "application/octet-stream");
    await cache.put(shareUrl, new Response(file, { headers }));
  } catch { /* storage cheio/indisponível — segue pro fetch */ }
}

async function readCachedShareFile(shareUrl: string): Promise<Blob | null> {
  try {
    if (typeof caches === "undefined") return null;
    const cache = await caches.open(SHARE_CACHE);
    const res = await cache.match(shareUrl);
    if (!res) return null;
    const cachedAt = Number(res.headers.get("x-cria-cached-at") || 0);
    if (cachedAt && Date.now() - cachedAt > CACHE_TTL_MS) {
      await cache.delete(shareUrl);
      return null;
    }
    return await res.blob();
  } catch { return null; }
}

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
    // 1) Arquivo local recém-subido (cache) — instantâneo, sem rede, sem esperar transcodificação.
    let blob = await readCachedShareFile(fileUrl);

    // 2) Fallback: baixa do Bunny/Storage COM timeout, pra nunca travar em "Preparando mídia…".
    if (!blob) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000); // 30s
      try {
        const res = await fetch(fileUrl, { signal: controller.signal });
        if (res.ok) blob = await res.blob();
      } finally {
        clearTimeout(timer);
      }
    }

    if (!blob) return null;
    const isVideo = mediaType === "video" || blob.type.startsWith("video");
    const ext = isVideo ? "mp4" : (blob.type.split("/")[1] || "jpg");
    return new File([blob], `cria-post.${ext}`, {
      type: blob.type || (isVideo ? "video/mp4" : "image/jpeg"),
    });
  } catch {
    return null; // inclui AbortError do timeout → PublishButton cai no fallback (copia legenda)
  }
}
