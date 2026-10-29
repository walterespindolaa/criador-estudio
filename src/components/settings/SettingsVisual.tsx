import { useState, useEffect, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProfile } from "@/hooks/useProfile";
import { THEME_PRESETS, ACCENT_GROUPS, type ThemePreset } from "@/lib/themes";
import { BG_STYLES } from "@/components/BgShapes";
import { applyTheme, applyAccent, applyHero, gradienteDaFaixa, faixaEhClara, luminancia } from "@/lib/applyTheme";
import { applySidebarColor } from "@/lib/sidebarTheme";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { carregarFontes, carregarFontesDoTema, TODAS_AS_FONTES_EXTRAS } from "@/lib/fontesSobDemanda";

const FONT_OPTIONS = [
  { key: "cria", label: "CRIA", desc: "Baloo 2 + Roboto", preview: "A cara da marca", displayFont: "'Baloo 2', sans-serif", bodyFont: "'Roboto', sans-serif" },
  { key: "moderno", label: "Moderno", desc: "Plus Jakarta Sans + Nunito Sans", preview: "Limpo e contemporâneo", displayFont: "'Plus Jakarta Sans', sans-serif", bodyFont: "'Nunito Sans', sans-serif" },
  { key: "elegante", label: "Elegante", desc: "DM Serif Display + DM Sans", preview: "Editorial sofisticado", displayFont: "'DM Serif Display', serif", bodyFont: "'DM Sans', sans-serif" },
  { key: "criativo", label: "Criativo", desc: "Space Grotesk + Outfit", preview: "Atitude criadora", displayFont: "'Space Grotesk', sans-serif", bodyFont: "'Outfit', sans-serif" },
  { key: "suave", label: "Suave", desc: "Quicksand + Nunito", preview: "Calmo e arredondado", displayFont: "'Quicksand', sans-serif", bodyFont: "'Nunito', sans-serif" },
  { key: "bold", label: "Bold", desc: "Sora + Inter", preview: "Geométrico e impactante", displayFont: "'Sora', sans-serif", bodyFont: "'Inter', sans-serif" },
];

