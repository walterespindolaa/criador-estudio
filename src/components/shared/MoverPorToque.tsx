import { useCallback, useRef, useState, type ReactNode } from "react";
import { Move, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   MOVER POR TOQUE (pente fino 23/09/2026)

   Os calendários remarcavam post/tarefa só por arraste HTML5 (`draggable`),
   que NÃO existe no toque: no celular a social mídia lia "arraste pra um
   dia" e nada acontecia. Este hook dá o mesmo poder em dois toques:

     1. toca na alça de mover do card (a bolinha com setas)
     2. toca no dia de destino

   O arraste com mouse continua igual; a alça só aparece em tela sem hover
   (celular e tablet), então no desktop nada muda visualmente.

   Uso:
     const mover = useMoverPorToque((id, dia) => onMove(id, dia));
     <AlcaMover mover={mover} id={p.id} />            // no card
     <div data-mover-destino={iso} onClick={() => mover.soltarEm(iso)} ...>  // célula do dia
     {mover.banner}                                   // uma vez, no topo
   ═══════════════════════════════════════════════════════════════════════════ */

/* ARRASTAR COM O DEDO (Walter, 26/11/2026: "não consigo mover o card pelo
   celular"). A alça tem cara de arrastar, e a pessoa segura e arrasta; só o
   toque-toque não respondia a isso. Agora a alça também arrasta: segura,
   leva até o dia (a célula acende) e solta. Toque rápido continua sendo o
   modo de dois toques. A célula de destino precisa de data-mover-destino. */
export function useMoverPorToque(aoMover?: (id: string, destino: string) => void, rotuloDestino = "o dia") {
  const [movendo, setMovendo] = useState<string | null>(null);
  const [arraste, setArraste] = useState<{ id: string; x: number; y: number } | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const aoMoverRef = useRef(aoMover);
  aoMoverRef.current = aoMover;

  const iniciar = useCallback((id: string) => setMovendo((m) => (m === id ? null : id)), []);
  const cancelar = useCallback(() => setMovendo(null), []);
  /** Chamado pela célula de destino. Devolve true se consumiu o toque. */
  const soltarEm = useCallback((destino: string) => {
    if (!movendo) return false;
    aoMoverRef.current?.(movendo, destino);
    setMovendo(null);
    return true;
  }, [movendo]);
  /** Fim do arraste com o dedo: solta no dia que estava embaixo. */
  const soltarArraste = useCallback((id: string, destino: string | null) => {
    setArraste(null); setSobre(null); setMovendo(null);
    if (destino) aoMoverRef.current?.(id, destino);
  }, []);

  /* O aviso fica preso no rodapé, acima da barra do app: preso no topo ele
     sumia atrás do cabeçalho fixo e parecia que nada tinha acontecido. */
  const banner: ReactNode = movendo && !arraste ? (
    <div role="status" className="fixed inset-x-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-50 flex items-center gap-2 rounded-xl border border-primary bg-primary text-primary-foreground px-3 py-2 shadow-md">
      <Move className="h-4 w-4 shrink-0" />
      <p className="text-sm font-body font-semibold flex-1">Agora toque em {rotuloDestino} de destino.</p>
      <button type="button" onClick={cancelar} aria-label="Cancelar mover" className="grid place-items-center h-9 w-9 rounded-lg hover:bg-white/15">
        <X className="h-4 w-4" />
      </button>
    </div>
  ) : arraste ? (
    <div aria-hidden className="pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-[130%] rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs font-body font-bold shadow-lg"
      style={{ left: arraste.x, top: arraste.y }}>
      {sobre ? "Solte aqui" : `Leve até ${rotuloDestino}`}
    </div>
  ) : null;

  return { movendo, iniciar, cancelar, soltarEm, banner, arraste, setArraste, sobre, setSobre, soltarArraste };
}

export type MoverPorToque = ReturnType<typeof useMoverPorToque>;

/** Primeiro ancestral que rola (o app rola um contêiner, não a janela). */
function quemRola(el: HTMLElement | null): HTMLElement | Window {
  for (let n = el?.parentElement; n; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight) return n;
  }
  return window;
}

function destinoEm(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  return el?.closest<HTMLElement>("[data-mover-destino]")?.dataset.moverDestino ?? null;
}

/** A alça no card. Só aparece onde não tem mouse (celular e tablet). */
export function AlcaMover({ mover, id, className }: { mover: MoverPorToque; id: string; className?: string }) {
  const ativo = mover.movendo === id || mover.arraste?.id === id;
  const inicio = useRef<{ x: number; y: number; arrastou: boolean; rola: HTMLElement | Window } | null>(null);
  const rolagem = useRef<number | null>(null);
  const pararRolagem = () => { if (rolagem.current) cancelAnimationFrame(rolagem.current); rolagem.current = null; };
  return (
    <button type="button"
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        inicio.current = { x: e.clientX, y: e.clientY, arrastou: false, rola: quemRola(e.currentTarget) };
      }}
      onPointerMove={(e) => {
        const i = inicio.current;
        if (!i) return;
        if (!i.arrastou && Math.hypot(e.clientX - i.x, e.clientY - i.y) < 8) return;
        i.arrastou = true;
        mover.setArraste({ id, x: e.clientX, y: e.clientY });
        mover.setSobre(destinoEm(e.clientX, e.clientY));
        // Perto da borda, rola sozinho pra alcançar a semana de cima ou de baixo.
        pararRolagem();
        const borda = 110;
        const passo = e.clientY < borda ? -14 : e.clientY > window.innerHeight - borda ? 14 : 0;
        if (passo) {
          const x = e.clientX, y = e.clientY;
          const rolar = () => {
            i.rola.scrollBy(0, passo);
            mover.setSobre(destinoEm(x, y));
            rolagem.current = requestAnimationFrame(rolar);
          };
          rolagem.current = requestAnimationFrame(rolar);
        }
      }}
      onPointerUp={(e) => {
        const i = inicio.current;
        inicio.current = null;
        pararRolagem();
        if (!i) return;
        if (i.arrastou) mover.soltarArraste(id, destinoEm(e.clientX, e.clientY));
        else mover.iniciar(id);
      }}
      onPointerCancel={() => { inicio.current = null; pararRolagem(); mover.soltarArraste(id, null); }}
      onClick={(e) => {
        e.stopPropagation(); e.preventDefault();
        // Teclado (sem ponteiro): o clique é o toque.
        if (e.detail === 0) mover.iniciar(id);
      }}
      aria-label={ativo ? "Cancelar mover" : "Mover para outro dia"}
      aria-pressed={ativo}
      style={{ touchAction: "none" }}
      className={cn(
        "hidden [@media(hover:none)]:grid place-items-center h-8 w-8 rounded-full border shrink-0 select-none",
        ativo ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border",
        className,
      )}>
      <Move className="h-3.5 w-3.5" />
    </button>
  );
}
