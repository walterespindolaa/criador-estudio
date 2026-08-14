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

/** Folga do topo: cabe o header sticky do mobile. */
const FOLGA_TOPO = 72;
/** Folga de baixo: no mobile o card do tour é um bottom-sheet e come a tela. */
const folgaBase = () => (window.innerWidth < 640 ? Math.min(Math.round(window.innerHeight * 0.55), 480) + 24 : 160);
/** Caixa menor que isso não é alvo: é wrapper vazio, aba fechada ou display:none. */
const CAIXA_MINIMA = 8;

function caixaValida(r: DOMRect): boolean {
  return r.width >= CAIXA_MINIMA && r.height >= CAIXA_MINIMA;
}

/**
 * ACHAR O ELEMENTO QUE REALMENTE DÁ PRA RECORTAR.
 * O `data-tour` às vezes mora num wrapper que não desenha nada: um <div> em volta
 * de um componente que retornou null (o checklist "Primeiros passos" some quando
 * está completo) vira uma caixa de altura ZERO e largura cheia, e o spotlight
 * saía como uma faixa fina no topo, sobre nada.
 * Regra: caixa boa, usa. Caixa zerada, procura o primeiro filho que desenha algo.
 * Não achou, sobe até 3 pais, aceitando só pai de tamanho razoável (não adianta
 * recortar a página inteira). Nada disso? Devolve null e o card vai pro centro.
 */
function resolverAlvo(el: Element): Element | null {
  if (caixaValida(el.getBoundingClientRect())) return el;
  const filho = Array.from(el.querySelectorAll("*")).find(f => caixaValida(f.getBoundingClientRect()));
  if (filho) return filho;
  let pai = el.parentElement;
  for (let i = 0; pai && i < 3; i++, pai = pai.parentElement) {
    const pr = pai.getBoundingClientRect();
    if (caixaValida(pr) && pr.height <= window.innerHeight * 0.8) return pai;
  }
  return null;
}

/**
 * PRECISA ROLAR PRA ENXERGAR?
 * Antes a checagem era só vertical, e por isso a pílula "Assinatura" das
 * Configurações (que mora numa tira de abas com scroll HORIZONTAL) nunca era
 * trazida pra tela: metade dela ficava fora da borda direita, e a pílula "Conta",
 * mais pra direita ainda, não aparecia de jeito nenhum.
 * Agora olha os dois eixos, tanto contra a janela quanto contra cada container
 * rolável que esteja recortando o alvo.
 */
function precisaRolar(el: Element): boolean {
  const r = el.getBoundingClientRect();
  // Alvo maior que a tela (ex.: a tira inteira de abas) não cabe de jeito nenhum:
  // rolar só empurraria o começo dele pra fora sem ganhar nada.
  const cabeX = r.width <= window.innerWidth - 16;
  const cabeY = r.height <= window.innerHeight - FOLGA_TOPO - folgaBase();
  if (cabeY && (r.top < FOLGA_TOPO || r.bottom > window.innerHeight - folgaBase())) return true;
  if (cabeX && (r.left < 8 || r.right > window.innerWidth - 8)) return true;
  // Grande demais pra caber, mas TOTALMENTE fora da vista: rola mesmo assim,
  // senão o spotlight fica desenhado num pedaço de tela que ninguém enxerga.
  if (!cabeY && (r.bottom < FOLGA_TOPO || r.top > window.innerHeight - folgaBase())) return true;
  if (!cabeX && (r.right < 8 || r.left > window.innerWidth - 8)) return true;
  let pai = el.parentElement;
  while (pai && pai !== document.body) {
    const st = getComputedStyle(pai);
    const rolaX = cabeX && /(auto|scroll)/.test(st.overflowX) && pai.scrollWidth > pai.clientWidth + 1;
    const rolaY = cabeY && /(auto|scroll)/.test(st.overflowY) && pai.scrollHeight > pai.clientHeight + 1;
    if (rolaX || rolaY) {
      const pr = pai.getBoundingClientRect();
      if (rolaX && (r.left < pr.left - 1 || r.right > pr.right + 1)) return true;
      if (rolaY && (r.top < pr.top - 1 || r.bottom > pr.bottom + 1)) return true;
    }
    pai = pai.parentElement;
  }
  return false;
}

