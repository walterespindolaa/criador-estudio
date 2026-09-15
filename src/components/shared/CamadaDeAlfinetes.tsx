import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   O ALFINETE NA ARTE

   O cliente escrevia "o logo ficou estranho" e o designer abria a arte tentando
   adivinhar: é o tamanho? a cor? a posição? o logo errado? Num carrossel de
   seis slides ele ainda tinha que descobrir de qual slide ela estava falando.
   Cada rodada dessas custa uma revisão inteira, e revisão de graça é o que come
   a margem de quem produz.

   Apontar resolve o que descrever não resolve.

   DUAS DECISÕES QUE VALEM A PENA REGISTRAR:

   1. FRAÇÃO, NÃO PIXEL. A posição é gravada de 0 a 1 sobre a largura e a
      altura. A mesma arte é vista no celular do cliente e no monitor do
      designer: pixel de um não é pixel do outro. Fração cai no mesmo lugar em
      qualquer tela.
   2. A BOLINHA TEM NÚMERO. Sem número, três alfinetes viram três pontos
      idênticos e a lista de comentários ao lado não casa com nada. Com número,
      o "2" da arte é o "2" do texto, e a conversa para de ser adivinhação.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Alfinete = {
  id: string;
  /** 0 a 1 sobre a largura. */
  x: number;
  /** 0 a 1 sobre a altura. */
  y: number;
  texto: string;
  /** Quem pôs: muda a cor e quem pode tirar. */
  deQuem: "cliente" | "equipe";
  /** Segundo do vídeo, quando a mídia é vídeo. */
  segundo?: number | null;
};

export function CamadaDeAlfinetes({
  alfinetes, aoFixar, aoAbrir, selecionado, modoApontar, children, className,
}: {
  alfinetes: Alfinete[];
  /** Recebe a posição em fração (0 a 1). Só é chamado no modo apontar. */
  aoFixar?: (x: number, y: number) => void;
  aoAbrir?: (id: string) => void;
  selecionado?: string | null;
  /** Ligado: o quadro vira alvo de clique e o cursor vira mira. */
  modoApontar?: boolean;
  /** A mídia (img, iframe, o que for). */
  children: ReactNode;
  className?: string;
}) {
  const quadro = useRef<HTMLDivElement>(null);

  const fixar = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!modoApontar || !aoFixar) return;
    const el = quadro.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    // Clamp: clique na borda arredonda pra fora e o alfinete sumiria do quadro.
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    aoFixar(Number(x.toFixed(4)), Number(y.toFixed(4)));
  };

  return (
    <div ref={quadro} onClick={fixar}
      className={cn("relative", modoApontar && "cursor-crosshair", className)}>
      {children}

      {/* Véu leve no modo apontar: sinaliza que o quadro virou alvo, sem
          esconder a arte que ela precisa enxergar pra apontar. */}
      {modoApontar && (
        <div className="absolute inset-0 bg-primary/10 ring-2 ring-inset ring-primary/40 pointer-events-none" />
      )}

      {alfinetes.map((a, i) => {
        const ativo = selecionado === a.id;
        return (
          <button
            key={a.id}
            type="button"
            title={a.texto}
            onClick={(e) => { e.stopPropagation(); aoAbrir?.(a.id); }}
            style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 h-7 w-7 rounded-full grid place-items-center",
              "text-[11px] font-display font-extrabold text-white shadow-md ring-2 ring-white transition-transform",
              "hover:scale-110 focus:outline-none focus:ring-4 focus:ring-white/70",
              ativo && "scale-110 ring-4",
              a.deQuem === "cliente" ? "bg-[#EA4918]" : "bg-[#7C90F0]",
            )}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

/** Segundo em mm:ss, pro alfinete de vídeo ("no 0:42 o corte fica seco"). */
export function segundoBonito(s: number | null | undefined) {
  if (s == null || !Number.isFinite(s)) return null;
  const inteiro = Math.max(0, Math.floor(s));
  return `${Math.floor(inteiro / 60)}:${String(inteiro % 60).padStart(2, "0")}`;
}
