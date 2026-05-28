import { useNavigate } from "react-router-dom";
import { Sparkles, Crown, AlertCircle } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";

type BadgeState =
  | { kind: "hide" }
  | { kind: "trial_active"; daysLeft: number }
  | { kind: "trial_warning"; daysLeft: number }
  | { kind: "pro" }
  | { kind: "studio" }
  | { kind: "expired" };

function deriveState(
  profile:
    | {
        role?: string | null;
        plan?: string | null;
        subscription_status?: string | null;
        trial_ends_at?: string | null;
      }
    | null
    | undefined,
): BadgeState {
  if (!profile) return { kind: "hide" };
  if (profile.role === "admin") return { kind: "hide" };

  if (profile.subscription_status === "active") {
    if (profile.plan === "studio") return { kind: "studio" };
    if (profile.plan === "pro") return { kind: "pro" };
  }

  if (profile.trial_ends_at) {
    const diffMs = new Date(profile.trial_ends_at).getTime() - Date.now();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffMs > 0) {
      return daysLeft <= 3
        ? { kind: "trial_warning", daysLeft }
        : { kind: "trial_active", daysLeft };
    }
  }

  return { kind: "expired" };
}

export function PlanBadge() {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const state = deriveState(profile);

  if (state.kind === "hide") return null;

  const base =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-body font-medium transition-all hover:opacity-90 cursor-pointer";

  const variants: Record<
    Exclude<BadgeState["kind"], "hide">,
    { className: string; icon: React.ReactNode; label: string }
  > = {
    trial_active: {
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      icon: <Sparkles className="w-3 h-3" />,
      label: `Trial · ${"daysLeft" in state ? state.daysLeft : 0}d`,
    },
    trial_warning: {
      className: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
      icon: <AlertCircle className="w-3 h-3" />,
      label: `Trial · ${"daysLeft" in state ? state.daysLeft : 0}d`,
    },
    pro: {
      className: "bg-primary/10 text-primary border border-primary/20",
      icon: <Sparkles className="w-3 h-3" />,
      label: "Pro",
    },
    studio: {
      className: "bg-gradient-to-r from-primary via-purple-600 to-pink-500 text-white",
      icon: <Crown className="w-3 h-3" />,
      label: "Studio",
    },
    expired: {
      className: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
      icon: <AlertCircle className="w-3 h-3" />,
      label: "Sem plano",
    },
  };

  const variant = variants[state.kind];

  return (
    <button
      type="button"
      onClick={() => navigate("/app/assinar")}
      className={`${base} ${variant.className}`}
      aria-label={`Plano atual: ${variant.label}. Clique para gerenciar.`}
    >
      {variant.icon}
      <span>{variant.label}</span>
    </button>
  );
}
