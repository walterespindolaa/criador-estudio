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
    // Heartbeat honesto: registra o RESULTADO da rodada (ok true/false) no admin.
    // Chamado nos pontos de saída — no início não sabemos ainda se vai dar certo.
    const heartbeat = (ok: boolean, detail: string | null = null) =>
      svc.from("cron_runs").upsert({ job: "story-notifications", last_run_at: new Date().toISOString(), ok, detail }, { onConflict: "job" });

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
    if (error) { await heartbeat(false, error.message); return json({ error: "query_failed", message: error.message }, 500); }

    const ready = (due ?? []).filter((s: any) => {
      const t = (s.slot_time || "").slice(0, 5);
      return t && t <= hhmmBr; // já passou do horário
    });
    if (ready.length === 0) { await heartbeat(true); return json({ ok: true, fired: 0 }); }

    // REIVINDICAÇÃO (claim) ANTES de notificar: marca notified_at só nos slots que
    // AINDA estavam null. O WHERE notified_at IS NULL é reavaliado por linha sob lock,
    // então duas execuções concorrentes do cron NÃO reivindicam o mesmo slot — cada
    // story dispara uma vez só. Antes o insert vinha primeiro e o update depois (não
    // checado), o que duplicava a notificação quando o cron rodava 2x junto.
    const readyIds = ready.map((s: any) => s.id);
    const { data: claimed, error: claimErr } = await svc.from("story_slots")
      .update({ notified_at: new Date().toISOString() })
      .in("id", readyIds)
      .is("notified_at", null)
      .select("id, user_id, title, notify_title, notify_body");
    if (claimErr) { await heartbeat(false, claimErr.message); return json({ error: "claim_failed", message: claimErr.message }, 500); }
    if (!claimed || claimed.length === 0) { await heartbeat(true); return json({ ok: true, fired: 0 }); }

    const rows = (claimed as any[]).map((s) => ({
      user_id: s.user_id,
      type: "story",
      title: String(s.notify_title || s.title || "Hora do story!").slice(0, 160),
      description: String(s.notify_body || s.title || "Está na hora de postar seu story planejado.").slice(0, 400),
      link: "/app/stories/semanastories",
    }));

    // Só insere pra quem foi reivindicado acima; o trigger de push dispara por linha.
    const { error: insErr } = await svc.from("notifications").insert(rows);
    if (insErr) { await heartbeat(false, insErr.message); return json({ error: "insert_failed", message: insErr.message }, 500); }

    await heartbeat(true);
    return json({ ok: true, fired: rows.length });
  } catch (e) {
    console.error("[story-notifications] error:", e);
    // Heartbeat de FALHA (visível no admin). Cliente novo pois `svc` é do escopo do try.
    try {
      const svc2 = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await svc2.from("cron_runs").upsert({ job: "story-notifications", last_run_at: new Date().toISOString(), ok: false, detail: String(e) }, { onConflict: "job" });
    } catch (_) { /* heartbeat é best-effort */ }
    return json({ error: "internal_error" }, 500);
  }
});
