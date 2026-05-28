import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return new Response("Webhook Error", { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session | Stripe.Subscription;

  switch (event.type) {
    case "checkout.session.completed": {
      const s = session as Stripe.Checkout.Session;
      const userId = s.metadata?.user_id;
      if (!userId) break;

      await supabase.from("profiles").update({
        subscription_status: "active",
        stripe_customer_id: s.customer as string,
        stripe_subscription_id: s.subscription as string,
        plan: "pro",
      }).eq("id", userId);

      await supabase.from("subscriptions").insert({
        user_id: userId,
        gateway: "stripe",
        gateway_customer_id: s.customer as string,
        gateway_subscription_id: s.subscription as string,
        gateway_payment_id: s.id,
        status: "active",
        plan: "pro",
        amount_cents: s.amount_total ?? 0,
        currency: s.currency?.toUpperCase() ?? "BRL",
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      break;
    }

    case "customer.subscription.updated": {
      const sub = session as Stripe.Subscription;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("stripe_subscription_id", sub.id)
        .single();

      if (profile) {
        await supabase.from("profiles").update({
          subscription_status: sub.status === "active" ? "active" : sub.status,
        }).eq("id", profile.id);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = session as Stripe.Subscription;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("stripe_subscription_id", sub.id)
        .single();

      if (profile) {
        await supabase.from("profiles").update({
          subscription_status: "canceled",
          plan: "free",
        }).eq("id", profile.id);
      }
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
