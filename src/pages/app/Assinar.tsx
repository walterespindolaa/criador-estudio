import { useNavigate } from "react-router-dom";
import { Check, Sparkles, ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";

const PLAN_FEATURES = [
  "Banco de ideias ilimitado",
  "Pipeline kanban completo",
  "Calendário + metas mensais",
  "Cria IA — legendas, hashtags e roteiros",
  "Agendamento para Instagram, TikTok e YouTube",
  "Preview de feed do Instagram",
  "Link in Bio profissional",
  "Brandbook + Biblioteca pessoal",
  "Relatórios e analytics das redes",
  "Suporte prioritário",
];

export default function Assinar() {
  const navigate = useNavigate();
  const { status } = useSubscription();

  const isExpired = status === "trial_expired" || status === "blocked";

  const handleCheckout = async () => {
    window.open(
      "mailto:contato@criadores.flow?subject=Quero assinar o cria",
      "_blank"
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-16">
      {!isExpired && (
        <button
          onClick={() => navigate("/app")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao app
        </button>
      )}

      {isExpired && (
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full px-4 py-1.5 text-sm font-body font-medium mb-3">
            <Shield className="h-4 w-4" />
            Seu período de teste encerrou
          </div>
          <p className="text-muted-foreground text-sm font-body max-w-sm">
            Para continuar acessando o cria, escolha um plano abaixo.
          </p>
        </div>
      )}

      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-warm">
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 text-xs font-body font-semibold">
            <Sparkles className="h-3 w-3" />
            Plano Criador Pro
          </span>
        </div>

        <div className="text-center mb-8">
          <div className="flex items-end justify-center gap-1 mb-1">
            <span className="text-4xl font-display font-extrabold text-foreground">R$ 29</span>
            <span className="text-muted-foreground font-body mb-1">/mês</span>
          </div>
          <p className="text-xs text-muted-foreground font-body">
            ou R$ 297/ano · 2 meses grátis
          </p>
        </div>

        <ul className="space-y-3 mb-8">
          {PLAN_FEATURES.map((feat) => (
            <li key={feat} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="h-3 w-3 text-primary" />
              </div>
              <span className="text-sm font-body text-foreground">{feat}</span>
            </li>
          ))}
        </ul>

        <Button
          variant="hero"
          size="lg"
          className="w-full text-base"
          onClick={handleCheckout}
        >
          Assinar agora
        </Button>

        <p className="text-center text-xs text-muted-foreground font-body mt-3">
          Pagamento seguro · Cancele quando quiser
        </p>
      </div>
    </div>
  );
}
