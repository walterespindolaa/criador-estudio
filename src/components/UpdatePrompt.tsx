import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Detecta nova versão do app (via service worker) e oferece recarregar.
 * Funciona no PWA instalado (atalho do celular) e no navegador.
 */
export function UpdatePrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const hadController = !!navigator.serviceWorker.controller;
    let interval: ReturnType<typeof setInterval> | undefined;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // checa atualização de hora em hora (e ao focar a aba)
        interval = setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) setShow(true);
          });
        });
      })
      .catch(() => {});

    const onControllerChange = () => { if (hadController) setShow(true); };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const onFocus = () => navigator.serviceWorker.getRegistration().then((r) => r?.update().catch(() => {}));
    window.addEventListener("focus", onFocus);

    return () => {
      if (interval) clearInterval(interval);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed left-1/2 z-[100] -translate-x-1/2 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg"
      style={{ bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", maxWidth: "92vw" }}
    >
      <span className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <RefreshCw className="h-4 w-4 text-primary" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-display font-bold text-foreground leading-tight">Nova versão disponível</p>
        <p className="text-xs text-muted-foreground font-body">Atualize para pegar as novidades.</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="shrink-0 text-sm font-body font-semibold rounded-xl bg-primary text-primary-foreground px-3.5 py-2 hover:brightness-105 transition"
      >
        Atualizar
      </button>
    </div>
  );
}
