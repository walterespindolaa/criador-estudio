import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

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

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (caller?.role !== "admin") return json({ error: "forbidden" }, 403);

    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) return json({ error: "stripe_not_configured" }, 500);
    const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

    let mrrCents = 0;
    let active = 0;
    let trialing = 0;
    let currency = "brl";
    // quebra por produto (somente assinaturas ATIVAS = pagantes reais)
    const breakdown: Record<string, { count: number; mrrCents: number; emails: string[] }> = {};

    for (const status of ["active", "trialing"] as const) {
      let startingAfter: string | undefined;
      for (let page = 0; page < 20; page++) {
        const res = await stripe.subscriptions.list({
          status,
          limit: 100,
          starting_after: startingAfter,
          expand: ["data.items.data.price.product", "data.customer"],
        });
        for (const sub of res.data) {
          if (status === "active") active++; else trialing++;
          let subMrr = 0;
          let label = "Outro";
          for (const item of sub.items.data) {
            const price = item.price;
            if (price?.currency) currency = price.currency;
            const amt = (price?.unit_amount ?? 0) * (item.quantity ?? 1);
            const interval = price?.recurring?.interval ?? "month";
            const factor = interval === "year" ? 1 / 12 : interval === "week" ? 4.345 : interval === "day" ? 30 : 1;
            const monthly = amt * factor;
            mrrCents += monthly;
            subMrr += monthly;
            const product = price?.product as { name?: string } | string | undefined;
            const pName = typeof product === "object" ? product?.name : undefined;
            label = pName || price?.nickname || label;
          }
          if (status === "active") {
            const cust = sub.customer as { email?: string } | string | undefined;
            const email = typeof cust === "object" ? (cust?.email ?? "") : "";
            const b = breakdown[label] ?? { count: 0, mrrCents: 0, emails: [] };
            b.count += 1;
            b.mrrCents += subMrr;
            if (email) b.emails.push(email);
            breakdown[label] = b;
          }
        }
        if (!res.has_more) break;
        startingAfter = res.data[res.data.length - 1]?.id;
      }
    }

    const mrr = Math.round(mrrCents) / 100;
    const planBreakdown = Object.entries(breakdown)
      .map(([label, b]) => ({ label, count: b.count, mrr: Math.round(b.mrrCents) / 100, emails: b.emails }))
      .sort((a, b) => b.mrr - a.mrr);

    return json({ active, trialing, mrr, currency: currency.toUpperCase(), planBreakdown });
  } catch (e) {
    console.error("[admin-billing] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
