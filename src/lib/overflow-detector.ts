/**
 * Diagnóstico DEV: varre o DOM e dá console.warn em todo elemento cujo
 * getBoundingClientRect().right ultrapasse a largura do <html>. Ajuda a
 * achar exatamente quem empurra o layout horizontal.
 *
 * Uso: chamar installOverflowDetector() uma vez no AppLayout — só roda
 * em import.meta.env.DEV; em produção é no-op.
 */

let installed = false;

export function installOverflowDetector(): void {
  if (!import.meta.env.DEV) return;
  if (installed) return;
  installed = true;

  const SLACK_PX = 0.5; // ignora ruído sub-pixel
  const HIGHLIGHT_LIMIT = 25; // não floodar o console

  const scan = () => {
    const docWidth = document.documentElement.clientWidth;
    const offenders: { el: Element; right: number; selector: string }[] = [];
    const all = document.body.getElementsByTagName("*");
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      const rect = el.getBoundingClientRect();
      if (rect.right - docWidth > SLACK_PX) {
        let selector = el.tagName.toLowerCase();
        if (el.id) selector += `#${el.id}`;
        const cls = (el as HTMLElement).className;
        if (typeof cls === "string" && cls.trim()) {
          selector += "." + cls.trim().split(/\s+/).slice(0, 3).join(".");
        }
        offenders.push({ el, right: rect.right, selector });
        if (offenders.length >= HIGHLIGHT_LIMIT) break;
      }
    }
    if (offenders.length === 0) return;
    // eslint-disable-next-line no-console
    console.warn(
      `[overflow] ${offenders.length} elemento(s) ultrapassam ${docWidth}px (mostrando até ${HIGHLIGHT_LIMIT}):`,
      offenders.map((o) => ({ selector: o.selector, right: Math.round(o.right), el: o.el })),
    );
  };

  // Roda no próximo frame pra dar tempo do React montar
  requestAnimationFrame(scan);

  // E em resize (debounce simples)
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener("resize", () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(scan, 200);
  });
}
