import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
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
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] md:bottom-6">
      <div className="flex items-center gap-3 bg-foreground text-background rounded-2xl px-4 py-3 shadow-xl border border-foreground/10">
        <Download className="h-4 w-4 shrink-0" />
        <span className="text-sm font-body font-medium whitespace-nowrap">
          Instalar app
        </span>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 text-xs bg-background text-foreground hover:bg-background/90 rounded-xl shrink-0"
          onClick={handleInstall}
        >
          Instalar
        </Button>
        <button
          onClick={handleDismiss}
          className="p-0.5 hover:opacity-70 transition-opacity rounded shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
