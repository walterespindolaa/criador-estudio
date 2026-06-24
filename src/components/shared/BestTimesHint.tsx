import { useMemo } from "react";
import { Clock, Sparkles } from "lucide-react";
import { bestTimes } from "@/lib/bestTimes";

type Props = {
  platform?: string | null;
  niche?: string | null;
  onPick?: (time: string) => void;
  className?: string;
};

// Mostra os melhores horários sugeridos. Se onPick for passado, cada horário
// vira um botão que aplica o horário no agendamento.
export function BestTimesHint({ platform, niche, onPick, className }: Props) {
  const bt = useMemo(() => bestTimes(platform, niche), [platform, niche]);

  return (
    <div className={`rounded-xl border border-primary/15 bg-primary/5 p-3 ${className ?? ""}`}>
      <p className="text-[11px] font-display font-semibold text-primary flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5" /> Melhor horário pra postar
      </p>
      <p className="text-[11px] font-body text-muted-foreground mt-1">
        Melhores dias: <span className="font-semibold text-foreground">{bt.days}</span>
      </p>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {bt.slots.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onPick?.(t)}
            disabled={!onPick}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-card text-xs font-body text-foreground hover:border-primary/40 hover:text-primary transition-colors disabled:cursor-default disabled:hover:border-border disabled:hover:text-foreground"
          >
            <Clock className="h-3 w-3" /> {t}
          </button>
        ))}
      </div>
      {bt.source === "heuristica" && (
        <p className="text-[10px] font-body text-muted-foreground/70 mt-2">
          Baseado no seu nicho e plataforma. Vai ficar ainda mais preciso quando o Instagram for conectado.
        </p>
      )}
    </div>
  );
}
