import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./lib/i18n";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorLogging } from "./lib/logError";
import { applyTheme, applyAccent } from "./lib/applyTheme";
import { applySidebarColor } from "./lib/sidebarTheme";

// Sentry: monitoramento de erros. Convive com o app_logs (o Admin → Logs continua
// funcionando); o Sentry agrupa/alerta/mostra a linha real via source map. Só liga
// em produção pra não poluir com erros de desenvolvimento local.
// O DSN é público por design (vai no bundle do client, igual à VAPID public key).
// CARGA ADIADA (pente fino 23/09/2026): o SDK (~80 KB gzip) saía do caminho
// crítico do primeiro paint. Ele entra na ociosidade; erros dos primeiros
// segundos continuam indo pro app_logs pelo installGlobalErrorLogging.
if (import.meta.env.PROD) {
  const ligarSentry = () => {
    void import("./lib/sentry").then((m) => m.ligarSentry()).catch(() => { /* sem Sentry, segue */ });
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(ligarSentry, { timeout: 4000 });
  else setTimeout(ligarSentry, 2000);
}

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
