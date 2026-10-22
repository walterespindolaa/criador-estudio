import { useContext, useEffect, useRef, useState } from "react";
import { EmPreviaContext } from "@/components/bio/SiteLoja";
import { escreverParcial, frear, partirNumero } from "@/lib/bioMovimento";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   MOVIMENTO DA PÁGINA (22/10/2026)

   Barra que enche e número que sobe quando a seção entra na tela. Três regras:
   · quem pediu "reduzir movimento" no celular vê o valor final, parado;
   · na prévia do editor e na miniatura do modelo também: ali é desenho;
   · o leitor de tela lê o número certo desde o começo, nunca o "0" do meio.
   ═══════════════════════════════════════════════════════════════════════════ */

export const querParado = () =>
  typeof window === "undefined" || !("IntersectionObserver" in window) ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Vira true uma vez, quando o elemento aparece. Não volta pra false. */
export function useAoAparecer<T extends Element>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const emPrevia = useContext(EmPreviaContext);
  const [visto, setVisto] = useState(() => emPrevia || querParado());
  useEffect(() => {
    if (visto) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { setVisto(true); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [visto]);
  return [ref, visto];
}

/** Número que sobe de 0 até o valor escrito. Texto sem número fica como está. */
export function Contador({ texto, className, duracao = 1100 }: { texto: string; className?: string; duracao?: number }) {
  const [ref, visto] = useAoAparecer<HTMLSpanElement>();
  const partes = partirNumero(texto);
  const emPrevia = useContext(EmPreviaContext);
  const animar = !!partes && partes.valor > 0 && !emPrevia && !querParado();
  const [atual, setAtual] = useState(() => (animar && partes ? escreverParcial(partes, 0) : texto));

  useEffect(() => {
    if (!animar || !partes) { setAtual(texto); return; }
    if (!visto) { setAtual(escreverParcial(partes, 0)); return; }
    let quadro = 0;
    const inicio = performance.now();
    const passo = (agora: number) => {
      const t = (agora - inicio) / duracao;
      setAtual(escreverParcial(partes, partes.valor * frear(t)));
      if (t < 1) quadro = requestAnimationFrame(passo);
      else setAtual(texto);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visto, texto, animar]);

  // Parado: um texto só. O par "lido/animado" só existe enquanto anima.
  if (!animar) return <span ref={ref} className={className}>{texto}</span>;
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      <span className="sr-only">{texto}</span>
      <span aria-hidden>{atual}</span>
    </span>
  );
}

/** Barra de porcentagem que enche ao aparecer. */
export function BarraQueEnche({ pct, cor, trilho, altura = 8, atraso = 0 }: {
  pct: number; cor: string; trilho: string; altura?: number; atraso?: number;
}) {
  const [ref, visto] = useAoAparecer<HTMLDivElement>();
  const valor = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const parado = querParado();
  return (
    <div ref={ref} className="w-full rounded-full overflow-hidden" style={{ height: altura, backgroundColor: trilho }}
      role="presentation">
      <div className="h-full rounded-full"
        style={{
          width: `${visto ? valor : 0}%`, backgroundColor: cor,
          transition: parado ? undefined : `width 1100ms cubic-bezier(.22,1,.36,1) ${atraso}ms`,
        }} />
    </div>
  );
}
