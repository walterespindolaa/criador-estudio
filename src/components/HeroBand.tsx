import { type ReactNode } from "react";
import { statusRamp } from "@/lib/statusRamp";
import { cn } from "@/lib/utils";

export function HeroBand({
  eyebrow,
  title,
  subtitle,
  avatar,
  actions,
  children,
  wideInset = false,
  meta,
  destaque = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  avatar?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  // Recuo maior à esquerda quando o menu lateral está fixado aberto (248px de
  // rail + folgas); o padrão continua sendo o rail de ícones (104px).
  wideInset?: boolean;
  /** Linha embaixo do título (ex: @handle + nicho no dashboard). */
  meta?: ReactNode;
  /** Dashboard (Walter, 19/10/2026, mockup aprovado): foto grande, nome maior,
   *  botões à direita alinhados embaixo e período numa pílula escura. */
  destaque?: boolean;
}) {
  const ramp = statusRamp();
  const grad = `linear-gradient(115deg, ${ramp["publicado"].from} 0%, ${ramp["gravando"].from} 100%)`;
  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-b-[26px] px-5 pt-3 pb-4 text-white shadow-[0_18px_50px_-24px_rgba(35,25,70,0.5)] md:px-8 md:transition-[padding-left] md:duration-200",
        wideInset ? "md:pl-[288px]" : "md:pl-[104px]",
      )}
      style={{ background: grad }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(60% 120% at 88% -10%, rgba(255,255,255,.18), transparent 60%)" }}
      />
      {/* Formas orgânicas da identidade CRIA, flutuam suave dentro da faixa */}
      <div aria-hidden className="cria-blob pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-[38%_62%_55%_45%/48%_42%_58%_52%] bg-[#FFCF03] opacity-70" />
      <div aria-hidden className="cria-blob cria-blob-slow pointer-events-none absolute -bottom-20 right-[18%] h-40 w-40 rounded-[55%_45%_40%_60%/50%_60%_40%_50%] bg-[#FF77B9] opacity-60" />
      <div aria-hidden className="cria-blob cria-blob-fast pointer-events-none absolute top-[26%] right-[40%] hidden h-10 w-10 rounded-full bg-[#FDFBF5] opacity-70 md:block" />
      <div aria-hidden className="cria-blob cria-blob-slow pointer-events-none absolute -bottom-14 left-[6%] hidden h-24 w-24 rounded-[45%_55%_60%_40%/55%_45%_55%_45%] bg-[#0061EE] opacity-40 md:block" />
      <div className="relative flex items-center justify-end gap-2">{children}</div>
      <div className={cn("relative mt-2 flex items-center gap-3", destaque && "flex-wrap items-end gap-x-5 gap-y-3")}>
        {avatar}
        <div className={cn("min-w-0", destaque && "self-center")}>
          {eyebrow && <p className="text-sm font-body text-white/75">{eyebrow}</p>}
          <h1 className={cn("font-display font-extrabold tracking-tight",
            destaque ? "text-3xl leading-none md:text-4xl" : "text-2xl md:text-3xl")}>{title}</h1>
          {subtitle && <p className="mt-1 text-sm font-body text-white/80">{subtitle}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-body text-white/85">{meta}</div>}
        </div>
        {actions && (
          <div className={cn("items-center gap-2",
            destaque ? "ml-auto flex flex-wrap" : "ml-3 hidden lg:flex")}>{actions}</div>
        )}
      </div>
      <div
        id="cria-hero-slot"
        className={cn(
          "relative mt-4 flex flex-wrap gap-1 empty:hidden",
          destaque ? "w-max max-w-full justify-start rounded-full bg-black/15 p-1" : "justify-end",
        )}
      />
    </header>
  );
}

export default HeroBand;
