import { THEME_PRESETS } from './themes';

export function hexToHsl(hex: string): string {
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

function rgbaToHslAlpha(rgba: string): string {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
  if (!match) return '0 0% 50% / 0.08';
  const r = parseInt(match[1]) / 255;
  const g = parseInt(match[2]) / 255;
  const b = parseInt(match[3]) / 255;
  const a = match[4] ? parseFloat(match[4]) : 1;
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
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}% / ${a}`;
}

export function applyTheme(presetId: string, accent: string) {
  const preset = THEME_PRESETS.find(t => t.id === presetId);
  if (!preset) return;
  const root = document.documentElement;

  // Apply dark/light mode
  root.classList.remove('light', 'dark');
  root.classList.add(preset.mode);

  // Convert and apply HSL CSS variables
  const v = preset.vars;
  root.style.setProperty('--background', hexToHsl(v.background));
  root.style.setProperty('--card', hexToHsl(v.card));
  root.style.setProperty('--card-foreground', hexToHsl(v.foreground));
  root.style.setProperty('--foreground', hexToHsl(v.foreground));
  root.style.setProperty('--popover', hexToHsl(v.background));
  root.style.setProperty('--popover-foreground', hexToHsl(v.foreground));
  root.style.setProperty('--muted', hexToHsl(v.muted));
  root.style.setProperty('--accent', hexToHsl(v.card));
  root.style.setProperty('--accent-foreground', hexToHsl(v.foreground));

  // Muted foreground: derive a mid-tone from foreground
  const fgHsl = hexToHsl(v.foreground);
  const parts = fgHsl.split(' ');
  root.style.setProperty('--muted-foreground', `${parts[0]} ${parseInt(parts[1]) > 10 ? '10%' : parts[1]} ${preset.mode === 'dark' ? '60%' : '40%'}`);

  // Border and input use rgba
  const borderHsl = rgbaToHslAlpha(v.border);
  root.style.setProperty('--border', borderHsl);
  root.style.setProperty('--input', borderHsl.replace(/[\d.]+$/, (m) => String(parseFloat(m) * 1.5)));

  // Sidebar
  root.style.setProperty('--sidebar-background', hexToHsl(v.sidebar));
  root.style.setProperty('--sidebar-foreground', hexToHsl(v.foreground));
  root.style.setProperty('--sidebar-accent', hexToHsl(v.muted));
  root.style.setProperty('--sidebar-accent-foreground', hexToHsl(v.foreground));
  root.style.setProperty('--sidebar-border', borderHsl);

  // Apply accent color
  applyAccent(accent);
}

/* COR DE TEMA CLARA DEMAIS (designer, 05/11/2026: "o botão de confirmar fica
   azul clarinho e pode dar a impressão de desabilitado"). O botão principal
   usa a cor do tema com texto quase branco. Com um azul como #A7C7EC o
   contraste é 1,6:1 e o botão parece apagado. Regra: se o texto claro não
   chega a 3:1 na cor escolhida, escurece O MESMO TOM até 4,5:1 (no modo
   claro). No modo escuro, em vez de escurecer, o texto do botão vira escuro.
   Cores que já passam (laranja do Cria, rosa, azul padrão) não mudam. */
const TEXTO_CLARO = '#F9F7F3';
const TEXTO_ESCURO = '#1D1B18';

function contraste(a: string, b: string): number {
  const la = luminancia(a), lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function hslParaHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** A cor do tema pronta pra levar texto claro por cima (mesmo matiz, mais escura se precisar). */
export function corLegivelDoTema(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex) || contraste(hex, TEXTO_CLARO) >= 3) return hex;
  const [h, s, l] = hexToHsl(hex).split(' ').map((x) => parseFloat(x));
  for (let luz = l / 100; luz > 0.05; luz -= 0.01) {
    const c = hslParaHex(h, s / 100, luz);
    if (contraste(c, TEXTO_CLARO) >= 4.5) return c;
  }
  return hex;
}

export function applyAccent(hex: string) {
  const root = document.documentElement;
  const escuro = root.classList.contains('dark');
  const valido = /^#[0-9a-fA-F]{6}$/.test(hex);
  const fraco = valido && contraste(hex, TEXTO_CLARO) < 3;
  const cor = fraco && !escuro ? corLegivelDoTema(hex) : hex;
  const hsl = hexToHsl(cor);
  root.style.setProperty('--primary', hsl);
  root.style.setProperty('--ring', hsl);
  root.style.setProperty('--sidebar-primary', hsl);
  root.style.setProperty('--sidebar-ring', hsl);

  // Texto em cima da cor do tema: claro, menos no modo escuro com cor clara.
  const texto = fraco && escuro ? hexToHsl(TEXTO_ESCURO) : '40 33% 97%';
  root.style.setProperty('--primary-foreground', texto);
  root.style.setProperty('--sidebar-primary-foreground', texto);
}

/* FAIXA DO TOPO (Walter, 19/10/2026). A faixa colorida do alto das telas seguia
   sozinha o destaque. Agora pode ter cor própria: null = segue o destaque (o
   HeroBand cai no gradiente de sempre). Faixa clara troca o texto pra escuro. */
function clamp01(n: number) { return Math.min(1, Math.max(0, n)); }

function misturar(hex: string, alvo: number, t: number): string {
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  const c = [n(1), n(3), n(5)].map((v) => Math.round(v + (alvo - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Luminância relativa (0 a 1) de um #rrggbb. */
export function luminancia(hex: string): number {
  const ch = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Gradiente da faixa a partir de uma cor: um pouco mais escura até um pouco mais clara. */
export function gradienteDaFaixa(hex: string): string {
  return `linear-gradient(115deg, ${misturar(hex, 0, 0.18)} 0%, ${misturar(hex, 255, 0.22)} 100%)`;
}

export function faixaEhClara(hex: string): boolean {
  return clamp01(luminancia(hex)) > 0.55;
}

export function applyHero(hex: string | null | undefined) {
  const root = document.documentElement;
  const ok = !!hex && /^#[0-9a-fA-F]{6}$/.test(hex);
  if (!ok) {
    root.style.removeProperty("--hero-bg");
    root.removeAttribute("data-hero-claro");
    return;
  }
  root.style.setProperty("--hero-bg", gradienteDaFaixa(hex as string));
  if (faixaEhClara(hex as string)) root.setAttribute("data-hero-claro", "1");
  else root.removeAttribute("data-hero-claro");
}
