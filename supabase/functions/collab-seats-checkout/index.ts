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

// Assento de colaborador: R$29,90/mês por assento extra (o 1º é grátis).
const SEAT_PRICE_ID = Deno.env.get("STRIPE_COLLAB_SEAT_PRICE_ID") ?? "price_1TqxUfRDE8ybSi6VJCU01dGn";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    // Quantidade de assentos EXTRAS (pagos). Ex.: quer 3 colaboradores → 1 grátis + 2 pagos → seats=2.
    const seats = Math.max(1, Math.floor(Number(body?.seats) || 1));

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await svc.from("profiles")
      .select("stripe_customer_id, name, collab_seats_subscription_id").eq("id", user.id).maybeSingle();

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
    const meta = { app: "cria", kind: "collab_seats", manager_id: user.id, seats: String(seats) };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: SEAT_PRICE_ID, quantity: seats }],
      metadata: meta,
      subscription_data: { metadata: meta },
      success_url: `${origin}/socialmidia/equipe?checkout=success`,
      cancel_url: `${origin}/socialmidia/equipe?checkout=cancel`,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error("[collab-seats-checkout] error:", err);
    return json({ error: "internal_error" }, 500);
  }
});
