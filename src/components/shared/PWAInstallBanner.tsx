import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Don't show in standalone mode or if dismissed
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (isStandalone || dismissed) return;

    // Don't show in iframes (Lovable preview)
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
    <div className="bg-primary/5 border-b border-primary/10 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 text-primary" />
        <span className="text-sm font-body text-foreground">Instale o Criadores no seu celular</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="default" size="sm" className="h-7 text-xs" onClick={handleInstall}>
          Instalar
        </Button>
        <button onClick={handleDismiss} className="p-1 hover:bg-accent rounded">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
