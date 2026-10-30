import type { TourConfig } from "./registry";

/* TOUR DO CRIAKUT (30/10/2026). A mesma tela mora em /app/criakut (criadora)
   e /socialmidia/criakut (social mídia e prestador); o texto é um só. */
export function TOUR_CRIAKUT(id: string, route: string): TourConfig {
  return {
    id,
    route,
    title: "Criakut",
    valueProp:
      "A comunidade do Cria pra achar e ser achado: social mídia, designer, editor, filmmaker e criadora no mesmo lugar, com trabalho de verdade pra mostrar.",
    benefits: [
      "Sua página com o que você faz, seus preços e seu portfólio",
      "Peças entregues pelo Cria no portfólio, com o ok do cliente",
      "Mural de trabalhos e propostas sem sair do Cria",
    ],
    steps: [
      {
        target: '[data-tour="kut-abas"]',
        mobileTarget: '[data-tour="kut-abas-m"]',
        title: "As partes do Criakut",
        body: "Minha página é a sua vitrine. Encontrar gente busca por especialidade, estilo, nicho e cidade. O Mural junta os pedidos de trabalho em aberto. Comunidades são as conversas por assunto. Propostas é onde cada negócio anda, com conversa e entrega.",
        placement: "bottom",
      },
      {
        skipIfMissing: true,
        target: '[data-tour="kut-pagina-abas"]',
        title: "O que a sua página mostra",
        body: "Serviços com preço, portfólio, o que você procura, recados e depoimentos. No Portfólio, \"peças do Cria\" lista o que você entregou por aqui: marque as que quer mostrar e cada uma aparece quando o dono da marca deixar, com ou sem o nome dele.",
        mobileBody: "Serviços com preço, portfólio, recados e depoimentos. Em Portfólio, \"peças do Cria\" mostra o que você entregou por aqui, com o ok do dono da marca.",
        placement: "bottom",
      },
      {
        skipIfMissing: true,
        target: '[data-tour="kut-lateral"]',
        title: "O que falta e quem passou",
        body: "Aqui fica quanto a sua página está pronta (toque no que falta pra resolver), quem visitou e as suas comunidades. Prestador e social mídia também veem o Destaque: aparecer primeiro na busca da sua especialidade.",
        placement: "left",
      },
    ],
  };
}
