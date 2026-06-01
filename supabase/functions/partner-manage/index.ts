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

const ALLOWED_MONTHS = [1, 3, 6, 12];

function normalizeBase(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 12);
}

function randomSuffix(): string {
  return String(Math.floor(Math.random() * 1000)).padStart(3, "0");
}

async function isCodeAvailable(svc: SupabaseClient, code: string, excludePartnerId?: string): Promise<boolean> {
  const sbFrom = svc.from.bind(svc) as unknown as AnyTable;
  let q = sbFrom("partners").select("id").eq("coupon_code", code);
  if (excludePartnerId) q = q.neq("id", excludePartnerId);
  const { data, error } = await q.maybeSingle();
  if (error) return false;
  return !data;
}

async function createDiscountCoupon(
  stripe: Stripe,
  code: string,
  pct: number,
  months: number,
): Promise<{ coupon_id: string; promo_id: string }> {
  const coupon = await stripe.coupons.create({
    percent_off: pct,
    ...(months === 1
      ? { duration: "once" }
      : { duration: "repeating", duration_in_months: months }),
    name: `Parceira ${code}`,
  });
  const promo = await stripe.promotionCodes.create({
    coupon: coupon.id,
    code,
  });
  return { coupon_id: coupon.id, promo_id: promo.id };
}

