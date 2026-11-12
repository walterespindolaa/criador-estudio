import { type ReactNode } from "react";
import { statusRamp } from "@/lib/statusRamp";
import { cn } from "@/lib/utils";

/* BARRA SUPERIOR DO CRIADOR (Walter, 08/11/2026, mockup aprovado "barra superior").
   Sai o bloco de cor escura com bolhas grandes; entra o papel creme com a cor
   do tema clarinha à esquerda, borda e sombra de 2px. A cor da conta continua
   mandando (--hero-bg na faixa suave, --primary no anel do avatar, no botão
   principal, na frase à mão e no ícone da página). A HeroBand antiga continua
   na área da social mídia (ManagerLayout), que não entrou nesta troca. */

const TINTA = "#1D1B18";

export function BarraSuperior({
  eyebrow,
  title,
  subtitle,
  avatar,
  actions,
  children,
  meta,
  destaque = false,
  topoEsquerda,
  icone,
  frase,
  recuo,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  avatar?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  /** Linha embaixo do título (ex: @handle + nicho no Início). */
  meta?: ReactNode;
  /** Início: avatar e nome maiores. */
  destaque?: boolean;
  /** Canto de cima à esquerda: data (Início) ou caminho Início › Página. */
  topoEsquerda?: ReactNode;
  /** Ícone da página interna (quadradinho na cor do tema). */
  icone?: ReactNode;
  /** Frase curta à mão (Caveat) ao lado do nome ou embaixo do título. */
  frase?: string;
  /** A barra passa por baixo do menu lateral: o conteúdo começa depois dele
   *  (12/11/2026: a foto e o nome ficavam escondidos atrás do menu). */
  recuo?: "menu" | "menu-fixado";
}) {
  const ramp = statusRamp();
  const grad = `linear-gradient(115deg, ${ramp["publicado"].from} 0%, ${ramp["gravando"].from} 100%)`;
  // Mesma conta do AppLayout (104px solto, 288px fixado), menos a folga e a borda da barra.
  const esq = cn("pl-[18px] md:transition-[padding-left] md:duration-200", recuo === "menu" && "md:pl-[86px]", recuo === "menu-fixado" && "md:pl-[270px]");
  return (
    <header
      className="relative overflow-hidden rounded-[22px] border-2 bg-[#FFFCF3] text-[#1D1B18]"
      style={{ borderColor: TINTA, boxShadow: `2px 2px 0 ${TINTA}` }}
    >
      {/* A cor do tema, clarinha, entrando pela esquerda. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.2]"
        style={{
          background: `var(--hero-bg, ${grad})`,
          WebkitMaskImage: "linear-gradient(100deg, #000 0%, #000 50%, transparent 100%)",
          maskImage: "linear-gradient(100deg, #000 0%, #000 50%, transparent 100%)",
        }}
      />
      {/* Bolhas pequenas, com contorno, longe da busca e dos ícones. */}
      <span aria-hidden className="pointer-events-none absolute -top-[60px] left-[31%] h-24 w-24 rounded-full border-2 bg-[#FFCF03]" style={{ borderColor: TINTA }} />
      {destaque && (
        <span aria-hidden className="pointer-events-none absolute -bottom-8 left-[40%] h-[52px] w-[52px] rounded-full border-2 bg-[#FF77B9]" style={{ borderColor: TINTA }} />
      )}
      <span aria-hidden className="pointer-events-none absolute left-[37%] top-[52px] h-3.5 w-3.5 rounded-full border-2 bg-primary" style={{ borderColor: TINTA }} />

      <div className={cn("relative flex items-center gap-3 pt-3 pr-3.5", esq)}>
        <div className="min-w-0 text-[12.5px] font-body text-[#7A7268]">{topoEsquerda}</div>
        <div className="ml-auto flex items-center gap-2">{children}</div>
      </div>

      <div className={cn("relative flex gap-4 pr-[18px] pb-4 pt-2.5", esq, destaque ? "items-end" : "items-center")}>
        {avatar}
        {!avatar && icone && (
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] border-2 bg-primary text-primary-foreground [&_svg]:h-6 [&_svg]:w-6"
            style={{ borderColor: TINTA, boxShadow: `2px 2px 0 ${TINTA}` }}
          >
            {icone}
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="text-[13px] font-body text-[#7A7268]">{eyebrow}</p>}
          {destaque ? (
            <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-display text-[34px] font-extrabold leading-none tracking-tight">
              {title}
              {frase && <span className="text-[22px] font-bold leading-none text-primary" style={{ fontFamily: "Caveat, cursive" }}>{frase}</span>}
            </h1>
          ) : (
            <>
              <h1 className="font-display text-[30px] font-extrabold leading-none tracking-tight">{title}</h1>
              {frase && <p className="mt-1 text-[20px] font-bold leading-tight text-primary" style={{ fontFamily: "Caveat, cursive" }}>{frase}</p>}
            </>
          )}
          {subtitle && <p className="mt-1 text-sm font-body text-[#7A7268]">{subtitle}</p>}
          {meta && <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px] font-body text-[#7A7268]">{meta}</div>}
        </div>
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div
        id="cria-hero-slot"
        className={cn("relative -mt-1 flex flex-wrap gap-1.5 pr-[18px] pb-4 empty:hidden", esq)}
      />
    </header>
  );
}

/** CARTÃO DO INÍCIO NO CELULAR. Desde 08/11/2026 o topo do celular do criador
 *  é um só (no AppLayout); no Início fica só este cartão menor com a saudação, na cor
 *  do tema clarinha, sem os botões (que viraram o + flutuante). */
export function CartaoInicioMobile({
  avatar, eyebrow, title, meta, actions, slotId, children,
}: {
  avatar?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  /** id do elemento vazio onde a página pode renderizar filtros (período). */
  slotId?: string;
  children?: ReactNode;
}) {
  const ramp = statusRamp();
  const grad = `linear-gradient(115deg, ${ramp["publicado"].from} 0%, ${ramp["gravando"].from} 100%)`;
  return (
    <section
      className="relative mx-3.5 mt-3.5 overflow-hidden rounded-[20px] border-2 bg-[#FFFCF3] p-3.5 text-[#1D1B18] md:hidden"
      style={{ borderColor: TINTA, boxShadow: `2px 2px 0 ${TINTA}` }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.22]" style={{ background: `var(--hero-bg, ${grad})` }} />
      <span aria-hidden className="pointer-events-none absolute -right-6 -top-[34px] h-20 w-20 rounded-full border-2 bg-[#FFCF03]" style={{ borderColor: TINTA }} />
      <span aria-hidden className="pointer-events-none absolute -bottom-[18px] right-14 h-9 w-9 rounded-full border-2 bg-[#FF77B9]" style={{ borderColor: TINTA }} />
      <div className="relative flex items-center gap-3">
        {avatar}
        <div className="min-w-0">
          {eyebrow && <p className="text-[13px] font-body text-[#7A7268]">{eyebrow}</p>}
          <h1 className="truncate font-display text-[28px] font-extrabold leading-none tracking-tight">{title}</h1>
          {meta && <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px] font-body text-[#7A7268]">{meta}</div>}
        </div>
      </div>
      {actions && <div className="relative mt-3.5 grid grid-cols-2 gap-2">{actions}</div>}
      {children}
      {slotId && (
        <div id={slotId} className="relative mt-3 flex w-max max-w-full flex-wrap gap-1 empty:hidden" />
      )}
    </section>
  );
}

