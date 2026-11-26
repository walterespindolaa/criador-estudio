/* ORIGEM DAS IDEIAS DO ONBOARDING (Walter, 26/11/2026). A IA cria até 5 ideias
   no onboarding e elas eram iguais às da pessoa no banco: o selo 001 e o passo
   "Guardar minha 1ª ideia" já nasciam ganhos, e o "Comece por aqui" destacava a
   ideia da IA em vez da que a pessoa escreveu. A coluna `ideas.origin` separa. */
export const ORIGEM_IDEIA_IA = "onboarding_ia";
export const ORIGEM_IDEIA_ONBOARDING = "onboarding";

/** Ideia escrita pela pessoa (tudo que não foi a IA do onboarding). */
export const ehIdeiaPropria = (i: { origin?: string | null }) => i.origin !== ORIGEM_IDEIA_IA;
