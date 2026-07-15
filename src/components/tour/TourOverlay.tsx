/**
 * TourOverlay, spotlight + tooltip do tour guiado.
 * - step -1: card de abertura centrado (valueProp + benefícios)
 * - steps: recorte no elemento-alvo (box-shadow gigante) + card "passo X de N"
 * - Mobile: o card vira bottom-sheet; desktop: posiciona perto do alvo
 * - Sem observers contínuos: mede sob demanda (passo/resize/scroll com rAF)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TourConfig } from "@/lib/tours/registry";

type Rect = { top: number; left: number; width: number; height: number };

export function TourOverlay({
  tour, step, onNext, onPrev, onSkip,
}: {
  tour: TourConfig;
  step: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false); // alvo não existe: mostra o card centrado
  const elRef = useRef<Element | null>(null);
  const rafRef = useRef(0);
  const current = step >= 0 ? tour.steps[step] : null;
  const total = tour.steps.length;

  const measure = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 });
  }, []);

  // Encontra o alvo do passo e mede IMEDIATAMENTE, o spotlight desliza da posição
  // anterior pra nova (transição CSS) e o listener de scroll o mantém colado ao alvo
  // durante o smooth-scroll. Zero espera fixa = zero delay visual.
  useEffect(() => {
    if (!current) { setRect(null); setMissing(false); elRef.current = null; return; }
    let tries = 0;
    let cancelled = false;
    setMissing(false);
    const attach = (el: Element) => {
      elRef.current = el;
      measure();
      const r = el.getBoundingClientRect();
      const foraDeVista = r.top < 72 || r.bottom > window.innerHeight - 140;
      if (foraDeVista) el.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    // ABRIR O QUE ESCONDE O ALVO.
    // Muito passo apontava pra um elemento que vive atrás de uma aba fechada
    // (ex.: no mobile, as abas do post moram dentro de "Criar conteúdo").
    // Como o elemento não existia no DOM, o tour caía no modo "sem alvo" e
    // virava um texto solto, sem destacar nada. Agora ele CLICA no controle
    // que revela o alvo e só depois procura. Isso é o "direcionamento quebrado".
    let abriu = false;
    const find = () => {
      if (cancelled) return;
      const el = document.querySelector(current.target);
      if (el) { attach(el); return; }

      if (!abriu && current.openFirst) {
        const gatilho = document.querySelector<HTMLElement>(current.openFirst);
        if (gatilho) {
          abriu = true;
          gatilho.click();
          window.setTimeout(find, 120);   // dá um frame pro conteúdo montar
          return;
        }
      }

      if (tries++ < 80) window.setTimeout(find, 50); // até ~4s pra páginas lazy montarem
      else { setRect(null); setMissing(true); }      // sem alvo: card centrado, NUNCA fica mudo
    };
    find();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, tour.id]);

  // Reposiciona em resize/scroll enquanto o passo está ativo
  useEffect(() => {
    if (!current) return;
    const onMove = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      cancelAnimationFrame(rafRef.current);
    };
  }, [current, measure]);

  const askAI = () => {
    if (!current?.aiPrompt) return;
    window.dispatchEvent(new CustomEvent("cria-ai-open", { detail: { prompt: current.aiPrompt } }));
    onSkip();
  };

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  // Posição do card no desktop: abaixo do alvo se couber, senão acima
  const cardStyle: React.CSSProperties = {};
  if (!isMobile && rect) {
    const below = rect.top + rect.height + 16;
    const fitsBelow = below + 220 < window.innerHeight;
    cardStyle.top = fitsBelow ? below : undefined;
    cardStyle.bottom = fitsBelow ? undefined : window.innerHeight - rect.top + 16;
    cardStyle.left = Math.min(Math.max(16, rect.left), window.innerWidth - 396);
  }

  return createPortal(
    // pointer-events-auto explícito: dialogs modais (editor de post) põem
    // pointer-events:none no body e o tour precisa continuar clicável por cima.
    <div className="fixed inset-0 z-[200] pointer-events-none" role="dialog" aria-modal="true">
      {/* ===== Card de abertura ===== */}
      {step === -1 && (
        <div className="absolute inset-0 bg-[#0A0A0A]/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-4 pointer-events-auto">
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-3xl border-2 border-[#0A0A0A] bg-card p-6 sm:p-8 shadow-[0_10px_0_rgba(21,20,18,0.9)] overflow-hidden">
            <div aria-hidden className="cria-blob pointer-events-none absolute -top-14 -right-12 h-32 w-32 rounded-[38%_62%_55%_45%/48%_42%_58%_52%] bg-[#FFCF03] opacity-70" />
            <button onClick={onSkip} aria-label="Fechar" className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
            <p className="relative font-display text-2xl font-extrabold text-foreground">{tour.title}</p>
            <p className="relative mt-2 text-sm font-body text-muted-foreground leading-relaxed">{tour.valueProp}</p>
            <ul className="relative mt-4 space-y-2">
              {tour.benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm font-body text-foreground">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-black text-secondary-foreground">✓</span>
                  {b}
                </li>
              ))}
            </ul>
            <div className="relative mt-6 flex items-center gap-3">
              {total > 0 ? (
                <Button onClick={onNext} className="flex-1 h-12 rounded-full bg-primary text-primary-foreground font-display font-bold shadow-[0_4px_0_rgba(21,20,18,0.85)] hover:-translate-y-0.5 hover:shadow-[0_6px_0_rgba(21,20,18,0.85)] transition-all">
                  Me mostra como funciona
                </Button>
              ) : (
                <Button onClick={onNext} className="flex-1 h-12 rounded-full bg-primary text-primary-foreground font-display font-bold shadow-[0_4px_0_rgba(21,20,18,0.85)] hover:-translate-y-0.5 transition-all">
                  Entendi, bora!
                </Button>
              )}
              <button onClick={onSkip} className="text-sm font-body text-muted-foreground underline underline-offset-2 hover:text-foreground shrink-0">
                Pular por agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dim de segurança enquanto o alvo do passo ainda não foi medido (evita flash) */}
      {current && !rect && <div className="absolute inset-0 bg-[#0A0A0A]/55 pointer-events-auto" />}

      {/* ===== Spotlight + tooltip dos passos ===== */}
      {current && (rect || missing) && (
        <>
          {rect && (
            <div
              className="fixed rounded-xl transition-all duration-200 ease-out pointer-events-none will-change-[top,left,width,height]"
              style={{
                top: rect.top, left: rect.left, width: rect.width, height: rect.height,
                boxShadow: "0 0 0 9999px rgba(27,26,23,0.55)",
                border: "2px solid hsl(var(--primary))",
              }}
            />
          )}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className={
              missing
                ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] max-w-[92vw] rounded-2xl border-2 border-[#0A0A0A] bg-card p-5 shadow-[0_8px_0_rgba(21,20,18,0.9)] pointer-events-auto"
                : isMobile
                ? "fixed inset-x-0 bottom-0 rounded-t-3xl border-t-2 border-x-2 border-[#0A0A0A] bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pointer-events-auto"
                : "fixed w-[380px] rounded-2xl border-2 border-[#0A0A0A] bg-card p-5 shadow-[0_8px_0_rgba(21,20,18,0.9)] transition-[top,left,bottom] duration-200 ease-out pointer-events-auto"
            }
            style={missing || isMobile ? undefined : cardStyle}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Passo {step + 1} de {total}
              </span>
              <button onClick={onSkip} aria-label="Fechar tour" className="rounded-full p-1 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${((step + 1) / total) * 100}%` }} />
            </div>
            <p className="mt-3 font-display text-lg font-extrabold text-foreground">{current.title}</p>
            <p className="mt-1 text-sm font-body text-muted-foreground leading-relaxed">{current.body}</p>
            {current.aiPrompt && (
              <button
                onClick={askAI}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-primary/50 px-4 py-2.5 text-sm font-display font-bold text-primary hover:bg-primary/10 transition-colors"
              >
                <Sparkles className="h-4 w-4" /> Quer que a Cria IA faça por você?
              </button>
            )}
            <div className="mt-4 flex items-center gap-2">
              {step > -1 && (
                <button onClick={onPrev} className="rounded-full border-2 border-border px-4 py-2 text-sm font-display font-bold text-foreground hover:border-foreground transition-colors">
                  Voltar
                </button>
              )}
              <Button onClick={onNext} className="flex-1 h-11 rounded-full bg-primary text-primary-foreground font-display font-bold shadow-[0_4px_0_rgba(21,20,18,0.85)] hover:-translate-y-0.5 transition-all">
                {step >= total - 1 ? "Concluir ✓" : "Continuar"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
