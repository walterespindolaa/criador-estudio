import { Lock } from "lucide-react";
import { useTier } from "@/hooks/useTier";
import { seloDaRota } from "@/lib/plans";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   O SELO DE PLANO NO MENU

   "Não dá pra saber o que é de cada plano." Era verdade: o único item marcado
   era o Cria Estúdio, e a marcação era um booleano escrito à mão. Insights,
   Tendências, Media Kit, Relatórios, Collabs, Cria Plano, Cria Stories, todos
   apareciam no menu como se fossem da pessoa. Ela clicava, batia na trava, e
   só ali descobria que aquilo custava mais.

   Este selo lê o MESMO mapa da trava (lib/plans.ts). E ele só aparece pra quem
   ainda não tem: pra o assinante Studio o menu fica limpo, como deve ser.
   ═══════════════════════════════════════════════════════════════════════════ */

export function PlanTag({ to, className }: { to: string; className?: string }) {
  const { tier } = useTier();
  const selo = seloDaRota(to, tier);
  if (!selo) return null;

  return (
    <span
      className={cn(
        "shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5",
        "text-[9px] font-body font-bold uppercase tracking-wide leading-none",
        "bg-muted text-muted-foreground/80 border border-border",
        className,
      )}
      title={`Disponível no plano ${selo}`}
    >
      <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
      {selo}
    </span>
  );
}

export default PlanTag;
