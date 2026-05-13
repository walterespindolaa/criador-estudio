import { useProfile } from "@/hooks/useProfile";
import { useMemo } from "react";

export type AccessStatus =
  | "loading"
  | "trial_active"
  | "trial_expiring"   // 3 dias ou menos
  | "trial_expired"
  | "active"           // assinatura paga ativa
  | "canceled"
  | "blocked";

export function useSubscription() {
  const { profile, isLoading } = useProfile();

  const status = useMemo<AccessStatus>(() => {
    if (isLoading || !profile) return "loading";

    // Admin sempre tem acesso total
    if (profile.role === "admin") return "active";

    // Assinatura paga ativa
    if (profile.subscription_status === "active") return "active";
    if (profile.subscription_status === "canceled") return "canceled";

    // Lógica de trial
    if (profile.trial_ends_at) {
      const now = new Date();
      const trialEnd = new Date(profile.trial_ends_at);
      const diffMs = trialEnd.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffMs <= 0) return "trial_expired";
      if (diffDays <= 3) return "trial_expiring";
      return "trial_active";
    }

    // Sem trial e sem assinatura
    return "blocked";
  }, [profile, isLoading]);

  const daysLeftInTrial = useMemo(() => {
    if (!profile?.trial_ends_at) return 0;
    const now = new Date();
    const trialEnd = new Date(profile.trial_ends_at);
    const diffMs = trialEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }, [profile]);

  const canAccess = status === "trial_active" || status === "trial_expiring" || status === "active";
  const isAdmin = profile?.role === "admin";
  const isPaid = profile?.subscription_status === "active";

  return {
    status,
    canAccess,
    isAdmin,
    isPaid,
    daysLeftInTrial,
    profile,
    isLoading,
  };
}
