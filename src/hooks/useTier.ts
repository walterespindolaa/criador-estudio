import { useMemo } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { tierAtLeast, type Tier } from "@/lib/plans";

export type { Tier };

export function deriveTier(
  profile:
    | {
        role?: string | null;
        plan?: string | null;
        subscription_status?: string | null;
        trial_ends_at?: string | null;
      }
    | null
    | undefined,
  now: Date = new Date(),
): Tier {
  if (!profile) return "none";
  if (profile.role === "admin") return "studio";
  // Assinatura vigente = active, trial pago do Stripe, ou em retentativa de cobrança
  // (past_due/unpaid). Não derruba o tier de quem ainda está na janela de dunning.
  const s = profile.subscription_status;
  const hasSub = s === "active" || s === "trialing" || s === "past_due" || s === "unpaid";
  if (hasSub && profile.plan === "studio") return "studio";
  if (hasSub && profile.plan === "pro") return "pro";
  if (hasSub && profile.plan === "essencial") return "essencial";
  // Trial livre entra no topo, de propósito: a pessoa precisa SENTIR o que
  // perde quando acabar. Trial que já começa capado não converte nada.
  if (profile.trial_ends_at && new Date(profile.trial_ends_at) > now) return "studio";
  return "none";
}

/**
 * Tier das ferramentas pagas = plano da CONTA ATIVA (decisão 18/10/2026):
 * quando a social media abre o Cria de uma cliente, vale o plano da cliente;
 * no "Meu perfil", vale o plano do perfil. Admin da SESSÃO continua liberado.
 * Acesso ao app em si (pagou ou não) é useSubscription, da sessão.
 */
export function useTier() {
  const { profile: sessao, isLoading: sessaoLoading } = useProfile();
  const { profile: ativo, isLoading: ativoLoading, isOutraConta } = useActiveProfile();

  const isAdmin = sessao?.role === "admin";
  const tier = useMemo<Tier>(
    () => (isAdmin ? "studio" : deriveTier(ativo)),
    [isAdmin, ativo],
  );
  const isLoading = sessaoLoading || ativoLoading;

  return {
    tier,
    isAdmin,
    isLoading,
    /** true quando o tier vem de outra conta (cliente ou Meu perfil). */
    isOutraConta,
    nomeDaConta: ativo?.name ?? null,
    isStudio: tier === "studio",
    isPro: tier === "pro",
    isEssencial: tier === "essencial",
    isPaidOrTrial: tier !== "none",
    /** A única pergunta que interessa: este tier alcança o mínimo exigido? */
    atLeast: (minimo: Tier) => tierAtLeast(tier, minimo),
    canUseStudioFeatures: tier === "studio",
  };
}
