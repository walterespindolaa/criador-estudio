import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   LINGUAGEM VISUAL DO INSIGHTS (mockup aprovado em 07/11/2026)

   Cards brancos com borda escura de 2px e sombra sólida de 2px (a sombra
   foi afinada a pedido do Walter: 4px deixava o ambiente pesado). Títulos de
   seção em Baloo grande com um subtítulo à mão em Caveat laranja.
   Usa a cor do texto (foreground) na borda e na sombra pra seguir o tema.
   ═══════════════════════════════════════════════════════════════════════════ */

export const CARD = "rounded-[20px] border border-foreground/15 bg-card shadow-[0_1px_3px_hsl(var(--foreground)/0.06)]";
export const CARD_VAZIO = "rounded-[20px] border border-dashed border-foreground/25 bg-card/60";
/** Caveat é a letra de mão do Cria. Sem a fonte carregada, cai pra cursiva do sistema. */
export const MAO: CSSProperties = { fontFamily: "Caveat, cursive", fontWeight: 700 };
/** Barra horizontal com contorno (cruzamentos, público). */
export const BARRA = "block h-full rounded-md border border-foreground/25";

export function SecaoTitulo({ id, titulo, mao, extra, className }: { id?: string; titulo: string; mao?: string; extra?: ReactNode; className?: string }) {
  return (
    <div id={id} className={cn("scroll-mt-32 md:scroll-mt-6 flex items-center gap-x-3 gap-y-1 flex-wrap mt-9 mb-3.5", className)}>
      <h2 className="font-display font-extrabold text-[21px] sm:text-2xl leading-none text-foreground">{titulo}</h2>
      {extra}
      {mao && <span className="text-[19px] sm:text-[21px] leading-none text-[#EA4918]" style={MAO}>{mao}</span>}
    </div>
  );
}

export function SeloIA() {
  return <span className="text-[10.5px] font-extrabold tracking-wide rounded-full px-2.5 py-0.5 bg-foreground text-[#FFCF03]">CRIA IA</span>;
}

/** Pílula de escolha (ordenar, janela, mostrar N). */
export function Pilula({ ativo, onClick, children, ...rest }: { ativo?: boolean; onClick?: () => void; children: ReactNode } & Record<string, unknown>) {
  return (
    <button type="button" onClick={onClick} {...rest}
      className={cn("h-8 px-3 rounded-full text-xs font-bold border border-foreground/25 whitespace-nowrap transition-colors",
        ativo ? "bg-foreground/10 text-foreground" : "bg-card text-foreground/70 hover:bg-muted")}>
      {children}
    </button>
  );
}
