// Expurga da Lixeira o que foi excluído há mais de 30 dias. Rodar via cron (1x/dia).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const secret = req.headers.get("x-internal-secret");
    if (!secret || secret !== Deno.env.get("INTERNAL_PUSH_SECRET")) return json({ error: "unauthorized" }, 401);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();

    const [p, c] = await Promise.all([
      svc.from("posts").delete().not("deleted_at", "is", null).lt("deleted_at", cutoff).select("id"),
      svc.from("crm_clients").delete().not("deleted_at", "is", null).lt("deleted_at", cutoff).select("id"),
    ]);

    return json({ ok: true, posts_purged: (p.data ?? []).length, clients_purged: (c.data ?? []).length });
  } catch (e) {
    console.error("[trash-purge] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
