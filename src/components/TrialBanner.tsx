import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Zap, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";

export function TrialBanner() {
  const { status, daysLeftInTrial } = useSubscription();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const key = `trial_banner_dismissed_${new Date().toDateString()}`;
    if (sessionStorage.getItem(key)) setDismissed(true);
  }, []);

  const handleDismiss = () => {
    const key = `trial_banner_dismissed_${new Date().toDateString()}`;
    sessionStorage.setItem(key, "1");
    setDismissed(true);
  };

  if (dismissed || (status !== "trial_expiring" && status !== "trial_active")) {
    return null;
  }

  // Só mostrar quando faltam 4 dias ou menos
  if (daysLeftInTrial > 4) return null;

  const isUrgent = daysLeftInTrial <= 1;
  const isCritical = daysLeftInTrial === 0;

  const message = isCritical
    ? "Seu período de teste termina hoje!"
    : daysLeftInTrial === 1
    ? "Último dia do seu período de teste."
    : `Faltam ${daysLeftInTrial} dias no seu período de teste.`;

  return (
    <div
      className={cn(
        "relative w-full px-4 py-2.5 flex items-center justify-between gap-3 text-sm font-body",
        isUrgent
          ? "bg-red-500 text-white"
          : "bg-amber-500 text-white"
      )}
    >
      <div className="flex items-center gap-2 flex-1 justify-center">
        {isUrgent ? (
          <Clock className="h-4 w-4 shrink-0" />
        ) : (
          <Zap className="h-4 w-4 shrink-0" />
        )}
        <span className="font-medium">{message}</span>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-3 text-xs border-white/40 bg-white/20 text-white hover:bg-white/30 hover:text-white ml-1"
          onClick={() => navigate("/app/assinar")}
        >
          Assinar agora
        </Button>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
        aria-label="Fechar aviso"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
