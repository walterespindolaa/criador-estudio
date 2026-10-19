import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* CUPOM DE CAMPANHA: período grátis + desconto que começa DEPOIS dele.
   O cupom "repeating" do Stripe conta os meses a partir de quando é aplicado
   (no checkout, ou seja, no começo do grátis). Por isso a duração do cupom é
   meses grátis + meses de desconto, e o fim do grátis cai num dia entre 1 e 28
   com folga de 36 h: assim a fatura 1 a N do desconto ficam dentro do cupom e a
   N+1 fica fora, em qualquer dia do mês que a pessoa assinar. */
function somaMesesUTC(d: Date, meses: number): Date {
  const r = new Date(d.getTime());
  const dia = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(dia, ultimo));
  return r;
}
function fimDoGratis(agora: Date, meses: number): number {
  const t = new Date(somaMesesUTC(agora, meses).getTime() + 36 * 3600 * 1000);
  if (t.getUTCDate() > 28) { t.setUTCDate(1); t.setUTCMonth(t.getUTCMonth() + 1); }
  return Math.floor(t.getTime() / 1000);
}
const MOTIVO_CUPOM: Record<string, string> = {
  inativo: "Esse cupom não está mais ativo.",
  expirado: "Esse cupom expirou.",
  esgotado: "Esse cupom já atingiu o limite de usos.",
  plano: "Esse cupom não vale pra esse plano.",
  primeira_assinatura: "Esse cupom só vale pra primeira assinatura.",
};
type Campanha = { codigo: string; dias_gratis: number; desconto_pct: number; desconto_meses: number; motivo: string | null };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente com o JWT do usuário (pra descobrir quem é, sem confiar no body)
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const plan = body?.plan;
    if (plan !== "essencial" && plan !== "pro" && plan !== "studio" && plan !== "agency") {
      return new Response(JSON.stringify({ error: "invalid_plan" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Plano de agência: assinatura com QUANTIDADE = nº de assentos (preço por assento).
    const isAgency = plan === "agency";
    // Plano de agência exige no mínimo 3 assentos.
    const seats = isAgency ? Math.max(3, Math.min(50, Math.floor(Number(body?.seats) || 3))) : 1;

    const priceId = isAgency
      ? Deno.env.get("STRIPE_PRICE_AGENCY_SEAT")!
      : plan === "studio"
      ? Deno.env.get("STRIPE_PRICE_STUDIO")!
      : plan === "essencial"
      ? Deno.env.get("STRIPE_PRICE_ESSENCIAL")!
      : Deno.env.get("STRIPE_PRICE_PRO")!;
    if (!priceId) {
      return new Response(JSON.stringify({ error: "price_not_configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client pra ler/gravar o stripe_customer_id
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    /* MEU PERFIL ASSINA (passo 6, 18/10/2026). A social mídia que tem o Meu
       perfil assina o plano DELE, logada na conta dela. O front manda
       account_id = id do perfil; aqui só passa se o perfil é dela mesma
       (profiles.perfil_de = sessão). Conta de cliente nunca: quem paga o plano
       da cliente é a própria cliente, no Cria dela. A assinatura, o plano e o
       cliente Stripe ficam no PERFIL; o e-mail de cobrança é o da dona. */
    const pedidoConta = typeof body?.account_id === "string" && body.account_id && body.account_id !== user.id
      ? String(body.account_id) : null;
    if (pedidoConta) {
      if (isAgency) {
        return new Response(JSON.stringify({ error: "invalid_plan" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: alvo } = await svc.from("profiles").select("perfil_de").eq("id", pedidoConta).maybeSingle();
      if (!alvo || (alvo as { perfil_de: string | null }).perfil_de !== user.id) {
        return new Response(JSON.stringify({ error: "so_meu_perfil" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    const contaId = pedidoConta ?? user.id;
    const metaPerfil: Record<string, string> = pedidoConta ? { meu_perfil_de: user.id } : {};

    const { data: profile } = await svc
      .from("profiles")
      .select("stripe_customer_id, name, stripe_subscription_id, subscription_status")
      .eq("id", contaId)
      .single();

    /* CUPOM DE CAMPANHA (Walter, 19/10/2026). O campo do cupom é o mesmo do
       código de parceira. Se o código não é de parceira, procura nas campanhas.
       Fica ANTES da troca de plano: quem já assina não pode usar cupom de
       primeira assinatura (senão o código só trocaria o plano). */
    const rawCode = (typeof body?.partner_code === "string" ? body.partner_code : "").trim();
    let campanha: Campanha | null = null;
    if (rawCode) {
      const codigoEscapado = rawCode.replace(/([\\%_])/g, "\\$1");
      const { data: ehParceira } = await svc.from("partners").select("id")
        .ilike("coupon_code", codigoEscapado).eq("status", "approved").maybeSingle();
      if (!ehParceira) {
        const { data: linhas } = await svc.rpc("cupom_campanha_checar", { _code: rawCode, _plan: plan });
        const c = Array.isArray(linhas) && linhas.length ? (linhas[0] as Campanha) : null;
        if (c) {
          const recusa = (motivo: string) => new Response(
            JSON.stringify({ error: `cupom_${motivo}`, message: MOTIVO_CUPOM[motivo] ?? "Cupom inválido." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
          if (c.motivo) return recusa(c.motivo);
          let jaAssinou = !!profile?.stripe_subscription_id;
          if (!jaAssinou && profile?.stripe_customer_id) {
            const anteriores = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: "all", limit: 1 });
            jaAssinou = anteriores.data.length > 0;
          }
          if (jaAssinou) return recusa("primeira_assinatura");
          campanha = c;
        }
      }
    }

    /* TROCA DE PLANO NÃO ABRE OUTRO CHECKOUT (pente fino 23/09/2026, B1).
       Quem já assina e clica em outro plano ganhava uma SEGUNDA assinatura, e a
       primeira continuava cobrando. Agora, se existe assinatura de criador viva
       no Stripe, o item dela é trocado pelo price novo com rateio (pró-rata) e
       o webhook `subscription.updated` grava o plano pelo price. Só cai no
       checkout quem não tem assinatura ou cuja assinatura já foi cancelada. */
    if (!isAgency && profile?.stripe_subscription_id) {
      try {
        const atual = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
        const viva = ["active", "trialing", "past_due"].includes(atual.status);
        const item = atual.items?.data?.[0];
        if (viva && item) {
          if (item.price?.id === priceId) {
            return new Response(JSON.stringify({ changed: false, same: true, plan }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          await stripe.subscriptions.update(atual.id, {
            items: [{ id: item.id, price: priceId }],
            proration_behavior: "create_prorations",
            metadata: { ...(atual.metadata ?? {}), app: "cria", user_id: contaId, plan, ...metaPerfil },
          });
          return new Response(JSON.stringify({ changed: true, plan }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        // Assinatura não existe mais no Stripe (deletada na mão): segue pro checkout.
        console.warn("[create-checkout] assinatura antiga nao recuperavel, abrindo checkout novo", e);
      }
    }

    // Reusa customer existente ou cria
    let customerId = profile?.stripe_customer_id ?? undefined;
    if (!customerId) {
      // Meu perfil tem cliente Stripe PRÓPRIO (com o e-mail da dona): o portal
      // dele mostra só o plano do perfil, sem misturar com os módulos da gestão.
      const customer = await stripe.customers.create({
        email: user.email,
        name: pedidoConta ? `${profile?.name ?? "Meu perfil"} (Meu perfil)` : (profile?.name ?? undefined),
        metadata: { app: "cria", user_id: contaId, ...metaPerfil },
      });
      customerId = customer.id;
      await svc.from("profiles").update({ stripe_customer_id: customerId }).eq("id", contaId);
    }

    // ── Self-subscribe (manager assinando pra conta PF dela) ────
    // O front passa self_subscribe:true quando o user logado tem
    // user_metadata.self_subscribe_plan. Validamos via account_members:
    // owner_id=user.id (PF) + pending_self_subscribe=true.
    const selfSubRequest = body?.self_subscribe === true && !pedidoConta;
    let selfSubValidated = false;
    let selfSubManagerId: string | null = null;
    if (selfSubRequest) {
      const { data: link } = await svc.from("account_members")
        .select("member_id")
        .eq("owner_id", user.id)
        .eq("pending_self_subscribe", true)
        .maybeSingle();
      if (link) {
        selfSubValidated = true;
        selfSubManagerId = (link as { member_id: string | null }).member_id;
      }
    }

    // ── Partner code (opcional) ─────────────────────────────────
    let partnerMeta: Record<string, string> = {};
    let appliedPromotionCodeId: string | null = null;
    if (rawCode && !campanha) {
      // Escapa curingas do ILIKE (% e _). Sem isto, partner_code = "%" casaria com
      // QUALQUER parceiro aprovado e aplicaria um cupom que não é do usuário.
      const escapedCode = rawCode.replace(/([\\%_])/g, "\\$1");
      const { data: partner } = await svc
        .from("partners")
        .select("id, user_id, status, coupon_type, stripe_promotion_code_id")
        .ilike("coupon_code", escapedCode) // match exato case-insensitive
        .eq("status", "approved")
        .maybeSingle();
      if (partner) {
        const pr = partner as { id: string; user_id: string; coupon_type: string | null; stripe_promotion_code_id: string | null };
        const isAutoIndicacao = pr.user_id === user.id;
        // Exceção: self-subscribe validado E partner pertence à manager (member_id do vínculo).
        const allowAutoIndicacao = selfSubValidated && pr.user_id === selfSubManagerId;
        if (!isAutoIndicacao || allowAutoIndicacao) {
          partnerMeta = { partner_code: rawCode.toUpperCase(), partner_id: pr.id };
          if (pr.coupon_type === "client_discount" && pr.stripe_promotion_code_id) {
            appliedPromotionCodeId = pr.stripe_promotion_code_id;
          }
        }
      }
    }
    // Marca self_subscribe nas metadatas, webhook B.2 lê "1" pra NÃO gerar comissão.
    // Carrega TAMBÉM o manager_id (self_subscribe_manager_id): o webhook usa isso
    // pra ativar APENAS a linha pendente desse manager (F28). Sem esse metadado,
    // o webhook não ativa vínculo nenhum uma assinatura normal da PF não pode
    // "acordar" um vínculo pendente que outra gestora deixou armado.
    const selfSubMark: Record<string, string> = selfSubValidated && selfSubManagerId
      ? { self_subscribe: "1", self_subscribe_manager_id: selfSubManagerId }
      : {};
    // ────────────────────────────────────────────────────────────

    const origin = req.headers.get("origin") ?? "https://app.criasocialclub.com.br";

    const agencyMeta: Record<string, string> = isAgency ? { seats: String(seats) } : {};
    // sid={CHECKOUT_SESSION_ID} é substituído pelo Stripe, usado como event_id do Purchase (dedupe com o webhook).
    const successUrl = isAgency ? `${origin}/socialmidia/contas?checkout=success` : `${origin}/app/obrigado?checkout=success&sid={CHECKOUT_SESSION_ID}`;
    const cancelUrl = isAgency ? `${origin}/socialmidia/contas?checkout=cancel` : `${origin}/app/assinar?checkout=cancel`;

    const campanhaMeta: Record<string, string> = campanha ? { campanha: campanha.codigo } : {};
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: seats }],
      metadata: { app: "cria", user_id: contaId, plan, ...agencyMeta, ...partnerMeta, ...selfSubMark, ...metaPerfil, ...campanhaMeta },
      subscription_data: {
        metadata: { app: "cria", user_id: contaId, plan, ...agencyMeta, ...partnerMeta, ...selfSubMark, ...metaPerfil, ...campanhaMeta },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    };
    if (campanha) {
      // Cartão na hora: no fim do grátis o Stripe cobra sozinho.
      sessionParams.payment_method_collection = "always";
      // Checkout de campanha expira em 1 h: o fim do grátis é calculado agora e
      // o cupom começa a contar quando a pessoa conclui. Com até 1 h entre os
      // dois, o desconto cobre exatamente as N faturas (simulado em 2 anos de datas).
      sessionParams.expires_at = Math.floor(Date.now() / 1000) + 60 * 60;
      const mesesGratis = campanha.dias_gratis > 0 ? Math.max(1, Math.round(campanha.dias_gratis / 30)) : 0;
      if (mesesGratis > 0) sessionParams.subscription_data!.trial_end = fimDoGratis(new Date(), mesesGratis);
      const pct = Number(campanha.desconto_pct);
      if (pct > 0 && campanha.desconto_meses > 0) {
        const duracao = campanha.desconto_meses + mesesGratis;
        const base = `camp_${campanha.codigo.toLowerCase().replace(/[^a-z0-9_-]/g, "")}`;
        const nome = `${campanha.codigo} ${pct}% por ${campanha.desconto_meses} meses`.slice(0, 40);
        const confere = (cp: Stripe.Coupon) => cp.valid && cp.percent_off === pct
          && cp.duration === "repeating" && cp.duration_in_months === duracao;
        // Idempotente: mesmo id sempre. Se alguém mudou a regra da campanha, o
        // cupom antigo não serve e nasce um com a regra no id.
        let couponId: string | null = null;
        for (const id of [base, `${base}_${pct}p_${duracao}m`]) {
          try {
            const cp = await stripe.coupons.retrieve(id);
            if (confere(cp)) { couponId = cp.id; break; }
          } catch (e) {
            if ((e as { code?: string })?.code !== "resource_missing") throw e;
            const cp = await stripe.coupons.create({
              id, name: nome, percent_off: pct, duration: "repeating", duration_in_months: duracao,
              metadata: { app: "cria", campanha: campanha.codigo },
            });
            couponId = cp.id;
            break;
          }
        }
        if (!couponId) throw new Error(`cupom de campanha sem cupom Stripe valido: ${base}`);
        await svc.from("cupons_campanha").update({ stripe_coupon_id: couponId }).eq("codigo", campanha.codigo);
        sessionParams.discounts = [{ coupon: couponId }];
      }
    } else if (appliedPromotionCodeId) {
      sessionParams.discounts = [{ promotion_code: appliedPromotionCodeId }];
    } else {
      sessionParams.allow_promotion_codes = true;
    }
    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[create-checkout] error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
