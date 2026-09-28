import { useMemo } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { bestTimes, bestTimesFromMedia, type MediaForBestTimes } from "@/lib/bestTimes";

/* MELHORES HORÁRIOS (Relatórios).
   Antes (até 28/09/2026) contava a hora em que a pessoa COSTUMA agendar e
   chamava isso de "baseado nos seus posts": só devolvia o próprio hábito.
   Agora (ciclo 3 dos dados do Instagram) usa o desempenho real dos posts no
   Instagram (mesma conta do editor de post). Sem base suficiente, mostra a
   sugestão por nicho e diz que é sugestão. */

type Props = {
  media: MediaForBestTimes[];
  niche?: string | null;
};

const ROTULOS = ["Ótimo", "Bom", "Regular"];

export function BestTimeToPost({ media, niche }: Props) {
  const real = useMemo(() => bestTimesFromMedia(media), [media]);
  const dados = real ?? bestTimes("instagram", niche);

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
          <Clock className="h-4 w-4 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h3 className="text-sm font-display font-semibold text-foreground">Melhores horários</h3>
          <p className="text-[11px] text-muted-foreground font-body">
            {real ? `Pelo desempenho de ${real.sample} posts seus no Instagram` : "Sugestão pro seu nicho no Instagram BR"}
          </p>
        </div>
      </div>

      <p className="text-xs font-body text-muted-foreground mb-2.5">
        Dias: <b className="text-foreground">{dados.days}</b>
      </p>
      <div className="space-y-2.5">
        {dados.slots.slice(0, 3).map((hora, i) => (
          <div key={`${hora}-${i}`} className="flex items-center gap-3">
            <div className={cn("w-2 h-2 rounded-full", i === 0 ? "bg-emerald-500" : i === 1 ? "bg-amber-500" : "bg-muted-foreground/40")} />
            <span className="text-sm font-body font-semibold text-foreground w-12">{hora}</span>
            {real && (
              <span className={cn(
                "text-[11px] font-body font-semibold px-1.5 py-0.5 rounded-full",
                i === 0 ? "bg-emerald-50 text-emerald-700" : i === 1 ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground",
              )}>
                {ROTULOS[i]}
              </span>
            )}
          </div>
        ))}
      </div>

      {!real && (
        <p className="text-[11px] text-muted-foreground font-body mt-3">
          Com uns 6 posts publicados (e o Instagram conectado), o Cria passa a usar o horário em que os SEUS posts rendem mais.
        </p>
      )}
    </div>
  );
}
