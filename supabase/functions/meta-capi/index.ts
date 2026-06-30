// Meta Conversions API (server-side). Espelha eventos do Pixel com o mesmo event_id
// pra o Meta deduplicar. No-op se META_PIXEL_ID/META_CAPI_TOKEN não estiverem setados.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED = new Set([
  "https://app.criasocialclub.com.br",
  "https://criasocialclub.com.br",
  "https://www.criasocialclub.com.br",
]);
function corsFor(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED.has(origin) ? origin : "https://app.criasocialclub.com.br";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}
const json = (cors: Record<string, string>, b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const PIXEL_ID = Deno.env.get("META_PIXEL_ID");
    const TOKEN = Deno.env.get("META_CAPI_TOKEN");
    if (!PIXEL_ID || !TOKEN) return json(cors, { ok: true, skipped: "not_configured" });

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

    // Rate-limit por IP: 120 eventos/min. Fail-closed.
    try {
      const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: ok, error } = await svc.rpc("rate_touch", { _key: `capi:${ip}`, _limit: 120 });
      if (error || ok === false) return json(cors, { ok: false, skipped: "rate_limited" }, 429);
    } catch { /* se o limiter cair, segue (evento de tracking não é crítico) */ }

    const body = await req.json().catch(() => ({}));
    const eventName = String(body?.event_name ?? "").trim();
    if (!eventName) return json(cors, { error: "missing_event_name" }, 400);

    const eventId = body?.event_id ? String(body.event_id) : undefined;
    const sourceUrl = body?.event_source_url ? String(body.event_source_url) : undefined;
    const value = body?.value != null ? Number(body.value) : undefined;
    const currency = body?.currency ? String(body.currency) : undefined;

    const ua = req.headers.get("user-agent") || undefined;

    const user_data: Record<string, unknown> = {};
    if (body?.email) user_data.em = [await sha256(String(body.email))];
    if (body?.fbp) user_data.fbp = String(body.fbp);
    if (body?.fbc) user_data.fbc = String(body.fbc);
    if (ip && ip !== "unknown") user_data.client_ip_address = ip;
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
      return json(cors, { ok: false }, 200); // não quebra o front
    }
    return json(cors, { ok: true });
  } catch (e) {
    console.error("[meta-capi] error:", e);
    return json(cors, { ok: false }, 200);
  }
});
