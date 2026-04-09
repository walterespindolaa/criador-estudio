import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./contexts/ThemeContext";
import App from "./App.tsx";
import "./index.css";

// Apply saved font immediately to avoid flash of unstyled text
const savedFont = localStorage.getItem("theme_font");
if (savedFont) {
  const FONT_MAP: Record<string, { display: string; body: string }> = {
    fraunces: { display: "'Fraunces', serif", body: "'Inter', sans-serif" },
    cormorant: { display: "'Cormorant Garamond', serif", body: "'Plus Jakarta Sans', sans-serif" },
    youngserif: { display: "'Young Serif', serif", body: "'Outfit', sans-serif" },
  };
  const opt = FONT_MAP[savedFont];
  if (opt) {
    document.documentElement.style.setProperty("--active-font-display", opt.display);
    document.documentElement.style.setProperty("--active-font-body", opt.body);
  }
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
