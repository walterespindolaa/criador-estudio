/* Sentry num módulo próprio: main.tsx carrega isto na ociosidade e o
   ErrorBoundary chama `capturar` sem importar o SDK direto. Se o SDK ainda
   não subiu quando o erro acontece, o erro vai só pro app_logs (que já é o
   caminho de sempre); nada se perde do lado do usuário. */
import * as Sentry from "@sentry/react";

let ligado = false;

export function ligarSentry() {
  if (ligado) return;
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN ?? "https://53b51307be2e2b1b40df7440935a4198@o4511252656685056.ingest.us.sentry.io/4511816482160645",
    enabled: import.meta.env.PROD,
    environment: import.meta.env.MODE,
    // Só monitoramento de erro (sem tracing/replay), pra manter o bundle enxuto e
    // ficar folgado no tier grátis. Dá pra ligar tracing depois se precisar.
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
  ligado = true;
}

export function capturar(error: unknown, componentStack?: string | null) {
  if (!ligado) return;
  Sentry.captureException(error, { contexts: { react: { componentStack: componentStack ?? undefined } } });
}
