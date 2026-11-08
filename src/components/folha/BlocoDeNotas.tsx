import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO DE NOTAS (Walter, 07/11/2026, mockup aprovado)

   A casca das janelas "Nova ideia" e "Nova tarefa": um bloco de notas aberto,
   com o mesmo papel, pauta e margem vermelha da folha da aba Ideias.
   Computador: espiral em cima, capa preta atrás, fita colorida.
   Celular: vira gaveta que sobe de baixo, com alça e os furos do bloco.
   Borda de 2px e sombra de 2px (sombra mais fina, pedido de 07/11).
   ═══════════════════════════════════════════════════════════════════════════ */

export const TINTA = "#1D1B18";
export const PAPEL = "#FFFCF3";
const PAUTA = "rgba(201,182,150,.4)";
const MARGEM = "#F3B7B0";
/** Letra de mão. A Caveat não está carregada no index.html: cai na Grand Hotel (carregada). */
export const MAO: React.CSSProperties = { fontFamily: "Caveat, 'Grand Hotel', cursive" };
/** Altura de uma linha da pauta. Tudo que é linha dentro da folha usa isso. */
export const LINHA = 32;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Emoji ou ícone pequeno dentro da bolinha do cabeçalho. */
  icone: React.ReactNode;
  corIcone?: string;
  rotulo: string;
  /** Cor da fita colada no canto (computador). */
  fita?: string;
  /** Título pra leitor de tela. */
  tituloAcessivel: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
};

export function BlocoDeNotas({
  open, onOpenChange, icone, corIcone = "#FFE36B", rotulo, fita = "rgba(255,119,185,.75)",
  tituloAcessivel, children, rodape,
}: Props) {
  const hoje = format(new Date(), "EEE, d MMM", { locale: ptBR }).replace(".", "");
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          // Mesmo cuidado do Dialog padrão: o teclado do celular não sobe sozinho.
          onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement)?.focus?.(); }}
          className={cn(
            "fixed z-50 outline-none",
            // celular: gaveta presa embaixo
            "inset-x-0 bottom-0 data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
            // computador: centralizado
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[600px] sm:max-w-[calc(100vw-2rem)] sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95",
          )}
        >
          <DialogPrimitive.Title className="sr-only">{tituloAcessivel}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{rotulo}</DialogPrimitive.Description>
          <div className="relative">
            {/* capa preta atrás */}
            <div aria-hidden className="hidden sm:block absolute left-2 -right-2 top-2 -bottom-2 rounded-[8px_22px_22px_22px]" style={{ background: TINTA }} />
            {/* fita */}
            <div aria-hidden className="hidden sm:block absolute -top-2.5 right-16 z-20 h-[30px] w-[120px] -rotate-6" style={{ background: fita }} />
            {/* espiral */}
            <div aria-hidden className="hidden sm:flex absolute -top-4 left-8 right-8 z-10 h-[34px] justify-between">
              {Array.from({ length: 15 }).map((_, i) => (
                <i key={i} className="block h-[34px] w-3 rounded-lg border-[3px] border-[#5b554c] border-b-transparent" />
              ))}
            </div>

            <div
              className={cn(
                "relative overflow-y-auto overscroll-contain border-2 text-[#1D1B18]",
                "[--mg:32px] sm:[--mg:40px]",
                "max-h-[88dvh] rounded-t-[22px] border-b-0 pl-[46px] pr-4 pt-9 pb-[max(1.25rem,env(safe-area-inset-bottom))]",
                "sm:max-h-[86vh] sm:rounded-[6px_20px_20px_20px] sm:border-b-2 sm:pl-[56px] sm:pr-6 sm:pt-10 sm:pb-5",
              )}
              style={{
                borderColor: TINTA,
                backgroundColor: PAPEL,
                backgroundImage: `linear-gradient(90deg, transparent var(--mg), ${MARGEM} var(--mg) calc(var(--mg) + 2px), transparent calc(var(--mg) + 2px)), repeating-linear-gradient(transparent 0 ${LINHA - 1}px, ${PAUTA} ${LINHA - 1}px ${LINHA}px)`,
                backgroundPosition: "0 0, 0 4px",
                backgroundAttachment: "local",
              }}
            >
              {/* celular: alça da gaveta e furos do bloco */}
              <div aria-hidden className="sm:hidden absolute left-1/2 top-2.5 h-[5px] w-11 -translate-x-1/2 rounded-full bg-[#d9cfbb]" />
              <div aria-hidden className="absolute left-6 right-6 top-5 flex justify-between sm:left-9 sm:right-9 sm:top-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <i key={i} className="block h-2.5 w-2.5 rounded-full border border-[#1D1B18]/35 bg-[#E9E1D0] sm:hidden" />
                ))}
              </div>
              <DialogPrimitive.Close
                className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border-2 bg-white text-[#1D1B18] hover:bg-[#F4EDDF] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{ borderColor: TINTA }}
              >
                <X className="h-3.5 w-3.5" strokeWidth={3} />
                <span className="sr-only">Fechar</span>
              </DialogPrimitive.Close>

              {/* cabeçalho: ícone, rótulo e a data escrita à mão */}
              <div className="flex h-8 items-center gap-2 pr-10">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[12px]" style={{ background: corIcone, borderColor: TINTA }}>{icone}</span>
                <span className="font-body text-[11.5px] font-bold uppercase tracking-[0.07em] text-[#7A7268]">{rotulo}</span>
                <span className="ml-auto text-[20px] leading-none text-[#0061EE]" style={MAO}>{hoje}</span>
              </div>

              {children}
              {rodape}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Linha da folha com o nome do campo escrito à mão. */
export function CampoDaFolha({ rotulo, children, className }: { rotulo: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2 py-[3px]", className)} style={{ minHeight: LINHA }}>
      <span className="w-[62px] shrink-0 pt-0.5 text-right text-[17px] leading-[26px] text-[#7A7268] sm:w-[78px] sm:text-[19px]" style={MAO}>{rotulo}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 pt-[2px]">{children}</div>
    </div>
  );
}

/** Etiqueta tracejada que pinta quando escolhida. */
export function Etiqueta({ ativa, cor, onClick, children, className }: {
  ativa: boolean; cor?: string; onClick: () => void; children: React.ReactNode; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className={cn(
        "inline-flex h-[24px] items-center gap-1 whitespace-nowrap rounded-[9px] px-2.5 font-body text-[12px] font-bold transition-colors",
        ativa ? "border-2 text-[#1D1B18] shadow-[0_2px_0_#1D1B18]" : "border-[1.5px] border-dashed border-[#b9b09a] bg-transparent text-[#7A7268] hover:text-[#1D1B18] hover:border-[#1D1B18]",
        className,
      )}
      style={ativa ? { background: cor ?? "#fff", borderColor: TINTA } : undefined}
    >
      {children}
    </button>
  );
}

/** Botões do rodapé da folha: borda de 2px e sombra de 2px. */
export function BotaoFolha({ tipo = "principal", className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tipo?: "principal" | "branco" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border-2 px-5 font-body text-[14px] font-extrabold shadow-[0_2px_0_#1D1B18] transition-transform active:translate-y-[1px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none",
        tipo === "principal" ? "bg-primary text-primary-foreground" : "bg-white text-[#1D1B18]",
        className,
      )}
      style={{ borderColor: TINTA, ...(props.style ?? {}) }}
    />
  );
}

/** Ctrl+Enter ou Cmd+Enter. */
export const ehSalvar = (e: React.KeyboardEvent) => e.key === "Enter" && (e.metaKey || e.ctrlKey);
