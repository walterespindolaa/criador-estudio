import { useState, useEffect } from "react";
import { Check, Monitor, Type, Palette, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { THEME_PRESETS, ACCENT_COLORS, type ThemePreset } from "@/lib/themes";
import { applyTheme, applyAccent } from "@/lib/applyTheme";
import { applySidebarColor } from "@/lib/sidebarTheme";
import { toast } from "sonner";

const FONT_OPTIONS = [
  { key: "fraunces", label: "Orgânico", desc: "Fraunces + Inter", preview: "Elegância natural", displayFont: "'Fraunces', serif", bodyFont: "'Inter', sans-serif" },
  { key: "cormorant", label: "Elegante", desc: "Cormorant + Jakarta Sans", preview: "Sofisticação clássica", displayFont: "'Cormorant Garamond', serif", bodyFont: "'Plus Jakarta Sans', sans-serif" },
  { key: "youngserif", label: "Moderno", desc: "Young Serif + Outfit", preview: "Estilo contemporâneo", displayFont: "'Young Serif', serif", bodyFont: "'Outfit', sans-serif" },
];

const SIDEBAR_COLORS = [
  { label: "Padrão", value: "" },
  { label: "Bege", value: "#F2EDE6" },
  { label: "Branco", value: "#FAFAFA" },
  { label: "Cinza", value: "#E8E8E8" },
  { label: "Carvão", value: "#1E1A17" },
  { label: "Marinho", value: "#161D2E" },
  { label: "Terracota", value: "#E5CDB8" },
  { label: "Lavanda", value: "#DDD5F0" },
  { label: "Sálvia", value: "#D5E5D5" },
  { label: "Rosé", value: "#F0DDD4" },
  { label: "Oliva", value: "#CED8BC" },
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

export function SettingsVisual() {
  const { profile, updateProfile } = useProfile();

  const [selectedTheme, setSelectedTheme] = useState(profile?.theme_preset || "clean-warm");
  const [selectedAccent, setSelectedAccent] = useState(profile?.theme_accent || "#C4622D");
  const [sidebarColor, setSidebarColor] = useState(profile?.theme_sidebar || "");
  const [selectedFont, setSelectedFont] = useState(profile?.theme_font || "fraunces");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setSelectedTheme(profile.theme_preset || "clean-warm");
      setSelectedAccent(profile.theme_accent || "#C4622D");
      setSidebarColor(profile.theme_sidebar || "");
      setSelectedFont(profile.theme_font || "fraunces");
    }
  }, [profile]);

  const handleThemeSelect = (id: string) => {
    setSelectedTheme(id);
    applyTheme(id, selectedAccent);
    if (sidebarColor) applySidebarColor(sidebarColor);
  };

  const handleAccentSelect = (value: string) => {
    setSelectedAccent(value);
    applyAccent(value);
  };

  const handleSidebarSelect = (hex: string) => {
    setSidebarColor(hex);
    applySidebarColor(hex || null);
  };

  const handleFontSelect = (key: string) => {
    setSelectedFont(key);
    applyThemeFont(key);
  };

  const handleSave = async () => {
    setSaving(true);
    const preset = THEME_PRESETS.find(t => t.id === selectedTheme);
    await updateProfile({
      theme_preset: selectedTheme,
      theme_accent: selectedAccent,
      theme_mode: preset?.mode || "light",
      theme_sidebar: sidebarColor || null,
      theme_font: selectedFont,
    } as any);
    toast.success("Visual salvo!");
    setSaving(false);
  };

  const previewTheme = THEME_PRESETS.find(t => t.id === selectedTheme);
  const previewFont = FONT_OPTIONS.find(f => f.key === selectedFont);
  const previewSidebar = sidebarColor || previewTheme?.vars.sidebar || "#F2EDE6";
  const isDarkSidebar = previewSidebar ? parseInt(previewSidebar.slice(1), 16) < 0x808080 : false;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">

      {/* LEFT — Controls */}
      <div className="space-y-8">

        {/* Themes */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Monitor className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-body font-semibold text-foreground">Tema</h3>
          </div>
          <p className="text-xs text-muted-foreground font-body mb-4">Escolha a paleta de cores do sistema</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {THEME_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => handleThemeSelect(preset.id)}
                className={`relative rounded-2xl border-2 p-1 transition-all text-left ${
                  selectedTheme === preset.id
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-primary/30"
                }`}
              >
                {selectedTheme === preset.id && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center z-10">
                    <Check className="h-2.5 w-2.5 text-primary-foreground" />
                  </div>
                )}
                <div className="rounded-xl overflow-hidden h-14 flex" style={{ backgroundColor: preset.vars.background }}>
                  <div className="w-1/5 h-full" style={{ backgroundColor: preset.vars.sidebar }} />
                  <div className="flex-1 p-1.5 flex flex-col gap-1">
                    <div className="h-1.5 w-2/3 rounded-full" style={{ backgroundColor: selectedAccent, opacity: 0.8 }} />
                    <div className="flex gap-1 flex-1">
                      <div className="flex-1 rounded" style={{ backgroundColor: preset.vars.card }} />
                      <div className="flex-1 rounded" style={{ backgroundColor: preset.vars.card }} />
                    </div>
                  </div>
                </div>
                <div className="px-1 py-1">
                  <p className="text-[10px] font-semibold font-body text-foreground truncate">{preset.name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Accent Color */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Palette className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-body font-semibold text-foreground">Cor de destaque</h3>
          </div>
          <p className="text-xs text-muted-foreground font-body mb-3">Botões, links e elementos ativos</p>
          <div className="flex flex-wrap gap-2.5">
            {ACCENT_COLORS.map(accent => (
              <button
                key={accent.key}
                onClick={() => handleAccentSelect(accent.value)}
                title={accent.label}
                className={`w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center ${
                  selectedAccent === accent.value
                    ? "border-foreground scale-110 shadow-md"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: accent.value }}
              >
                {selectedAccent === accent.value && (
                  <Check className="h-4 w-4 text-white drop-shadow" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Color */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <PanelLeft className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-body font-semibold text-foreground">Cor da sidebar</h3>
          </div>
          <p className="text-xs text-muted-foreground font-body mb-3">Personalize o fundo da barra lateral</p>
          <div className="flex flex-wrap gap-2">
            {SIDEBAR_COLORS.map(c => (
              <button
                key={c.value || "default"}
                onClick={() => handleSidebarSelect(c.value)}
                title={c.label}
                className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                  sidebarColor === c.value
                    ? "border-foreground scale-110 shadow-md"
                    : "border-border hover:scale-105"
                }`}
                style={{ backgroundColor: c.value || (previewTheme?.vars.sidebar || '#F2EDE6') }}
              >
                {sidebarColor === c.value && (
                  <Check className="h-3 w-3" style={{ color: c.value && parseInt(c.value.slice(1), 16) < 0x808080 ? '#fff' : '#1C1C1A' }} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Typography */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Type className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-body font-semibold text-foreground">Tipografia</h3>
          </div>
          <p className="text-xs text-muted-foreground font-body mb-3">Estilo tipográfico de todo o sistema</p>
          <div className="grid grid-cols-3 gap-2.5">
            {FONT_OPTIONS.map(font => (
              <button
                key={font.key}
                onClick={() => handleFontSelect(font.key)}
                className={`rounded-2xl border-2 p-3 text-left transition-all ${
                  selectedFont === font.key
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <p className="text-base font-semibold text-foreground leading-tight" style={{ fontFamily: font.displayFont }}>
                  {font.label}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5" style={{ fontFamily: font.bodyFont }}>{font.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} variant="hero" className="w-full">
          {saving ? "Salvando..." : "Salvar visual"}
        </Button>
      </div>

      {/* RIGHT — Live Preview */}
      <div className="hidden lg:block sticky top-6 self-start">
        <h3 className="text-sm font-body font-semibold text-foreground mb-1">Preview</h3>
        <p className="text-xs text-muted-foreground font-body mb-4">Como o app vai aparecer com as suas escolhas</p>

        {previewTheme && (
          <div className="rounded-2xl overflow-hidden border border-border shadow-lg" style={{ backgroundColor: previewTheme.vars.background }}>
            <div className="flex h-64">
              {/* Sidebar */}
              <div className="w-14 h-full flex flex-col items-center py-4 gap-4 shrink-0" style={{ backgroundColor: previewSidebar }}>
                <div className="w-7 h-7 rounded-full" style={{ backgroundColor: selectedAccent }} />
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-5 h-5 rounded-lg" style={{ backgroundColor: i === 1 ? selectedAccent : previewTheme.vars.muted, opacity: i === 1 ? 1 : 0.5 }} />
                ))}
              </div>
              {/* Main content */}
              <div className="flex-1 p-4 flex flex-col gap-3">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <div className="h-4 w-32 rounded-full" style={{ backgroundColor: previewTheme.vars.foreground, opacity: 0.8 }} />
                </div>
                {/* Stats cards */}
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-xl p-2" style={{ backgroundColor: previewTheme.vars.card }}>
                      <div className="h-1.5 w-1/2 rounded mb-1.5" style={{ backgroundColor: previewTheme.vars.muted }} />
                      <div className="h-4 w-1/3 rounded" style={{ backgroundColor: i === 1 ? selectedAccent : previewTheme.vars.muted, opacity: i === 1 ? 1 : 0.5 }} />
                    </div>
                  ))}
                </div>
                {/* Content area */}
                <div className="flex-1 rounded-xl p-3" style={{ backgroundColor: previewTheme.vars.card }}>
                  <div className="h-2 w-3/4 rounded mb-2" style={{ backgroundColor: previewTheme.vars.muted }} />
                  <div className="h-2 w-1/2 rounded mb-2" style={{ backgroundColor: previewTheme.vars.muted, opacity: 0.6 }} />
                  <div className="h-6 w-24 rounded-lg mt-3" style={{ backgroundColor: selectedAccent }} />
                </div>
              </div>
            </div>
            {/* Bottom bar */}
            <div className="h-10 flex items-center justify-around px-4 border-t" style={{ backgroundColor: previewTheme.vars.card, borderColor: previewTheme.vars.border || "rgba(0,0,0,0.1)" }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="w-5 h-5 rounded" style={{ backgroundColor: i === 1 ? selectedAccent : previewTheme.vars.muted, opacity: i === 1 ? 1 : 0.4 }} />
              ))}
            </div>
          </div>
        )}

        {/* Font preview */}
        {previewTheme && (
          <div className="mt-4 rounded-2xl border border-border p-4" style={{ backgroundColor: previewTheme.vars.card }}>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-body">Tipografia selecionada</p>
            <p className="text-xl font-bold mb-1" style={{ fontFamily: previewFont?.displayFont, color: previewTheme.vars.foreground }}>
              Criadores de conteúdo
            </p>
            <p className="text-sm" style={{ fontFamily: previewFont?.bodyFont, color: previewTheme.vars.foreground, opacity: 0.6 }}>
              {previewFont?.desc} · {previewFont?.preview}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
