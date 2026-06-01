import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

type AnyTable = (table: string) => ReturnType<SupabaseClient["from"]>;

function normalizeBase(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^A-Za-z0-9]/g, "")    // strip special chars
    .toUpperCase()
    .slice(0, 12);
}

function deriveBaseCode(fullName: string | null, instagram: string | null): string {
  const fromName = fullName ? normalizeBase(fullName.split(/\s+/)[0] ?? "") : "";
  const fromIg = instagram ? normalizeBase(instagram.replace(/^@/, "")) : "";
  if (fromName.length >= 3) return fromName;
  if (fromIg.length >= 3) return fromIg;
  return "PARCEIRA";
}

function randomSuffix(): string {
  return String(Math.floor(Math.random() * 1000)).padStart(3, "0");
}

async function isCodeAvailable(svc: SupabaseClient, code: string): Promise<boolean> {
  const sbFrom = svc.from.bind(svc) as unknown as AnyTable;
  const { data, error } = await sbFrom("partners").select("id").eq("coupon_code", code).maybeSingle();
  if (error) return false; // se a query falha, assume não disponível (força retry)
  return !data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const sbFrom = svc.from.bind(svc) as unknown as AnyTable;

    // Caller precisa ser admin
    const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (caller?.role !== "admin") return json({ error: "forbidden" }, 403);

    // Body
    const body = await req.json().catch(() => ({}));
    const partnerId = body?.partner_id;
    const couponType = body?.coupon_type;
    const discountPct = body?.discount_pct;

    if (!partnerId || typeof partnerId !== "string") {
      return json({ error: "missing_partner_id" }, 400);
    }
    if (couponType !== "tracking" && couponType !== "client_discount") {
      return json({ error: "invalid_coupon_type" }, 400);
    }
    if (couponType === "client_discount") {
      if (typeof discountPct !== "number" || !Number.isFinite(discountPct) || discountPct < 1 || discountPct > 100) {
        return json({ error: "invalid_discount_pct" }, 400);
      }
    }

    // Busca o parceiro
    const { data: partnerRow, error: pErr } = await sbFrom("partners")
      .select("id, user_id, full_name, instagram_handle, coupon_code, status")
      .eq("id", partnerId)
      .maybeSingle();
    if (pErr) {
      console.error("[partner-approve] fetch partner failed:", pErr);
      return json({ error: "internal_error" }, 500);
    }
    if (!partnerRow) return json({ error: "partner_not_found" }, 404);
    const partner = partnerRow as {
      id: string;
      user_id: string;
      full_name: string | null;
      instagram_handle: string | null;
      coupon_code: string | null;
      status: string;
    };

    // Gera coupon_code único na tabela
    const baseCode = deriveBaseCode(partner.full_name, partner.instagram_handle);
    let couponCode = baseCode;
    let dbAttempt = 0;
    while (dbAttempt < 20 && !(await isCodeAvailable(svc, couponCode))) {
      couponCode = `${baseCode}${randomSuffix()}`;
      dbAttempt++;
    }
    if (dbAttempt >= 20) {
      return json({ error: "could_not_generate_unique_code" }, 500);
    }

    let stripeCouponId: string | null = null;
    let stripePromotionCodeId: string | null = null;

    if (couponType === "client_discount") {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        console.error("[partner-approve] STRIPE_SECRET_KEY not set");
        return json({ error: "stripe_not_configured" }, 500);
      }
      const stripe = new Stripe(stripeKey, {
        apiVersion: "2024-06-20",
        httpClient: Stripe.createFetchHttpClient(),
      });

      // Cria o coupon (objeto de desconto) uma vez — pode ser reusado em N promotion codes
      let coupon: Stripe.Coupon;
      try {
        coupon = await stripe.coupons.create({
          percent_off: discountPct,
          duration: "once", // só na 1ª fatura
          name: `Parceira ${couponCode}`,
        });
      } catch (err) {
        const msg = (err as { message?: string })?.message ?? "stripe_unknown";
        console.error("[partner-approve] stripe coupons.create failed:", err);
        return json({ error: "stripe_error", message: msg.slice(0, 200) }, 502);
      }

      // Cria o promotion code com o code custom; retry com sufixos se conflitar
      let promo: Stripe.PromotionCode | null = null;
      for (let i = 0; i < 20; i++) {
        try {
          promo = await stripe.promotionCodes.create({
            coupon: coupon.id,
            code: couponCode,
          });
          break;
        } catch (err) {
          const msg = (err as { message?: string })?.message ?? "";
          // Conflito de code (já existe no Stripe) → tenta sufixo novo
          if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("promotion code")) {
            couponCode = `${baseCode}${randomSuffix()}`;
            // garante que o novo code ainda está livre na tabela
            if (!(await isCodeAvailable(svc, couponCode))) continue;
            continue;
          }
          console.error("[partner-approve] stripe promotionCodes.create failed:", err);
          return json({ error: "stripe_error", message: msg.slice(0, 200) }, 502);
        }
      }
      if (!promo) {
        return json({ error: "could_not_create_promotion_code" }, 500);
      }

      stripeCouponId = coupon.id;
      stripePromotionCodeId = promo.id;
    }

    // Update da row
    const patch: Record<string, unknown> = {
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
      coupon_type: couponType,
      coupon_discount_pct: couponType === "client_discount" ? discountPct : null,
      stripe_coupon_id: stripeCouponId,
      stripe_promotion_code_id: stripePromotionCodeId,
      coupon_code: couponCode,
    };
    const { error: uErr } = await sbFrom("partners").update(patch).eq("id", partnerId);
    if (uErr) {
      console.error("[partner-approve] update partner failed:", uErr);
      return json({ error: "internal_error" }, 500);
    }

    return json({ ok: true, coupon_code: couponCode });
  } catch (e) {
    console.error("[partner-approve] unhandled error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
