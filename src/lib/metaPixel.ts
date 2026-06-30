// Meta (Facebook) Pixel — client-side + espelho no CAPI server-side.
// O ID vem da env VITE_META_PIXEL_ID (configurar no Lovable). Sem ID, tudo vira no-op.
// Cada track() também é enviado pro CAPI (edge meta-capi) com o mesmo event_id → o Meta deduplica.

import { supabase } from "@/integrations/supabase/client";

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : undefined;
}

// Envia o evento pro CAPI (fire-and-forget). Email opcional pra melhorar o match.
function sendCapi(event: string, eventId?: string, params?: Record<string, unknown>): void {
  if (!PIXEL_ID || typeof window === "undefined") return;
  try {
    void supabase.functions.invoke("meta-capi", {
      body: {
        event_name: event,
        event_id: eventId,
        event_source_url: window.location.href,
        value: params?.value,
        currency: params?.currency,
        email: params?.email,
        fbp: getCookie("_fbp"),
        fbc: getCookie("_fbc"),
      },
    });
  } catch { /* tracking nunca quebra a UX */ }
}

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

/** Dispara um evento padrão do Pixel (PageView, Purchase, Lead, etc.) + espelha no CAPI. */
export function track(event: string, params?: Record<string, unknown>, eventId?: string): void {
  if (!PIXEL_ID || typeof window === "undefined") return;
  initMetaPixel();
  const id = eventId ?? newEventId();
  (window.fbq as ((...a: unknown[]) => void))?.("track", event, params || {}, { eventID: id });
  sendCapi(event, id, params);
}

export function trackPageView(): void {
  track("PageView");
}

export const isPixelEnabled = !!PIXEL_ID;
