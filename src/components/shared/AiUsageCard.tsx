import { Sparkles } from "lucide-react";
import { useAiUsage } from "@/hooks/useAiUsage";

/**
 * Card de uso da IA no mês corrente. Mostra a barra de consumo (gerações
 * usadas / cota), quanto resta e quando zera. Usado no Dashboard e em
 * Configurações > Integrações.
 */
export function AiUsageCard({ className = "" }: { className?: string }) {
  const { used, quota, remaining, pct, isLoading } = useAiUsage();

  if (isLoading) return null;
  if (quota === 0) return null; // sem cota definida (ex.: admin ilimitado) — não mostra

  const nearLimit = pct >= 80;
  const maxed = remaining === 0;

  return (
    <div className={`bg-card rounded-xl p-5 border border-border ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 grid place-items-center">
            <Sparkles className="h-4 w-4 text-white" />
          </span>
          Uso da IA este mês
        </h3>
        <span className={`text-sm font-body font-semibold ${nearLimit ? "text-red-500" : "text-foreground"}`}>
          {used}<span className="text-muted-foreground font-normal">/{quota}</span>
        </span>
      </div>

      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${nearLimit ? "bg-red-500" : "bg-gradient-to-r from-primary to-purple-600"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-xs font-body text-muted-foreground mt-2.5">
        {maxed
          ? "Você atingiu o limite de gerações deste mês. A cota zera no início do próximo mês."
          : `Restam ${remaining} ${remaining === 1 ? "geração" : "gerações"} este mês. A cota zera no dia 1º.`}
      </p>
    </div>
  );
}
