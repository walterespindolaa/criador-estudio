import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, ArrowLeft, Shield, UserCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useManageSubscription } from "@/hooks/useManageSubscription";
import { useSouParceiro } from "@/hooks/useParceiro";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { deriveTier } from "@/hooks/useTier";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PLANS, PLAN_VALUE, tierRank, type PlanId, type Tier } from "@/lib/plans";
import { PlanComparison } from "@/components/shared/PlanComparison";
import { BgShapes } from "@/components/BgShapes";
import { track, newEventId } from "@/lib/metaPixel";
import { lerIndicacao } from "@/lib/indicacao";

export default function Assinar() {
  const navigate = useNavigate();
  const { data: souParceiro } = useSouParceiro();
  const { status } = useSubscription();
  const { profile } = useProfile();
  const { user } = useAuth();
  const { openPortal, isLoading: portalLoading } = useManageSubscription();
  const [searchParams] = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  // Celular: régua Essencial/Pro/Studio, um plano aberto por vez (começa no destacado).
  const [planoCel, setPlanoCel] = useState<PlanId | null>(null);
  const [partnerCode, setPartnerCode] = useState("");
  const [partnerInfo, setPartnerInfo] = useState<{ name: string; discountPct: number | null; durationMonths: number | null } | null>(null);
  const [codeError, setCodeError] = useState(false);
  /* CUPOM DE CAMPANHA (19/10/2026): o mesmo campo aceita cupom de campanha
     (ex.: CRIA3MESES). A checagem é só pra mostrar a oferta; quem decide é o
     create-checkout, que também confere se é a primeira assinatura. */
  const [campanhaInfo, setCampanhaInfo] = useState<{ mesesGratis: number; pct: number; mesesDesconto: number; motivo: string | null } | null>(null);

  /* MEU PERFIL ASSINA AQUI (passo 6, 18/10/2026). Dentro do Meu perfil esta
     página mostra e vende o plano DO PERFIL: o checkout vai com account_id e
     o servidor confere que o perfil é da sessão. */
  const { ehMeuPerfil, meuPerfil } = useActiveAccount();
  const { profile: perfilAtivo } = useActiveProfile();
  const isExpired = ehMeuPerfil
    ? !!perfilAtivo && deriveTier(perfilAtivo) === "none"
    : status === "trial_expired" || status === "blocked";

  // ONDE A PESSOA ESTÁ HOJE. Sem isto a página é um cardápio pra estranho: ela
  // mostrava "Assinar cria Pro" pra quem JÁ É Pro. Uma página de upgrade que não
  // sabe o seu plano não consegue te convidar pra lugar nenhum.
  const basePlano = ehMeuPerfil ? perfilAtivo : profile;
  const planoAtual: Tier | null =
    basePlano?.subscription_status === "active" && basePlano?.plan
      ? (basePlano.plan as Tier)
      : null;

  // Self-subscribe: conta PF criada por uma gestora via fluxo "Assinar pra mim".
  // user_metadata.self_subscribe_plan + self_subscribe_partner_code são gravados
  // pela edge manager-self-subscribe (Entrega 1).
  const meta = (user?.user_metadata ?? {}) as { self_subscribe_plan?: string; self_subscribe_partner_code?: string };
  const selfSubscribePlan = meta.self_subscribe_plan;
  const selfSubscribeCode = meta.self_subscribe_partner_code;
  const isSelfSubscribeFlow = !ehMeuPerfil && !!selfSubscribePlan && (selfSubscribePlan === "pro" || selfSubscribePlan === "studio");
  const prefilledRef = useRef(false);

  /* TESTE DE 7 DIAS COM CARTÃO (03/11/2026, mockup aprovado). Mesma regra do
     create-checkout: criador que nunca testou nem assinou. Quem já usou o teste
     (antigo, sem cartão, ou o novo) vê "Assinar", sem a faixa. Cupom de
     campanha válido tem o grátis dele e passa na frente. */
  const pf = profile as (typeof profile & { teste_cartao_inicio?: string | null }) | null;
  const podeTestar = !ehMeuPerfil && !isSelfSubscribeFlow && !souParceiro && !!pf
    && pf.account_type !== "manager" && !pf.trial_ends_at && !pf.teste_cartao_inicio
    && !pf.stripe_subscription_id && !(campanhaInfo && !campanhaInfo.motivo);
  const dataCobranca = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" })
    .format(new Date(Date.now() + 7 * 86400000));
  /* No meio do teste sem cartão (06/11/2026): quem assina antes do fim não perde
     os dias que sobram. O create-checkout empurra a 1ª cobrança pro fim do teste
     (o Stripe exige pelo menos 2 dias de folga; com menos, cobra na hora). */
  const fimTeste = pf?.trial_ends_at ? new Date(pf.trial_ends_at) : null;
  const guardaDias = !!fimTeste && !pf?.stripe_subscription_id && fimTeste.getTime() - Date.now() > 2 * 86400000
    && !(campanhaInfo && !campanhaInfo.motivo) && !isSelfSubscribeFlow && !ehMeuPerfil;
  const dataFimTeste = fimTeste ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(fimTeste) : "";

  /* De onde vem o código, em ordem de prioridade:
       1. o fluxo self-subscribe (a gestora assinando pelo cliente);
       2. o link /p/CODIGO que a parceira compartilhou, guardado no navegador.
     O segundo é o caso novo: antes a pessoa precisava lembrar de digitar, e
     quem esquecia virava venda sem dono. Ver src/pages/IndicacaoParceira.tsx. */
  useEffect(() => {
    if (prefilledRef.current) return;
    if (!isSelfSubscribeFlow) {
      /* 0. Cupom que veio no link do e-mail (?cupom=VOLTA50, 30/10/2026): só
         preenche e mostra a oferta. Quem decide se vale é o create-checkout. */
      const doEmail = (searchParams.get("cupom") ?? "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 30);
      if (doEmail) {
        prefilledRef.current = true;
        setPartnerCode(doEmail);
        void (async () => {
          const { data: camp } = await (supabase.rpc as unknown as (fn: string, args: unknown) => Promise<{ data: unknown }>)(
            "cupom_campanha_checar", { _code: doEmail },
          );
          const c = Array.isArray(camp) && camp.length
            ? (camp[0] as { dias_gratis: number; desconto_pct: number; desconto_meses: number; motivo: string | null })
            : null;
          if (c) setCampanhaInfo({
            mesesGratis: c.dias_gratis > 0 ? Math.max(1, Math.round(c.dias_gratis / 30)) : 0,
            pct: Number(c.desconto_pct) || 0,
            mesesDesconto: c.desconto_meses ?? 0,
            motivo: c.motivo,
          });
        })();
        return;
      }
      const doLink = lerIndicacao();
      if (doLink) {
        prefilledRef.current = true;
        setPartnerCode(doLink);
        void (async () => {
          const { data } = await (supabase.rpc as unknown as (fn: string, args: unknown) => Promise<{ data: unknown }>)(
            "validate_partner_code", { _code: doLink },
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
      return;
    }
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
  }, [isSelfSubscribeFlow, selfSubscribeCode, searchParams]);

  const validateCode = async () => {
    const code = partnerCode.trim();
    setPartnerInfo(null);
    setCampanhaInfo(null);
    setCodeError(false);
    if (!code) return;
    const { data } = await (supabase.rpc as unknown as (fn: string, args: unknown) => Promise<{ data: unknown }>)(
      "validate_partner_code",
      { _code: code },
    );
    const row = Array.isArray(data) && data.length
      ? (data[0] as { partner_name: string; discount_pct: number | null; duration_months: number | null })
      : null;
    if (row) {
      setPartnerInfo({
        name: row.partner_name,
        discountPct: row.discount_pct != null ? Number(row.discount_pct) : null,
        durationMonths: row.duration_months ?? null,
      });
      return;
    }
    const { data: camp } = await (supabase.rpc as unknown as (fn: string, args: unknown) => Promise<{ data: unknown }>)(
      "cupom_campanha_checar",
      { _code: code },
    );
    const c = Array.isArray(camp) && camp.length
      ? (camp[0] as { dias_gratis: number; desconto_pct: number; desconto_meses: number; motivo: string | null })
      : null;
    if (c) setCampanhaInfo({
      mesesGratis: c.dias_gratis > 0 ? Math.max(1, Math.round(c.dias_gratis / 30)) : 0,
      pct: Number(c.desconto_pct) || 0,
      mesesDesconto: c.desconto_meses ?? 0,
      motivo: c.motivo,
    });
    else setCodeError(true);
  };

  /* JORNADA (04/11/2026): grava a primeira vez que a pessoa vê os planos e o
     aparelho, pro admin saber onde ela parou. Falha não atrapalha a tela. */
  useEffect(() => {
    if (ehMeuPerfil) return;
    const w = typeof window !== "undefined" ? window.innerWidth : 1200;
    const aparelho = w < 768 ? "celular" : w < 1100 ? "tablet" : "computador";
    void (supabase.rpc as unknown as (fn: string, args: unknown) => Promise<unknown>)("jornada_marcar", { _passo: "planos", _aparelho: aparelho })
      .catch(() => { /* métrica perdida não é problema */ });
  }, [ehMeuPerfil]);

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
          account_id: ehMeuPerfil ? meuPerfil?.owner_id : undefined,
        },
      });
      if (error) throw error;
      /* Já assinante: o servidor trocou o plano na assinatura existente (com
         rateio) em vez de abrir outro checkout. Nada de segunda cobrança. */
      if (data?.changed) {
        toast.success(`Plano trocado pra ${String(data.plan ?? planId)}. A diferença é cobrada proporcionalmente na próxima fatura.`);
        setLoadingPlan(null);
        setTimeout(() => { window.location.href = "/app"; }, 900);
        return;
      }
      if (data?.same) {
        toast("Esse já é o seu plano atual.");
        setLoadingPlan(null);
        return;
      }
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
          // Recusa de cupom vem com a frase pronta (ex.: "só vale pra primeira assinatura").
          if (body?.message) { toast.error(String(body.message)); setLoadingPlan(null); return; }
          if (body?.error) detail = String(body.error);
        }
      } catch { /* ignore */ }
      console.error(e);
      toast.error(`Checkout: ${detail}`);
      setLoadingPlan(null);
    }
  };

  /* REPAGINADA (07/11/2026, mockup aprovado): cada plano tem cabeçalho de
     cor própria (azul, cor do tema, preto), o verbo em letra de mão e o Pro
     sobe com selo. A lógica de destaque, plano atual e texto do botão é a
     mesma de antes, só saiu do map pra servir o computador e o celular. */
  const TINTA = "#1D1B18";
  const infoPlano = (plan: (typeof PLANS)[number]) => {
    const isLoading = loadingPlan === plan.id;
    // Qualquer checkout em andamento trava todos os botões (evita 2 sessões Stripe).
    const anyLoading = loadingPlan !== null;
    // Veio de uma trava ("Liberar por R$ X") → destaca o plano que ela foi buscar.
    const veioPor = searchParams.get("plano") === plan.id;
    const atual = planoAtual === plan.id;
    const abaixo = planoAtual ? tierRank(plan.id) < tierRank(planoAtual) : false;
    // O destaque NUNCA pode cair num plano abaixo do atual: ficava um botão
    // laranja gritante escrito "Voltar pro Pro" pra quem é Studio.
    const destaque = !atual && !abaixo && (veioPor || (plan.highlighted && !searchParams.get("plano")));
    const curto = plan.name.replace("cria ", "");
    // O texto do botão muda com ONDE a pessoa está.
    const textoBotao = atual
      ? "Você já está aqui"
      : isLoading
        ? "Redirecionando..."
        : planoAtual && !abaixo
          ? `Subir pro ${curto}`
          : abaixo
            ? `Voltar pro ${curto}`
            : podeTestar
              ? "Começar 7 dias grátis"
              : `Assinar ${plan.name}`;
    return { isLoading, anyLoading, veioPor, atual, abaixo, destaque, curto, textoBotao };
  };
  const estiloPlano = (id: PlanId) =>
    id === "essencial"
      ? { cab: "bg-[#C9DAFF] text-[#1D1B18]", verbo: "text-[#1D1B18]", marca: "bg-[#C9DAFF]" }
      : id === "pro"
        ? { cab: "bg-primary text-primary-foreground", verbo: "text-primary-foreground", marca: "bg-primary/25" }
        : { cab: "bg-[#1D1B18] text-white", verbo: "text-[#FFCF03]", marca: "bg-[#FFCF03]" };
  const classeBotao = (plan: (typeof PLANS)[number]) => {
    const i = infoPlano(plan);
    return cn(
      "w-full rounded-full border-2 px-5 py-3 font-body text-[15px] font-extrabold transition-transform active:translate-y-[1px] disabled:opacity-60 shadow-[0_2px_0_#1D1B18]",
      i.atual
        ? "bg-white text-[#1D1B18] pointer-events-none opacity-70"
        : i.destaque
          ? "bg-primary text-primary-foreground"
          : plan.id === "studio" && !i.abaixo
            ? "bg-[#1D1B18] text-white"
            : "bg-white text-[#1D1B18]",
    );
  };
  const destacadoId = (PLANS.find((p) => infoPlano(p).destaque) ?? PLANS.find((p) => p.highlighted) ?? PLANS[0]).id;
  const celId: PlanId = planoCel ?? destacadoId;
  const renderCartao = (plan: (typeof PLANS)[number], noCelular = false) => {
    const i = infoPlano(plan);
    const e = estiloPlano(plan.id);
    return (
      <div
        key={plan.id}
        className={cn(
          "relative rounded-3xl border-2 bg-white flex flex-col shadow-[2px_2px_0_#1D1B18]",
          !noCelular && i.destaque && "md:-translate-y-3",
          i.abaixo && "opacity-60",
        )}
        style={{ borderColor: TINTA }}
      >
        {(i.atual || i.destaque) && (
          <div
            className={cn(
              "absolute -top-7 -right-3 z-10 grid h-[88px] w-[88px] rotate-12 place-items-center rounded-full border-2 text-center font-display text-[13px] font-extrabold leading-none shadow-[2px_2px_0_#1D1B18]",
              i.atual ? "bg-emerald-500 text-white" : "bg-[#FFCF03] text-[#1D1B18]",
            )}
            style={{ borderColor: TINTA }}
          >
            {i.atual ? (<span>seu plano<br />hoje</span>) : i.veioPor ? (<span>é este<br />que você<br />quer</span>) : (<span>mais<br />escolhido</span>)}
          </div>
        )}
        <div className={cn("rounded-t-[22px] border-b-2 px-5 pb-4 pt-5 pr-20", e.cab)} style={{ borderColor: TINTA }}>
          {/* O VERBO do degrau: a pessoa compra uma mudança, não uma lista. */}
          <p className={cn("text-[28px] leading-none", e.verbo)} style={{ fontFamily: "'Caveat', cursive", fontWeight: 700 }}>{plan.verbo}</p>
          <h2 className="mt-1 font-display text-[22px] font-extrabold leading-tight">{plan.name}</h2>
          <p className="mt-0.5 text-[13px] font-body leading-snug opacity-85">{plan.tagline}</p>
        </div>
        <div className="px-5 pt-4">
          <div className="flex items-end gap-1 whitespace-nowrap">
            <span className="font-display text-[38px] font-extrabold leading-none text-[#1D1B18]">{plan.price}</span>
            <span className="mb-1 font-body text-sm text-muted-foreground">/mês</span>
          </div>
          {podeTestar && <p className="mt-1 text-xs font-body text-muted-foreground">a partir de {dataCobranca}</p>}
        </div>
        <ul className="flex-1 space-y-2.5 px-5 pb-2 pt-4">
          {plan.features.map((feat, k) => (
            <li key={feat} className={cn("flex items-start gap-2.5 text-sm font-body text-[#1D1B18]", k === 0 && plan.id !== "essencial" && "font-bold")}>
              <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2", e.marca)} style={{ borderColor: TINTA }}>
                <Check className="h-3 w-3 text-[#1D1B18]" strokeWidth={3} />
              </span>
              {feat}
            </li>
          ))}
        </ul>
        {!noCelular && (
          <div className="px-5 pb-5 pt-3">
            <button
              type="button"
              className={classeBotao(plan)}
              style={{ borderColor: TINTA }}
              onClick={() => handleSubscribe(plan.id)}
              disabled={i.anyLoading || i.atual}
            >
              {i.textoBotao}
            </button>
          </div>
        )}
        {noCelular && <div className="h-4" />}
      </div>
    );
  };

  return (
    <div className="relative">
      {/* Agora ela vive DENTRO do app (menu, rail, barra), então o fundo orgânico
          vem do próprio AppLayout. Ela deixou de ser "outro site". */}
      <div className="flex flex-col items-center pb-16">
      {/* Parceiro SEMPRE tem porta de saída: a área dele (/parceiro) não
          depende de plano nenhum. Sem isto, o PeJota clicou em "Meu Cria",
          caiu no paywall do trial expirado e ficou preso sem botão de volta. */}
      {souParceiro ? (
        <button
          onClick={() => navigate("/parceiro")}
          className="self-start flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar pra área de parceiro
        </button>
      ) : !isExpired && (
        <button
          onClick={() => navigate("/app")}
          className="self-start flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao app
        </button>
      )}

      {/* ── O CABEÇALHO ─────────────────────────────────────────────────────
          Repaginado (07/11/2026): selo "Planos" amarelo, frase grande com o
          grifo amarelo atrás de "o processo". */}
      <div className="relative w-full max-w-6xl px-2 pb-2 pt-2 mb-4 text-center">
        <span className="inline-block -rotate-2 rounded-full border-2 bg-[#FFCF03] px-3 py-0.5 text-[11px] font-body font-extrabold uppercase tracking-wider text-[#1D1B18]" style={{ borderColor: "#1D1B18" }}>
          Planos
        </span>
        <h1 className="mt-3 font-display text-[28px] sm:text-[40px] font-extrabold leading-[1.02] tracking-tight text-[#1D1B18]">
          Todo mundo tem as ideias.
          <br />
          <span className="relative inline-block text-primary">
            <span className="absolute inset-x-0 bottom-1 -z-0 h-2.5 rounded bg-[#FFCF03]/80" aria-hidden />
            <span className="relative">Quase ninguém tem o processo.</span>
          </span>
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm sm:text-[15px] font-body leading-relaxed text-muted-foreground">
          Escolha até onde você quer que o Cria vá com você: organizar a bagunça,
          escrever junto, ou fazer por você.
        </p>
      </div>

      {ehMeuPerfil && (
        <div className="w-full max-w-4xl mb-6 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <UserCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-semibold text-foreground">
              Plano do seu Meu perfil{meuPerfil?.name ? ` (${meuPerfil.name})` : ""}
            </p>
            <p className="text-xs text-muted-foreground font-body mt-0.5">
              É a assinatura do seu lado criador, separada dos módulos da sua gestão. A cobrança vai pro seu e-mail.
            </p>
          </div>
        </div>
      )}

      {(podeTestar || guardaDias) && (
        <div
          className="w-full max-w-3xl mb-3 flex flex-col sm:flex-row overflow-hidden rounded-2xl border-2 bg-white text-left shadow-[2px_2px_0_#1D1B18]"
          style={{ borderColor: "#1D1B18" }}
        >
          <div className="flex sm:flex-col items-center justify-center gap-2 sm:gap-0 bg-[#00A652] px-5 py-2.5 sm:py-3 text-white border-b-2 sm:border-b-0 sm:border-r-2 border-dashed" style={{ borderColor: "#1D1B18" }}>
            <span className="font-display text-2xl sm:text-[30px] font-extrabold leading-none">7 dias</span>
            <span className="text-[11px] font-body font-bold uppercase tracking-wider">grátis</span>
          </div>
          <p className="flex-1 px-4 py-3 text-[13.5px] font-body leading-relaxed text-[#1D1B18] self-center">
            {podeTestar ? (
              <>
                <b>Hoje você não paga nada.</b> A primeira cobrança é em <b>{dataCobranca}</b>. A gente avisa por
                e-mail 2 dias antes e na véspera, e você cancela quando quiser, em 2 cliques.
              </>
            ) : (
              <>
                Seu teste vai até <b>{dataFimTeste}</b>. Se assinar agora, <b>não perde os dias que faltam</b>: a
                primeira cobrança só vem em <b>{dataFimTeste}</b>. Cancela quando quiser, em 2 cliques.
              </>
            )}
          </p>
        </div>
      )}

      {isExpired && !podeTestar && (
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

      {/* COMPUTADOR: 3 cartões. pt-8 porque o selo do destaque mora em -top-7. */}
      <div className="hidden md:grid w-full max-w-6xl grid-cols-3 gap-6 pt-8 items-start">
        {PLANS.map((plan) => renderCartao(plan))}
      </div>

      {/* CELULAR: régua com um plano aberto por vez, os outros dois em mini
          cartões e o botão de assinar preso no rodapé. */}
      <div className="md:hidden w-full">
        <div className="mb-8 flex rounded-full border-2 bg-white p-1 shadow-[0_2px_0_#1D1B18]" style={{ borderColor: "#1D1B18" }}>
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setPlanoCel(plan.id)}
              className={cn(
                "flex-1 rounded-full py-1.5 font-display text-sm font-extrabold transition-colors",
                celId === plan.id ? "bg-primary text-primary-foreground" : "text-[#1D1B18]",
              )}
            >
              {plan.name.replace("cria ", "")}
            </button>
          ))}
        </div>
        {PLANS.filter((p) => p.id === celId).map((plan) => renderCartao(plan, true))}
        <div className="mt-4 flex gap-2.5">
          {PLANS.filter((p) => p.id !== celId).map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setPlanoCel(plan.id)}
              className="flex-1 rounded-2xl border-2 bg-white px-3 py-2 text-left shadow-[0_2px_0_#1D1B18]"
              style={{ borderColor: "#1D1B18" }}
            >
              <span className="block font-display text-sm font-extrabold text-[#1D1B18]">{plan.name.replace("cria ", "")}</span>
              <span className="block text-xs font-body text-muted-foreground">{plan.price} · {plan.verbo.toLowerCase()}</span>
            </button>
          ))}
        </div>
        {PLANS.filter((p) => p.id === celId).map((plan) => {
          const i = infoPlano(plan);
          return (
            <div key={plan.id} className="sticky z-30 mt-4 bottom-[calc(84px+env(safe-area-inset-bottom,0px))]">
              <button
                type="button"
                className={classeBotao(plan)}
                style={{ borderColor: "#1D1B18" }}
                onClick={() => handleSubscribe(plan.id)}
                disabled={i.anyLoading || i.atual}
              >
                {i.atual || i.isLoading ? i.textoBotao : `${i.textoBotao} · ${plan.price}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── RISCO ZERO ───────────────────────────────────────────────────────
          A objeção real de quem está com o dedo no botão não é "quanto custa",
          é "e se eu não usar?". Vira post-it amarelo. */}
      <div className="mt-10 w-full max-w-md -rotate-1 bg-[#FFE46B] px-5 py-4 text-left shadow-[3px_4px_0_rgba(29,27,24,0.18)]">
        <p className="inline-flex items-center gap-2 font-display text-lg font-extrabold text-[#1D1B18]">
          <ShieldCheck className="h-5 w-5" /> Cancelar leva 2 cliques
        </p>
        <p className="mt-1 text-[21px] leading-[1.1] text-[#1D1B18]" style={{ fontFamily: "'Caveat', cursive", fontWeight: 700 }}>
          Sem ligação, sem formulário, sem falar com ninguém. Se em um mês o Cria não te economizar tempo, você sai e não paga o mês seguinte.
        </p>
      </div>

      <PlanComparison className="mt-12" />

      <div className="w-full max-w-sm mt-8 rounded-2xl border-2 border-dashed bg-white px-4 py-3" style={{ borderColor: "#1D1B18" }}>
        <label htmlFor="partner-code" className="block text-xs font-body text-muted-foreground mb-1.5">
          🎟️ Tem um cupom ou código de parceira? (opcional)
        </label>
        <input
          id="partner-code"
          type="text"
          value={partnerCode}
          onChange={(e) => {
            setPartnerCode(e.target.value.toUpperCase());
            if (codeError || partnerInfo || campanhaInfo) {
              setCodeError(false);
              setPartnerInfo(null);
              setCampanhaInfo(null);
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
        {campanhaInfo && !campanhaInfo.motivo && (
          <p className="text-xs font-body text-primary mt-2">
            Cupom aplicado:{" "}
            {[
              campanhaInfo.mesesGratis > 0 ? `${campanhaInfo.mesesGratis} ${campanhaInfo.mesesGratis === 1 ? "mês grátis" : "meses grátis"}` : null,
              campanhaInfo.pct > 0 && campanhaInfo.mesesDesconto > 0
                ? `${campanhaInfo.mesesGratis > 0 ? "depois " : ""}${campanhaInfo.pct}% off por ${campanhaInfo.mesesDesconto} ${campanhaInfo.mesesDesconto === 1 ? "mês" : "meses"}`
                : null,
            ].filter(Boolean).join(", ")}
            . O cartão é pedido agora e a primeira cobrança só vem quando o grátis acabar. Cancela quando quiser.
          </p>
        )}
        {campanhaInfo?.motivo && (
          <p className="text-xs font-body text-red-500 mt-2">
            {{
              inativo: "Esse cupom não está mais ativo.",
              expirado: "Esse cupom expirou.",
              esgotado: "Esse cupom já atingiu o limite de usos.",
              plano: "Esse cupom não vale pra esse plano.",
            }[campanhaInfo.motivo] ?? "Esse cupom não vale agora."}
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
          "Pagamento seguro", isso é rodapé de e-commerce. Tem que ser o motivo. */}
      <div className="w-full max-w-2xl mt-10 text-center">
        <p className="text-[15px] font-body text-foreground leading-relaxed">
          O que trava a maioria não é falta de ideia, é o domingo à noite olhando pro
          calendário vazio, o post pela metade, a legenda que não sai.
          <span className="font-display font-bold"> O cria existe pra isso não acontecer de novo.</span>
        </p>
        <p className="text-xs text-muted-foreground font-body mt-4">
          Pagamento seguro via Stripe{podeTestar ? " · Cartão, Apple Pay ou Google Pay" : ""} · Troca de plano na hora · Sem fidelidade
        </p>
      </div>
      </div>
    </div>
  );
}
