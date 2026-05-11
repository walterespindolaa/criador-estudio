import { useState, useEffect } from "react";
import { Check, Monitor, Type, Palette, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { THEME_PRESETS, ACCENT_COLORS, type ThemePreset } from "@/lib/themes";
import { applyTheme, applyAccent } from "@/lib/applyTheme";
import { applySidebarColor } from "@/lib/sidebarTheme";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FONT_OPTIONS = [
  { key: "moderno", label: "Moderno", desc: "Plus Jakarta Sans + Nunito Sans", preview: "Limpo e contemporâneo", displayFont: "'Plus Jakarta Sans', sans-serif", bodyFont: "'Nunito Sans', sans-serif" },
  { key: "elegante", label: "Elegante", desc: "DM Serif Display + DM Sans", preview: "Editorial sofisticado", displayFont: "'DM Serif Display', serif", bodyFont: "'DM Sans', sans-serif" },
  { key: "criativo", label: "Criativo", desc: "Space Grotesk + Outfit", preview: "Atitude criadora", displayFont: "'Space Grotesk', sans-serif", bodyFont: "'Outfit', sans-serif" },
  { key: "suave", label: "Suave", desc: "Quicksand + Nunito", preview: "Calmo e arredondado", displayFont: "'Quicksand', sans-serif", bodyFont: "'Nunito', sans-serif" },
  { key: "bold", label: "Bold", desc: "Sora + Inter", preview: "Geométrico e impactante", displayFont: "'Sora', sans-serif", bodyFont: "'Inter', sans-serif" },
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
    moderno: { display: "'Plus Jakarta Sans', sans-serif", body: "'Nunito Sans', sans-serif" },
    elegante: { display: "'DM Serif Display', serif", body: "'DM Sans', sans-serif" },
    criativo: { display: "'Space Grotesk', sans-serif", body: "'Outfit', sans-serif" },
    suave: { display: "'Quicksand', sans-serif", body: "'Nunito', sans-serif" },
    bold: { display: "'Sora', sans-serif", body: "'Inter', sans-serif" },
  };
  const opt = fonts[fontKey] ?? fonts.moderno;
  document.documentElement.style.setProperty("--active-font-display", opt.display);
  document.documentElement.style.setProperty("--active-font-body", opt.body);
}

