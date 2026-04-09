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
        <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-widest mb-3">Preview ao vivo</p>
        {previewTheme && (
          <div
            className="rounded-2xl border border-border overflow-hidden shadow-lg"
            style={{ backgroundColor: previewTheme.vars.background }}
          >
            {/* Mini app mockup */}
            <div className="flex h-[420px]">
              {/* Sidebar mock */}
              <div
                className="w-14 flex flex-col items-center gap-3 py-4 shrink-0"
                style={{ backgroundColor: previewSidebar }}
              >
                <div className="w-7 h-7 rounded-lg" style={{ backgroundColor: selectedAccent, opacity: 0.9 }} />
                <div className="w-5 h-1 rounded-full mt-2" style={{ backgroundColor: isDarkSidebar ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)' }} />
                <div className="w-5 h-1 rounded-full" style={{ backgroundColor: isDarkSidebar ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }} />
                <div className="w-5 h-1 rounded-full" style={{ backgroundColor: isDarkSidebar ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }} />
                <div className="w-5 h-1 rounded-full" style={{ backgroundColor: isDarkSidebar ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }} />
              </div>

              {/* Main content mock */}
              <div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <div
                      className="h-4 w-28 rounded mb-1.5"
                      style={{
                        backgroundColor: previewTheme.vars.foreground,
                        opacity: 0.85,
                        fontFamily: previewFont?.displayFont,
                      }}
                    />
                    <div className="h-2 w-20 rounded-full" style={{ backgroundColor: previewTheme.vars.muted }} />
                  </div>
                  <div
                    className="px-3 py-1.5 rounded-xl text-[9px] font-semibold"
                    style={{
                      backgroundColor: selectedAccent,
                      color: '#fff',
                      fontFamily: previewFont?.bodyFont,
                    }}
                  >
                    + Novo
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex gap-2">
                  {[1, 2, 3].map(n => (
                    <div
                      key={n}
                      className="flex-1 rounded-xl p-2.5"
                      style={{ backgroundColor: previewTheme.vars.card }}
                    >
                      <div className="h-1.5 w-8 rounded-full mb-1.5" style={{ backgroundColor: previewTheme.vars.muted }} />
                      <div
                        className="text-sm font-bold"
                        style={{
                          color: previewTheme.vars.foreground,
                          fontFamily: previewFont?.bodyFont,
                        }}
                      >
                        {n === 1 ? "12" : n === 2 ? "4" : "87%"}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cards */}
                <div className="flex-1 flex flex-col gap-2">
                  {[1, 2, 3].map(n => (
                    <div
                      key={n}
                      className="rounded-xl p-3 flex items-center gap-3"
                      style={{ backgroundColor: previewTheme.vars.card }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg shrink-0"
                        style={{ backgroundColor: n === 1 ? selectedAccent : previewTheme.vars.muted, opacity: n === 1 ? 0.2 : 1 }}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className="h-2 rounded-full mb-1.5"
                          style={{
                            backgroundColor: previewTheme.vars.foreground,
                            opacity: 0.6,
                            width: n === 1 ? '70%' : n === 2 ? '55%' : '80%',
                          }}
                        />
                        <div className="h-1.5 w-1/2 rounded-full" style={{ backgroundColor: previewTheme.vars.muted }} />
                      </div>
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: n === 1 ? selectedAccent : previewTheme.vars.muted }}
                      />
                    </div>
                  ))}
                </div>

                {/* Bottom bar mock */}
                <div className="flex items-center justify-around py-1.5 rounded-xl" style={{ backgroundColor: previewTheme.vars.card }}>
                  {[1, 2, 3, 4].map(n => (
                    <div
                      key={n}
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: n === 1 ? selectedAccent : previewTheme.vars.muted, opacity: n === 1 ? 0.8 : 0.4 }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer with font label */}
            <div
              className="px-4 py-2.5 border-t flex items-center justify-between"
              style={{ borderColor: previewTheme.vars.border, backgroundColor: previewTheme.vars.card }}
            >
              <span
                className="text-[10px] font-medium"
                style={{ color: previewTheme.vars.foreground, opacity: 0.5, fontFamily: previewFont?.bodyFont }}
              >
                {previewFont?.desc}
              </span>
              <span
                className="text-[10px] font-semibold"
                style={{ color: selectedAccent }}
              >
                {previewTheme.name}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
