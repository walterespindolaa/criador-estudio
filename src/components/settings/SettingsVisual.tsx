import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/hooks/useProfile";
import { THEME_PRESETS, ACCENT_COLORS, type ThemePreset } from "@/lib/themes";
import { applyTheme, applyAccent } from "@/lib/applyTheme";
import { applySidebarColor } from "@/lib/sidebarTheme";
import { toast } from "sonner";

const FONT_OPTIONS = [
  { key: "fraunces", label: "Orgânico", desc: "Fraunces + Inter", preview: "Elegância natural" },
  { key: "cormorant", label: "Elegante", desc: "Cormorant + Jakarta Sans", preview: "Sofisticação clássica" },
  { key: "youngserif", label: "Moderno", desc: "Young Serif + Outfit", preview: "Estilo contemporâneo" },
];

export function applyThemeFont(fontKey: string) {
  localStorage.setItem("theme_font", fontKey);

  const fonts: Record<string, { display: string; body: string }> = {
    fraunces: { display: "'Fraunces', serif", body: "'Inter', sans-serif" },
    cormorant: { display: "'Cormorant Garamond', serif", body: "'Plus Jakarta Sans', sans-serif" },
    youngserif: { display: "'Young Serif', serif", body: "'Outfit', sans-serif" },
  };

  const opt = fonts[fontKey];
  if (!opt) return;

  document.documentElement.style.setProperty("--active-font-display", opt.display);
  document.documentElement.style.setProperty("--active-font-body", opt.body);
}

