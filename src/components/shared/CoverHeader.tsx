export function CoverHeader({ label, title, count, from, to, ink = "#fff", sub = "rgba(255,255,255,.78)" }:{ label?:string; title:string; count?:number; from:string; to:string; ink?:string; sub?:string }) {
  return (
    <div className="relative overflow-hidden rounded-[18px] px-5 pt-7 pb-8 shadow-warm-lg"
         style={{ background:`linear-gradient(140deg, ${from}, ${to})` }}>
      <div className="absolute inset-0" style={{ background:'radial-gradient(80% 60% at 78% 8%, rgba(255,255,255,.22), transparent 55%)' }} />
      {label && <span className="absolute top-3 left-4 text-[10px] font-bold tracking-[1.4px] uppercase" style={{ color: sub }}>{label}</span>}
      {count!=null && <span className="absolute top-3 right-4 text-[11px] font-bold bg-white/15 px-2 py-0.5 rounded-full" style={{ color: ink }}>{count}</span>}
      <h2 className="relative mt-3 font-display italic font-light text-[2.4rem] leading-[0.96] tracking-tight"
          style={{ textShadow:'0 2px 18px rgba(0,0,0,.18)', color: ink }}>{title}</h2>
    </div>
  );
}
