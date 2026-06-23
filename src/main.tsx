import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./lib/i18n";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorLogging } from "./lib/logError";

installGlobalErrorLogging();

// Apply saved font immediately to avoid flash of unstyled text
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

createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </I18nProvider>
);
