import { useCallback, useEffect, useRef } from "react";

/**
 * ROLAGEM DO KANBAN CLICANDO NO VAZIO.
 *
 * Hoje pra andar de lado no board a pessoa precisa achar a barrinha embaixo.
 * Aqui ela clica em qualquer espaço vazio do board (fundo da coluna, cabeçalho,
 * respiro entre cards) e arrasta o mouse: o board acompanha 1:1.
 *
 * O que este hook NÃO faz, de propósito:
 *
 * 1. TOQUE. No celular o dedo já rola nativamente. Mexer nisso foi exatamente o
 *    bug que quebrou a rolagem da Agenda (o `touch-action:none` global do
 *    `[data-rfd-drag-handle-draggable-id]` no index.css travava o pan). Por isso
 *    aqui só existe evento de MOUSE. Num tap o navegador emite mousedown/mouseup
 *    sintéticos sem movimento entre eles, então o limiar nunca é vencido e nada
 *    acontece.
 * 2. INÉRCIA. Rolagem 1:1 é previsível e não precisa respeitar
 *    `prefers-reduced-motion`. Se um dia entrar inércia, ela tem que ser
 *    desligada nessa preferência.
 * 3. ROUBAR O CLIQUE DO CARD. Se o mousedown nasceu dentro de um card, botão,
 *    link, campo de formulário ou punho de arraste do @hello-pangea/dnd, o hook
 *    passa reto. E nunca damos preventDefault no mousedown, então o dnd continua
 *    recebendo o evento igualzinho e o arraste de card entre colunas segue vivo.
 */

/**
 * Alvos onde o arrasto de rolagem não pode nascer.
 *
 * `[data-rfd-drag-handle-draggable-id]` é o punho do @hello-pangea/dnd: nos
 * boards do projeto ele costuma ser o card inteiro, então essa linha sozinha já
 * protege quase todo card. As demais cobrem card que é `<button>`, controles
 * dentro do card (o `<input type="date">` do Cria Post, selects, checkbox) e
 * cards que usam o drag nativo do HTML5.
 *
 * `[data-no-drag-scroll]` é a válvula de escape: marque qualquer elemento com
 * esse atributo pra ele ficar imune ao arrasto de rolagem.
 */
const SELETORES_IGNORADOS = [
  "[data-rfd-drag-handle-draggable-id]",
  "[data-rfd-draggable-id]",
  "[data-no-drag-scroll]",
  '[draggable="true"]',
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  '[role="button"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="slider"]',
  '[role="menuitem"]',
  '[contenteditable="true"]',
].join(", ");

/** Movimento mínimo pra virar arrasto. Abaixo disso é clique com tremida de mão. */
const LIMIAR_PX = 5;

export type DragScrollRef<T extends HTMLElement = HTMLDivElement> = (no: T | null) => void;