/** O alvo sobrou dentro da tela depois de rolar? (se não, não adianta recortar) */
function estaNaTela(r: DOMRect): boolean {
  const visivelX = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
  const visivelY = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
  if (visivelX <= 0 || visivelY <= 0) return false;
  return visivelX * visivelY >= r.width * r.height * 0.25;
}

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
  // Direção da navegação: se a pessoa voltou pra um passo condicional que sumiu,
  // pular pra FRENTE faria o botão Voltar parecer quebrado (o card ricocheteia).
  // Guardando a direção, o passo ausente é pulado pro mesmo lado que ela ia.
  const passoAnterior = useRef(step);
  const indoPraFrente = step >= passoAnterior.current;
  useEffect(() => { passoAnterior.current = step; }, [step]);

  // Mede e GRUDA NA TELA: o recorte nunca sai pela borda, senão vira meia moldura
  // cortada (era o que acontecia com a pílula "Assinatura" no celular).
  const measure = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let top = r.top - 6, left = r.left - 6, width = r.width + 12, height = r.height + 12;
    const limiteX = window.innerWidth - 4, limiteY = window.innerHeight - 4;
    if (left < 4) { width += left - 4; left = 4; }
    if (top < 4) { height += top - 4; top = 4; }
    if (left + width > limiteX) width = limiteX - left;
    if (top + height > limiteY) height = limiteY - top;
    if (width <= 0 || height <= 0) return; // fora da tela agora: mantém o último recorte
    setRect({ top, left, width, height });
  }, []);

  // Encontra o alvo do passo e mede IMEDIATAMENTE, o spotlight desliza da posição
  // anterior pra nova (transição CSS) e o listener de scroll o mantém colado ao alvo
  // durante o smooth-scroll. Zero espera fixa = zero delay visual.
  useEffect(() => {
    if (!current) { setRect(null); setMissing(false); elRef.current = null; return; }
    let tries = 0;
    let cancelled = false;
    let rafSettle = 0;
    setMissing(false);

    // Sem alvo utilizável: passo condicional sai do tour, o resto vira card centrado.
    const semAlvo = () => {
      elRef.current = null;
      if (current.skipIfMissing) { if (indoPraFrente) onNext(); else onPrev(); return; }
      setRect(null); setMissing(true);
    };

    /**
     * ESPERAR O LAYOUT PARAR ANTES DE CONFIAR NA MEDIDA.
     * Medir na hora e depender só do evento de scroll não bastava: banner que
     * carrega depois, imagem que entra, aba que monta, tudo isso EMPURRA a página
     * sem disparar scroll nenhum, e o recorte ficava parado num pedaço vazio acima
     * do alvo de verdade (era o caso das abas do Cria Stories). Aqui a gente
     * remede a cada frame até o retângulo repetir 5 vezes seguidas (ou estourar
     * 1,2s) e só então decide se o alvo presta.
     */
    const estabilizar = (el: Element) => {
      let ultimo = "";
      let iguais = 0;
      const inicio = performance.now();
      const tick = () => {
        if (cancelled || elRef.current !== el) return;
        measure();
        const r = el.getBoundingClientRect();
        const chave = `${Math.round(r.top)}:${Math.round(r.left)}:${Math.round(r.width)}:${Math.round(r.height)}`;
        iguais = chave === ultimo ? iguais + 1 : 0;
        ultimo = chave;
        if (iguais < 5 && performance.now() - inicio < 1200) { rafSettle = requestAnimationFrame(tick); return; }
        // Veredito final: caixa zerada ou fora da tela não vira spotlight.
        const fim = el.getBoundingClientRect();
        if (!caixaValida(fim) || !estaNaTela(fim)) semAlvo();
      };
      rafSettle = requestAnimationFrame(tick);
    };

    const attach = (el: Element) => {
      elRef.current = el;
      measure();
      if (precisaRolar(el)) {
        el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
        // No mobile o card é um bottom-sheet que come a metade de baixo: centraliza
        // o alvo na ÁREA VISÍVEL (entre o header e o sheet), não na janela inteira.
        if (window.innerWidth < 640) {
          window.setTimeout(() => {
            if (cancelled || elRef.current !== el) return;
            const r2 = el.getBoundingClientRect();
            const alvoY = FOLGA_TOPO + (window.innerHeight - FOLGA_TOPO - folgaBase()) / 2;
            const delta = r2.top + r2.height / 2 - alvoY;
            if (Math.abs(delta) > 24) window.scrollBy({ top: delta, behavior: "smooth" });
          }, 280);
        }
      }
      estabilizar(el);
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
      // "Existe no DOM" não basta: elemento dentro de aba fechada, ou wrapper de um
      // componente que não renderizou nada, tem caixa ZERO e não dá pra recortar.
      // Nesse caso a busca continua (e o openFirst ainda tem chance de abrir a aba).
      const bruto = document.querySelector(current.target);
      const el = bruto ? resolverAlvo(bruto) : null;
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

      // Passo condicional que já teve a aba aberta pelo openFirst e mesmo assim não
      // achou o alvo: ele não existe NESTE estado da tela (ex.: card do Kanban num
      // cliente que não usa o Cria). Espera curta e pula, em vez de segurar 4s e
      // mostrar um card explicando algo que não está na tela.
      const limite = current.skipIfMissing ? 16 : 80; // ~0,8s contra ~4s
      if (tries++ < limite) { window.setTimeout(find, 50); return; }
      semAlvo();                                     // sem alvo: card centrado, NUNCA fica mudo
    };
    find();
    return () => { cancelled = true; cancelAnimationFrame(rafSettle); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, tour.id]);

  // Reposiciona em resize/scroll enquanto o passo está ativo.
  // O ResizeObserver no <body> é o que salva do conteúdo que chega atrasado
  // (banner, imagem, lista) e empurra a página SEM disparar evento de scroll.
  useEffect(() => {
    if (!current) return;
    const onMove = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    const ro = new ResizeObserver(onMove);
    ro.observe(document.body);
    if (elRef.current) ro.observe(elRef.current);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [current, measure]);

  const askAI = () => {
    if (!current?.aiPrompt) return;
    window.dispatchEvent(new CustomEvent("cria-ai-open", { detail: { prompt: current.aiPrompt } }));
    onSkip();
  };

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  // Posição do card no desktop: vai pro lado com MAIS espaço e ganha um
  // max-height com rolagem interna. Antes um card longo estourava a janela e o
  // botão Continuar ficava cortado, travando o tour.
  const cardStyle: React.CSSProperties = {};
  if (!isMobile && rect) {
    const abaixo = window.innerHeight - (rect.top + rect.height + 16) - 12;
    const acima = rect.top - 16 - 12;
    if (abaixo >= acima) {
      cardStyle.top = rect.top + rect.height + 16;
      cardStyle.maxHeight = Math.max(200, abaixo);
    } else {
      cardStyle.bottom = window.innerHeight - rect.top + 16;
      cardStyle.maxHeight = Math.max(200, acima);
    }
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
                // max-h + scroll: rede de segurança pra passo de texto longo no
                // celular, que antes crescia até engolir a tela e tapar o spotlight.
                ? "fixed inset-x-0 bottom-0 max-h-[55vh] overflow-y-auto overscroll-contain rounded-t-3xl border-t-2 border-x-2 border-[#0A0A0A] bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pointer-events-auto"
                : "fixed w-[380px] overflow-y-auto overscroll-contain rounded-2xl border-2 border-[#0A0A0A] bg-card p-5 shadow-[0_8px_0_rgba(21,20,18,0.9)] transition-[top,left,bottom] duration-200 ease-out pointer-events-auto"
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
