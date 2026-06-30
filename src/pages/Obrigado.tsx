import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/metaPixel";
import { useAuth } from "@/contexts/AuthContext";

// Página de sucesso pós-Stripe. Dispara a conversão (Purchase/Subscribe) com o
// valor guardado no início do checkout, pra o Meta/Google medirem a compra.
export default function Obrigado() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    let info: { plano?: string; value?: number; eventId?: string; name?: string } = {};
    try { info = JSON.parse(sessionStorage.getItem("cria_checkout") || "{}"); } catch { /* ignore */ }
    const params: Record<string, unknown> = {
      value: info.value ?? 0,
      currency: "BRL",
      content_name: info.name,
      content_ids: info.plano ? [info.plano] : undefined,
      email: user?.email,
    };
    track("Purchase", params, info.eventId);
    track("Subscribe", params, info.eventId ? `${info.eventId}-sub` : undefined);
    try { sessionStorage.removeItem("cria_checkout"); } catch { /* ignore */ }
  }, [user?.email]);

  return (
    <div className="min-h-screen w-full app-canvas flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-warm-lg sm:p-10">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/15">
          <CheckCircle2 className="h-9 w-9 text-secondary" />
        </div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Assinatura confirmada! 🎉</h1>
        <p className="mt-3 text-sm font-body text-muted-foreground">
          Pagamento aprovado. Bem-vindo ao Cria Social Club — agora é só criar.
        </p>
        <Button onClick={() => navigate("/app")} className="mt-7 h-12 w-full text-base">
          Ir pro app <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
