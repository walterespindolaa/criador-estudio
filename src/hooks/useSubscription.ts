import { useProfile } from "@/hooks/useProfile";
import { useMemo } from "react";
import {
  deriveSubStatus,
  canAccess as canAccessStatus,
  daysLeftInTrial as computeDaysLeftInTrial,
  type SubStatus,
} from "@/lib/subscription-status";

export type AccessStatus = "loading" | SubStatus;

export function useSubscription() {
  const { profile, isLoading } = useProfile();

  const status = useMemo<AccessStatus>(() => {
    if (isLoading || !profile) return "loading";
    return deriveSubStatus({
      role: profile.role,
      subscriptionStatus: profile.subscription_status,
      trialEndsAt: profile.trial_ends_at,
    });
  }, [profile, isLoading]);

  const daysLeftInTrial = useMemo(
    () => computeDaysLeftInTrial(profile?.trial_ends_at),
    [profile?.trial_ends_at],
  );

  const canAccess = status !== "loading" && canAccessStatus(status);
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
