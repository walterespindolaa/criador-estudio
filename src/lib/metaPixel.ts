// Meta (Facebook) Pixel — client-side.
// O ID vem da env VITE_META_PIXEL_ID (configurar no Lovable). Sem ID, tudo vira no-op.
// Os event_id gerados aqui permitem deduplicar com o CAPI server-side (futuro).

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

declare global {
  interface Window { fbq?: (...args: unknown[]) => void; _fbq?: unknown; }
}

let initialized = false;

/** Injeta o script base do Pixel uma única vez. Seguro chamar várias vezes. */
export function initMetaPixel(): void {
  if (initialized || !PIXEL_ID || typeof window === "undefined") return;
  /* eslint-disable */
  (function (f: any, b: any, e: string, v: string) {
    if (f.fbq) return;
    const n: any = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
    const t = b.createElement(e); t.async = true; t.src = v;
    const s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */
  (window.fbq as ((...a: unknown[]) => void))?.("init", PIXEL_ID);
  initialized = true;
}

/** Gera um event_id para deduplicação com o CAPI. */
export function newEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Dispara um evento padrão do Pixel (PageView, Purchase, Lead, etc.). */
export function track(event: string, params?: Record<string, unknown>, eventId?: string): void {
  if (!PIXEL_ID || typeof window === "undefined") return;
  initMetaPixel();
  (window.fbq as ((...a: unknown[]) => void))?.("track", event, params || {}, eventId ? { eventID: eventId } : undefined);
}

export function trackPageView(): void {
  track("PageView");
}

export const isPixelEnabled = !!PIXEL_ID;
