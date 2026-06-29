import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { pushSupported, isPushEnabled, enablePush } from "@/lib/push";

const COUNT_KEY = "push_nudge_count";
const DISMISS_KEY = "push_nudge_dismissed";
const SESSION_KEY = "push_nudge_counted";
const MAX_SHOWS = 3;

/**
 * Banner discreto que aparece no topo do conteúdo nas 3 primeiras vezes que a
 * pessoa entra no app SEM ter ativado as notificações. Some quando ela ativa
 * ou fecha. Conta uma vez por sessão (não a cada re-render).
 */
export function NotificationNudge() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!pushSupported()) return;
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      if (await isPushEnabled()) return;

      let count = parseInt(localStorage.getItem(COUNT_KEY) || "0", 10);
      // conta só uma vez por sessão (aba aberta)
      if (!sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(SESSION_KEY, "1");
        count += 1;
        localStorage.setItem(COUNT_KEY, String(count));
      }
      if (count <= MAX_SHOWS && active) setShow(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  const activate = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const res = await enablePush(user.id);
      if (res.ok) {
        toast.success("Notificações ativadas! Você vai receber leads, aprovações e lembretes.");
        localStorage.setItem(DISMISS_KEY, "1");
        setShow(false);
      } else if (res.reason === "denied") {
        toast.error("Permissão negada. Ative as notificações nas configurações do navegador.");
      } else if (res.reason === "unsupported") {
        toast.error("Seu navegador não suporta notificações push.");
      } else if (res.reason === "sw_timeout") {
        toast.error("Demorou pra preparar as notificações. Recarregue a página e tente de novo.");
      } else {
        toast.error("Não foi possível ativar agora. Tente de novo.");
      }
    } catch (e) {
      console.error("activate push failed", e);
      toast.error("Não foi possível ativar as notificações.");
    } finally {
      setBusy(false);
    }
  };

  if (!show) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Bell className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-body font-semibold text-foreground">Ative as notificações</p>
        <p className="text-xs font-body text-muted-foreground">
          Receba leads, aprovações de cliente e lembretes direto no seu aparelho.
        </p>
      </div>
      <button
        type="button"
        onClick={activate}
        disabled={busy}
        className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Ativando…" : "Ativar"}
      </button>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-lg p-1 text-muted-foreground/60 transition hover:text-foreground"
        aria-label="Dispensar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
