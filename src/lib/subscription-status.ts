export type SubStatus =
  | "trial_active"
  | "trial_expiring"
  | "trial_expired"
  | "active"
  | "canceled"
  | "blocked";

export interface SubInput {
  role?: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  now?: Date;
}

export function deriveSubStatus(input: SubInput): SubStatus {
  const now = input.now ?? new Date();

  if (input.role === "admin") return "active";
  if (input.subscriptionStatus === "active") return "active";
  if (input.subscriptionStatus === "canceled") return "canceled";

  if (input.trialEndsAt) {
    const trialEnd = new Date(input.trialEndsAt);
    const diffMs = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs <= 0) return "trial_expired";
    if (diffDays <= 3) return "trial_expiring";
    return "trial_active";
  }

  return "blocked";
}

export function canAccess(status: SubStatus): boolean {
  return status === "trial_active" || status === "trial_expiring" || status === "active";
}

export function daysLeftInTrial(trialEndsAt: string | null | undefined, now: Date = new Date()): number {
  if (!trialEndsAt) return 0;
  const diffMs = new Date(trialEndsAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}
