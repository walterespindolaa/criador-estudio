// Dispara notificações dos stories no horário programado. Rodar via cron (ex.: a cada 15 min).
// Insere linha em `notifications` (o trigger de push cuida do envio) e marca notified_at.
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
    // Heartbeat: registra que este cron executou (visível no admin). Não-fatal.
    await svc.from("cron_runs").upsert({ job: "story-notifications", last_run_at: new Date().toISOString(), ok: true }, { onConflict: "job" });

    // Agora no fuso de Brasília (UTC-3).
    const br = new Date(Date.now() - 3 * 3600 * 1000);
    const todayBr = br.toISOString().slice(0, 10);
    const hhmmBr = br.toISOString().slice(11, 16); // "HH:MM"

    // Slots de hoje com notificação configurada e ainda não disparada.
    const { data: due, error } = await svc.from("story_slots")
      .select("id, user_id, title, slot_time, notify_title, notify_body")
      .eq("slot_date", todayBr)
      .is("notified_at", null)
      .not("notify_title", "is", null);
    if (error) return json({ error: "query_failed", message: error.message }, 500);

    const ready = (due ?? []).filter((s: any) => {
      const t = (s.slot_time || "").slice(0, 5);
      return t && t <= hhmmBr; // já passou do horário
    });
    if (ready.length === 0) return json({ ok: true, fired: 0 });

    const rows = ready.map((s: any) => ({
      user_id: s.user_id,
      type: "story",
      title: String(s.notify_title || s.title || "Hora do story!").slice(0, 160),
      description: String(s.notify_body || s.title || "Está na hora de postar seu story planejado.").slice(0, 400),
      link: "/app/stories/semanastories",
    }));

    const { error: insErr } = await svc.from("notifications").insert(rows);
    if (insErr) return json({ error: "insert_failed", message: insErr.message }, 500);

    const ids = ready.map((s: any) => s.id);
    await svc.from("story_slots").update({ notified_at: new Date().toISOString() }).in("id", ids);

    return json({ ok: true, fired: ids.length });
  } catch (e) {
    console.error("[story-notifications] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
