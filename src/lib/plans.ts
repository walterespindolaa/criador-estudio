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
