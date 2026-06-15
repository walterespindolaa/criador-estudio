export function CoverHeader({ label, title, count, from, to }:{ label?:string; title:string; count?:number; from:string; to:string }) {
  return (
    <div className="relative overflow-hidden rounded-[18px] px-5 pt-7 pb-8 shadow-warm-lg"
         style={{ background:`linear-gradient(140deg, ${from}, ${to})` }}>
      <div className="absolute inset-0" style={{ background:'radial-gradient(80% 60% at 78% 8%, rgba(255,255,255,.22), transparent 55%)' }} />
      {label && <span className="absolute top-3 left-4 text-[10px] font-bold tracking-[1.4px] uppercase text-white/75">{label}</span>}
      {count!=null && <span className="absolute top-3 right-4 text-[11px] font-bold text-white/90 bg-white/15 px-2 py-0.5 rounded-full">{count}</span>}
      <h2 className="relative mt-3 font-display italic font-light text-[2.4rem] leading-[0.96] tracking-tight text-white/95"
          style={{ textShadow:'0 2px 18px rgba(0,0,0,.18)' }}>{title}</h2>
    </div>
  );
}