/**
 * Devolve um ref callback (identidade estável) pra pendurar no container que
 * rola na horizontal:
 *
 *   const boardRef = useDragScroll<HTMLDivElement>();
 *   <div ref={boardRef} className="flex overflow-x-auto ...">
 *
 * Se precisar juntar com outro ref, envolva num `useCallback` estável pra não
 * religar os listeners a cada render.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>(): DragScrollRef<T> {
  const noAtual = useRef<T | null>(null);
  const desligarAtual = useRef<(() => void) | null>(null);

  const ligar = useCallback((no: T) => {
    let arrastando = false;
    let venceuLimiar = false;
    let xInicial = 0;
    let yInicial = 0;
    let esquerdaInicial = 0;
    let topoInicial = 0;
    // Estilos que a gente mexe durante o arrasto e devolve no final.
    let comportamentoAntes = "";
    let snapAntes = "";
    let cursorCorpoAntes = "";
    let selecaoCorpoAntes = "";
    let limparClique: (() => void) | null = null;

    // `overflow: visible` transborda mas NÃO rola: mexer no scrollLeft ali não faz
    // nada. Sem essa checagem um kanban em grid (que estoura a largura mas não é
    // container de rolagem) ganharia mãozinha prometendo algo que não acontece.
    // `hidden` entra na lista porque rola por JS (é o caso de carrossel sem barra).
    // `visible` e `clip` ficam de fora: não rolam nem programaticamente.
    const ROLAVEIS = ["auto", "scroll", "hidden", "overlay"];
    const rolavel = (eixo: "overflowX" | "overflowY") =>
      ROLAVEIS.includes(window.getComputedStyle(no)[eixo]);
    const rolaHorizontal = () => rolavel("overflowX") && no.scrollWidth - no.clientWidth > 1;
    const rolaVertical = () => rolavel("overflowY") && no.scrollHeight - no.clientHeight > 1;
    const podeRolar = () => rolaHorizontal() || rolaVertical();

    // Mãozinha só onde realmente dá pra rolar. Coluna que não rola fica com o
    // cursor normal, senão a interface promete algo que não acontece.
    const atualizaCursor = () => {
      if (arrastando) return;
      no.style.cursor = podeRolar() ? "grab" : "";
    };

    /**
     * Depois de um arrasto de verdade o navegador ainda dispara o `click` no
     * elemento que estava embaixo do mouse, o que abriria o card. Aqui a gente
     * mata o PRÓXIMO clique, uma única vez, na fase de captura da window (roda
     * antes do listener raiz do React).
     */
    const cancelaProximoClique = () => {
      limparClique?.();
      const mata = (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        limparClique?.();
      };
      const limpa = () => {
        window.removeEventListener("click", mata, true);
        window.clearTimeout(temporizador);
        limparClique = null;
      };
      // Se o mouse for solto fora da janela o `click` nem chega: o timeout
      // garante que o listener não fique de tocaia esperando o clique seguinte.
      const temporizador = window.setTimeout(limpa, 0);
      limparClique = limpa;
      window.addEventListener("click", mata, true);
    };

    const finaliza = (houveArrasto: boolean) => {
      if (!arrastando) return;
      arrastando = false;
      window.removeEventListener("mousemove", aoMover, true);
      window.removeEventListener("mouseup", aoSoltar, true);
      window.removeEventListener("blur", aoPerderFoco);
      if (venceuLimiar) {
        no.style.scrollBehavior = comportamentoAntes;
        no.style.scrollSnapType = snapAntes;
        document.body.style.cursor = cursorCorpoAntes;
        document.body.style.userSelect = selecaoCorpoAntes;
      }
      venceuLimiar = false;
      atualizaCursor();
      if (houveArrasto) cancelaProximoClique();
    };

    const aoMover = (e: MouseEvent) => {
      if (!arrastando) return;
      // Botão solto fora da janela: não chega mouseup, mas o próximo mousemove
      // volta com buttons = 0 e a gente encerra sem cancelar clique nenhum.
      if (e.buttons === 0) {
        finaliza(venceuLimiar);
        return;
      }
      const dx = e.clientX - xInicial;
      const dy = e.clientY - yInicial;
      if (!venceuLimiar) {
        if (Math.abs(dx) < LIMIAR_PX && Math.abs(dy) < LIMIAR_PX) return;
        venceuLimiar = true;
        comportamentoAntes = no.style.scrollBehavior;
        snapAntes = no.style.scrollSnapType;
        cursorCorpoAntes = document.body.style.cursor;
        selecaoCorpoAntes = document.body.style.userSelect;
        // `scroll-smooth` e `snap-mandatory` (Agenda, Criando) brigam com o
        // scrollLeft escrito a cada mousemove: um atrasa, o outro puxa de volta.
        // Desligamos durante o arrasto e devolvemos no final, então o snap
        // acontece de novo quando a pessoa solta.
        no.style.scrollBehavior = "auto";
        no.style.scrollSnapType = "none";
        no.style.cursor = "grabbing";
        // No corpo pra continuar "grabbing" mesmo com o mouse fora do board.
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
        window.getSelection()?.removeAllRanges();
      }
      e.preventDefault();
      no.scrollLeft = esquerdaInicial - dx;
      no.scrollTop = topoInicial - dy;
    };

    const aoSoltar = () => finaliza(venceuLimiar);
    const aoPerderFoco = () => finaliza(false);

    const aoDescer = (e: MouseEvent) => {
      // Só botão esquerdo. Meio (auto-scroll do navegador) e direito (menu de
      // contexto) passam batido. Com modificador também não: é seleção/atalho.
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (arrastando) return;
      if (!podeRolar()) return;
      const alvo = e.target;
      if (!(alvo instanceof Element)) return;
      const bloqueio = alvo.closest(SELETORES_IGNORADOS);
      // `closest` sobe até a raiz: só vale o que está DENTRO do board (o próprio
      // container não conta, senão um board dentro de um `<a>` nunca rolaria).
      if (bloqueio && bloqueio !== no && no.contains(bloqueio)) return;

      arrastando = true;
      venceuLimiar = false;
      xInicial = e.clientX;
      yInicial = e.clientY;
      esquerdaInicial = no.scrollLeft;
      topoInicial = no.scrollTop;
      window.addEventListener("mousemove", aoMover, true);
      window.addEventListener("mouseup", aoSoltar, true);
      window.addEventListener("blur", aoPerderFoco);
    };

    // Captura pra receber o mousedown mesmo se algum filho parar a propagação.
    // Nunca damos preventDefault aqui, então o dnd recebe o evento normalmente.
    no.addEventListener("mousedown", aoDescer, true);
    no.addEventListener("mouseenter", atualizaCursor);

    // Redimensionou a janela/o board? A coluna pode ter deixado de rolar.
    let observador: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observador = new ResizeObserver(atualizaCursor);
      observador.observe(no);
      if (no.firstElementChild) observador.observe(no.firstElementChild);
    }
    atualizaCursor();

    return () => {
      finaliza(false);
      limparClique?.();
      observador?.disconnect();
      no.removeEventListener("mousedown", aoDescer, true);
      no.removeEventListener("mouseenter", atualizaCursor);
      no.style.cursor = "";
    };
  }, []);

  const ref = useCallback<DragScrollRef<T>>((no) => {
    if (noAtual.current === no) return;
    desligarAtual.current?.();
    desligarAtual.current = null;
    noAtual.current = no;
    if (no) desligarAtual.current = ligar(no);
  }, [ligar]);

  // Desmontou com o mouse ainda apertado, ou o container sumiu: limpa tudo.
  useEffect(() => () => {
    desligarAtual.current?.();
    desligarAtual.current = null;
    noAtual.current = null;
  }, []);

  return ref;
}
