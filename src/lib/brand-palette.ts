// Paleta rica de cores da MARCA do cliente, agrupada por família (do claro ao escuro).
// Usada na personalização do cliente (portal público de aprovação) e no link dele.
// O valor salvo é SEMPRE o hex. Cada família traz 5 tons pra dar bastante escolha
// sem virar um seletor genérico de cor (que já existe como fallback no input color).
export type BrandColorFamily = { nome: string; tons: string[] };

export const BRAND_COLOR_FAMILIES: BrandColorFamily[] = [
  { nome: "Vermelhos", tons: ["#FECACA", "#F87171", "#EF4444", "#DC2626", "#991B1B"] },
  { nome: "Laranjas", tons: ["#FED7AA", "#FB923C", "#F97316", "#EA4918", "#C2410C"] },
  { nome: "Amarelos", tons: ["#FEF08A", "#FDE047", "#FACC15", "#FFCF03", "#CA8A04"] },
  { nome: "Verdes", tons: ["#BBF7D0", "#4ADE80", "#22C55E", "#01A652", "#15803D"] },
  { nome: "Turquesas", tons: ["#99F6E4", "#2DD4BF", "#14B8A6", "#0D9488", "#0F766E"] },
  { nome: "Azuis", tons: ["#BFDBFE", "#60A5FA", "#3B82F6", "#0061EE", "#1E40AF"] },
  { nome: "Índigos", tons: ["#C7D2FE", "#818CF8", "#6366F1", "#4B3FA8", "#3730A3"] },
  { nome: "Roxos", tons: ["#E9D5FF", "#C084FC", "#A855F7", "#9333EA", "#6B21A8"] },
  { nome: "Rosas", tons: ["#FBCFE8", "#F472B6", "#EC4899", "#FF77B9", "#BE185D"] },
  { nome: "Marrons", tons: ["#E7D3C0", "#C9A78A", "#A97C52", "#8B5E34", "#5C3D21"] },
  { nome: "Dourados", tons: ["#F5E4B3", "#E9C863", "#D4A72C", "#B8860B", "#8A6508"] },
  { nome: "Neutros", tons: ["#F3F4F6", "#D1D5DB", "#9CA3AF", "#4B5563", "#1F2937"] },
];

// Lista chapada com todos os tons, útil pra fallback/validação.
export const BRAND_COLORS = BRAND_COLOR_FAMILIES.flatMap((f) => f.tons);
