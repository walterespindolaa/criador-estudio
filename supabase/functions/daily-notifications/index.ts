import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // Só o agendador (cron) chama, com o segredo interno.
    const secret = req.headers.get("x-internal-secret");
    if (!secret || secret !== Deno.env.get("INTERNAL_PUSH_SECRET")) return json({ error: "unauthorized" }, 401);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const dayMs = 86400000;
    const now = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    let created = 0;

    // 1) Re-engajamento: sumiram há ~5 dias (janela de 1 dia pra notificar uma vez só).
    const { data: gone } = await svc
      .from("profiles")
      .select("id")
      .gte("last_seen_at", iso(now - 6 * dayMs))
      .lte("last_seen_at", iso(now - 5 * dayMs));
    for (const p of (gone ?? []) as { id: string }[]) {
      await svc.from("notifications").insert({
        user_id: p.id, type: "volte",
        title: "Sentimos sua falta!",
        description: "Que tal voltar e planejar seu conteúdo da semana?",
        link: "/app",
      });
      created++;
    }

    // 2) Acesso vencendo (~3 dias antes).
    const { data: exp } = await svc
      .from("profiles")
      .select("id")
      .gte("access_expires_at", iso(now + 2 * dayMs))
      .lte("access_expires_at", iso(now + 3 * dayMs));
    for (const p of (exp ?? []) as { id: string }[]) {
      await svc.from("notifications").insert({
        user_id: p.id, type: "acesso_vencendo",
        title: "Seu acesso vence em breve",
        description: "Renove pra não perder seus conteúdos e o acesso à Cria IA.",
        link: "/app/configuracoes",
      });
      created++;
    }

    return json({ ok: true, created });
  } catch (e) {
    console.error("[daily-notifications] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
