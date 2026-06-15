export type RampStep = { from: string; to: string; ink: string; sub: string; line: string };

const ORDER = ["ideia", "roteiro", "gravando", "editando", "agendado", "publicado"] as const;
const STEPS = [
  { s: 42, l: 86 }, { s: 52, l: 74 }, { s: 60, l: 63 },
  { s: 66, l: 53 }, { s: 70, l: 45 }, { s: 74, l: 38 },
];

function accentHue(): number {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
    const h = parseFloat(v.split(/\s+/)[0]);
    return Number.isFinite(h) ? h : 262;
  } catch { return 262; }
}

export function statusRamp(): Record<string, RampStep> {
  const h = accentHue();
  const map: Record<string, RampStep> = {};
  ORDER.forEach((key, i) => {
    const { s, l } = STEPS[i];
    const light = l >= 60;
    map[key] = {
      from: `hsl(${h} ${s}% ${l}%)`,
      to: `hsl(${h} ${s}% ${Math.max(l - 8, 12)}%)`,
      ink: light ? `hsl(${h} 60% 26%)` : "#ffffff",
      sub: light ? `hsl(${h} 45% 34%)` : "rgba(255,255,255,.85)",
      line: `hsl(${h} ${s}% ${Math.max(l - 6, 26)}%)`,
    };
  });
  return map;
}
