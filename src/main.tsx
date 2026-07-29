import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./lib/i18n";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorLogging } from "./lib/logError";
import { applyTheme, applyAccent } from "./lib/applyTheme";
import { applySidebarColor } from "./lib/sidebarTheme";

// Sentry: monitoramento de erros. Convive com o app_logs (o Admin → Logs continua
// funcionando); o Sentry agrupa/alerta/mostra a linha real via source map. Só liga
// em produção (enabled: PROD) pra não poluir com erros de desenvolvimento local.
// O DSN é público por design (vai no bundle do client, igual à VAPID public key).
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN ?? "https://53b51307be2e2b1b40df7440935a4198@o4511252656685056.ingest.us.sentry.io/4511816482160645",
  enabled: import.meta.env.PROD,
  environment: import.meta.env.MODE,
  // Só monitoramento de erro (sem tracing/replay), pra manter o bundle enxuto e
  // ficar folgado no tier grátis. Dá pra ligar tracing depois se precisar.
  tracesSampleRate: 0,
  sendDefaultPii: false,
});

installGlobalErrorLogging();

// Tema salvo aplicado IMEDIATAMENTE (antes do React montar), pra não ter o flash
// do laranja padrão trocando pra cor do usuário só quando o perfil chega.
try {
  const savedPreset = localStorage.getItem("theme_preset");
  const savedAccent = localStorage.getItem("theme_accent");
  if (savedPreset) applyTheme(savedPreset, savedAccent || "#EA4918");
  else if (savedAccent) applyAccent(savedAccent);
  const savedSidebar = localStorage.getItem("theme_sidebar");
  if (savedSidebar) applySidebarColor(savedSidebar);
} catch { /* localStorage indisponível: segue com o padrão */ }

// Apply saved font immediately to avoid flash of unstyled text.
// try/catch OBRIGATÓRIO: em navegador/webview com storage bloqueado (cookies
// desabilitados, modo restrito), localStorage.getItem LANÇA SecurityError. Como
// isto roda no load do módulo, antes do React e de qualquer ErrorBoundary, sem
// o guard o bundle inteiro quebrava → tela branca em TODAS as rotas (inclusive
// os links públicos de aprovação do cliente).
try {
  const savedFont = localStorage.getItem("theme_font");
  if (savedFont) {
    const FONT_MAP: Record<string, { display: string; body: string }> = {
      moderno: { display: "'Plus Jakarta Sans', sans-serif", body: "'Nunito Sans', sans-serif" },
      elegante: { display: "'DM Serif Display', serif", body: "'DM Sans', sans-serif" },
      criativo: { display: "'Space Grotesk', sans-serif", body: "'Outfit', sans-serif" },
      suave: { display: "'Quicksand', sans-serif", body: "'Nunito', sans-serif" },
      bold: { display: "'Sora', sans-serif", body: "'Inter', sans-serif" },
    };
    const opt = FONT_MAP[savedFont];
    if (opt) {
      document.documentElement.style.setProperty("--active-font-display", opt.display);
      document.documentElement.style.setProperty("--active-font-body", opt.body);
    }
  }
} catch { /* localStorage indisponível: segue com a fonte padrão */ }

createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </I18nProvider>
);
