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

  const obj = event.data.object as Record<string, unknown>;

  // ── Filtro de app: ignora eventos que não são do cria ──
  const appTag = (obj?.metadata as Record<string, string> | undefined)?.app;
  if (appTag && appTag !== "cria") {
    return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200 });
  }

  // ── Idempotência: já processamos esse evento? ──
  const { data: already } = await supabase
    .from("billing_events")
    .select("event_id")
    .eq("gateway", "stripe")
    .eq("event_id", event.id)
    .maybeSingle();
  if (already) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const userId = s.metadata?.user_id;
        const plan = s.metadata?.plan;
        if (!userId || !plan) break;

        await supabase.from("profiles").update({
          subscription_status: "active",
          stripe_customer_id: s.customer as string,
          stripe_subscription_id: s.subscription as string,
          plan,
        }).eq("id", userId);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        const plan = sub.metadata?.plan;

        const status =
          sub.status === "active" ? "active" :
          sub.status === "past_due" ? "past_due" :
          sub.status === "canceled" ? "canceled" :
          sub.status === "unpaid" ? "past_due" :
          sub.status;

        if (userId) {
          const update: Record<string, string> = { subscription_status: status };
          if (plan) update.plan = plan;
          await supabase.from("profiles").update(update).eq("id", userId);
        } else {
          // fallback: casa pelo stripe_subscription_id
          const { data: p } = await supabase.from("profiles")
            .select("id").eq("stripe_subscription_id", sub.id).maybeSingle();
          if (p) await supabase.from("profiles")
            .update({ subscription_status: status }).eq("id", p.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (userId) {
          await supabase.from("profiles")
            .update({ subscription_status: "canceled" }).eq("id", userId);
        } else {
          const { data: p } = await supabase.from("profiles")
            .select("id").eq("stripe_subscription_id", sub.id).maybeSingle();
          if (p) await supabase.from("profiles")
            .update({ subscription_status: "canceled" }).eq("id", p.id);
        }
        break;
      }

      default:
        // outros eventos: ignora silenciosamente
        break;
    }

    // ── Registra o evento como processado (idempotência + auditoria) ──
    await supabase.from("billing_events").insert({
      gateway: "stripe",
      event_id: event.id,
      type: event.type,
      payload: obj,
    });
  } catch (err) {
    console.error("[stripe-webhook] handler error:", err);
    return new Response("Handler Error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
