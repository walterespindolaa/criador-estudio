import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

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

// Pacote de expansão da carteira: +10 clientes por pacote (R$19,90/mês cada).
// A conta grátis cobre 3 clientes; o teto = 3 + (bônus + pagos) * 10.
// Espelho fiel do collab-seats-checkout (mesma mecânica de quantidade).
const PACK_PRICE_ID = Deno.env.get("STRIPE_CLIENT_PACK_PRICE_ID") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!PACK_PRICE_ID) return json({ error: "config_missing", message: "STRIPE_CLIENT_PACK_PRICE_ID não configurado." }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    // Quantidade TOTAL de pacotes pagos desejada (1 pacote = +10 clientes).
    const packs = Math.max(1, Math.min(50, Math.floor(Number(body?.packs) || 1)));

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await svc.from("profiles")
      .select("stripe_customer_id, name, account_type, client_packs_subscription_id")
      .eq("id", user.id).maybeSingle();
    if ((profile as { account_type?: string | null } | null)?.account_type !== "manager") {
      return json({ error: "forbidden_not_manager" }, 403);
    }

    let customerId = (profile as { stripe_customer_id: string | null } | null)?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email, name: (profile as { name: string | null } | null)?.name ?? undefined,
        metadata: { app: "cria", user_id: user.id },
      });
      customerId = customer.id;
      await svc.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const origin = req.headers.get("origin") ?? "https://app.criasocialclub.com.br";
    const meta = { app: "cria", kind: "client_packs", manager_id: user.id, packs: String(packs) };

    // Já tem assinatura de pacotes? Atualiza a QUANTIDADE (pró-rata) em vez de
    // abrir checkout novo — mesma lição aprendida nos assentos de colaborador.
    const existingSubId =
      (profile as { client_packs_subscription_id: string | null } | null)?.client_packs_subscription_id ?? null;
    if (existingSubId) {
      try {
        const sub = await stripe.subscriptions.retrieve(existingSubId);
        if (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due") {
          const item = sub.items.data[0];
          await stripe.subscriptions.update(existingSubId, {
            items: [{ id: item.id, quantity: packs }],
            proration_behavior: "create_prorations",
            metadata: meta,
          });
          // Reflete na hora; o webhook customer.subscription.updated confirma depois.
          await svc.from("profiles").update({ paid_client_packs: packs }).eq("id", user.id);
          return json({ updated: true, packs });
        }
      } catch (e) {
        console.warn("[client-packs-checkout] sub antiga inacessível, criando nova:", e);
        await svc.from("profiles")
          .update({ client_packs_subscription_id: null, paid_client_packs: 0 }).eq("id", user.id);
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: PACK_PRICE_ID, quantity: packs }],
      metadata: meta,
      subscription_data: { metadata: meta },
      success_url: `${origin}/socialmidia/clientes?checkout=success`,
      cancel_url: `${origin}/socialmidia/clientes?checkout=cancel`,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error("[client-packs-checkout] error:", err);
    return json({ error: "internal_error" }, 500);
  }
});
