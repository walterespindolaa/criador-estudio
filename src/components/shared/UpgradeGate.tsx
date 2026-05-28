import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTier } from "@/hooks/useTier";

type UpgradeGateProps = {
  requires?: "pro" | "studio";
  feature?: string;
  children: ReactNode;
};

const order = { none: 0, pro: 1, studio: 2 } as const;

export function UpgradeGate({ requires = "studio", feature, children }: UpgradeGateProps) {
  const { tier, isLoading } = useTier();
  const navigate = useNavigate();

  if (isLoading) return null;

  const hasAccess = order[tier] >= order[requires];
  if (hasAccess) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 flex items-center justify-center mb-4">
        <Lock className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-xl font-display font-bold text-foreground mb-2">
        {feature ? `${feature} é do plano Studio` : "Recurso do plano Studio"}
      </h3>
      <p className="text-muted-foreground font-body max-w-sm mb-6">
        Faça upgrade para o <strong>cria Studio</strong> e desbloqueie parcerias, financeiro e muito mais para quem monetiza.
      </p>
      <Button variant="hero" onClick={() => navigate("/app/assinar")}>
        <Sparkles className="w-4 h-4 mr-2" />
        Conhecer o Studio
      </Button>
    </div>
  );
}
