import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

/* DESTAQUE DO CRIAKUT (Walter, 14/10/2026): R$ 14,90 por mês, assinatura no
   Stripe igual aos módulos. Nasce desligado: só vende com a chave
   'destaque_ativo' ligada no painel do Admin. Não gera comissão de parceira
   (o webhook pula kind=criakut_destaque no invoice.paid).
   Preço: usa STRIPE_CRIAKUT_DESTAQUE_PRICE_ID se existir; sem ele, monta o
   preço na hora (R$ 14,90/mês), pra não travar o lançamento por falta de
   cadastro no painel do Stripe. */

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const PRICE_ID = Deno.env.get("STRIPE_CRIAKUT_DESTAQUE_PRICE_ID") ?? "";
const VALOR_CENTAVOS = 1490;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const acao = body?.acao === "gerenciar" ? "gerenciar" : "comprar";
    // Volta só pra dentro do Criakut (nada de URL de fora vinda do navegador).
    const volta = typeof body?.volta === "string" && /^\/(app|socialmidia)\/criakut$/.test(body.volta) ? body.volta : "/app/criakut";
    const origin = req.headers.get("origin") ?? "https://app.criasocialclub.com.br";

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await svc.from("profiles").select("stripe_customer_id, name").eq("id", user.id).maybeSingle();
    let customerId = (profile as { stripe_customer_id: string | null } | null)?.stripe_customer_id ?? undefined;

    if (acao === "gerenciar") {
      if (!customerId) return json({ error: "sem_assinatura" }, 404);
      const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${origin}${volta}` });
      return json({ url: portal.url });
    }

    // Confere no banco: venda ligada, página publicada, não é criadora, sem destaque ativo.
    const { data: cfg } = await svc.from("criakut_config").select("valor").eq("chave", "destaque_ativo").maybeSingle();
    if ((cfg as { valor: unknown } | null)?.valor !== true) return json({ error: "desligado" }, 403);
    const { data: perfil } = await svc.from("criakut_perfis").select("publicado, funcao").eq("user_id", user.id).maybeSingle();
    const p = perfil as { publicado: boolean; funcao: string } | null;
    if (!p || !p.publicado) return json({ error: "pagina_escondida" }, 403);
    if (p.funcao === "criadora") return json({ error: "criadora" }, 403);
    const { data: dest } = await svc.from("criakut_destaques").select("status").eq("user_id", user.id).maybeSingle();
    const st = (dest as { status: string } | null)?.status;
    if (st === "active" || st === "trialing" || st === "past_due") return json({ error: "ja_ativo" }, 409);

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email, name: (profile as { name: string | null } | null)?.name ?? undefined,
        metadata: { app: "cria", user_id: user.id },
      });
      customerId = customer.id;
      await svc.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    // Sem user_id na metadata de propósito: o webhook trata user_id como plano-base.
    const meta = { app: "cria", kind: "criakut_destaque", destaque_user: user.id };
    const item: Stripe.Checkout.SessionCreateParams.LineItem = PRICE_ID
      ? { price: PRICE_ID, quantity: 1 }
      : { quantity: 1, price_data: { currency: "brl", unit_amount: VALOR_CENTAVOS, recurring: { interval: "month" },
          product_data: { name: "Destaque no Criakut" } } };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [item],
      payment_method_types: ["card"],
      metadata: meta,
      subscription_data: { metadata: meta },
      success_url: `${origin}${volta}?destaque=ok`,
      cancel_url: `${origin}${volta}?destaque=cancelado`,
    });
    return json({ url: session.url });
  } catch (err) {
    console.error("[criakut-destaque-checkout] error:", err);
    return json({ error: "internal_error" }, 500);
  }
});
