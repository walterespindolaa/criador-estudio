import { useNavigate } from "react-router-dom";
import { Sparkles, Crown, AlertCircle, Shield, Layers } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";

/* ═══════════════════════════════════════════════════════════════════════════
   A PÍLULA DO PLANO

   Ela EXISTIA e era clicável — mas escondia a si mesma pra admin e pra conta de
   agência (`return { kind: "hide" }`). Resultado: quem administra o sistema nunca
   via a pílula, e concluía que não existia. Pior: não havia NENHUM outro lugar,
   em nenhuma tela, onde a pessoa pudesse ver o plano que tem ou trocar de plano.

   Agora ela aparece sempre: diz o que você tem hoje e leva pra tela de planos.
   ═══════════════════════════════════════════════════════════════════════════ */

type BadgeState =
  | { kind: "admin" }
  | { kind: "agencia" }
  | { kind: "trial_active"; daysLeft: number }
  | { kind: "trial_warning"; daysLeft: number }
  | { kind: "essencial" }
  | { kind: "pro" }
  | { kind: "studio" }
  | { kind: "expired" };

type Perfil = {
  role?: string | null;
  account_type?: string | null;
  plan?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
} | null | undefined;

function deriveState(profile: Perfil): BadgeState | null {
  if (!profile) return null;
  if (profile.role === "admin") return { kind: "admin" };

  const ativo =
    profile.subscription_status === "active" ||
    profile.subscription_status === "trialing" ||
    profile.subscription_status === "past_due" ||
    profile.subscription_status === "unpaid";

  if (ativo) {
    if (profile.plan === "studio") return { kind: "studio" };
    if (profile.plan === "pro") return { kind: "pro" };
    if (profile.plan === "essencial") return { kind: "essencial" };
  }

  if (profile.trial_ends_at) {
    const diffMs = new Date(profile.trial_ends_at).getTime() - Date.now();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffMs > 0) {
      return daysLeft <= 3 ? { kind: "trial_warning", daysLeft } : { kind: "trial_active", daysLeft };
    }
  }

  // Conta de agência sem plano pessoal: ela paga por assento, não por plano.
  if (profile.account_type === "manager") return { kind: "agencia" };

  return { kind: "expired" };
}

export function PlanBadge({ light = false }: { light?: boolean }) {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const state = deriveState(profile);

  if (!state) return null;

  const base =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-body font-semibold transition-all hover:opacity-90 hover:-translate-y-px cursor-pointer shrink-0";

  const variants: Record<BadgeState["kind"], { className: string; icon: React.ReactNode; label: string }> = {
    admin: {
      className: light ? "bg-white/20 text-white" : "bg-muted text-muted-foreground border border-border",
      icon: <Shield className="w-3 h-3" />,
      label: "Admin",
    },
    agencia: {
      className: light ? "bg-white/20 text-white" : "bg-primary/10 text-primary border border-primary/20",
      icon: <Layers className="w-3 h-3" />,
      label: "Agência",
    },
    trial_active: {
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      icon: <Sparkles className="w-3 h-3" />,
      label: `Teste · ${"daysLeft" in state ? state.daysLeft : 0}d`,
    },
    trial_warning: {
      className: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
      icon: <AlertCircle className="w-3 h-3" />,
      label: `Teste acaba em ${"daysLeft" in state ? state.daysLeft : 0}d`,
    },
    essencial: {
      className: light ? "bg-white/20 text-white" : "bg-muted text-foreground border border-border",
      icon: <Sparkles className="w-3 h-3" />,
      label: "Essencial",
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
      title="Ver planos e trocar de plano"
      aria-label={`Plano atual: ${variant.label}. Clique para ver os planos.`}
    >
      {variant.icon}
      <span>{variant.label}</span>
    </button>
  );
}
