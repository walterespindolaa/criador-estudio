import { useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   ATUALIZAÇÃO AUTOMÁTICA E SILENCIOSA

   Antes isto abria um card feio "Nova versão disponível / Atualizar" e ficava
   esperando a pessoa clicar. Ela não sabe o que é "versão", e o popup atrapalha.

   Agora é invisível: quando o service worker instala uma versão nova (ele já
   ativa sozinho, via skipWaiting no sw.js), a gente recarrega SÓ quando o app
   volta pro foco e não tem nada sendo digitado. Assim a pessoa nunca vê o
   processo e nunca perde o que estava escrevendo, ela só abre o app e ele já
   está atualizado.
   ═══════════════════════════════════════════════════════════════════════════ */
export function UpdatePrompt() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let novaVersaoPronta = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    // Nunca recarrega no meio de uma edição: se há um campo em foco (post,
    // legenda, comentário), esperamos. Perder texto pra "atualizar" é o pior
    // dos mundos.
    const podeRecarregar = () => {
      const el = document.activeElement;
      const digitando = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);
      return !digitando;
    };

    const recarregarSePuder = () => {
      if (!novaVersaoPronta) return;
      if (document.visibilityState !== "visible") return;
      if (!podeRecarregar()) return;
      novaVersaoPronta = false;
      window.location.reload();
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Procura versão nova de hora em hora e sempre que o app ganha foco.
        interval = setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            // Instalou uma versão nova por cima de uma que já rodava.
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              novaVersaoPronta = true;
              // Tenta na hora (se a pessoa não estiver digitando); senão espera o foco.
              recarregarSePuder();
            }
          });
        });
      })
      .catch(() => {});

    // Quando o app volta pro foco, aproveita pra checar update e aplicar o que já baixou.
    const onFocus = () => {
      navigator.serviceWorker.getRegistration().then((r) => r?.update().catch(() => {}));
      recarregarSePuder();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", recarregarSePuder);

    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", recarregarSePuder);
    };
  }, []);

  return null;
}
