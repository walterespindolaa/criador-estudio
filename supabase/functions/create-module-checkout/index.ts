import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const moduleCode = typeof body?.module_code === "string" ? body.module_code : "";
    if (!moduleCode) {
      return new Response(JSON.stringify({ error: "invalid_module" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // módulo precisa existir, estar ativo e ter price configurado
    const { data: mod } = await svc
      .from("modules").select("code, active, stripe_price_id").eq("code", moduleCode).maybeSingle();
    const m = mod as { code: string; active: boolean; stripe_price_id: string | null } | null;
    if (!m || !m.active || !m.stripe_price_id) {
      return new Response(JSON.stringify({ error: "module_unavailable" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // exige cadastro completo da manager (preenchido no front antes do checkout)
    const { data: mp } = await svc
      .from("manager_profiles").select("id").eq("user_id", user.id).maybeSingle();
    if (!mp) {
      return new Response(JSON.stringify({ error: "manager_profile_required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // já tem esse módulo ativo? não deixa assinar de novo
    const { data: ent } = await svc
      .from("module_entitlements").select("id")
      .eq("manager_id", user.id).eq("module_code", moduleCode).eq("status", "active").maybeSingle();
    if (ent) {
      return new Response(JSON.stringify({ error: "already_subscribed" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // reusa o MESMO customer da assinatura-base
    const { data: profile } = await svc
      .from("profiles").select("stripe_customer_id, name").eq("id", user.id).maybeSingle();
    let customerId = (profile as { stripe_customer_id: string | null } | null)?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: (profile as { name: string | null } | null)?.name ?? undefined,
        metadata: { app: "cria", user_id: user.id },
      });
      customerId = customer.id;
      await svc.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const origin = req.headers.get("origin") ?? "https://app.criasocialclub.com.br";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: m.stripe_price_id, quantity: 1 }],
      metadata: { app: "cria", kind: "module", module_code: moduleCode, manager_id: user.id },
      subscription_data: {
        metadata: { app: "cria", kind: "module", module_code: moduleCode, manager_id: user.id },
      },
      success_url: `${origin}/app/modulos?checkout=success`,
      cancel_url: `${origin}/app/modulos?checkout=cancel`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[create-module-checkout] error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
