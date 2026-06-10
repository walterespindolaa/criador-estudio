export type PlanId = "pro" | "studio";

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  tagline: string;
  features: string[];
  highlighted: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "pro",
    name: "cria Pro",
    price: "R$ 32,90",
    tagline: "Seu estúdio de conteúdo completo",
    features: [
      "Banco de ideias ilimitado",
      "Pipeline kanban de produção",
      "Calendário + metas mensais",
      "IA: 150 gerações/mês (legendas, roteiros, ideias)",
      "Agendamento Instagram, TikTok e YouTube",
      "Link in Bio profissional",
      "Brandbook + Biblioteca",
      "Relatórios e analytics",
    ],
    highlighted: false,
  },
  {
    id: "studio",
    name: "cria Studio",
    price: "R$ 49,90",
    tagline: "Para quem vive de conteúdo",
    features: [
      "Tudo do cria Pro",
      "🤝 Collabs: parcerias com marcas",
      "💰 Financeiro: controle de cachês",
      "📊 Acompanhamento de campanhas",
      "🎓 Acesso aos cursos",
      "IA: 500 gerações/mês",
      "Suporte prioritário",
    ],
    highlighted: true,
  },
];

// Cota de armazenamento por plano (em bytes). Trial/sem assinatura = 500MB.
export const STORAGE_BYTES: Record<string, number> = {
  trial: 524288000,     // 500 MB
  pro: 5368709120,      // 5 GB
  studio: 16106127360,  // 15 GB
};

export function storageBytesForPlan(plan?: string | null, active?: boolean): number {
  if (active && plan && STORAGE_BYTES[plan] != null) return STORAGE_BYTES[plan];
  return STORAGE_BYTES.trial;
}

export function formatStorage(bytes: number): string {
  if (bytes >= 1073741824) {
    const gb = bytes / 1073741824;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  }
  return `${Math.round(bytes / 1048576)} MB`;
}
