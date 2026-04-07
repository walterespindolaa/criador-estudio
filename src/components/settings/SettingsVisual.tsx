import { useState, useEffect } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/contexts/ThemeContext";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

const ACCENT_COLORS = [
  { hex: "#C4622D", label: "Terracota" },
  { hex: "#5C7A6B", label: "Sage" },
  { hex: "#3B82F6", label: "Azul" },
  { hex: "#EC4899", label: "Rosa" },
  { hex: "#8B5CF6", label: "Roxo" },
  { hex: "#F59E0B", label: "Âmbar" },
  { hex: "#EF4444", label: "Vermelho" },
  { hex: "#22C55E", label: "Verde" },
];

const FONT_OPTIONS = [
  { key: "fraunces", display: "Fraunces + DM Sans", label: "Orgânico", families: "'Fraunces', serif|'DM Sans', sans-serif" },
  { key: "cormorant", display: "Cormorant Garamond + Plus Jakarta Sans", label: "Elegante", families: "'Cormorant Garamond', serif|'Plus Jakarta Sans', sans-serif" },
  { key: "youngserif", display: "Young Serif + Outfit", label: "Moderno", families: "'Young Serif', serif|'Outfit', sans-serif" },
];

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyThemeColor(hex: string) {
  const hsl = hexToHsl(hex);
  document.documentElement.style.setProperty("--primary", hsl);
  document.documentElement.style.setProperty("--ring", hsl);
  document.documentElement.style.setProperty("--sidebar-primary", hsl);
  document.documentElement.style.setProperty("--sidebar-ring", hsl);
}

export function applyThemeFont(fontKey: string) {
  const opt = FONT_OPTIONS.find(f => f.key === fontKey);
  if (!opt) return;
  const [display, body] = opt.families.split("|");
  document.documentElement.style.setProperty("--font-display", display);
  document.documentElement.style.setProperty("--font-body", body);

  // Load Google Font dynamically
  const families: Record<string, string> = {
    fraunces: "Fraunces:opsz,wght@9..144,100..900&family=DM+Sans:wght@400;500;600;700",
    cormorant: "Cormorant+Garamond:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700",
    youngserif: "Young+Serif&family=Outfit:wght@400;500;600;700",
  };
  const id = `theme-font-${fontKey}`;
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${families[fontKey]}&display=swap`;
    document.head.appendChild(link);
  }
}

export function SettingsVisual() {
  const { theme, setTheme } = useTheme();
  const { profile, updateProfile } = useProfile();

  const [color, setColor] = useState(profile?.theme_color || "#C4622D");
  const [customColor, setCustomColor] = useState("");
  const [font, setFont] = useState(profile?.theme_font || "fraunces");

  useEffect(() => {
    if (profile) {
      setColor((profile as any).theme_color || "#C4622D");
      setFont((profile as any).theme_font || "fraunces");
    }
  }, [profile]);

  const handleColorSelect = (hex: string) => {
    setColor(hex);
    applyThemeColor(hex);
  };

  const handleFontSelect = (key: string) => {
    setFont(key);
    applyThemeFont(key);
  };

  const handleSave = async () => {
    await updateProfile({
      theme_color: color,
      theme_mode: theme,
      theme_font: font,
    } as any);
    toast.success("Visual salvo!");
  };

  return (
    <div className="space-y-6">
      {/* Accent color */}
      <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
        <h3 className="font-display font-semibold text-foreground">Cor de destaque</h3>
        <div className="flex flex-wrap gap-3">
          {ACCENT_COLORS.map(c => (
            <button
              key={c.hex}
              onClick={() => handleColorSelect(c.hex)}
              className={`w-10 h-10 rounded-full transition-all flex items-center justify-center ${color === c.hex ? "ring-2 ring-offset-2 ring-foreground" : "hover:scale-110"}`}
              style={{ backgroundColor: c.hex }}
              title={c.label}
            >
              {color === c.hex && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Label className="font-body text-sm whitespace-nowrap">Cor personalizada:</Label>
          <Input
            type="color"
            value={color}
            onChange={(e) => handleColorSelect(e.target.value)}
            className="w-10 h-10 p-1 rounded-xl cursor-pointer"
          />
          <Input
            placeholder="#hexcode"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            onBlur={() => { if (/^#[0-9a-fA-F]{6}$/.test(customColor)) handleColorSelect(customColor); }}
            className="rounded-xl text-sm w-28"
          />
        </div>
      </div>

      {/* Mode */}
      <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
        <h3 className="font-display font-semibold text-foreground">Modo</h3>
        <div className="flex gap-3">
          {([
            { key: "light" as const, label: "Claro", icon: Sun },
            { key: "dark" as const, label: "Escuro", icon: Moon },
            { key: "system" as const, label: "Sistema", icon: Monitor },
          ]).map(opt => (
            <button key={opt.key} onClick={() => setTheme(opt.key)}
              className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${theme === opt.key ? "bg-primary/10 border-primary" : "bg-background border-border"}`}>
              <opt.icon className={`h-5 w-5 ${theme === opt.key ? "text-primary" : "text-muted-foreground"}`} />
              <span className="text-xs font-body font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
        <h3 className="font-display font-semibold text-foreground">Tipografia</h3>
        <div className="space-y-2">
          {FONT_OPTIONS.map(opt => (
            <button key={opt.key} onClick={() => handleFontSelect(opt.key)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${font === opt.key ? "bg-primary/10 border-primary" : "bg-background border-border"}`}>
              <p className="font-body text-sm font-medium text-foreground">{opt.label}</p>
              <p className="text-xs text-muted-foreground font-body">{opt.display}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-3">
        <h3 className="font-display font-semibold text-foreground">Preview</h3>
        <div className="bg-background rounded-xl p-5 border border-border">
          <h4 className="font-display text-lg font-bold text-foreground mb-1">Título exemplo</h4>
          <p className="font-body text-sm text-muted-foreground mb-3">Esse é o corpo do texto com a fonte escolhida.</p>
          <button className="px-4 py-2 rounded-xl text-sm font-body font-medium text-primary-foreground bg-primary">Botão primário</button>
        </div>
      </div>

      <Button variant="hero" onClick={handleSave} className="w-full">Salvar Visual</Button>
    </div>
  );
}
