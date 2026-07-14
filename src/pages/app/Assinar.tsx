import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Sparkles, ArrowLeft, Shield, UserCircle, Gem, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useManageSubscription } from "@/hooks/useManageSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PLANS, PLAN_VALUE, tierRank, type PlanId, type Tier } from "@/lib/plans";
import { PlanComparison } from "@/components/shared/PlanComparison";
import { OrganicBlobs } from "@/components/brand/OrganicBlobs";
import { BgShapes } from "@/components/BgShapes";
import { track, newEventId } from "@/lib/metaPixel";

export default function Assinar() {
  const navigate = useNavigate();
  const { status } = useSubscription();
  const { profile } = useProfile();
  const { user } = useAuth();
  const { openPortal, isLoading: portalLoading } = useManageSubscription();
  const [searchParams] = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [partnerCode, setPartnerCode] = useState("");
  const [partnerInfo, setPartnerInfo] = useState<{ name: string; discountPct: number | null; durationMonths: number | null } | null>(null);
  const [codeError, setCodeError] = useState(false);

  const isExpired = status === "trial_expired" || status === "blocked";

  // ONDE A PESSOA ESTÁ HOJE. Sem isto a página é um cardápio pra estranho: ela
  // mostrava "Assinar cria Pro" pra quem JÁ É Pro. Uma página de upgrade que não
  // sabe o seu plano não consegue te convidar pra lugar nenhum.
  const planoAtual: Tier | null =
    profile?.subscription_status === "active" && profile?.plan
      ? (profile.plan as Tier)
      : null;

  // Self-subscribe: conta PF criada por uma gestora via fluxo "Assinar pra mim".
  // user_metadata.self_subscribe_plan + self_subscribe_partner_code são gravados
  // pela edge manager-self-subscribe (Entrega 1).
  const meta = (user?.user_metadata ?? {}) as { self_subscribe_plan?: string; self_subscribe_partner_code?: string };
  const selfSubscribePlan = meta.self_subscribe_plan;
  const selfSubscribeCode = meta.self_subscribe_partner_code;
  const isSelfSubscribeFlow = !!selfSubscribePlan && (selfSubscribePlan === "pro" || selfSubscribePlan === "studio");
  const prefilledRef = useRef(false);

  useEffect(() => {
    if (!isSelfSubscribeFlow || prefilledRef.current) return;
    prefilledRef.current = true;
    if (selfSubscribeCode) {
      setPartnerCode(selfSubscribeCode);
      // Valida no mount pra o badge "Código da X aplicado" aparecer
      (async () => {
        const { data } = await (supabase.rpc as unknown as (fn: string, args: unknown) => Promise<{ data: unknown }>)(
          "validate_partner_code",
          { _code: selfSubscribeCode },
        );
        const row = Array.isArray(data) && data.length
          ? (data[0] as { partner_name: string; discount_pct: number | null; duration_months: number | null })
          : null;
        if (row) setPartnerInfo({
          name: row.partner_name,
          discountPct: row.discount_pct != null ? Number(row.discount_pct) : null,
          durationMonths: row.duration_months ?? null,
        });
      })();
    }
  }, [isSelfSubscribeFlow, selfSubscribeCode]);

  const validateCode = async () => {
    const code = partnerCode.trim();
    setPartnerInfo(null);
    setCodeError(false);
    if (!code) return;
    const { data } = await (supabase.rpc as unknown as (fn: string, args: unknown) => Promise<{ data: unknown }>)(
      "validate_partner_code",
      { _code: code },
    );
    const row = Array.isArray(data) && data.length
      ? (data[0] as { partner_name: string; discount_pct: number | null; duration_months: number | null })
      : null;
    if (row) setPartnerInfo({
      name: row.partner_name,
      discountPct: row.discount_pct != null ? Number(row.discount_pct) : null,
      durationMonths: row.duration_months ?? null,
    });
    else setCodeError(true);
  };

  useEffect(() => {
    if (searchParams.get("checkout") === "cancel") {
      toast("Checkout cancelado. Você pode tentar de novo quando quiser.");
    }
  }, [searchParams]);

  const handleSubscribe = async (planId: PlanId) => {
    if (loadingPlan) return; // já tem um checkout em andamento
    setLoadingPlan(planId);
    // Guarda o valor pra disparar a conversão (Purchase) na página de obrigado + mede InitiateCheckout.
    // O valor sai do PLANS (fonte única): antes era um ternário que só conhecia
    // dois planos, e o terceiro entraria no funil com o preço errado.
    const planValue = PLAN_VALUE[planId];
    const eventId = newEventId();
    try { sessionStorage.setItem("cria_checkout", JSON.stringify({ plano: planId, value: planValue, name: `cria ${planId}`, eventId })); } catch { /* ignore */ }
    track("InitiateCheckout", { value: planValue, currency: "BRL", content_ids: [planId] }, eventId);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          plan: planId,
          partner_code: partnerCode.trim() || undefined,
          self_subscribe: isSelfSubscribeFlow || undefined,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("checkout sem URL");
      }
    } catch (e: unknown) {
      let detail = e instanceof Error ? e.message : String(e);
      try {
        const ctx = (e as { context?: Response })?.context;
        if (ctx && typeof ctx.json === "function") {
          const body = await ctx.json();
          if (body?.error) detail = String(body.error);
        }
      } catch { /* ignore */ }
      console.error(e);
      toast.error(`Checkout: ${detail}`);
      setLoadingPlan(null);
    }
  };

  return (
    <div className="relative min-h-screen app-canvas overflow-hidden">
      {/* O FUNDO NATIVO DO CRIA. A página estava numa folha lisa — a única do
          sistema sem as formas orgânicas. Justo a página onde a pessoa decide
          te pagar: ela precisa PARECER o produto que ela vai comprar. */}
      <BgShapes styleKey="organico" />

      <div className="relative z-[1] flex flex-col items-center px-4 py-10 sm:py-14">
      {!isExpired && (
        <button
          onClick={() => navigate("/app")}
          className="self-start flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao app
        </button>
      )}

      {/* ── O CABEÇALHO ──────────────────────────────────────────────────────
          Esta página era uma folha BRANCA com três caixas brancas. Era a página
          onde a pessoa decide te pagar — e era a única do sistema sem a cara do
          Cria. Página de venda sem identidade não vende: parece formulário de
          banco. Agora ela tem o creme, as manchas orgânicas e o laranja da marca. */}
      <div className="relative w-full max-w-6xl overflow-hidden rounded-3xl border border-border bg-card px-5 py-7 sm:px-9 sm:py-9 mb-6 text-center">
        <OrganicBlobs color="laranja" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 mb-3">
            <Gem className="h-3.5 w-3.5" />
            <span className="text-[10px] font-body font-bold uppercase tracking-wider">Planos</span>
          </span>
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Todo mundo tem as ideias.
            <br className="hidden sm:block" />{" "}
            <span className="text-primary">Quase ninguém tem o processo.</span>
          </h1>
          <p className="text-sm sm:text-[15px] font-body text-muted-foreground mt-2.5 max-w-xl mx-auto leading-relaxed">
            Escolha até onde você quer que o cria vá com você: organizar a bagunça,
            escrever junto, ou fazer por você.
          </p>
        </div>
      </div>

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

      {isSelfSubscribeFlow && (
        <div className="w-full max-w-4xl mb-6 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <UserCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-semibold text-foreground">
              Você está finalizando sua assinatura pessoal
            </p>
            <p className="text-xs text-muted-foreground font-body mt-0.5">
              Plano <span className="font-semibold text-foreground capitalize">{selfSubscribePlan}</span> pré-selecionado{selfSubscribeCode ? " · cupom aplicado" : ""}. Clique em "Assinar" pra concluir.
            </p>
          </div>
        </div>
      )}

      {/* pt-4 no grid: o selo "Mais escolhido" vive em -top-3 e estava sendo
          COMEÇADO fora do container — o card cortava a metade de cima dele.
          (E eu tinha piorado pondo overflow-hidden no card.) */}
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 items-start">
        {PLANS.map((plan) => {
          const isLoading = loadingPlan === plan.id;
          // Qualquer checkout em andamento trava todos os botões (evita 2 sessões Stripe).
          const anyLoading = loadingPlan !== null;
          // Veio de uma trava ("Liberar por R$ X") → destaca o plano que ela foi buscar.
          const veioPor = searchParams.get("plano") === plan.id;
          const atual = planoAtual === plan.id;
          const abaixo = planoAtual ? tierRank(plan.id) < tierRank(planoAtual) : false;
          // O destaque NUNCA pode cair num plano abaixo do atual: ficava um botão
          // laranja gritante escrito "Voltar pro Pro" pra quem é Studio. A página
          // estava vendendo downgrade com o CTA principal.
          const destaque = !atual && !abaixo && (veioPor || (plan.highlighted && !searchParams.get("plano")));
          return (
            <div
              key={plan.id}
              className={cn(
                "relative rounded-3xl border p-7 flex flex-col transition-all",
                atual
                  ? "border-emerald-600/40 bg-emerald-600/[0.04]"
                  : destaque
                    ? "border-primary bg-card ring-2 ring-primary/15 shadow-warm-lg md:-mt-2 md:pb-9"
                    : "border-border bg-card shadow-warm hover:shadow-warm-md hover:-translate-y-0.5",
                abaixo && "opacity-60",
              )}
            >
              {atual ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 bg-emerald-600 text-white rounded-full px-3 py-1 text-[11px] font-body font-bold shadow-sm whitespace-nowrap">
                    <Check className="h-3 w-3" /> Seu plano hoje
                  </span>
                </div>
              ) : destaque && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground rounded-full px-3 py-1 text-[11px] font-body font-bold shadow-sm whitespace-nowrap">
                    <Sparkles className="h-3 w-3" />
                    {veioPor ? "É este que você quer" : "Mais escolhido"}
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                {/* O VERBO do degrau. A pessoa não compra uma lista de recursos,
                    compra uma mudança: organizar → criar melhor → a IA faz por você. */}
                <p className="text-[11px] font-body font-bold uppercase tracking-wider text-primary mb-1.5">
                  {plan.verbo}
                </p>
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
                        destaque ? "bg-primary/20" : "bg-primary/15",
                      )}
                    >
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm font-body text-foreground">{feat}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={atual ? "outline" : destaque ? "hero" : "outline"}
                size="lg"
                className={cn("w-full text-base", atual && "pointer-events-none opacity-70")}
                onClick={() => handleSubscribe(plan.id)}
                disabled={anyLoading || atual}
              >
                {/* O texto do botão muda com ONDE a pessoa está. "Assinar cria Pro"
                    pra quem já é Pro é ruído; "Subir pro Studio" é um convite. */}
                {atual
                  ? "Você já está aqui"
                  : isLoading
                    ? "Redirecionando..."
                    : planoAtual && !abaixo
                      ? `Subir pro ${plan.name.replace("cria ", "")}`
                      : abaixo
                        ? `Voltar pro ${plan.name.replace("cria ", "")}`
                        : `Assinar ${plan.name}`}
              </Button>
            </div>
          );
        })}
      </div>

      {/* ── RISCO ZERO ───────────────────────────────────────────────────────
          A objeção real de quem está com o dedo no botão não é "quanto custa",
          é "e se eu não usar?". Uma página de upgrade que não responde isso
          deixa a pessoa fechar a aba e adiar pra sempre. */}
      <div className="w-full max-w-3xl mt-8 rounded-3xl bg-emerald-700 px-6 py-6 text-center text-white">
        <p className="inline-flex items-center gap-2 font-display text-lg font-extrabold">
          <ShieldCheck className="h-5 w-5" /> Cancelar leva 2 cliques
        </p>
        <p className="text-[13.5px] font-body text-white/85 mt-1.5 max-w-xl mx-auto leading-relaxed">
          Sem ligação, sem formulário, sem falar com ninguém — dentro do próprio app.
          Se em um mês o cria não te economizar tempo, você sai e não paga o mês seguinte.
        </p>
      </div>

      <PlanComparison className="mt-12" />

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
            {partnerInfo.discountPct
              ? `, ${partnerInfo.discountPct}% off ${
                  partnerInfo.durationMonths && partnerInfo.durationMonths > 1
                    ? `por ${partnerInfo.durationMonths} meses`
                    : "na 1ª fatura"
                }`
              : ""}
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

      {/* O FECHO. A última coisa que ela lê antes de decidir não pode ser
          "Pagamento seguro" — isso é rodapé de e-commerce. Tem que ser o motivo. */}
      <div className="w-full max-w-2xl mt-10 text-center">
        <p className="text-[15px] font-body text-foreground leading-relaxed">
          O que trava a maioria não é falta de ideia — é o domingo à noite olhando pro
          calendário vazio, o post pela metade, a legenda que não sai.
          <span className="font-display font-bold"> O cria existe pra isso não acontecer de novo.</span>
        </p>
        <p className="text-xs text-muted-foreground font-body mt-4">
          Pagamento seguro via Stripe · Troca de plano na hora · Sem fidelidade
        </p>
      </div>
      </div>
    </div>
  );
}
