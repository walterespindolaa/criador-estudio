// Meta Conversions API (server-side). Espelha eventos do Pixel com o mesmo event_id
// pra o Meta deduplicar. No-op se META_PIXEL_ID/META_CAPI_TOKEN não estiverem setados.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const PIXEL_ID = Deno.env.get("META_PIXEL_ID");
    const TOKEN = Deno.env.get("META_CAPI_TOKEN");
    if (!PIXEL_ID || !TOKEN) return json({ ok: true, skipped: "not_configured" });

    const body = await req.json().catch(() => ({}));
    const eventName = String(body?.event_name ?? "").trim();
    if (!eventName) return json({ error: "missing_event_name" }, 400);

    const eventId = body?.event_id ? String(body.event_id) : undefined;
    const sourceUrl = body?.event_source_url ? String(body.event_source_url) : undefined;
    const value = body?.value != null ? Number(body.value) : undefined;
    const currency = body?.currency ? String(body.currency) : undefined;

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || undefined;
    const ua = req.headers.get("user-agent") || undefined;

    const user_data: Record<string, unknown> = {};
    if (body?.email) user_data.em = [await sha256(String(body.email))];
    if (body?.fbp) user_data.fbp = String(body.fbp);
    if (body?.fbc) user_data.fbc = String(body.fbc);
    if (ip) user_data.client_ip_address = ip;
    if (ua) user_data.client_user_agent = ua;

    const custom_data: Record<string, unknown> = {};
    if (value != null && !Number.isNaN(value)) custom_data.value = value;
    if (currency) custom_data.currency = currency;

    const payload = {
      data: [{
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        ...(eventId ? { event_id: eventId } : {}),
        ...(sourceUrl ? { event_source_url: sourceUrl } : {}),
        user_data,
        ...(Object.keys(custom_data).length ? { custom_data } : {}),
      }],
    };

    const res = await fetch(`https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${encodeURIComponent(TOKEN)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[meta-capi] graph error", res.status, t);
      return json({ ok: false }, 200); // não quebra o front
    }
    return json({ ok: true });
  } catch (e) {
    console.error("[meta-capi] error:", e);
    return json({ ok: false }, 200);
  }
});
