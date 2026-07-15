/**
 * Fundo decorativo escolhível (rebranding CRIA).
 * Estilos config-driven, adicionar um estilo = adicionar uma entrada em BG_STYLES.
 * Renderizado atrás do conteúdo (o wrapper do layout fica com z-[1]).
 */
export const BG_STYLES = [
  { key: "nenhum", label: "Nenhum", desc: "Fundo limpo, zero distração" },
  { key: "organico", label: "Orgânico CRIA", desc: "Formas fluidas flutuando" },
  { key: "bolhas", label: "Bolhas", desc: "Círculos suaves e calmos" },
  { key: "confete", label: "Confete", desc: "Pontinhos coloridos discretos" },
] as const;

type Shape = {
  size: number;            // px
  top?: string; bottom?: string; left?: string; right?: string;
  color: string;
  radius: string;          // border-radius (orgânico usa raios irregulares)
  opacity: number;
  anim?: "cria-blob" | "cria-blob cria-blob-slow" | "cria-blob cria-blob-fast";
};

const ORGANICO: Shape[] = [
  { size: 380, top: "-140px", right: "-120px", color: "#FF77B9", radius: "38% 62% 55% 45%/48% 42% 58% 52%", opacity: 0.14, anim: "cria-blob" },
  { size: 300, bottom: "-110px", left: "-100px", color: "#FFCF03", radius: "55% 45% 40% 60%/50% 60% 40% 50%", opacity: 0.16, anim: "cria-blob cria-blob-slow" },
  { size: 150, top: "38%", right: "6%", color: "#0061EE", radius: "45% 55% 60% 40%/55% 45% 55% 45%", opacity: 0.10, anim: "cria-blob cria-blob-fast" },
  { size: 90, bottom: "26%", left: "4%", color: "#01A652", radius: "50%", opacity: 0.12, anim: "cria-blob cria-blob-slow" },
];

const BOLHAS: Shape[] = [
  { size: 260, top: "-80px", right: "10%", color: "#0061EE", radius: "50%", opacity: 0.08, anim: "cria-blob cria-blob-slow" },
  { size: 180, top: "30%", left: "-60px", color: "#FF77B9", radius: "50%", opacity: 0.10, anim: "cria-blob" },
  { size: 120, bottom: "18%", right: "-40px", color: "#FFCF03", radius: "50%", opacity: 0.12, anim: "cria-blob cria-blob-fast" },
  { size: 70, bottom: "-20px", left: "30%", color: "#EA4918", radius: "50%", opacity: 0.09, anim: "cria-blob cria-blob-slow" },
  { size: 46, top: "14%", left: "42%", color: "#01A652", radius: "50%", opacity: 0.10 },
];

const CONFETE: Shape[] = [
  { size: 14, top: "12%", left: "8%", color: "#EA4918", radius: "4px", opacity: 0.35, anim: "cria-blob cria-blob-fast" },
  { size: 10, top: "22%", right: "12%", color: "#0061EE", radius: "50%", opacity: 0.35, anim: "cria-blob" },
  { size: 12, top: "45%", left: "16%", color: "#FFCF03", radius: "50%", opacity: 0.4, anim: "cria-blob cria-blob-slow" },
  { size: 9, top: "60%", right: "7%", color: "#FF77B9", radius: "3px", opacity: 0.4, anim: "cria-blob" },
  { size: 13, bottom: "18%", left: "6%", color: "#01A652", radius: "50%", opacity: 0.35, anim: "cria-blob cria-blob-fast" },
  { size: 8, bottom: "10%", right: "24%", color: "#EA4918", radius: "50%", opacity: 0.35, anim: "cria-blob cria-blob-slow" },
  { size: 11, top: "34%", right: "34%", color: "#FFCF03", radius: "3px", opacity: 0.3 },
  { size: 9, bottom: "34%", left: "38%", color: "#0061EE", radius: "50%", opacity: 0.3, anim: "cria-blob" },
];

const SETS: Record<string, Shape[]> = { organico: ORGANICO, bolhas: BOLHAS, confete: CONFETE };

export function BgShapes({ styleKey }: { styleKey?: string | null }) {
  const shapes = styleKey ? SETS[styleKey] : undefined;
  if (!shapes) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {shapes.map((s, i) => (
        <div
          key={i}
          className={s.anim}
          style={{
            position: "absolute",
            width: s.size,
            height: s.size,
            top: s.top, bottom: s.bottom, left: s.left, right: s.right,
            backgroundColor: s.color,
            borderRadius: s.radius,
            opacity: s.opacity,
          }}
        />
      ))}
    </div>
  );
}

export default BgShapes;
