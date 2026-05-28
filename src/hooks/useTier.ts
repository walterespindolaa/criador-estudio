import { useMemo } from "react";
import { useProfile } from "@/hooks/useProfile";

export type Tier = "none" | "pro" | "studio";

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
  if (profile.subscription_status === "active" && profile.plan === "studio") return "studio";
  if (profile.subscription_status === "active" && profile.plan === "pro") return "pro";
  if (profile.trial_ends_at && new Date(profile.trial_ends_at) > now) return "studio";
  return "none";
}

export function useTier() {
  const { profile, isLoading } = useProfile();

  const tier = useMemo<Tier>(() => deriveTier(profile), [profile]);

  return {
    tier,
    isLoading,
    isStudio: tier === "studio",
    isPro: tier === "pro",
    isPaidOrTrial: tier !== "none",
    canUseStudioFeatures: tier === "studio",
  };
}