function ThemeCard({ preset, selected, onClick }: { preset: ThemePreset; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-2xl border-2 p-1 transition-all text-left ${
        selected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/30"
      }`}
    >
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
      <div className="rounded-xl overflow-hidden h-20 flex" style={{ backgroundColor: preset.vars.background }}>
        <div className="w-1/4 h-full" style={{ backgroundColor: preset.vars.sidebar }} />
        <div className="flex-1 p-2 flex flex-col gap-1.5">
          <div className="h-2.5 w-3/4 rounded-full" style={{ backgroundColor: preset.vars.muted }} />
          <div className="flex gap-1 flex-1">
            <div className="flex-1 rounded-lg" style={{ backgroundColor: preset.vars.card }} />
            <div className="flex-1 rounded-lg" style={{ backgroundColor: preset.vars.card }} />
          </div>
        </div>
      </div>
      <div className="px-2 py-2">
        <p className="text-sm font-semibold font-body text-foreground">{preset.name}</p>
        <p className="text-xs text-muted-foreground font-body">{preset.desc}</p>
      </div>
    </button>
  );
}

const SIDEBAR_COLORS = [
  { label: "Padrão (tema)", value: "" },
  { label: "Bege Quente", value: "#F2EDE6" },
  { label: "Branco", value: "#FAFAFA" },
  { label: "Cinza Suave", value: "#E8E8E8" },
  { label: "Carvão", value: "#1E1A17" },
  { label: "Marinho", value: "#161D2E" },
  { label: "Terracota", value: "#E5CDB8" },
  { label: "Lavanda", value: "#DDD5F0" },
  { label: "Sálvia", value: "#D5E5D5" },
  { label: "Rosé", value: "#F0DDD4" },
  { label: "Oliva", value: "#CED8BC" },
];

export function SettingsVisual() {
  const { profile, updateProfile } = useProfile();

  const [preset, setPreset] = useState(profile?.theme_preset || "clean-warm");
  const [accent, setAccent] = useState(profile?.theme_accent || "#C4622D");
  const [sidebarColor, setSidebarColor] = useState(profile?.theme_sidebar || "");
  const [font, setFont] = useState(profile?.theme_font || "fraunces");

  useEffect(() => {
    if (profile) {
      setPreset(profile.theme_preset || "clean-warm");
      setAccent(profile.theme_accent || "#C4622D");
      setSidebarColor(profile.theme_sidebar || "");
      setFont(profile.theme_font || "fraunces");
    }
  }, [profile]);

  const handlePresetSelect = (id: string) => {
    setPreset(id);
    applyTheme(id, accent);
    // Re-apply sidebar color override after theme change
    if (sidebarColor) applySidebarColor(sidebarColor);
  };

  const handleAccentSelect = (hex: string) => {
    setAccent(hex);
    applyAccent(hex);
  };

  const handleSidebarSelect = (hex: string) => {
    setSidebarColor(hex);
    // Instant application!
    applySidebarColor(hex || null);
  };

  const handleFontSelect = (key: string) => {
    setFont(key);
    applyThemeFont(key);
  };

  const handleSave = async () => {
    const selectedPreset = THEME_PRESETS.find(t => t.id === preset);
    await updateProfile({
      theme_preset: preset,
      theme_accent: accent,
      theme_mode: selectedPreset?.mode || "light",
      theme_sidebar: sidebarColor || null,
      theme_font: font,
    } as any);
    toast.success("Visual salvo!");
  };

  const essenciais = THEME_PRESETS.filter(t => t.group === "essenciais");
  const premium = THEME_PRESETS.filter(t => t.group === "premium");
  const selectedPreset = THEME_PRESETS.find(t => t.id === preset);

  return (
    <div className="space-y-6">
      {/* Theme presets - Essenciais */}
      <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
        <div>
          <p className="text-xs font-semibold font-body uppercase tracking-widest text-muted-foreground mb-3">Essenciais</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {essenciais.map(t => (
              <ThemeCard key={t.id} preset={t} selected={preset === t.id} onClick={() => handlePresetSelect(t.id)} />
            ))}
          </div>
        </div>
      </div>

      {/* Theme presets - Premium */}
      <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-xs font-semibold font-body uppercase tracking-widest text-muted-foreground">Temas Premium</p>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Novos</Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {premium.map(t => (
            <ThemeCard key={t.id} preset={t} selected={preset === t.id} onClick={() => handlePresetSelect(t.id)} />
          ))}
        </div>
      </div>

      {/* Accent color */}
      <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
        <div>
          <h3 className="font-display font-semibold text-foreground">Cor de Destaque</h3>
          <p className="text-xs text-muted-foreground font-body mt-0.5">Defina a cor principal de ícones, badges e elementos de ação</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ACCENT_COLORS.map(c => (
            <button
              key={c.key}
              onClick={() => handleAccentSelect(c.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                accent === c.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: c.value }}>
                {accent === c.value && <Check className="h-3 w-3 text-white" />}
              </span>
              <span className="text-xs font-body font-medium text-foreground">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sidebar color */}
      <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
        <div>
          <h3 className="font-display font-semibold text-foreground">Cor da Sidebar</h3>
          <p className="text-xs text-muted-foreground font-body mt-0.5">Personalize a cor de fundo da barra lateral</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SIDEBAR_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => handleSidebarSelect(c.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                sidebarColor === c.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
              }`}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center border border-border"
                style={{ backgroundColor: c.value || (selectedPreset?.vars.sidebar || '#F2EDE6') }}
              >
                {sidebarColor === c.value && <Check className="h-3 w-3" style={{ color: c.value && parseInt(c.value.slice(1), 16) < 0x808080 ? '#fff' : '#1C1C1A' }} />}
              </span>
              <span className="text-xs font-body font-medium text-foreground">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-4">
        <div>
          <h3 className="font-display font-semibold text-foreground">Tipografia</h3>
          <p className="text-xs text-muted-foreground font-body mt-0.5">Escolha o estilo tipográfico de todo o sistema</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {FONT_OPTIONS.map(f => (
            <button
              key={f.key}
              onClick={() => handleFontSelect(f.key)}
              className={`relative text-left rounded-2xl border-2 p-4 transition-all ${
                font === f.key ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/30"
              }`}
            >
              {font === f.key && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              <p className="text-sm font-semibold text-foreground">{f.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{f.desc}</p>
              <p className="text-xs text-muted-foreground/70 mt-2 italic">{f.preview}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Live preview */}
      <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-3">
        <h3 className="font-display font-semibold text-foreground">Preview ao vivo</h3>
        {selectedPreset && (
          <div className="rounded-xl overflow-hidden border border-border h-40 flex" style={{ backgroundColor: selectedPreset.vars.background }}>
            <div className="w-1/5 h-full flex flex-col gap-2 p-3" style={{ backgroundColor: sidebarColor || selectedPreset.vars.sidebar }}>
              <div className="h-2 w-full rounded-full" style={{ backgroundColor: accent, opacity: 0.8 }} />
              <div className="h-2 w-3/4 rounded-full" style={{ backgroundColor: selectedPreset.vars.muted }} />
              <div className="h-2 w-3/4 rounded-full" style={{ backgroundColor: selectedPreset.vars.muted }} />
              <div className="h-2 w-3/4 rounded-full" style={{ backgroundColor: selectedPreset.vars.muted }} />
            </div>
            <div className="flex-1 p-4 flex flex-col gap-3">
              <div className="h-3 w-1/3 rounded-full" style={{ backgroundColor: selectedPreset.vars.foreground, opacity: 0.7 }} />
              <div className="flex gap-3 flex-1">
                <div className="flex-1 rounded-xl p-3 flex flex-col gap-2" style={{ backgroundColor: selectedPreset.vars.card }}>
                  <div className="h-2 w-2/3 rounded-full" style={{ backgroundColor: selectedPreset.vars.foreground, opacity: 0.5 }} />
                  <div className="h-2 w-full rounded-full" style={{ backgroundColor: selectedPreset.vars.muted }} />
                </div>
                <div className="flex-1 rounded-xl p-3 flex flex-col gap-2" style={{ backgroundColor: selectedPreset.vars.card }}>
                  <div className="h-2 w-2/3 rounded-full" style={{ backgroundColor: selectedPreset.vars.foreground, opacity: 0.5 }} />
                  <div className="h-2 w-full rounded-full" style={{ backgroundColor: selectedPreset.vars.muted }} />
                </div>
              </div>
              <button
                className="self-start px-4 py-1.5 rounded-xl text-xs font-body font-medium text-white"
                style={{ backgroundColor: accent }}
              >
                Botão primário
              </button>
            </div>
          </div>
        )}
      </div>

      <Button variant="hero" onClick={handleSave} className="w-full">Salvar Visual</Button>
    </div>
  );
}
