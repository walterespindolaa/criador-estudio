import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Chamada interna (gatilho do banco) usa um segredo; senão exige admin logado.
    const internalSecret = req.headers.get("x-internal-secret");
    const isInternal = !!internalSecret && internalSecret === Deno.env.get("INTERNAL_PUSH_SECRET");
    if (!isInternal) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "unauthorized" }, 401);
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "unauthorized" }, 401);
      const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
      if (caller?.role !== "admin") return json({ error: "forbidden" }, 403);
    }

    const { title, message, audience, url, user_id } = await req.json();
    if (!message) return json({ error: "missing_message" }, 400);

    const pub = Deno.env.get("VAPID_PUBLIC_KEY");
    const priv = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!pub || !priv) return json({ error: "vapid_not_configured" }, 500);
    webpush.setVapidDetails("mailto:contato@criasocialclub.com.br", pub, priv);

    let q = svc.from("push_subscriptions").select("endpoint, p256dh, auth, user_id, profiles!inner(account_type)");
    if (user_id) q = q.eq("user_id", user_id);
    const { data: subs } = await q;

    const aud = audience ?? "todos";
    const filtered = (subs ?? []).filter((s: { profiles?: { account_type?: string | null } }) => {
      if (user_id) return true; // alvo específico: manda pra todos os aparelhos dele
      const at = s.profiles?.account_type ?? null;
      if (aud === "social") return at === "manager";
      if (aud === "criadora") return at !== "manager";
      return true;
    });

    const payload = JSON.stringify({ title: title || "Cria", body: message, url: url || "/app" });
    let sent = 0;
    for (const s of filtered as { endpoint: string; p256dh: string; auth: string }[]) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await svc.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }
    return json({ ok: true, sent });
  } catch (e) {
    console.error("[send-push] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
