import { CRIA_HEX, type CriaColor } from "@/lib/moduleTheme";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════
// FORMAS ORGÂNICAS, as manchas coloridas da landing page, dentro do sistema.
//
// A LP faz isso com border-radius assimétrico (ex.: 38% 62% 55% 45% / 48% 42% 58% 52%),
// não com SVG. Mesma técnica aqui: leve, escala em qualquer tamanho, zero request.
//
// Uso: um pai com `relative overflow-hidden` e <OrganicBlobs color="azul" />.
// Fica atrás do conteúdo (-z-0), então o texto sempre lê por cima.
// ═══════════════════════════════════════════════════════════════════════

// Cada mancha: posição, tamanho, forma e opacidade. Formas diferentes = orgânico.
// Se todas fossem círculos, viraria "bolinha decorativa" e perderia a graça.
const BLOBS = [
  { top: "-30%", left: "-6%", size: "46%", radius: "38% 62% 55% 45% / 48% 42% 58% 52%", op: 0.16 },
  { top: "-45%", left: "22%", size: "58%", radius: "55% 45% 40% 60% / 50% 60% 40% 50%", op: 0.1 },
  { top: "-18%", right: "8%", size: "34%", radius: "60% 40% 55% 45% / 55% 60% 40% 45%", op: 0.14 },
  { bottom: "-55%", right: "-8%", size: "50%", radius: "45% 55% 62% 38% / 42% 55% 45% 58%", op: 0.09 },
] as const;

/** A cor principal do módulo + duas acompanhantes, pra não ficar monocromático. */
const COMPANION: Record<CriaColor, [CriaColor, CriaColor]> = {
  laranja: ["amarelo", "rosa"],
  verde: ["amarelo", "azul"],
  azul: ["lilas", "verde"],
  rosa: ["lilas", "laranja"],
  amarelo: ["laranja", "verde"],
  lilas: ["azul", "rosa"],
};

export function OrganicBlobs({ color, className }: { color: CriaColor; className?: string }) {
  const [c2, c3] = COMPANION[color];
  const palette: CriaColor[] = [color, c2, color, c3];

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {BLOBS.map((b, i) => (
        <span
          key={i}
          className="absolute block"
          style={{
            top: "top" in b ? b.top : undefined,
            bottom: "bottom" in b ? b.bottom : undefined,
            left: "left" in b ? b.left : undefined,
            right: "right" in b ? b.right : undefined,
            width: b.size,
            aspectRatio: "1 / 1",
            borderRadius: b.radius,
            background: CRIA_HEX[palette[i]],
            opacity: b.op,
          }}
        />
      ))}
    </div>
  );
}

export default OrganicBlobs;
