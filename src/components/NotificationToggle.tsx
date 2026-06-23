import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { pushSupported, isPushEnabled, enablePush, disablePush } from "@/lib/push";

export function NotificationToggle() {
  const { user } = useAuth();
  const [supported] = useState(() => pushSupported());
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { isPushEnabled().then(setEnabled); }, []);

  if (!supported) {
    return <p className="text-xs text-muted-foreground font-body">Seu navegador não suporta notificações push. No iPhone, instale o app na tela inicial primeiro.</p>;
  }

  const toggle = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        toast.success("Notificações desativadas.");
      } else {
        const r = await enablePush(user.id);
        if (r.ok) { setEnabled(true); toast.success("Notificações ativadas! Você receberá avisos no aparelho."); }
        else if (r.reason === "denied") toast.error("Permissão negada. Reative nas configurações do navegador/site.");
        else if (r.reason === "unsupported") toast.error("Navegador não suporta notificações.");
        else toast.error("Não foi possível ativar as notificações.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={enabled ? "outline" : "default"} onClick={toggle} disabled={loading} className="gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : enabled ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      {enabled ? "Desativar notificações" : "Ativar notificações"}
    </Button>
  );
}
