import { useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   CALENDÁRIO DO MÊS NO CELULAR, ESTILO IPHONE (Walter, 05/11/2026; mockup
   aprovado na Agenda). O mês com bolinhas por dia; tocou no dia, a semana
   fica no topo (arrasta pros lados pra trocar de semana) e a lista daquele
   dia embaixo. Genérico: quem chama diz os dias da grade, as cores de cada
   dia e desenha a lista do dia.
   ═══════════════════════════════════════════════════════════════════════════ */

const LETRAS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function CalendarioMesCelular({ dias, mes, hoje, coresDe, conteudoDoDia, totalDe, aoAdicionar, className }: {
  /** Dias da grade em "YYYY-MM-DD", começando no domingo, em semanas completas. */
  dias: string[];
  /** Mês exibido (0-11): os dias de fora ficam apagados. */
  mes: number;
  hoje: string;
  coresDe: (dia: string) => string[];
  totalDe: (dia: string) => number;
  conteudoDoDia: (dia: string) => ReactNode;
  aoAdicionar?: (dia: string) => void;
  className?: string;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const ativo = sel && dias.includes(sel) ? sel : null;
  const mesNome = new Date(`${dias[Math.min(10, dias.length - 1)]}T12:00:00`).toLocaleDateString("pt-BR", { month: "long" });
  const bolinhas = (dia: string) => (
    <span className="flex items-center justify-center gap-[3px] h-1.5">
      {coresDe(dia).slice(0, 4).map((c, i) => <i key={`${c}${i}`} className="block h-1.5 w-1.5 rounded-full" style={{ background: c }} />)}
    </span>
  );

  if (!ativo) {
    return (
      <div className={cn("overflow-x-clip", className)}>
        <div className="grid grid-cols-7 mb-1">
          {LETRAS.map((l, i) => <p key={i} className="text-[10.5px] font-body font-semibold text-muted-foreground text-center">{l}</p>)}
        </div>
        <div className="grid grid-cols-7">
          {dias.map((dia) => {
            const d = new Date(`${dia}T12:00:00`);
            const fora = d.getMonth() !== mes;
            return (
              <button key={dia} type="button" onClick={() => setSel(dia)}
                className={cn("min-w-0 flex flex-col items-center gap-1 border-t border-border pt-1.5 pb-2", fora && "opacity-35")}>
                <span className={cn("grid place-items-center h-8 w-8 rounded-full text-[15px] font-body",
                  dia === hoje ? "bg-primary text-primary-foreground font-bold" : "text-foreground")}>{d.getDate()}</span>
                {bolinhas(dia)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const idx = dias.indexOf(ativo);
  const ini = Math.floor(idx / 7) * 7;
  const semana = dias.slice(ini, ini + 7);
  let x0: number | null = null;
  const pular = (n: number) => { const alvo = idx + n; if (alvo >= 0 && alvo < dias.length) setSel(dias[alvo]); };
  const d = new Date(`${ativo}T12:00:00`);
  const total = totalDe(ativo);
  return (
    <div className={cn("overflow-x-clip", className)}>
      <div className="mb-2">
        <button type="button" onClick={() => setSel(null)}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-[13px] font-body font-semibold capitalize">
          <ChevronLeft className="h-4 w-4" /> {mesNome}
        </button>
      </div>
      <div className="grid grid-cols-7 border-b border-border pb-2 mb-1 touch-pan-y"
        onTouchStart={(e) => { x0 = e.touches[0].clientX; }}
        onTouchEnd={(e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) pular(dx < 0 ? 7 : -7); x0 = null; }}>
        {semana.map((dia, i) => {
          const sd = new Date(`${dia}T12:00:00`);
          const s = dia === ativo; const h = dia === hoje;
          return (
            <button key={dia} type="button" onClick={() => setSel(dia)} className="min-w-0 flex flex-col items-center gap-1">
              <span className="text-[10.5px] font-body font-semibold text-muted-foreground">{LETRAS[i]}</span>
              <span className={cn("grid place-items-center h-9 w-9 rounded-full text-[16px] font-body",
                s && h ? "bg-primary text-primary-foreground font-bold" : s ? "bg-foreground text-background font-bold" : h ? "text-primary font-bold" : "text-foreground")}>
                {sd.getDate()}
              </span>
              {bolinhas(dia)}
            </button>
          );
        })}
      </div>
      <div className="flex items-baseline gap-2 px-0.5 pt-2 pb-2">
        <p className="font-display font-bold text-[15px] capitalize">{d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" }).replace(".", "")}</p>
        {ativo === hoje && <span className="text-[12px] font-body text-primary font-semibold">hoje</span>}
        <span className="ml-auto text-[12px] font-body text-muted-foreground">{total} {total === 1 ? "item" : "itens"}</span>
      </div>
      {total === 0 ? (
        <div className="text-center text-[13px] font-body text-muted-foreground py-8">
          Nada marcado neste dia.
          {aoAdicionar && <button type="button" onClick={() => aoAdicionar(ativo)} className="block mx-auto mt-2 text-primary font-semibold">+ Adicionar</button>}
        </div>
      ) : conteudoDoDia(ativo)}
    </div>
  );
}
