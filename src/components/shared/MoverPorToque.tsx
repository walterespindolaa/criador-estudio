import { useCallback, useState, type ReactNode } from "react";
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
     <div onClick={() => mover.soltarEm(iso)} ...>    // na célula do dia
     {mover.banner}                                   // uma vez, no topo
   ═══════════════════════════════════════════════════════════════════════════ */

export function useMoverPorToque(aoMover: (id: string, destino: string) => void, rotuloDestino = "o dia") {
  const [movendo, setMovendo] = useState<string | null>(null);

  const iniciar = useCallback((id: string) => setMovendo((m) => (m === id ? null : id)), []);
  const cancelar = useCallback(() => setMovendo(null), []);
  /** Chamado pela célula de destino. Devolve true se consumiu o toque. */
  const soltarEm = useCallback((destino: string) => {
    if (!movendo) return false;
    aoMover(movendo, destino);
    setMovendo(null);
    return true;
  }, [movendo, aoMover]);

  const banner: ReactNode = movendo ? (
    <div role="status" className="sticky top-2 z-30 mb-2 flex items-center gap-2 rounded-xl border border-primary bg-primary text-primary-foreground px-3 py-2 shadow-md">
      <Move className="h-4 w-4 shrink-0" />
      <p className="text-sm font-body font-semibold flex-1">Agora toque em {rotuloDestino} de destino.</p>
      <button type="button" onClick={cancelar} aria-label="Cancelar mover" className="grid place-items-center h-9 w-9 rounded-lg hover:bg-white/15">
        <X className="h-4 w-4" />
      </button>
    </div>
  ) : null;

  return { movendo, iniciar, cancelar, soltarEm, banner };
}

export type MoverPorToque = ReturnType<typeof useMoverPorToque>;

/** A alça no card. Só aparece onde não tem mouse (celular e tablet). */
export function AlcaMover({ mover, id, className }: { mover: MoverPorToque; id: string; className?: string }) {
  const ativo = mover.movendo === id;
  return (
    <button type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); mover.iniciar(id); }}
      aria-label={ativo ? "Cancelar mover" : "Mover para outro dia"}
      aria-pressed={ativo}
      className={cn(
        "hidden [@media(hover:none)]:grid place-items-center h-7 w-7 rounded-full border shrink-0",
        ativo ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border",
        className,
      )}>
      <Move className="h-3.5 w-3.5" />
    </button>
  );
}
