// Tracking público do Link na bio (visitas e cliques) com rate-limit por IP+slug.
// As RPCs increment_bio_* só são acessíveis via service_role — esta é a única porta.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Allowlist (+ localhost/preview do Lovable) — bloqueia origens aleatórias sem quebrar dev.
function isAllowedOrigin(origin: string): boolean {
  if (["https://app.criasocialclub.com.br", "https://criasocialclub.com.br", "https://www.criasocialclub.com.br"].includes(origin)) return true;
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.(lovableproject\.com|lovable\.app)$/.test(origin)) return true;
  return false;
}
function corsFor(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : "https://app.criasocialclub.com.br",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const cors = corsFor(req);
  const ok = (b: unknown = { ok: true }) =>
    new Response(JSON.stringify(b), { headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const type = String(body?.type ?? "");
    const slug = body?.slug ? String(body.slug).slice(0, 120) : "";
    const linkId = body?.linkId ? String(body.linkId) : "";
    if (type !== "view" && type !== "click") return ok({ ok: false });

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 30 eventos/min por IP+alvo. Se estourar, ignora silenciosamente (não conta).
    const { data: allowed } = await svc.rpc("rate_touch", { _key: `bio:${ip}:${slug || linkId}`, _limit: 30 });
    if (allowed === false) return ok({ ok: true, throttled: true });

    if (type === "view" && slug) {
      await svc.rpc("increment_bio_view", { _slug: slug });
    } else if (type === "click" && linkId) {
      await svc.rpc("increment_bio_link_click", { link_id: linkId });
    }
    return ok();
  } catch (e) {
    console.error("[bio-track] error:", e);
    return ok({ ok: false });
  }
});