async function archivePromo(stripe: Stripe, promoId: string | null): Promise<void> {
  if (!promoId) return;
  try {
    await stripe.promotionCodes.update(promoId, { active: false });
  } catch (err) {
    // Promo já pode estar arquivado / não existir mais. Loga mas não bloqueia.
    console.error("[partner-manage] archive promo failed:", err);
  }
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

    const body = await req.json().catch(() => ({}));
    const partnerId = body?.partner_id;
    const action = body?.action;

    if (!partnerId || typeof partnerId !== "string") {
      return json({ error: "missing_partner_id" }, 400);
    }
    if (!["edit_coupon", "suspend", "reactivate", "delete"].includes(action)) {
      return json({ error: "invalid_action" }, 400);
    }

    // Busca o parceiro
    const { data: partnerRow, error: pErr } = await sbFrom("partners")
      .select("id, full_name, instagram_handle, coupon_code, coupon_type, coupon_discount_pct, coupon_duration_months, stripe_coupon_id, stripe_promotion_code_id, status")
      .eq("id", partnerId)
      .maybeSingle();
    if (pErr) {
      console.error("[partner-manage] fetch partner failed:", pErr);
      return json({ error: "internal_error" }, 500);
    }
    if (!partnerRow) return json({ error: "partner_not_found" }, 404);
    const partner = partnerRow as {
      id: string;
      full_name: string | null;
      instagram_handle: string | null;
      coupon_code: string | null;
      coupon_type: string | null;
      coupon_discount_pct: number | null;
      coupon_duration_months: number | null;
      stripe_coupon_id: string | null;
      stripe_promotion_code_id: string | null;
      status: string;
    };

    // Stripe lazy init (algumas actions só mexem no banco)
    let _stripe: Stripe | null = null;
    const getStripe = (): Stripe => {
      if (_stripe) return _stripe;
      const key = Deno.env.get("STRIPE_SECRET_KEY");
      if (!key) throw new Error("stripe_not_configured");
      _stripe = new Stripe(key, {
        apiVersion: "2024-06-20",
        httpClient: Stripe.createFetchHttpClient(),
      });
      return _stripe;
    };

    // ── SUSPEND ──────────────────────────────────────────────
    if (action === "suspend") {
      if (partner.stripe_promotion_code_id) {
        try {
          await archivePromo(getStripe(), partner.stripe_promotion_code_id);
        } catch (err) {
          const msg = (err as { message?: string })?.message ?? "";
          if (msg === "stripe_not_configured") {
            console.error("[partner-manage] suspend: STRIPE_SECRET_KEY missing");
            // Continua — a suspensão no DB é o essencial
          }
        }
      }
      const { error } = await sbFrom("partners").update({ status: "suspended" }).eq("id", partnerId);
      if (error) {
        console.error("[partner-manage] suspend update failed:", error);
        return json({ error: "internal_error" }, 500);
      }
      return json({ ok: true });
    }

    // ── REACTIVATE ───────────────────────────────────────────
    if (action === "reactivate") {
      const patch: Record<string, unknown> = { status: "approved" };

      // Recria coupon+promo só se tinha desconto antes
      if (partner.coupon_type === "client_discount" && partner.coupon_discount_pct != null) {
        try {
          const stripe = getStripe();
          const months = partner.coupon_duration_months ?? 1;
          const code = partner.coupon_code ?? "PARCEIRA";
          const { coupon_id, promo_id } = await createDiscountCoupon(
            stripe,
            code,
            partner.coupon_discount_pct,
            months,
          );
          patch.stripe_coupon_id = coupon_id;
          patch.stripe_promotion_code_id = promo_id;
        } catch (err) {
          const msg = (err as { message?: string })?.message ?? "stripe_unknown";
          console.error("[partner-manage] reactivate stripe step failed:", err);
          if (msg === "stripe_not_configured") return json({ error: "stripe_not_configured" }, 500);
          return json({ error: "stripe_error", message: msg.slice(0, 200) }, 502);
        }
      }

      const { error } = await sbFrom("partners").update(patch).eq("id", partnerId);
      if (error) {
        console.error("[partner-manage] reactivate update failed:", error);
        return json({ error: "internal_error" }, 500);
      }
      return json({ ok: true });
    }

    // ── DELETE ───────────────────────────────────────────────
    if (action === "delete") {
      if (partner.stripe_promotion_code_id) {
        try {
          await archivePromo(getStripe(), partner.stripe_promotion_code_id);
        } catch {
          // Stripe não-configurado ou outro erro: não bloqueia o delete da row
        }
      }
      const { error } = await sbFrom("partners").delete().eq("id", partnerId);
      if (error) {
        console.error("[partner-manage] delete failed:", error);
        return json({ error: "internal_error" }, 500);
      }
      // partner_referrals cascateia via FK ON DELETE CASCADE
      return json({ ok: true });
    }

    // ── EDIT_COUPON ──────────────────────────────────────────
    if (action === "edit_coupon") {
      const couponType = body?.coupon_type;
      const discountPct = body?.discount_pct;
      const durationMonths = body?.duration_months;
      const inputCode = body?.coupon_code;

      if (couponType !== "tracking" && couponType !== "client_discount") {
        return json({ error: "invalid_coupon_type" }, 400);
      }

      // Resolve palavra do cupom
      let newCode = partner.coupon_code ?? "";
      if (typeof inputCode === "string") {
        const cleaned = inputCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (cleaned.length >= 2) newCode = cleaned;
      }
      if (!newCode) {
        const fromName = normalizeBase(partner.full_name?.split(/\s+/)[0] ?? "");
        const fromIg = normalizeBase((partner.instagram_handle ?? "").replace(/^@/, ""));
        newCode = fromName.length >= 3 ? fromName : (fromIg.length >= 3 ? fromIg : "PARCEIRA");
      }

      // Garante unicidade no banco se a palavra mudou
      if (newCode !== partner.coupon_code) {
        const base = newCode;
        let candidate = base;
        let attempt = 0;
        while (attempt < 20 && !(await isCodeAvailable(svc, candidate, partnerId))) {
          candidate = `${base}${randomSuffix()}`;
          attempt++;
        }
        if (attempt >= 20) return json({ error: "could_not_generate_unique_code" }, 500);
        newCode = candidate;
      }

      // Arquiva promo antigo (se houver)
      if (partner.stripe_promotion_code_id) {
        try {
          await archivePromo(getStripe(), partner.stripe_promotion_code_id);
        } catch (err) {
          const msg = (err as { message?: string })?.message ?? "";
          if (msg === "stripe_not_configured" && couponType === "client_discount") {
            return json({ error: "stripe_not_configured" }, 500);
          }
          // se for tracking, segue sem Stripe
        }
      }

      let patch: Record<string, unknown>;

      if (couponType === "client_discount") {
        if (typeof discountPct !== "number" || !Number.isFinite(discountPct) || discountPct < 1 || discountPct > 100) {
          return json({ error: "invalid_discount_pct" }, 400);
        }
        const months = ALLOWED_MONTHS.includes(durationMonths) ? durationMonths : 1;

        const stripe = getStripe();
        let finalCode = newCode;
        let result: { coupon_id: string; promo_id: string } | null = null;
        for (let i = 0; i < 20; i++) {
          try {
            result = await createDiscountCoupon(stripe, finalCode, discountPct, months);
            break;
          } catch (err) {
            const errMsg = (err as { message?: string })?.message ?? "";
            // Conflito de code no Stripe → tenta sufixo novo (e garante no banco também)
            if (/already|promotion code|conflict|exists/i.test(errMsg)) {
              const candidate = `${newCode}${randomSuffix()}`;
              if (!(await isCodeAvailable(svc, candidate, partnerId))) continue;
              finalCode = candidate;
              continue;
            }
            console.error("[partner-manage] edit createDiscountCoupon failed:", err);
            const msg = errMsg || "stripe_unknown";
            return json({ error: "stripe_error", message: msg.slice(0, 200) }, 502);
          }
        }
        if (!result) return json({ error: "could_not_create_promotion_code" }, 500);
        newCode = finalCode;

        patch = {
          coupon_type: "client_discount",
          coupon_discount_pct: discountPct,
          coupon_duration_months: months,
          stripe_coupon_id: result.coupon_id,
          stripe_promotion_code_id: result.promo_id,
          coupon_code: newCode,
        };
      } else {
        // tracking
        patch = {
          coupon_type: "tracking",
          coupon_discount_pct: null,
          coupon_duration_months: null,
          stripe_coupon_id: null,
          stripe_promotion_code_id: null,
          coupon_code: newCode,
        };
      }

      const { error: uErr } = await sbFrom("partners").update(patch).eq("id", partnerId);
      if (uErr) {
        console.error("[partner-manage] edit update failed:", uErr);
        return json({ error: "internal_error" }, 500);
      }
      return json({ ok: true, coupon_code: newCode });
    }

    return json({ error: "invalid_action" }, 400);
  } catch (e) {
    console.error("[partner-manage] unhandled error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
