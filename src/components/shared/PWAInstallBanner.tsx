import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (isStandalone || dismissed) return;

    try {
      if (window.self !== window.top) return;
    } catch { return; }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShow(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("pwa-install-dismissed", "true");
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 md:bottom-6">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/95 px-3.5 py-2.5 shadow-xl backdrop-blur">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
          <span className="font-display text-lg font-extrabold leading-none">C</span>
        </div>
        <div className="min-w-0 pr-1">
          <p className="text-sm font-bold leading-tight text-foreground">Instalar o Cria</p>
          <p className="text-xs text-muted-foreground">Acesso rápido na sua tela inicial</p>
        </div>
        <Button
          size="sm"
          className="h-8 shrink-0 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-90"
          onClick={handleInstall}
        >
          Instalar
        </Button>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-opacity hover:opacity-70"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
