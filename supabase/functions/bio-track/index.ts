// Tracking público do Link na bio (visitas e cliques) com rate-limit por IP+slug.
// As RPCs increment_bio_* só são acessíveis via service_role — esta é a única porta.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ok = (b: unknown = { ok: true }) =>
  new Response(JSON.stringify(b), { headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
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
