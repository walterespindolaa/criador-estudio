import { type ReactNode } from "react";
import { statusRamp } from "@/lib/statusRamp";

export function HeroBand({
  eyebrow,
  title,
  subtitle,
  avatar,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  avatar?: ReactNode;
  children?: ReactNode;
}) {
  const ramp = statusRamp();
  const grad = `linear-gradient(115deg, ${ramp["publicado"].from} 0%, ${ramp["gravando"].from} 100%)`;
  return (
    <header
      className="relative overflow-hidden rounded-b-[28px] px-6 pt-4 pb-6 text-white shadow-[0_18px_50px_-24px_rgba(35,25,70,0.5)] md:px-8"
      style={{ background: grad }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(60% 120% at 88% -10%, rgba(255,255,255,.18), transparent 60%)" }}
      />
      <div className="relative flex items-center justify-end gap-2">{children}</div>
      <div className="relative mt-3 flex items-center gap-3">
        {avatar}
        <div className="min-w-0">
          {eyebrow && <p className="text-sm font-body text-white/75">{eyebrow}</p>}
          <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm font-body text-white/80">{subtitle}</p>}
        </div>
      </div>
      <div id="cria-hero-slot" className="relative mt-4 flex flex-wrap justify-end gap-1 empty:hidden" />
    </header>
  );
}

export default HeroBand;