export function SettingsVisual() {
  const { profile, updateProfile } = useProfile();

  const [selectedTheme, setSelectedTheme] = useState(profile?.theme_preset || "clean-warm");
  const [selectedAccent, setSelectedAccent] = useState(profile?.theme_accent || "#C4622D");
  const [sidebarColor, setSidebarColor] = useState(profile?.theme_sidebar || "");
  const [selectedFont, setSelectedFont] = useState(profile?.theme_font || "moderno");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setSelectedTheme(profile.theme_preset || "clean-warm");
      setSelectedAccent(profile.theme_accent || "#C4622D");
      setSidebarColor(profile.theme_sidebar || "");
      setSelectedFont(profile.theme_font || "moderno");
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
    await updateProfile.mutateAsync({
      theme_preset: selectedTheme,
      theme_accent: selectedAccent,
      theme_mode: preset?.mode || "light",
      theme_sidebar: sidebarColor || null,
      theme_font: selectedFont,
    });
    toast.success("Visual salvo!");
    setSaving(false);
  };

  const previewTheme = THEME_PRESETS.find(t => t.id === selectedTheme);
  const previewFont = FONT_OPTIONS.find(f => f.key === selectedFont);
  const previewSidebar = sidebarColor || previewTheme?.vars.sidebar || "#F2EDE6";

  return (
    <div className="w-full max-w-[1100px] mx-auto">
      <div className="flex flex-col lg:flex-row gap-12">
        {/* LEFT — Controls */}
        <div className="flex-[0_0_45%] space-y-10">
          {/* Themes */}
          <section>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <Monitor className="h-5 w-5 text-primary" />
                <h3 className="text-base font-body font-bold text-foreground">Tema</h3>
              </div>
              <p className="text-sm text-muted-foreground font-body">Escolha a paleta de cores do sistema</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {THEME_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handleThemeSelect(preset.id)}
                  className={cn(
                    "group relative rounded-2xl border-2 transition-all text-left overflow-hidden flex flex-col min-w-[120px]",
                    selectedTheme === preset.id
                      ? "border-[#1A2F21] ring-1 ring-[#1A2F21]"
                      : "border-border hover:border-[#1A2F21]/30"
                  )}
                >
                  <div className="p-2.5 h-20 flex" style={{ backgroundColor: preset.vars.background }}>
                    <div className="w-1/4 h-full rounded-sm" style={{ backgroundColor: preset.vars.sidebar }} />
                    <div className="flex-1 pl-2 flex flex-col gap-1.5">
                      <div className="h-2 w-full rounded-full" style={{ backgroundColor: selectedAccent, opacity: 0.8 }} />
                      <div className="flex gap-1.5 flex-1">
                        <div className="flex-1 rounded-sm shadow-sm" style={{ backgroundColor: preset.vars.card }} />
                        <div className="flex-1 rounded-sm shadow-sm" style={{ backgroundColor: preset.vars.card }} />
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-2 bg-background border-t">
                    <p className={cn(
                      "text-xs font-semibold font-body truncate",
                      selectedTheme === preset.id ? "text-[#1A2F21]" : "text-foreground"
                    )}>
                      {preset.name}
                    </p>
                  </div>
                  {selectedTheme === preset.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#1A2F21] flex items-center justify-center z-10 shadow-sm">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Accent Color */}
          <section>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <Palette className="h-5 w-5 text-primary" />
                <h3 className="text-base font-body font-bold text-foreground">Cor de destaque</h3>
              </div>
              <p className="text-sm text-muted-foreground font-body">Botões, links e elementos ativos</p>
            </div>
            <div className="flex flex-wrap gap-[10px]">
              {ACCENT_COLORS.map(accent => (
                <button
                  key={accent.key}
                  onClick={() => handleAccentSelect(accent.value)}
                  title={accent.label}
                  className={cn(
                    "w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center relative",
                    selectedAccent === accent.value
                      ? "border-[#1A2F21] scale-105 shadow-md"
                      : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: accent.value }}
                >
                  {selectedAccent === accent.value && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="h-5 w-5 text-white drop-shadow-sm" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Sidebar Color */}
          <section>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <PanelLeft className="h-5 w-5 text-primary" />
                <h3 className="text-base font-body font-bold text-foreground">Cor da sidebar</h3>
              </div>
              <p className="text-sm text-muted-foreground font-body">Personalize o fundo da barra lateral</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {SIDEBAR_COLORS.map(c => (
                <button
                  key={c.value || "default"}
                  onClick={() => handleSidebarSelect(c.value)}
                  title={c.label}
                  className={cn(
                    "w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center relative",
                    sidebarColor === c.value
                      ? "border-[#1A2F21] scale-105 shadow-md"
                      : "border-border hover:border-[#1A2F21]/30"
                  )}
                  style={{ backgroundColor: c.value || (previewTheme?.vars.sidebar || '#F2EDE6') }}
                >
                  {sidebarColor === c.value && (
                    <Check className="h-4 w-4" style={{ color: c.value && parseInt(c.value.slice(1), 16) < 0x808080 ? '#fff' : '#1C1C1A' }} />
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Typography */}
          <section>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <Type className="h-5 w-5 text-primary" />
                <h3 className="text-base font-body font-bold text-foreground">Tipografia</h3>
              </div>
              <p className="text-sm text-muted-foreground font-body">Estilo tipográfico de todo o sistema</p>
            </div>
            <div className="flex flex-col gap-3">
              {FONT_OPTIONS.map(font => (
                <button
                  key={font.key}
                  onClick={() => handleFontSelect(font.key)}
                  className={cn(
                    "w-full rounded-xl border-2 p-5 text-left transition-all relative flex flex-col gap-1",
                    selectedFont === font.key
                      ? "border-[#1A2F21] bg-[#1A2F21]/5"
                      : "border-border hover:border-[#1A2F21]/30"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xl font-bold text-foreground leading-tight" style={{ fontFamily: font.displayFont }}>
                      {font.label}
                    </p>
                    {selectedFont === font.key && (
                      <div className="w-6 h-6 rounded-full bg-[#1A2F21] flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground" style={{ fontFamily: font.bodyFont }}>{font.desc}</p>
                </button>
              ))}
            </div>
          </section>

          <Button 
            onClick={handleSave} 
            disabled={saving} 
            className="w-full h-[52px] bg-[#1A2F21] hover:bg-[#1A2F21]/90 text-white rounded-xl font-semibold text-lg transition-all"
          >
            {saving ? "Salvando..." : "Salvar visual"}
          </Button>
        </div>

        {/* RIGHT — Live Preview */}
        <div className="hidden lg:block flex-1 sticky top-6 self-start">
          <div className="mb-6">
            <h3 className="text-xl font-body font-bold text-foreground mb-1">Preview ao vivo</h3>
            <p className="text-sm text-muted-foreground font-body">Veja como ficará o seu espaço</p>
          </div>

          {previewTheme && (
            <div className="flex flex-col gap-6">
              <div className="rounded-2xl overflow-hidden border border-border shadow-2xl flex flex-col" style={{ backgroundColor: previewTheme.vars.background, height: '420px' }}>
                <div className="flex flex-1 min-h-0">
                  {/* Sidebar */}
                  <div className="w-20 h-full flex flex-col items-center py-6 gap-6 shrink-0 border-r" style={{ backgroundColor: previewSidebar, borderColor: previewTheme.vars.border }}>
                    <div className="w-10 h-10 rounded-2xl shadow-sm flex items-center justify-center" style={{ backgroundColor: selectedAccent }}>
                      <div className="w-5 h-5 rounded-full bg-white/20" />
                    </div>
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="w-6 h-6 rounded-lg" style={{ backgroundColor: i === 1 ? selectedAccent : previewTheme.vars.muted, opacity: i === 1 ? 1 : 0.4 }} />
                    ))}
                  </div>
                  {/* Main content */}
                  <div className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="h-6 w-40 rounded-full" style={{ backgroundColor: previewTheme.vars.foreground, opacity: 0.15 }} />
                      <div className="flex gap-2">
                        <div className="h-8 w-8 rounded-full" style={{ backgroundColor: previewTheme.vars.muted }} />
                        <div className="h-8 w-8 rounded-full" style={{ backgroundColor: previewTheme.vars.muted }} />
                      </div>
                    </div>
                    
                    {/* Stats cards */}
                    <div className="grid grid-cols-3 gap-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="rounded-2xl p-4 shadow-sm border" style={{ backgroundColor: previewTheme.vars.card, borderColor: previewTheme.vars.border }}>
                          <div className="h-2 w-12 rounded-full mb-3" style={{ backgroundColor: previewTheme.vars.muted }} />
                          <div className="h-5 w-8 rounded-lg" style={{ backgroundColor: i === 1 ? selectedAccent : previewTheme.vars.muted, opacity: i === 1 ? 1 : 0.4 }} />
                        </div>
                      ))}
                    </div>

                    {/* Content area - List of posts */}
                    <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                      {[1, 2].map(i => (
                        <div key={i} className="rounded-xl p-4 border" style={{ backgroundColor: previewTheme.vars.card, borderColor: previewTheme.vars.border }}>
                          <div className="flex gap-3 items-center mb-2">
                            <div className="h-8 w-8 rounded-full" style={{ backgroundColor: previewTheme.vars.muted }} />
                            <div className="flex-1 flex flex-col gap-1">
                              <div className="h-2 w-24 rounded-full" style={{ backgroundColor: previewTheme.vars.foreground, opacity: 0.2 }} />
                              <div className="h-1.5 w-16 rounded-full" style={{ backgroundColor: previewTheme.vars.muted }} />
                            </div>
                          </div>
                          <div className="h-2 w-full rounded-full" style={{ backgroundColor: previewTheme.vars.muted, opacity: 0.5 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Bottom bar */}
                <div className="h-14 flex items-center justify-around px-8 border-t" style={{ backgroundColor: previewTheme.vars.card, borderColor: previewTheme.vars.border }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="w-6 h-6 rounded-lg" style={{ backgroundColor: i === 1 ? selectedAccent : previewTheme.vars.muted, opacity: i === 1 ? 1 : 0.4 }} />
                  ))}
                </div>
              </div>

              {/* Status Pill */}
              <div className="self-center flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border text-xs font-medium text-muted-foreground shadow-sm">
                <span>Fonte: <span className="text-foreground">{previewFont?.desc}</span></span>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span>Tema: <span className="text-foreground">{previewTheme.name}</span></span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile Preview (Visible only on small screens) */}
      <div className="mt-12 lg:hidden">
        <div className="mb-6">
          <h3 className="text-xl font-body font-bold text-foreground mb-1">Preview ao vivo</h3>
          <p className="text-sm text-muted-foreground font-body">Veja como ficará o seu espaço</p>
        </div>
        {previewTheme && (
           <div className="flex flex-col gap-6">
           <div className="rounded-2xl overflow-hidden border border-border shadow-2xl flex flex-col" style={{ backgroundColor: previewTheme.vars.background, height: '420px' }}>
             <div className="flex flex-1 min-h-0">
               <div className="w-16 h-full flex flex-col items-center py-6 gap-6 shrink-0 border-r" style={{ backgroundColor: previewSidebar, borderColor: previewTheme.vars.border }}>
                 <div className="w-8 h-8 rounded-xl shadow-sm flex items-center justify-center" style={{ backgroundColor: selectedAccent }}>
                   <div className="w-4 h-4 rounded-full bg-white/20" />
                 </div>
                 {[1, 2, 3, 4].map(i => (
                   <div key={i} className="w-5 h-5 rounded-lg" style={{ backgroundColor: i === 1 ? selectedAccent : previewTheme.vars.muted, opacity: i === 1 ? 1 : 0.4 }} />
                 ))}
               </div>
               <div className="flex-1 p-4 flex flex-col gap-4 overflow-hidden">
                 <div className="h-4 w-32 rounded-full" style={{ backgroundColor: previewTheme.vars.foreground, opacity: 0.15 }} />
                 <div className="grid grid-cols-3 gap-2">
                   {[1, 2, 3].map(i => (
                     <div key={i} className="rounded-xl p-2 shadow-sm border" style={{ backgroundColor: previewTheme.vars.card, borderColor: previewTheme.vars.border }}>
                       <div className="h-4 w-6 rounded-lg" style={{ backgroundColor: i === 1 ? selectedAccent : previewTheme.vars.muted, opacity: i === 1 ? 1 : 0.4 }} />
                     </div>
                   ))}
                 </div>
                 <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                   {[1, 2, 3].map(i => (
                     <div key={i} className="rounded-lg p-3 border" style={{ backgroundColor: previewTheme.vars.card, borderColor: previewTheme.vars.border }}>
                       <div className="h-2 w-full rounded-full" style={{ backgroundColor: previewTheme.vars.muted, opacity: 0.5 }} />
                     </div>
                   ))}
                 </div>
               </div>
             </div>
             <div className="h-12 flex items-center justify-around px-6 border-t" style={{ backgroundColor: previewTheme.vars.card, borderColor: previewTheme.vars.border }}>
               {[1, 2, 3, 4, 5].map(i => (
                 <div key={i} className="w-5 h-5 rounded-lg" style={{ backgroundColor: i === 1 ? selectedAccent : previewTheme.vars.muted, opacity: i === 1 ? 1 : 0.4 }} />
               ))}
             </div>
           </div>
           <div className="self-center flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border text-xs font-medium text-muted-foreground shadow-sm">
             <span>Fonte: <span className="text-foreground">{previewFont?.desc}</span></span>
             <span className="w-1 h-1 rounded-full bg-border" />
             <span>Tema: <span className="text-foreground">{previewTheme.name}</span></span>
           </div>
         </div>
        )}
      </div>
    </div>
  );
}
