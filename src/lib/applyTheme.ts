import { THEME_PRESETS } from './themes';

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

export function applyAccent(hex: string) {
  const hsl = hexToHsl(hex);
  const root = document.documentElement;
  root.style.setProperty('--primary', hsl);
  root.style.setProperty('--ring', hsl);
  root.style.setProperty('--sidebar-primary', hsl);
  root.style.setProperty('--sidebar-ring', hsl);

  // Primary foreground: white for dark accents, near-white for all
  root.style.setProperty('--primary-foreground', '40 33% 97%');
  root.style.setProperty('--sidebar-primary-foreground', '40 33% 97%');
}
