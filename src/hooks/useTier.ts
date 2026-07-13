import { useMemo } from "react";
import { useProfile } from "@/hooks/useProfile";
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

export function useTier() {
  const { profile, isLoading } = useProfile();

  const tier = useMemo<Tier>(() => deriveTier(profile), [profile]);
  const isAdmin = profile?.role === "admin";

  return {
    tier,
    isAdmin,
    isLoading,
    isStudio: tier === "studio",
    isPro: tier === "pro",
    isEssencial: tier === "essencial",
    isPaidOrTrial: tier !== "none",
    /** A única pergunta que interessa: este tier alcança o mínimo exigido? */
    atLeast: (minimo: Tier) => tierAtLeast(tier, minimo),
    canUseStudioFeatures: tier === "studio",
  };
}
