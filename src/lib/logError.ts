import { supabase } from "@/integrations/supabase/client";
import { sanitizeTrackingUrl } from "@/lib/trackingUrl";

// RPC nova ainda não está nos tipos gerados, cast.
const sbRpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<unknown>;

// Throttle: não repete a mesma mensagem por 1 minuto (evita spam de log).
const recent = new Map<string, number>();

export function logError(message: string, context?: Record<string, unknown>, level: "error" | "warn" | "info" = "error") {
  try {
    // Aviso do navegador, não é erro do app (aparecia no Piloto como erro novo, 08/11/2026).
    if (/ResizeObserver loop/i.test(message || "")) return;
    const key = (message || "").slice(0, 140);
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < 60_000) return;
    recent.set(key, now);

    void sbRpc("log_app_error", {
      _message: message || "erro sem mensagem",
      _context: { ...(context ?? {}), ua: typeof navigator !== "undefined" ? navigator.userAgent : null },
      // URL mascarada: rotas com token (/aprovar, /ativar, etc.) não vazam o token pro log.
      _url: typeof window !== "undefined" ? sanitizeTrackingUrl(window.location.href) : null,
      _level: level,
    }).then(undefined, () => { /* sem log, segue */ });
    // O retorno do rpc é preguiçoso: sem o .then o pedido nunca era enviado,
    // e o app_logs ficou com 0 linhas desde sempre (visto em 08/11/2026).
  } catch {
    /* nunca deixar o log quebrar o app */
  }
}

let installed = false;
export function installGlobalErrorLogging() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    logError(e.message || "window error", {
      source: e.filename,
      line: e.lineno,
      col: e.colno,
      stack: (e.error as Error | undefined)?.stack?.slice(0, 1200),
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason as { message?: string; stack?: string } | undefined;
    const msg = reason?.message || String(e.reason) || "unhandledrejection";
    logError("Promise não tratada: " + msg, { stack: reason?.stack?.slice(0, 1200) });
  });
}