const SIDEBAR_COLORS = [
  { label: "Padrão", value: "" },
  { label: "Liquid Glass", value: "glass" },
  { label: "Creme CRIA", value: "#F5F3E7" },
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
  carregarFontesDoTema(fontKey);
  const fonts: Record<string, { display: string; body: string }> = {
    cria: { display: "'Baloo 2', sans-serif", body: "'Roboto', sans-serif" },
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

/** Tema que a tela edita. Sem props: o da sessão (como sempre). No Meu perfil
 *  a Configurações passa o perfil ativo e o gravador dele (Walter, 19/10/2026:
 *  a cor do Meu Cria não tinha onde mudar). */
type TemaDoPerfil = {
  theme_preset?: string | null; theme_accent?: string | null; theme_sidebar?: string | null;
  theme_font?: string | null; theme_bg?: string | null; theme_hero?: string | null;
};

/** Faixa do topo (Walter, 19/10/2026): null = segue a cor de destaque. */
const HERO_OPCOES = [
  { label: "Marinho", value: "#1F2A44" },
  { label: "Oliva", value: "#4E6B48" },
  { label: "Ameixa", value: "#7A4467" },
  { label: "Grafite", value: "#35302B" },
  { label: "Mostarda", value: "#B07D22" },
  { label: "Areia clara", value: "#EDE3D6" },
];

const ACCENT_TODAS = ACCENT_GROUPS.flatMap((g) => g.colors);
// Vibrantes primeiro: são os que mais escolhem; os pastéis abrem no "Mais cores".
const ACCENT_PRIMEIRAS = [
  ...(ACCENT_GROUPS.find((g) => g.group === "Vibrantes")?.colors ?? []),
  ...ACCENT_TODAS,
].filter((c, i, arr) => arr.findIndex((x) => x.value.toLowerCase() === c.value.toLowerCase()) === i).slice(0, 8);

function Cartao({ titulo, desc, children }: { titulo: string; desc?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-body font-bold text-foreground">{titulo}</h3>
      {desc && <p className="mt-0.5 mb-3 text-xs font-body text-muted-foreground">{desc}</p>}
      {!desc && <div className="mb-3" />}
      {children}
    </section>
  );
}

export function SettingsVisual({ perfil, gravar, embutido = false }: {
  perfil?: TemaDoPerfil | null;
  gravar?: (patch: Record<string, string | null>) => Promise<unknown>;
  /** Dentro de um painel estreito (drawer da agência): uma coluna e salvar no rodapé do painel. */
  embutido?: boolean;
} = {}) {
  // As prévias dos temas mostram as fontes de todos eles.
  useEffect(() => { carregarFontes(TODAS_AS_FONTES_EXTRAS); }, []);
  const sessao = useProfile();
  const profile = (perfil !== undefined ? perfil : sessao.profile) as TemaDoPerfil | null | undefined;

  const salvo = {
    tema: profile?.theme_preset || "cria",
    accent: profile?.theme_accent || "#EA4918",
    barra: profile?.theme_sidebar || "",
    fonte: profile?.theme_font || "moderno",
    fundo: profile?.theme_bg || "nenhum",
    hero: profile?.theme_hero || null,
  };

  const [selectedTheme, setSelectedTheme] = useState(salvo.tema);
  const [selectedAccent, setSelectedAccent] = useState(salvo.accent);
  const [sidebarColor, setSidebarColor] = useState(salvo.barra);
  const [selectedFont, setSelectedFont] = useState(salvo.fonte);
  const [selectedBg, setSelectedBg] = useState<string>(salvo.fundo);
  const [hero, setHero] = useState<string | null>(salvo.hero);
  const [saving, setSaving] = useState(false);
  const [todosTemas, setTodosTemas] = useState(false);
  const [todasCores, setTodasCores] = useState(false);
  const [todasFontes, setTodasFontes] = useState(false);
  const [previaAberta, setPreviaAberta] = useState(false);
  // Depois de salvar, o "salvo" passa a ser o que está na tela até o perfil voltar do servidor.
  const [salvoLocal, setSalvoLocal] = useState<typeof salvo | null>(null);

  useEffect(() => {
    if (profile) {
      setSelectedTheme(profile.theme_preset || "cria");
      setSelectedAccent(profile.theme_accent || "#EA4918");
      setSidebarColor(profile.theme_sidebar || "");
      setSelectedFont(profile.theme_font || "moderno");
      setSelectedBg(profile.theme_bg || "nenhum");
      setHero(profile.theme_hero || null);
      setSalvoLocal(null);
    }
  }, [profile]);

  const base = salvoLocal ?? salvo;
  const mudou =
    base.tema !== selectedTheme || base.accent.toLowerCase() !== selectedAccent.toLowerCase() ||
    base.barra !== sidebarColor || base.fonte !== selectedFont || base.fundo !== selectedBg ||
    (base.hero ?? "").toLowerCase() !== (hero ?? "").toLowerCase();

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

  const handleHero = (hex: string | null) => {
    setHero(hex);
    applyHero(hex);
  };

  const handleSave = async () => {
    setSaving(true);
    const preset = THEME_PRESETS.find(t => t.id === selectedTheme);
    const patch = {
      theme_preset: selectedTheme,
      theme_accent: selectedAccent,
      theme_mode: preset?.mode || "light",
      theme_sidebar: sidebarColor || null,
      theme_font: selectedFont,
      theme_bg: selectedBg === "nenhum" ? null : selectedBg,
      theme_hero: hero,
    };
    try {
      if (gravar) await gravar(patch);
      else await sessao.updateProfile.mutateAsync(patch as never);
      setSalvoLocal({ tema: selectedTheme, accent: selectedAccent, barra: sidebarColor, fonte: selectedFont, fundo: selectedBg, hero });
      try {
        if (hero) localStorage.setItem("theme_hero", hero); else localStorage.removeItem("theme_hero");
      } catch { /* storage bloqueado */ }
      toast.success("Visual salvo!");
    } catch {
      toast.error("Não consegui salvar o visual. Tenta de novo.");
    } finally {
      setSaving(false);
    }
  };

  const previewTheme = THEME_PRESETS.find(t => t.id === selectedTheme);
  const previewFont = FONT_OPTIONS.find(f => f.key === selectedFont);
  const previewBgLabel = BG_STYLES.find((b) => b.key === selectedBg)?.label ?? "Nenhum";
  const previewSidebar = sidebarColor && sidebarColor !== "glass" ? sidebarColor : previewTheme?.vars.sidebar || "#F2EDE6";
  const faixaPreview = hero ? gradienteDaFaixa(hero) : `linear-gradient(120deg, ${selectedAccent}, ${selectedAccent}cc)`;
  const faixaClara = !!hero && faixaEhClara(hero);

  const claros = THEME_PRESETS.filter((p) => p.mode === "light");
  const escuros = THEME_PRESETS.filter((p) => p.mode === "dark");

  const cartaoTema = (preset: ThemePreset, idx: number) => {
    const on = selectedTheme === preset.id;
    return (
      <button
        key={preset.id}
        type="button"
        onClick={() => handleThemeSelect(preset.id)}
        aria-pressed={on}
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-xl border bg-background p-2 text-left transition-all",
          on ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-foreground/30",
          !todosTemas && idx >= 4 && "hidden sm:flex",
        )}
      >
        <span className="flex shrink-0 overflow-hidden rounded-md border border-black/5">
          <span className="block h-6 w-3" style={{ backgroundColor: preset.vars.background }} />
          <span className="block h-6 w-3" style={{ backgroundColor: preset.vars.sidebar === preset.vars.background ? preset.vars.muted : preset.vars.sidebar }} />
          <span className="block h-6 w-3" style={{ backgroundColor: selectedAccent }} />
        </span>
        <span className="min-w-0 flex-1 text-xs font-body font-bold leading-tight text-foreground">{preset.name}</span>
        {on && <Check className="h-3.5 w-3.5 shrink-0 text-foreground" />}
      </button>
    );
  };

  const previa = previewTheme && (
    <div className="overflow-hidden rounded-2xl border border-border" style={{ backgroundColor: previewTheme.vars.background }}>
      <div className="relative flex h-14 items-center gap-2 px-3" style={{ background: faixaPreview }}>
        <div className={cn("h-7 w-7 rounded-full", faixaClara ? "bg-black/15" : "bg-white/40")} />
        <div className={cn("h-1.5 w-16 rounded-full", faixaClara ? "bg-black/40" : "bg-white/85")} />
      </div>
      <div className="flex gap-2.5 p-3">
        <div className="flex flex-col items-center gap-2 rounded-xl border px-1.5 py-2"
          style={sidebarColor === "glass"
            ? { background: "hsl(var(--card) / 0.6)", borderColor: previewTheme.vars.border }
            : { backgroundColor: previewSidebar, borderColor: previewTheme.vars.border }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-3 w-3 rounded-full" style={{ backgroundColor: i === 0 ? selectedAccent : previewTheme.vars.muted }} />
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-8 rounded-lg border" style={{ backgroundColor: previewTheme.vars.card, borderColor: previewTheme.vars.border }} />
          ))}
          <div className="h-6 w-20 rounded-full" style={{ backgroundColor: selectedAccent }} />
        </div>
      </div>
    </div>
  );

  const chipsPrevia = (
    <div className="flex flex-wrap gap-1.5">
      {[previewTheme?.name, previewBgLabel, previewFont?.label].filter(Boolean).map((t) => (
        <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-body font-bold text-foreground">{t}</span>
      ))}
    </div>
  );

  const fontesVisiveis = todasFontes ? FONT_OPTIONS : FONT_OPTIONS.slice(0, 3);
  const coresVisiveis = todasCores ? ACCENT_TODAS : ACCENT_PRIMEIRAS;

  return (
    <div className={cn("w-full", !embutido && "lg:pb-0")}>
      {/* Celular: faixa pequena da prévia, abre a prévia inteira ao tocar */}
      <button type="button" onClick={() => setPreviaAberta(true)}
        className={cn("mb-3 flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-2.5 text-left", !embutido && "lg:hidden")}>
        <span className="h-8 w-16 shrink-0 rounded-lg" style={{ background: faixaPreview }} />
        <span className="min-w-0 flex-1 truncate text-xs font-body text-muted-foreground">
          {[previewTheme?.name, previewBgLabel, previewFont?.label].filter(Boolean).join(" · ")}
        </span>
        <span className="text-xs font-body font-bold text-primary">Ver prévia</span>
      </button>

      <div className={cn("grid grid-cols-1 items-start gap-5", !embutido && "lg:grid-cols-[minmax(0,1fr)_300px]")}>
        <div className="min-w-0 space-y-3">
          <Cartao titulo="Tema" desc="A paleta de cores do sistema.">
            <p className="mb-2 text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground">Claros</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {claros.map((p, i) => cartaoTema(p, i))}
            </div>
            {escuros.length > 0 && (
              <div className={cn(!todosTemas && "hidden sm:block")}>
                <p className="mb-2 mt-3 text-[10px] font-body font-bold uppercase tracking-wider text-muted-foreground">Escuros</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {escuros.map((p) => cartaoTema(p, 0))}
                </div>
              </div>
            )}
            {!todosTemas && THEME_PRESETS.length > 4 && (
              <button type="button" onClick={() => setTodosTemas(true)} className="mt-3 text-xs font-body font-bold text-primary sm:hidden">
                Ver todos os {THEME_PRESETS.length} temas
              </button>
            )}
          </Cartao>

          <Cartao titulo="Cor de destaque" desc="Botões, links e o que está ativo.">
            <div className="flex flex-wrap gap-2.5">
              {coresVisiveis.map((accent) => {
                const on = selectedAccent.toLowerCase() === accent.value.toLowerCase();
                return (
                  <button key={accent.key} type="button" onClick={() => handleAccentSelect(accent.value)} title={accent.label} aria-label={accent.label}
                    className={cn("flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-transform active:scale-90",
                      on ? "ring-2 ring-foreground" : "ring-1 ring-border")}
                    style={{ backgroundColor: accent.value }}>
                    {on && <Check className="h-4 w-4 text-white drop-shadow-sm" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {!todasCores && (
                <button type="button" onClick={() => setTodasCores(true)} className="text-xs font-body font-bold text-primary">Mais cores</button>
              )}
              <label className="flex items-center gap-2 text-xs font-body text-muted-foreground">
                Tom personalizado
                <input type="color" value={selectedAccent} onChange={(e) => handleAccentSelect(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded-lg border border-border bg-transparent p-0.5" />
              </label>
            </div>
          </Cartao>

          <Cartao titulo="Faixa do topo" desc="A faixa colorida no alto de cada tela.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button type="button" onClick={() => handleHero(null)} aria-pressed={!hero}
                className={cn("grid gap-1.5 rounded-xl border bg-background p-1.5 text-left",
                  !hero ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-foreground/30")}>
                <span className="block h-7 rounded-lg" style={{ background: `linear-gradient(115deg, ${selectedAccent}, ${selectedAccent}cc)` }} />
                <span className="px-0.5 text-[11.5px] font-body font-bold text-foreground">Igual ao destaque</span>
              </button>
              {HERO_OPCOES.map((o) => {
                const on = (hero ?? "").toLowerCase() === o.value.toLowerCase();
                return (
                  <button key={o.value} type="button" onClick={() => handleHero(o.value)} aria-pressed={on}
                    className={cn("grid gap-1.5 rounded-xl border bg-background p-1.5 text-left",
                      on ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-foreground/30")}>
                    <span className="block h-7 rounded-lg border border-black/5" style={{ background: gradienteDaFaixa(o.value) }} />
                    <span className="px-0.5 text-[11.5px] font-body font-bold text-foreground">{o.label}</span>
                  </button>
                );
              })}
              {(() => {
                const propria = !!hero && !HERO_OPCOES.some((o) => o.value.toLowerCase() === hero.toLowerCase());
                return (
                  <label className={cn("relative grid cursor-pointer gap-1.5 rounded-xl border bg-background p-1.5",
                    propria ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-foreground/30")}>
                    <span className="block h-7 rounded-lg"
                      style={{ background: propria && hero ? gradienteDaFaixa(hero) : "conic-gradient(#E0622E,#D9468A,#4D6BEA,#3FAE5A,#E39A1F,#E0622E)" }} />
                    <span className="px-0.5 text-[11.5px] font-body font-bold text-foreground">Escolher cor</span>
                    <input type="color" value={hero ?? "#1F2A44"} onChange={(e) => handleHero(e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Escolher cor da faixa" />
                  </label>
                );
              })()}
            </div>
          </Cartao>

          <Cartao titulo="Fundo" desc="Formas decorativas atrás do conteúdo.">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:grid-cols-4">
              {BG_STYLES.map((bg) => (
                <button key={bg.key} type="button" onClick={() => setSelectedBg(bg.key)} title={bg.desc}
                  className={cn("rounded-lg px-2 py-2 text-xs font-body font-bold transition-colors",
                    selectedBg === bg.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {bg.label.replace(" CRIA", "")}
                </button>
              ))}
            </div>
          </Cartao>

          <Cartao titulo="Fonte" desc="Títulos e textos.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {fontesVisiveis.map((font) => {
                const on = selectedFont === font.key;
                return (
                  <button key={font.key} type="button" onClick={() => handleFontSelect(font.key)} aria-pressed={on}
                    className={cn("rounded-xl border bg-background p-2.5 text-left transition-all",
                      on ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-foreground/30")}>
                    <span className="block text-base font-bold leading-tight text-foreground" style={{ fontFamily: font.displayFont }}>{font.label}</span>
                    <span className="block text-[11px] text-muted-foreground" style={{ fontFamily: font.bodyFont }}>{font.desc}</span>
                  </button>
                );
              })}
            </div>
            {!todasFontes && (
              <button type="button" onClick={() => setTodasFontes(true)} className="mt-3 text-xs font-body font-bold text-primary">
                Ver as {FONT_OPTIONS.length} fontes
              </button>
            )}
          </Cartao>

          <Cartao titulo="Barra lateral" desc="Cor do menu da esquerda.">
            <div className="flex flex-wrap gap-2.5">
              {SIDEBAR_COLORS.map((c) => {
                const on = sidebarColor === c.value;
                return (
                  <button key={c.value || "padrao"} type="button" onClick={() => handleSidebarSelect(c.value)} title={c.label} aria-label={c.label}
                    className={cn("flex h-9 w-9 items-center justify-center rounded-full border transition-all",
                      on ? "border-foreground ring-2 ring-foreground ring-offset-2 ring-offset-card" : "border-border")}
                    style={c.value === "glass"
                      ? { background: "linear-gradient(135deg, rgba(255,255,255,.9), rgba(200,200,220,.35))" }
                      : { backgroundColor: c.value || (previewTheme?.vars.sidebar || "#F2EDE6") }}>
                    {on && <Check className="h-4 w-4" style={{ color: c.value && c.value !== "glass" && luminancia(c.value) < 0.3 ? "#fff" : "#1C1C1A" }} />}
                  </button>
                );
              })}
            </div>
          </Cartao>
        </div>

        {/* Computador: prévia pequena grudada na tela, com o salvar */}
        <aside className={cn("sticky top-24 hidden self-start rounded-2xl border border-border bg-card p-3", !embutido && "lg:block")}>
          <p className="mb-2.5 text-sm font-body font-bold text-foreground">Prévia</p>
          {previa}
          <div className="mt-3">{chipsPrevia}</div>
          <Button onClick={handleSave} disabled={saving}
            className="mt-3 h-11 w-full rounded-xl bg-foreground font-semibold text-background hover:bg-foreground/90">
            {saving ? "Salvando..." : "Salvar visual"}
          </Button>
          {mudou && <p className="mt-2 text-center text-[11.5px] font-body text-muted-foreground">Você tem mudanças não salvas</p>}
        </aside>
      </div>

      {/* Celular: salvar grudado embaixo, acima do dock (sticky: funciona na página e no painel) */}
      <div className={cn("sticky z-30 -mx-1 mt-4 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur", !embutido && "lg:hidden")}
        style={{ bottom: embutido ? "8px" : "calc(88px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <span className="flex-1 text-xs font-body text-muted-foreground">{mudou ? "Mudanças não salvas" : "Tudo salvo"}</span>
          <Button onClick={handleSave} disabled={saving}
            className="h-10 rounded-xl bg-foreground px-5 font-semibold text-background hover:bg-foreground/90">
            {saving ? "Salvando..." : "Salvar visual"}
          </Button>
        </div>
      </div>

      <Dialog open={previaAberta} onOpenChange={setPreviaAberta}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Prévia</DialogTitle></DialogHeader>
          {previa}
          <div className="mt-1">{chipsPrevia}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
