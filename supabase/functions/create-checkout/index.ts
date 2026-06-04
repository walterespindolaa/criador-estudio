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
    if (plan !== "pro" && plan !== "studio") {
      return new Response(JSON.stringify({ error: "invalid_plan" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const priceId = plan === "studio"
      ? Deno.env.get("STRIPE_PRICE_STUDIO")!
      : Deno.env.get("STRIPE_PRICE_PRO")!;

    // Service client pra ler/gravar o stripe_customer_id
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: profile } = await svc
      .from("profiles")
      .select("stripe_customer_id, name")
      .eq("id", user.id)
      .single();

    // Reusa customer existente ou cria
    let customerId = profile?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.name ?? undefined,
        metadata: { app: "cria", user_id: user.id },
      });
      customerId = customer.id;
      await svc.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    // ── Self-subscribe (manager assinando pra conta PF dela) ────
    // O front passa self_subscribe:true quando o user logado tem
    // user_metadata.self_subscribe_plan. Validamos via account_members:
    // owner_id=user.id (PF) + pending_self_subscribe=true.
    const selfSubRequest = body?.self_subscribe === true;
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
    const rawCode = (typeof body?.partner_code === "string" ? body.partner_code : "").trim();
    if (rawCode) {
      const { data: partner } = await svc
        .from("partners")
        .select("id, user_id, status, coupon_type, stripe_promotion_code_id")
        .ilike("coupon_code", rawCode) // match exato case-insensitive (sem %)
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
    // Marca self_subscribe nas metadatas — webhook B.2 lê "1" pra NÃO gerar comissão.
    const selfSubMark: Record<string, string> = selfSubValidated ? { self_subscribe: "1" } : {};
    // ────────────────────────────────────────────────────────────

    const origin = req.headers.get("origin") ?? "https://app.criasocialclub.com.br";

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { app: "cria", user_id: user.id, plan, ...partnerMeta, ...selfSubMark },
      subscription_data: {
        metadata: { app: "cria", user_id: user.id, plan, ...partnerMeta, ...selfSubMark },
      },
      success_url: `${origin}/app?checkout=success`,
      cancel_url: `${origin}/app/assinar?checkout=cancel`,
    };
    if (appliedPromotionCodeId) {
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
