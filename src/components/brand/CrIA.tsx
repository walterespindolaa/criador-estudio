import { cn } from "@/lib/utils";

/* Nome da IA no app (Walter, 28/10/2026): "Cria IA" nos textos e "CrIA" nos
   botões de ação, com o "IA" em laranja. Nunca "IA" solto. Em botão laranja o
   "IA" fica branco e sublinhado (laranja sobre laranja some). */
export function CrIA({ sobreLaranja, className }: { sobreLaranja?: boolean; className?: string }) {
  return (
    <span className={cn("font-extrabold whitespace-nowrap", className)}>
      Cr<span className={sobreLaranja ? "underline decoration-2 underline-offset-2" : "text-primary"}>IA</span>
    </span>
  );
}
