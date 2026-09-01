import { InfoTooltip } from "@/components/shared/InfoTooltip";

export function CoverHeader({ label, title, count, from, to, ink = "#fff", sub = "rgba(255,255,255,.78)", hint, compact }:{ label?:string; title:string; count?:number; from:string; to:string; ink?:string; sub?:string; hint?:string; compact?:boolean }) {
  return (
    /* compact ENCOLHEU de verdade (Walter, 31/08: "tá tudo muito grande"):
       menos padding, título menor e eyebrow colado, pro banner do kanban
       parar de comer a tela sem perder a capa personalizada. */
    <div className={`relative overflow-hidden rounded-[18px] shadow-warm-lg ${compact ? "px-3.5 pt-2.5 pb-3" : "px-5 pt-7 pb-8"}`}
         style={{ background:`linear-gradient(140deg, ${from}, ${to})`, ["--ch-ink" as string]: ink }}>
      <div className="absolute inset-0" style={{ background:'radial-gradient(80% 60% at 78% 8%, rgba(255,255,255,.22), transparent 55%)' }} />
      {label && (
        <span className={`${compact ? "relative" : "absolute top-3 left-4"} flex items-center gap-1 text-[9px] font-bold tracking-[1.4px] uppercase`} style={{ color: sub }}>
          {label}
          {hint && <InfoTooltip text={hint} side="bottom" className="!text-[color:var(--ch-ink)] opacity-70 hover:opacity-100" />}
        </span>
      )}
      {count!=null && <span className={`absolute right-3.5 text-[11px] font-bold bg-white/15 px-2 py-0.5 rounded-full ${compact ? "top-2" : "top-3"}`} style={{ color: ink }}>{count}</span>}
      <div className={`relative flex items-end ${compact ? "mt-0.5" : "mt-3"}`} style={{ ["--ch-ink" as string]: ink }}>
        {/* SEM itálico (Walter, 01/09) e um peso acima, senão o light reto some.
            line-clamp: título longo quebra em 2 linhas em vez de ser cortado. */}
        <h2 className={`font-display font-semibold leading-[1.08] tracking-tight min-w-0 line-clamp-2 break-words pr-1 pb-0.5 ${compact ? "text-[17px]" : "text-[2.4rem]"}`}
            style={{ textShadow:'0 2px 18px rgba(0,0,0,.18)', color: ink }}>{title}</h2>
      </div>
    </div>
  );
}
