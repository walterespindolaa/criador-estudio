import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Sparkles, ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useProfile } from "@/hooks/useProfile";
import { useManageSubscription } from "@/hooks/useManageSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    id: "pro" as const,
    name: "cria Pro",
    price: "R$ 32,90",
    tagline: "Seu estúdio de conteúdo completo",
    features: [
      "Banco de ideias ilimitado",
      "Pipeline kanban de produção",
      "Calendário + metas mensais",
      "IA: 150 gerações/mês (legendas, roteiros, ideias)",
      "Agendamento Instagram, TikTok e YouTube",
      "Link in Bio profissional",
      "Brandbook + Biblioteca",
      "Relatórios e analytics",
    ],
    highlighted: false,
  },
  {
    id: "studio" as const,
    name: "cria Studio",
    price: "R$ 49,90",
    tagline: "Para quem vive de conteúdo",
    features: [
      "Tudo do cria Pro",
      "🤝 Collabs: parcerias com marcas",
      "💰 Financeiro: controle de cachês",
      "📊 Acompanhamento de campanhas",
      "🎓 Acesso aos cursos",
      "IA: 500 gerações/mês",
      "Suporte prioritário",
    ],
    highlighted: true,
  },
];

export default function Assinar() {
  const navigate = useNavigate();
  const { status } = useSubscription();
  const { profile } = useProfile();
  const { openPortal, isLoading: portalLoading } = useManageSubscription();
  const [searchParams] = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [partnerCode, setPartnerCode] = useState("");
  const [partnerInfo, setPartnerInfo] = useState<{ name: string; discountPct: number | null } | null>(null);
  const [codeError, setCodeError] = useState(false);

  const isExpired = status === "trial_expired" || status === "blocked";

  const validateCode = async () => {
    const code = partnerCode.trim();
    setPartnerInfo(null);
    setCodeError(false);
    if (!code) return;
    const { data } = await (supabase.rpc as unknown as (fn: string, args: unknown) => Promise<{ data: unknown }>)(
      "validate_partner_code",
      { _code: code },
    );
    const row = Array.isArray(data) && data.length ? (data[0] as { partner_name: string; discount_pct: number | null }) : null;
    if (row) setPartnerInfo({ name: row.partner_name, discountPct: row.discount_pct ?? null });
    else setCodeError(true);
  };

  useEffect(() => {
    if (searchParams.get("checkout") === "cancel") {
      toast("Checkout cancelado. Você pode tentar de novo quando quiser.");
    }
  }, [searchParams]);

  const handleSubscribe = async (planId: "pro" | "studio") => {
    setLoadingPlan(planId);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan: planId, partner_code: partnerCode.trim() || undefined },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("checkout sem URL");
      }
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível iniciar o checkout. Tente novamente.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-16">
      {!isExpired && (
        <button
          onClick={() => navigate("/app")}
          className="self-start sm:self-center flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
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

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {PLANS.map((plan) => {
          const isLoading = loadingPlan === plan.id;
          return (
            <div
              key={plan.id}
              className={cn(
                "relative bg-card border rounded-2xl p-8 shadow-warm flex flex-col",
                plan.highlighted
                  ? "border-primary ring-1 ring-primary/30"
                  : "border-border",
              )}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground rounded-full px-3 py-1 text-[11px] font-body font-semibold shadow-sm">
                    <Sparkles className="h-3 w-3" />
                    Mais completo
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h2 className="text-xl font-display font-extrabold text-foreground mb-1">
                  {plan.name}
                </h2>
                <p className="text-xs text-muted-foreground font-body">{plan.tagline}</p>
              </div>

              <div className="text-center mb-6">
                <div className="flex items-end justify-center gap-1">
                  <span className="text-4xl font-display font-extrabold text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground font-body mb-1">/mês</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                        plan.highlighted ? "bg-primary/20" : "bg-primary/15",
                      )}
                    >
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm font-body text-foreground">{feat}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.highlighted ? "hero" : "outline"}
                size="lg"
                className="w-full text-base"
                onClick={() => handleSubscribe(plan.id)}
                disabled={isLoading}
              >
                {isLoading ? "Redirecionando..." : `Assinar ${plan.name}`}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="w-full max-w-sm mt-8 rounded-2xl border border-border bg-card px-4 py-3">
        <label htmlFor="partner-code" className="block text-xs font-body text-muted-foreground mb-1.5">
          Tem um código de parceira? (opcional)
        </label>
        <input
          id="partner-code"
          type="text"
          value={partnerCode}
          onChange={(e) => {
            setPartnerCode(e.target.value.toUpperCase());
            if (codeError || partnerInfo) {
              setCodeError(false);
              setPartnerInfo(null);
            }
          }}
          onBlur={validateCode}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-body uppercase tracking-wider text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="EX: GABRIELA"
        />
        {partnerInfo && (
          <p className="text-xs font-body text-primary mt-2">
            Código da {partnerInfo.name} aplicado
            {partnerInfo.discountPct ? ` — ${partnerInfo.discountPct}% off na 1ª fatura` : ""}
          </p>
        )}
        {codeError && (
          <p className="text-xs font-body text-red-500 mt-2">Código não encontrado</p>
        )}
      </div>

      {profile?.stripe_customer_id && (
        <div className="mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={openPortal}
            disabled={portalLoading}
          >
            {portalLoading ? "Abrindo..." : "Gerenciar minha assinatura"}
          </Button>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground font-body mt-6">
        Pagamento seguro · Cancele quando quiser
      </p>
    </div>
  );
}
