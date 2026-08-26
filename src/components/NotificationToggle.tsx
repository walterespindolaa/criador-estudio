import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Send, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { pushSupported, isPushEnabled, enablePush, disablePush } from "@/lib/push";
import { estaInstalado, ehIOS } from "@/lib/pwa";

/* ═══════════════════════════════════════════════════════════════════════════
   LIGAR E TESTAR AS NOTIFICAÇÕES

   Notificação que não chega é o problema mais frustrante que existe: não tem
   erro na tela, não tem log, não tem nada. A pessoa aperta "ativar", vê
   "ativadas!", e simplesmente nunca recebe. Do lado de cá, tudo parece certo.

   A cadeia tem cinco elos (app instalado, permissão do sistema, inscrição
   gravada, chaves do servidor, entrega da Apple/Google) e QUALQUER um deles
   quebra do mesmo jeito silencioso. Por isso aqui não tem só o interruptor:
   tem um botão de teste que percorre a cadeia inteira e diz, em português,
   onde ela parou.
   ═══════════════════════════════════════════════════════════════════════════ */

export function NotificationToggle() {
  const { user } = useAuth();
  const [supported] = useState(() => pushSupported());
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testando, setTestando] = useState(false);
  const [diagnostico, setDiagnostico] = useState<string | null>(null);

  useEffect(() => { void isPushEnabled().then(setEnabled); }, []);

  /* No iPhone, notificação SÓ funciona com o app na tela de início. É regra da
     Apple, não escolha nossa, e é o motivo número um de "ativei e não chega":
     a pessoa testa no Safari em aba, onde nunca vai chegar. Dizer isso antes
     evita a pessoa concluir que o produto é quebrado. */
  const iphoneNaAba = ehIOS() && !estaInstalado();

  if (iphoneNaAba) {
    return (
      <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4">
        <div className="flex items-start gap-2.5">
          <Smartphone className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[13.5px] font-display font-bold text-amber-900">Instale o app antes de ligar os avisos</p>
            <p className="text-[12.5px] font-body text-amber-800/90 leading-relaxed mt-1">
              No iPhone a Apple só entrega notificação pra app instalado na tela de início. Toque em Compartilhar,
              o quadradinho com a seta pra cima, e escolha "Adicionar à Tela de Início". Depois abra o Cria pelo
              ícone novo e volte aqui.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground font-body">
        Este navegador não suporta notificações. No iPhone, instale o app na tela de início primeiro.
      </p>
    );
  }

  const toggle = async () => {
    if (!user) return;
    setLoading(true);
    setDiagnostico(null);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        toast.success("Notificações desativadas.");
      } else {
        const r = await enablePush(user.id);
        if (r.ok) {
          setEnabled(true);
          toast.success("Notificações ativadas! Faça o teste abaixo pra confirmar que chega.");
        } else if (r.reason === "denied") {
          toast.error("Você negou a permissão. Reative nos ajustes do aparelho, na parte de notificações.");
        } else if (r.reason === "unsupported") {
          toast.error("Este navegador não suporta notificações.");
        } else if (r.reason === "sw_timeout") {
          toast.error("O app demorou pra responder. Feche e abra de novo, e tente outra vez.");
        } else {
          // O motivo técnico agora aparece: sem ele, "não foi possível" não
          // dava pra investigar nem aqui nem no suporte.
          toast.error("Não consegui ativar.");
          setDiagnostico(r.detalhe ?? r.reason ?? "erro desconhecido");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  /** Manda um push de verdade pra este aparelho e conta o que aconteceu. */
  const testar = async () => {
    if (!user) return;
    setTestando(true);
    setDiagnostico(null);
    try {
      // Elo 1: a permissão do sistema ainda está de pé?
      if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
        setDiagnostico("O aparelho está com a permissão desligada. Ligue nos ajustes do sistema, em Notificações.");
        return;
      }
      // Elo 2: a inscrição deste aparelho está gravada?
      const inscrito = await isPushEnabled();
      if (!inscrito) {
        setDiagnostico("Este aparelho não está inscrito. Toque em Ativar notificações aqui em cima primeiro.");
        return;
      }
      // Elo 3 ao 5: o servidor consegue entregar?
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: { title: "Cria", message: "Teste: se você está vendo isso, está tudo certo.", user_id: user.id, url: "/app" },
      });
      if (error) { setDiagnostico(`O servidor de notificações não respondeu: ${error.message}`); return; }

      const r = data as {
        error?: string; sent?: number; aparelhos?: number;
        falhas?: { code: number; motivo: string }[];
      } | null;

      if (r?.error === "vapid_not_configured") {
        setDiagnostico("Faltam as chaves de notificação no servidor (VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY).");
        return;
      }
      if (r?.error) { setDiagnostico(`O servidor recusou: ${r.error}`); return; }
      if ((r?.aparelhos ?? 0) === 0) {
        setDiagnostico("O servidor não encontrou nenhum aparelho inscrito nesta conta. Desative e ative de novo aqui em cima.");
        return;
      }
      if ((r?.sent ?? 0) === 0) {
        const f = r?.falhas?.[0];
        setDiagnostico(
          f?.code === 403
            ? "A chave de notificação do app não bate com a do servidor. As duas precisam ser o mesmo par."
            : `A entrega falhou${f ? ` com o código ${f.code}` : ""}. ${f?.motivo ?? ""}`.trim(),
        );
        return;
      }
      toast.success("Enviado! Deve aparecer no seu aparelho em alguns segundos.");
      setDiagnostico(null);
    } catch (e) {
      setDiagnostico(`Não consegui testar: ${(e as Error)?.message ?? "erro"}`);
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant={enabled ? "outline" : "default"} onClick={() => void toggle()} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : enabled ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {enabled ? "Desativar notificações" : "Ativar notificações"}
        </Button>
        {enabled && (
          <Button variant="outline" onClick={() => void testar()} disabled={testando} className="gap-2">
            {testando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar um teste pra este aparelho
          </Button>
        )}
      </div>
      {diagnostico && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3.5 py-2.5">
          <p className="text-[12.5px] font-body text-destructive leading-relaxed">{diagnostico}</p>
        </div>
      )}
    </div>
  );
}
