import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    // Caller precisa ser admin
    const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (caller?.role !== "admin") return json({ error: "forbidden" }, 403);

    const body = await req.json();
    const { referral_id, payout_proof_url, payout_note } = body as {
      referral_id?: string; payout_proof_url?: string; payout_note?: string;
    };
    if (!referral_id) return json({ error: "missing_referral_id" }, 400);

    // Confirma que existe e está payable
    const { data: ref } = await svc
      .from("partner_referrals")
      .select("id, status")
      .eq("id", referral_id)
      .maybeSingle();
    if (!ref) return json({ error: "referral_not_found" }, 404);
    const refRow = ref as { id: string; status: string };
    if (refRow.status !== "payable") {
      return json({ error: "Comissão ainda não liberada ou já processada" }, 400);
    }

    const patch: Record<string, unknown> = {
      status: "paid",
      paid_at: new Date().toISOString(),
    };
    if (typeof payout_proof_url === "string" && payout_proof_url.trim()) {
      patch.payout_proof_url = payout_proof_url.trim();
    }
    if (typeof payout_note === "string" && payout_note.trim()) {
      patch.payout_note = payout_note.trim();
    }

    console.log("[partner-referral-payout] marcando paga", { referral_id, caller: user.id, patch });

    const { data: updated, error: updErr } = await svc
      .from("partner_referrals")
      .update(patch)
      .eq("id", referral_id)
      .select("*")
      .single();
    if (updErr) {
      console.error("[partner-referral-payout] update failed:", updErr);
      return json({ error: "update_failed" }, 500);
    }

    return json({ ok: true, referral: updated });
  } catch (e) {
    console.error("[partner-referral-payout] unhandled error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
