import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

/* ═══════════════════════════════════════════════════════════════════════════
   RESGATE DE COMPRA DIRETA (Payment Link da LP)

   A pessoa PAGA antes de ter conta. O stripe-webhook guarda a compra em
   pending_purchases (chave: session_id + e-mail). Esta função fecha o ciclo:

   - action "peek"  (sem auth): dado o session_id do redirect do Stripe,
     devolve e-mail e plano pra pré-preencher o cadastro. O session_id é um
     segredo longo que só quem pagou recebeu, por isso pode responder sem auth.
   - action "claim" (com auth): entrega a assinatura pro usuário logado.
     Com session_id: casa direto. Sem session_id: tenta pelo e-mail da conta
     (cobre quem confirmou o e-mail em outro navegador e perdeu o parâmetro).
   ═══════════════════════════════════════════════════════════════════════════ */

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

const STORAGE_BY_PLAN: Record<string, number> = {
  essencial: 524288000,
  pro: 5368709120,
  studio: 16106127360,
};

function planFromPrice(priceId: string): string | null {
  if (priceId && priceId === Deno.env.get("STRIPE_PRICE_ESSENCIAL")) return "essencial";
  if (priceId && priceId === Deno.env.get("STRIPE_PRICE_PRO")) return "pro";
  if (priceId && priceId === Deno.env.get("STRIPE_PRICE_STUDIO")) return "studio";
  return null;
}

type Purchase = {
  session_id: string; email: string; plan: string;
  stripe_customer_id: string; stripe_subscription_id: string;
  status: string; claimed_by: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const sessionId = body?.session_id ? String(body.session_id) : null;

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Resolve a compra: primeiro na tabela; se o webhook ainda não chegou,
    // direto no Stripe (e semeia a tabela pra próxima).
    const resolveBySession = async (sid: string): Promise<Purchase | null> => {
      const { data } = await svc.from("pending_purchases").select("*").eq("session_id", sid).maybeSingle();
      if (data) return data as Purchase;
      try {
        const s = await stripe.checkout.sessions.retrieve(sid);
        if (s.payment_status !== "paid" || !s.subscription) return null;
        const sub = await stripe.subscriptions.retrieve(s.subscription as string);
        const plan = planFromPrice(sub.items?.data?.[0]?.price?.id ?? "");
        if (!plan) return null;
        const row = {
          session_id: s.id,
          email: (s.customer_details?.email ?? "").toLowerCase(),
          plan,
          stripe_customer_id: s.customer as string,
          stripe_subscription_id: s.subscription as string,
          status: "pending",
        };
        await svc.from("pending_purchases").upsert(row, { onConflict: "session_id" });
        return { ...row, claimed_by: null } as Purchase;
      } catch {
        return null;
      }
    };

    if (action === "peek") {
      if (!sessionId) return json({ error: "missing_session" }, 400);
      const p = await resolveBySession(sessionId);
      if (!p) return json({ found: false });
      return json({ found: true, email: p.email, plan: p.plan, claimed: p.status === "claimed" });
    }

    if (action === "claim") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "unauthorized" }, 401);
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "unauthorized" }, 401);

      let p: Purchase | null = null;
      if (sessionId) p = await resolveBySession(sessionId);
      if (!p) {
        // Sem session_id (ou não achou): tenta compra pendente pelo e-mail da conta.
        const email = (user.email ?? "").toLowerCase();
        if (email) {
          const { data } = await svc.from("pending_purchases")
            .select("*").eq("email", email).eq("status", "pending")
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          p = (data as Purchase | null) ?? null;
        }
      }
      if (!p) return json({ claimed: false });
      if (p.status === "claimed" && p.claimed_by !== user.id) {
        // Outra conta já levou esta compra: não entrega duas vezes.
        return json({ claimed: false, error: "already_claimed" });
      }

      const { error: upErr } = await svc.from("profiles").update({
        subscription_status: "active",
        stripe_customer_id: p.stripe_customer_id,
        stripe_subscription_id: p.stripe_subscription_id,
        plan: p.plan,
        storage_quota_bytes: STORAGE_BY_PLAN[p.plan] ?? 524288000,
      }).eq("id", user.id);
      if (upErr) { console.error("[claim-purchase] profile update", upErr); return json({ error: "activate_failed" }, 500); }

      await svc.from("pending_purchases").update({
        status: "claimed", claimed_by: user.id, claimed_at: new Date().toISOString(),
      }).eq("session_id", p.session_id);

      // Metadados na assinatura: eventos futuros do Stripe passam a saber de quem é.
      try {
        await stripe.subscriptions.update(p.stripe_subscription_id, {
          metadata: { app: "cria", user_id: user.id, plan: p.plan },
        });
      } catch { /* cosmético, o fallback por stripe_subscription_id cobre */ }

      return json({ claimed: true, plan: p.plan });
    }

    return json({ error: "invalid_action" }, 400);
  } catch (e) {
    console.error("[claim-purchase] unhandled", e);
    return json({ error: "internal_error" }, 500);
  }
});
