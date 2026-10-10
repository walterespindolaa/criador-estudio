import { useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   VER AS PEÇAS EM SEQUÊNCIA (Walter/Gabriela, 10/10/2026)

   "Quando a designer inclui as mídias e a social media clica, abre numa aba
   nova cada imagem individual e ela não consegue ver todas de uma vez tipo
   carrossel." Um carrossel de 5 slides virava 5 abas. Agora o clique abre
   aqui mesmo, por cima do card: seta na tela, seta do teclado (← →) ou
   deslizar no celular, até a última. Esc fecha e volta pro card.

   O arquivo original continua a um clique ("Abrir original"), pra quem
   precisa baixar ou ver em tamanho real.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PecaDaGaleria = { url: string | null; thumb: string | null; nome: string | null; tipo: string | null };

const EH_IMAGEM = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;
const EH_VIDEO = /\.(mp4|mov|webm|m4v)(\?.*)?$/i;

function comoMostrar(m: PecaDaGaleria): { tipo: "imagem" | "video" | "arquivo"; src: string } {
  const url = m.url ?? "";
  const thumb = m.thumb ?? "";
  if (/^video\//.test(m.tipo ?? "") || EH_VIDEO.test(url)) return { tipo: "video", src: url };
  // A imagem grande é o original quando ele é imagem de verdade; senão a miniatura.
  if (url && EH_IMAGEM.test(url)) return { tipo: "imagem", src: url };
  if (thumb) return { tipo: "imagem", src: thumb };
  if (/^image\//.test(m.tipo ?? "") && url) return { tipo: "imagem", src: url };
  return { tipo: "arquivo", src: url };
}

export function GaleriaDePecas({ pecas, indice, aoMudar, aoFechar }: {
  pecas: PecaDaGaleria[];
  /** null = fechada. */
  indice: number | null;
  aoMudar: (i: number) => void;
  aoFechar: () => void;
}) {
  const aberto = indice != null && pecas.length > 0;
  const atual = aberto ? Math.min(Math.max(indice, 0), pecas.length - 1) : 0;
  const total = pecas.length;

  const anterior = useCallback(() => { if (atual > 0) aoMudar(atual - 1); }, [atual, aoMudar]);
  const proxima = useCallback(() => { if (atual < total - 1) aoMudar(atual + 1); }, [atual, total, aoMudar]);

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); anterior(); }
      if (e.key === "ArrowRight") { e.preventDefault(); proxima(); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, anterior, proxima]);

  // Deslizar no celular: 40px pro lado já conta.
  const toqueX = useRef<number | null>(null);

  if (!aberto) return null;
  const m = pecas[atual];
  const { tipo, src } = comoMostrar(m);
  const original = m.url || m.thumb || "";

  const seta = "absolute top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-black shadow-lg transition hover:bg-white disabled:opacity-0 disabled:pointer-events-none";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) aoFechar(); }}>
      <DialogContent
        className="max-w-6xl w-[calc(100vw-1rem)] h-[calc(100dvh-var(--topo-app)-2rem)] sm:h-[90vh] p-0 gap-0 border-0 bg-[#141414] rounded-2xl overflow-hidden [&>button:last-child]:text-white [&>button:last-child]:hover:bg-white/10"
      >
        <DialogTitle className="sr-only">Peça {atual + 1} de {total}</DialogTitle>
        <div className="flex items-center gap-3 px-4 pr-14 h-14 shrink-0 text-white">
          <span className="text-[13px] font-body font-bold tabular-nums">{atual + 1} de {total}</span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-body text-white/70">{m.nome ?? ""}</span>
          {original && (
            <a href={original} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-body font-bold text-white/90 hover:bg-white/10">
              <ExternalLink className="h-3.5 w-3.5" /> Abrir original
            </a>
          )}
        </div>

        <div
          className="relative flex-1 min-h-0 flex items-center justify-center px-3 sm:px-16 pb-3"
          onTouchStart={(e) => { toqueX.current = e.touches[0]?.clientX ?? null; }}
          onTouchEnd={(e) => {
            const ini = toqueX.current; toqueX.current = null;
            const fim = e.changedTouches[0]?.clientX;
            if (ini == null || fim == null) return;
            if (fim - ini > 40) anterior();
            else if (ini - fim > 40) proxima();
          }}
        >
          {tipo === "imagem" ? (
            <img key={src} src={src} alt={m.nome ?? `Peça ${atual + 1}`}
              className="max-h-full max-w-full object-contain rounded-lg select-none" draggable={false} />
          ) : tipo === "video" ? (
            <video key={src} src={src} controls playsInline className="max-h-full max-w-full rounded-lg bg-black" />
          ) : (
            <div className="text-center text-white">
              <p className="text-sm font-body font-semibold">{m.nome || "Arquivo"}</p>
              <p className="text-[12px] font-body text-white/60 mt-1">Este arquivo não abre aqui. Use "Abrir original".</p>
            </div>
          )}

          <button type="button" aria-label="Peça anterior" onClick={anterior} disabled={atual === 0}
            className={cn(seta, "left-2 sm:left-4 hidden sm:grid")}>
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button type="button" aria-label="Próxima peça" onClick={proxima} disabled={atual === total - 1}
            className={cn(seta, "right-2 sm:right-4 hidden sm:grid")}>
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {total > 1 && (
          <div className="shrink-0 flex gap-1.5 overflow-x-auto px-4 pb-4 justify-start sm:justify-center">
            {pecas.map((p, i) => {
              const mini = p.thumb || p.url || "";
              const ehImg = !!mini && (/^image\//.test(p.tipo ?? "") || EH_IMAGEM.test(mini) || !!p.thumb);
              return (
                <button key={`${mini}-${i}`} type="button" onClick={() => aoMudar(i)}
                  aria-label={`Ver peça ${i + 1}`} aria-current={i === atual}
                  className={cn("h-14 w-14 shrink-0 rounded-md overflow-hidden border-2 transition",
                    i === atual ? "border-white" : "border-transparent opacity-60 hover:opacity-100")}>
                  {ehImg
                    ? <img src={mini} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <span className="h-full w-full grid place-items-center bg-white/10 text-[10px] font-body font-bold text-white">{i + 1}</span>}
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
