import type { CapaTipo } from "@/lib/criakut";
import { cn } from "@/lib/utils";

/* AS 5 CAPAS DO CRIA (Walter, 14/10/2026: "umas 5 no padrão do Cria bem bonitas").
   Desenhadas em código, não imagem: ficam nítidas em qualquer tela, não ocupam
   armazenamento e as cores seguem a LP (laranja, azul, rosa, amarelo, verde,
   creme). Proporção fixa 4 por 1: o que a pessoa vê no editor é o que aparece
   em qualquer tela. A faixa de baixo fica atrás da foto e dos cards, por isso
   os selos moram na metade de cima. */

export const CAPAS_CRIA: { tipo: Exclude<CapaTipo, "propria">; nome: string }[] = [
  { tipo: "cria-1", nome: "Laranja" },
  { tipo: "cria-2", nome: "Azul" },
  { tipo: "cria-3", nome: "Papel picado" },
  { tipo: "cria-4", nome: "Caderno" },
  { tipo: "cria-5", nome: "Verde" },
];

const BLOB = "M0.5 0C0.78 0 1 0.2 1 0.48C1 0.78 0.76 1 0.46 1C0.18 1 0 0.8 0 0.52C0 0.22 0.22 0 0.5 0Z";
const blob = (x: number, y: number, w: number, h: number, cor: string, rot = 0, op = 1) => (
  <path d={BLOB} fill={cor} opacity={op} transform={`translate(${x} ${y}) rotate(${rot}) scale(${w} ${h})`} />
);
const selo = (src: string, x: number, y: number, w: number, rot: number) => (
  <image href={src} x={x} y={y} width={w} height={w} preserveAspectRatio="xMidYMid meet" transform={`rotate(${rot} ${x + w / 2} ${y + w / 2})`} />
);

function Desenho({ tipo }: { tipo: Exclude<CapaTipo, "propria"> }) {
  switch (tipo) {
    case "cria-1":
      return (<>
        <rect width="1600" height="400" fill="#FBE3D8" />
        {blob(1080, -170, 620, 520, "#CE4A1D", 8, 0.9)}
        {blob(760, 210, 300, 260, "#F2C21E", -12, 0.75)}
        {blob(-120, -140, 360, 300, "#F27EB5", 20, 0.35)}
        {selo("/stickers/selo-sem-formula.png", 1240, 20, 190, 10)}
      </>);
    case "cria-2":
      return (<>
        <rect width="1600" height="400" fill="#E3E8FC" />
        {blob(-140, 60, 620, 520, "#2A4BDF", -10, 0.85)}
        {blob(1280, -120, 420, 360, "#F27EB5", 15, 0.5)}
        {blob(980, 230, 220, 200, "#F2C21E", 0, 0.7)}
        {selo("/stickers/selo-social-club-azul.png", 1330, 30, 170, -10)}
      </>);
    case "cria-3": {
      const cores = ["#CE4A1D", "#2A4BDF", "#F2C21E", "#3E9152", "#F27EB5"];
      const pecas = Array.from({ length: 46 }, (_, i) => ({
        x: (i * 337) % 1600, y: (i * 131) % 380, r: (i * 47) % 180, c: cores[i % 5], q: i % 3,
      }));
      return (<>
        <rect width="1600" height="400" fill="#FDE6F1" />
        {pecas.map((p, i) => p.q === 0
          ? <circle key={i} cx={p.x} cy={p.y} r="9" fill={p.c} opacity="0.8" />
          : <rect key={i} x={p.x} y={p.y} width={p.q === 1 ? 26 : 14} height="10" rx="3" fill={p.c} opacity="0.8" transform={`rotate(${p.r} ${p.x} ${p.y})`} />)}
        {selo("/stickers/selo-da-ideia-ao-post-rosa.png", 1150, 10, 300, -8)}
      </>);
    }
    case "cria-4":
      return (<>
        <rect width="1600" height="400" fill="#FFFBEF" />
        {Array.from({ length: 41 }, (_, i) => <line key={`v${i}`} x1={i * 40} x2={i * 40} y1="0" y2="400" stroke="#2A4BDF" strokeOpacity="0.08" />)}
        {Array.from({ length: 11 }, (_, i) => <line key={`h${i}`} x1="0" x2="1600" y1={i * 40} y2={i * 40} stroke="#2A4BDF" strokeOpacity="0.08" />)}
        <line x1="120" x2="120" y1="0" y2="400" stroke="#CE4A1D" strokeOpacity="0.35" strokeWidth="3" />
        <rect x="560" y="40" width="190" height="46" fill="#F2C21E" opacity="0.55" transform="rotate(-6 655 63)" />
        <rect x="1000" y="150" width="160" height="42" fill="#F27EB5" opacity="0.45" transform="rotate(5 1080 171)" />
        {selo("/stickers/selo-social-club-amarelo.png", 1300, 24, 180, 12)}
      </>);
    case "cria-5":
      return (<>
        <rect width="1600" height="400" fill="#E0F1E4" />
        {blob(1100, -200, 560, 520, "#3E9152", 0, 0.8)}
        {blob(200, 180, 380, 320, "#F2C21E", 18, 0.55)}
        {blob(-160, -180, 360, 320, "#3E9152", 0, 0.3)}
        {selo("/stickers/selo-da-ideia-ao-post-amarelo.png", 1080, 10, 300, 6)}
      </>);
  }
}

/** topo = em faixa baixa (página), mostra a parte de cima do desenho, onde ficam os selos. */
export function CapaCriakut({ tipo, url, className, topo = false }: { tipo: CapaTipo; url?: string | null; className?: string; topo?: boolean }) {
  return (
    <div className={cn("relative w-full aspect-[4/1] overflow-hidden rounded-3xl bg-muted", className)}>
      {tipo === "propria" && url
        ? <img src={url} alt="" className={cn("absolute inset-0 h-full w-full object-cover", topo && "object-[center_30%]")} />
        : <svg viewBox="0 0 1600 400" preserveAspectRatio={topo ? "xMidYMin slice" : "xMidYMid slice"} className="absolute inset-0 h-full w-full" aria-hidden>
            <Desenho tipo={tipo === "propria" ? "cria-1" : tipo} />
          </svg>}
    </div>
  );
}
