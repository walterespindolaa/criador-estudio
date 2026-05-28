import { Sparkles } from "lucide-react";
import { useAiUsage } from "@/hooks/useAiUsage";

export function AiUsageBadge({ compact = false }: { compact?: boolean }) {
  const { used, quota, pct, isLoading } = useAiUsage();
  if (isLoading || quota === 0) return null;

  const nearLimit = pct >= 80;

  if (compact) {
    return (
      <div
        className="flex items-center gap-1 text-xs text-muted-foreground"
        title={`${used}/${quota} gerações de IA este mês`}
      >
        <Sparkles className="w-3 h-3" />
        {used}/{quota}
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between text-xs font-body mb-1.5">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Sparkles className="w-3 h-3" /> IA este mês
        </span>
        <span className={nearLimit ? "text-red-500 font-medium" : "text-muted-foreground"}>
          {used}/{quota}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${nearLimit ? "bg-red-500" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
