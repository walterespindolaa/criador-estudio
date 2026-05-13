import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HardDrive, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";

export function StorageWarningBanner() {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const key = `storage_banner_${new Date().toDateString()}`;
    if (sessionStorage.getItem(key)) setDismissed(true);
  }, []);

  if (!profile || dismissed) return null;

  const used = profile.storage_used_bytes ?? 0;
  const quota = profile.storage_quota_bytes ?? 524288000;
  const pct = Math.round((used / quota) * 100);

  if (pct < 80) return null;

  const isFull = pct >= 100;

  const handleDismiss = () => {
    sessionStorage.setItem(`storage_banner_${new Date().toDateString()}`, "1");
    setDismissed(true);
  };

  return (
    <div className={cn(
      "relative w-full px-4 py-2.5 flex items-center justify-between gap-3 text-sm font-body",
      isFull ? "bg-red-500 text-white" : "bg-amber-500 text-white"
    )}>
      <div className="flex items-center gap-2 flex-1 justify-center">
        <HardDrive className="h-4 w-4 shrink-0" />
        <span className="font-medium">
          {isFull
            ? "Armazenamento cheio! Novos uploads estão bloqueados."
            : `Armazenamento ${pct}% usado. Considere liberar espaço.`}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-3 text-xs border-white/40 bg-white/20 text-white hover:bg-white/30 hover:text-white ml-1"
          onClick={() => navigate("/app/arquivos")}
        >
          Gerenciar
        </Button>
      </div>
      <button onClick={handleDismiss} className="shrink-0 p-1 rounded hover:bg-white/20">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
