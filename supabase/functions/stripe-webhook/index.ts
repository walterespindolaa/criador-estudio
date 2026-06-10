import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const DEDUCTION_PCT_FALLBACK = 10; // fallback se partner_program_config não tiver linha

// Mantém em sincronia com STORAGE_BYTES do src/lib/plans.ts (runtime Deno não importa o frontend)
const STORAGE_BY_PLAN: Record<string, number> = { pro: 5368709120, studio: 16106127360 };

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
        // ── MÓDULO PAGO: cria o entitlement e NÃO toca na assinatura-base ──
        if (s.metadata?.kind === "module") {
          const moduleCode = s.metadata?.module_code;
          const managerId = s.metadata?.manager_id;
          if (moduleCode && managerId) {
            await supabase.from("module_entitlements").upsert({
              manager_id: managerId,
              module_code: moduleCode,
              status: "active",
              stripe_customer_id: s.customer as string,
              stripe_subscription_id: s.subscription as string,
              updated_at: new Date().toISOString(),
            }, { onConflict: "stripe_subscription_id" });
          }
          break;
        }
        const userId = s.metadata?.user_id;
        const plan = s.metadata?.plan;
        if (!userId || !plan) break;

        await supabase.from("profiles").update({
          subscription_status: "active",
          stripe_customer_id: s.customer as string,
          stripe_subscription_id: s.subscription as string,
          plan,
          storage_quota_bytes: STORAGE_BY_PLAN[plan] ?? 524288000,
        }).eq("id", userId);

        // Self-subscribe: ativa vínculo pendente manager→PF.
        // PF (owner_id) agora aparece automaticamente na equipe da gestora.
        await supabase.from("account_members")
          .update({
            status: "active",
            pending_self_subscribe: false,
            accepted_at: new Date().toISOString(),
          })
          .eq("owner_id", userId)
          .eq("pending_self_subscribe", true);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        // ── MÓDULO PAGO: sincroniza status do entitlement ──
        if (sub.metadata?.kind === "module") {
          const moduleCode = sub.metadata?.module_code;
          const managerId = sub.metadata?.manager_id;
          const mstatus =
            sub.status === "active" ? "active" :
            sub.status === "trialing" ? "active" :
            sub.status === "past_due" ? "past_due" :
            sub.status === "unpaid" ? "past_due" :
            sub.status === "canceled" ? "canceled" : sub.status;
          const periodEnd = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString() : null;
          if (moduleCode && managerId) {
            await supabase.from("module_entitlements").upsert({
              manager_id: managerId,
              module_code: moduleCode,
              status: mstatus,
              stripe_customer_id: sub.customer as string,
              stripe_subscription_id: sub.id,
              current_period_end: periodEnd,
              updated_at: new Date().toISOString(),
            }, { onConflict: "stripe_subscription_id" });
          }
          break;
        }
        const userId = sub.metadata?.user_id;
        const plan = sub.metadata?.plan;

        const status =
          sub.status === "active" ? "active" :
          sub.status === "past_due" ? "past_due" :
          sub.status === "canceled" ? "canceled" :
          sub.status === "unpaid" ? "past_due" :
          sub.status;

        if (userId) {
          const update: Record<string, string | number> = { subscription_status: status };
          if (plan) update.plan = plan;
          if (plan && status === "active") update.storage_quota_bytes = STORAGE_BY_PLAN[plan] ?? 524288000;
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
        // ── MÓDULO PAGO: revoga o entitlement ──
        if (sub.metadata?.kind === "module") {
          await supabase.from("module_entitlements")
            .update({ status: "canceled", updated_at: new Date().toISOString() })
            .eq("stripe_subscription_id", sub.id);
          break;
        }
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
        // B.2 — cancelamento antes da liberação anula só 'pending'.
        // 'payable' (sobreviveu à carência) e 'paid' (já pagamos) são mantidos.
        await supabase.from("partner_referrals")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
            cancel_reason: "subscription_canceled",
          })
          .eq("stripe_subscription_id", sub.id)
          .eq("status", "pending");
        break;
      }

      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        const subId = inv.subscription as string | null;
        if (!subId) break;

        // metadata de atribuição vive na SUBSCRIPTION, não na invoice
        const sub = await stripe.subscriptions.retrieve(subId);
        const md = sub.metadata || {};
        // módulo pago não gera comissão de parceira
        if (md.kind === "module") break;
        const partnerId = md.partner_id;
        const referredUserId = md.user_id;
        const selfSub = md.self_subscribe === "1";

        // sem atribuição ou self-subscribe → sem comissão
        if (!partnerId || !referredUserId || selfSub) break;

        // dono do cupom — usado pelas duas checagens abaixo
        const { data: partnerRow } = await supabase
          .from("partners").select("user_id").eq("id", partnerId).maybeSingle();
        const ownerOfCoupon = partnerRow ? (partnerRow as { user_id: string }).user_id : null;

        // proteção auto-indicação: partner.user_id === quem assinou
        if (ownerOfCoupon && ownerOfCoupon === referredUserId) break;

        // proteção defensiva self-subscribe: não confiar só na metadata.
        // Se a conta PF (referredUserId) é gerenciada pelo dono do cupom → self-assinatura
        // da manager (não importa se o front esqueceu a flag self_subscribe="1").
        if (ownerOfCoupon) {
          const { data: amLink } = await supabase
            .from("account_members")
            .select("id")
            .eq("owner_id", referredUserId)
            .eq("member_id", ownerOfCoupon)
            .maybeSingle();
          if (amLink) break; // self-subscribe por vínculo → sem comissão
        }

        const billingReason = inv.billing_reason;
        const amountPaid = inv.amount_paid ?? 0; // centavos, valor real (com desconto)

        const { data: cfg } = await supabase
          .from("partner_program_config").select("deduction_pct").eq("id", true).maybeSingle();
        const deductionPct = cfg
          ? Number((cfg as { deduction_pct: number }).deduction_pct)
          : DEDUCTION_PCT_FALLBACK;

        const { data: existing } = await supabase
          .from("partner_referrals").select("*").eq("stripe_subscription_id", subId).maybeSingle();

        if (billingReason === "subscription_create") {
          // 1ª fatura → cria pending (idempotente)
          if (!existing) {
            const net = Math.round(amountPaid * (1 - deductionPct / 100));
            await supabase.from("partner_referrals").insert({
              partner_id: partnerId,
              referred_user_id: referredUserId,
              stripe_customer_id: inv.customer as string,
              stripe_subscription_id: subId,
              first_invoice_id: inv.id,
              gross_amount_cents: amountPaid,
              deduction_pct: deductionPct,
              net_amount_cents: net,
              currency: inv.currency || "brl",
              paid_invoices_count: 1,
              status: "pending",
            });
          }
        } else if (billingReason === "subscription_cycle") {
          // renovação → incrementa; ao chegar a 2 pagas, libera
          if (existing) {
            const e = existing as { id: string; paid_invoices_count: number; status: string };
            const newCount = (e.paid_invoices_count ?? 1) + 1;
            const patch: Record<string, unknown> = { paid_invoices_count: newCount };
            if (newCount >= 2 && e.status === "pending") {
              patch.status = "payable";
              patch.unlocked_at = new Date().toISOString();
            }
            await supabase.from("partner_referrals").update(patch).eq("id", e.id);
          }
        }
        break;
      }

      case "charge.refunded": {
        // estorno total → anula comissão pending OU payable. Não toca em 'paid' (já transferimos).
        const charge = event.data.object as Stripe.Charge;
        const invId = charge.invoice as string | null;
        if (!invId) break;
        const inv = await stripe.invoices.retrieve(invId);
        const subId = inv.subscription as string | null;
        if (!subId) break;

        const fullRefund = charge.refunded === true || (charge.amount_refunded >= charge.amount);
        if (!fullRefund) break;

        await supabase.from("partner_referrals")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
            cancel_reason: "refund",
          })
          .eq("stripe_subscription_id", subId)
          .in("status", ["pending", "payable"]);
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
