/* Peças visuais do Piloto: o mesmo cartão de borda 2px e sombra sólida 2px dos
   mockups aprovados em 07/11/2026, pílulas de filtro e o chip de variação. */
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export const TINTA = "#1D1B18";
export const MAO = { fontFamily: "Caveat, cursive" } as const;

export function Cartao({ children, className, cor }: { children: ReactNode; className?: string; cor?: string }) {
  return (
    <div
      className={cn("rounded-2xl border-2 p-4 min-w-0", className)}
      style={{ borderColor: TINTA, boxShadow: `2px 2px 0 ${TINTA}`, background: cor ?? "#fff" }}
    >
      {children}
    </div>
  );
}

export function TituloCartao({ children, direita }: { children: ReactNode; direita?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3 min-h-[24px]">
      <h4 className="font-display font-extrabold text-[16px] leading-tight">{children}</h4>
      {direita && <div className="ml-auto flex items-center gap-2">{direita}</div>}
    </div>
  );
}

export function Secao({ titulo, mao, direita }: { titulo: string; mao?: string; direita?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 flex-wrap mt-8 mb-3">
      <h3 className="font-display font-extrabold text-[22px] leading-none">{titulo}</h3>
      {mao && <span className="text-[20px] leading-none text-[#EA4918]" style={MAO}>{mao}</span>}
      {direita && <div className="ml-auto flex items-center gap-2">{direita}</div>}
    </div>
  );
}

export function Pilula({ ativo, onClick, children, disabled, title }: {
  ativo?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3 py-1 text-[12.5px] font-bold transition-colors",
        ativo ? "bg-[#1D1B18] text-white" : "bg-white text-[#1D1B18] hover:bg-[#F4EDDF]",
        disabled && "opacity-45 cursor-not-allowed hover:bg-white",
      )}
      style={{ borderColor: TINTA }}
    >
      {children}
    </button>
  );
}

export function BotaoAcao({ children, onClick, primario, disabled, title }: {
  children: ReactNode; onClick?: () => void; primario?: boolean; disabled?: boolean; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold",
        primario ? "bg-[#EA4918] text-white" : "bg-white text-[#1D1B18]",
        disabled && "opacity-45 cursor-not-allowed",
      )}
      style={{ borderColor: TINTA, boxShadow: disabled ? "none" : `0 2px 0 ${TINTA}` }}
    >
      {children}
    </button>
  );
}

export function ChipDelta({ d }: { d: { texto: string; sobe: boolean } | null }) {
  if (!d) return null;
  return (
    <span
      className={cn("inline-flex items-center rounded-full border-[1.5px] px-2 py-[1px] text-[11px] font-extrabold",
        d.sobe ? "bg-white text-[#1D1B18]" : "bg-[#1D1B18] text-white")}
      style={{ borderColor: TINTA }}
    >
      {d.sobe ? <ArrowUp className="h-3 w-3 mr-0.5" /> : <ArrowDown className="h-3 w-3 mr-0.5" />}{d.texto}
    </span>
  );
}

export function Etiqueta({ children, cor = "#FFE46B" }: { children: ReactNode; cor?: string }) {
  return (
    <span className="inline-flex items-center rounded-md border-[1.5px] px-1.5 py-[1px] text-[10px] font-extrabold uppercase tracking-wide"
      style={{ borderColor: TINTA, background: cor }}>
      {children}
    </span>
  );
}
