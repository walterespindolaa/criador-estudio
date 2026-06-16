import { InfoTooltip } from "@/components/shared/InfoTooltip";

export function CoverHeader({ label, title, count, from, to, ink = "#fff", sub = "rgba(255,255,255,.78)", hint, compact }:{ label?:string; title:string; count?:number; from:string; to:string; ink?:string; sub?:string; hint?:string; compact?:boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-[18px] shadow-warm-lg ${compact ? "px-4 pt-6 pb-5" : "px-5 pt-7 pb-8"}`}
         style={{ background:`linear-gradient(140deg, ${from}, ${to})` }}>
      <div className="absolute inset-0" style={{ background:'radial-gradient(80% 60% at 78% 8%, rgba(255,255,255,.22), transparent 55%)' }} />
      {label && <span className="absolute top-3 left-4 text-[10px] font-bold tracking-[1.4px] uppercase" style={{ color: sub }}>{label}</span>}
      {count!=null && <span className="absolute top-3 right-4 text-[11px] font-bold bg-white/15 px-2 py-0.5 rounded-full" style={{ color: ink }}>{count}</span>}
      <div className="relative mt-3 flex items-end gap-1 min-w-0" style={{ ["--ch-ink" as string]: ink }}>
        <h2 className={`font-display italic font-light leading-[0.96] tracking-tight min-w-0 truncate ${compact ? "text-2xl" : "text-[2.4rem]"}`}
            style={{ textShadow:'0 2px 18px rgba(0,0,0,.18)', color: ink }}>{title}</h2>
        {hint && <InfoTooltip text={hint} side="bottom" className="!text-[color:var(--ch-ink)] opacity-75 hover:opacity-100 mb-1.5 shrink-0" />}
      </div>
    </div>
  );
}
