import { useState, useEffect } from "react";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/hooks/useProfile";
import { THEME_PRESETS, ACCENT_COLORS, type ThemePreset } from "@/lib/themes";
import { applyTheme, applyAccent } from "@/lib/applyTheme";
import { toast } from "sonner";

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
      {/* Mini preview */}
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

export function SettingsVisual() {
  const { profile, updateProfile } = useProfile();

  const [preset, setPreset] = useState(profile?.theme_preset || "clean-warm");
  const [accent, setAccent] = useState(profile?.theme_accent || "#C4622D");

  useEffect(() => {
    if (profile) {
      setPreset(profile.theme_preset || "clean-warm");
      setAccent(profile.theme_accent || "#C4622D");
    }
  }, [profile]);

  const handlePresetSelect = (id: string) => {
    setPreset(id);
    applyTheme(id, accent);
  };

  const handleAccentSelect = (hex: string) => {
    setAccent(hex);
    applyAccent(hex);
  };

  const handleSave = async () => {
    const selectedPreset = THEME_PRESETS.find(t => t.id === preset);
    await updateProfile({
      theme_preset: preset,
      theme_accent: accent,
      theme_mode: selectedPreset?.mode || "light",
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

      {/* Live preview */}
      <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-warm)] border border-border space-y-3">
        <h3 className="font-display font-semibold text-foreground">Preview ao vivo</h3>
        {selectedPreset && (
          <div className="rounded-xl overflow-hidden border border-border h-40 flex" style={{ backgroundColor: selectedPreset.vars.background }}>
            <div className="w-1/5 h-full flex flex-col gap-2 p-3" style={{ backgroundColor: selectedPreset.vars.sidebar }}>
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
