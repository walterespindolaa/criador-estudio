/**
 * Sidebar theme utilities: applies sidebar-specific CSS variables
 * and auto-calculates text contrast based on background luminance.
 */

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

/** Returns relative luminance 0..1 from hex */
function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Is this hex color considered "dark"? */
export function isDarkColor(hex: string): boolean {
  return luminance(hex) < 0.35;
}

/**
 * Apply sidebar color to CSS variables with auto-contrast.
 * Pass empty string or null to reset to theme defaults.
 */
export function applySidebarColor(hex: string | null | undefined) {
  const root = document.documentElement;

  root.removeAttribute("data-bar");
  if (hex === "glass") {
    root.setAttribute("data-bar", "glass");
    // limpa overrides sólidos pra não brigar com o CSS de vidro
    root.style.removeProperty('--sidebar-background');
    root.style.removeProperty('--sidebar-foreground');
    root.style.removeProperty('--sidebar-accent');
    root.style.removeProperty('--sidebar-accent-foreground');
    root.style.removeProperty('--sidebar-border');
    root.style.removeProperty('--sidebar-primary-foreground');
    return;
  }

  if (!hex) {
    // Reset — let the theme preset handle sidebar vars
    root.style.removeProperty('--sidebar-background');
    root.style.removeProperty('--sidebar-foreground');
    root.style.removeProperty('--sidebar-accent');
    root.style.removeProperty('--sidebar-accent-foreground');
    root.style.removeProperty('--sidebar-border');
    root.style.removeProperty('--sidebar-primary-foreground');
    return;
  }

  const bgHsl = hexToHsl(hex);
  const dark = isDarkColor(hex);

  root.style.setProperty('--sidebar-background', bgHsl);

  if (dark) {
    // Light text on dark background
    root.style.setProperty('--sidebar-foreground', '40 20% 92%');
    root.style.setProperty('--sidebar-accent', '40 10% 20%');
    root.style.setProperty('--sidebar-accent-foreground', '40 20% 92%');
    root.style.setProperty('--sidebar-border', '40 20% 92% / 0.1');
    root.style.setProperty('--sidebar-primary-foreground', '40 20% 95%');
  } else {
    // Dark text on light background
    root.style.setProperty('--sidebar-foreground', '30 10% 15%');
    root.style.setProperty('--sidebar-accent', '30 10% 80%');
    root.style.setProperty('--sidebar-accent-foreground', '30 10% 15%');
    root.style.setProperty('--sidebar-border', '30 10% 15% / 0.08');
    root.style.setProperty('--sidebar-primary-foreground', '40 33% 97%');
  }
}
