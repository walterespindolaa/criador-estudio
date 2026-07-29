// Robô diário de saúde do CRIA. Roda via cron (1x/dia, x-internal-secret).
// Olha o app_logs das últimas 24h + o cron_runs e MANDA um resumo pro(s) admin(s)
// por notificação in-app (que dispara o push via trg_notify_push). Assim ninguém
// precisa abrir o painel: o resumo chega. Grava o próprio heartbeat em cron_runs.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// "Frescor" máximo esperado por cron (horas). Passou disso sem rodar = suspeito.
const STALE_HOURS: Record<string, number> = {
  "story-notifications-15min": 1,
  "rl-buckets-cleanup": 26,
  "cria-daily-notif": 26,
  "cria-ig-refresh": 26,
  "trash-purge-daily": 26,
  "storage-cleanup-daily": 26,
  "criapost-media-cleanup-daily": 26,
  "agency-inventory-cleanup": 26,
  "daily-health-report": 26,
  "trend-bank-weekly": 24 * 8,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const heartbeat = (ok: boolean, detail: string | null = null) =>
    svc.from("cron_runs").upsert(
      { job: "daily-health-report", last_run_at: new Date().toISOString(), ok, detail },
      { onConflict: "job" },
    );

  try {
    const secret = req.headers.get("x-internal-secret");
    if (!secret || secret !== Deno.env.get("INTERNAL_PUSH_SECRET")) return json({ error: "unauthorized" }, 401);

    const now = Date.now();
    const since = new Date(now - 24 * 3600 * 1000).toISOString();

    // 1) Erros/avisos das últimas 24h.
    const { data: logs, error: logErr } = await svc
      .from("app_logs")
      .select("level, message, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (logErr) { await heartbeat(false, "app_logs: " + logErr.message); return json({ error: "logs_failed", message: logErr.message }, 500); }

    const rows = logs ?? [];
    const nErro = rows.filter((l) => l.level === "error").length;
    const nAviso = rows.filter((l) => l.level === "warn").length;

    // Top 3 mensagens de erro mais frequentes (agrupa pelo início da mensagem).
    const freq = new Map<string, number>();
    for (const l of rows.filter((r) => r.level === "error")) {
      const key = String(l.message || "erro sem mensagem").slice(0, 80);
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    // 2) Saúde dos crons (heartbeat).
    const { data: crons } = await svc.from("cron_runs").select("job, last_run_at, ok, detail");
    const problemas: string[] = [];
    for (const c of (crons ?? []) as { job: string; last_run_at: string; ok: boolean; detail: string | null }[]) {
      if (c.ok === false) { problemas.push(`${c.job} falhou${c.detail ? " (" + c.detail.slice(0, 40) + ")" : ""}`); continue; }
      const limite = (STALE_HOURS[c.job] ?? 26) * 3600 * 1000;
      const idadeMs = now - new Date(c.last_run_at).getTime();
      if (idadeMs > limite) problemas.push(`${c.job} sem rodar há ${Math.round(idadeMs / 3600000)}h`);
    }

    // 3) Monta o resumo.
    const saudavel = nErro === 0 && problemas.length === 0;
    const title = saudavel ? "CRIA saudável (24h)" : "CRIA: atenção (24h)";
    const partes: string[] = [];
    partes.push(`${nErro} erro(s), ${nAviso} aviso(s) em 24h.`);
    if (top.length) partes.push("Top: " + top.map(([m, n]) => `${n}× ${m}`).join(" · "));
    if (problemas.length) partes.push("Crons: " + problemas.join("; "));
    else partes.push("Crons: todos ok.");
    const description = partes.join(" ").slice(0, 400);

    // 4) Admins que recebem o resumo.
    const { data: admins } = await svc.from("profiles").select("id").eq("role", "admin");
    const adminIds = ((admins ?? []) as { id: string }[]).map((a) => a.id);
    if (adminIds.length === 0) { await heartbeat(true, "sem admin p/ notificar"); return json({ ok: true, notified: 0, saudavel, nErro, problemas }); }

    // 5) Notifica (o insert dispara o push via trg_notify_push).
    const notifs = adminIds.map((uid) => ({
      user_id: uid,
      type: "sistema",
      title,
      description,
      link: "/cf-admin-panel",
    }));
    const { error: insErr } = await svc.from("notifications").insert(notifs);
    if (insErr) { await heartbeat(false, "notif: " + insErr.message); return json({ error: "notify_failed", message: insErr.message }, 500); }

    await heartbeat(true, saudavel ? "ok" : description.slice(0, 100));
    return json({ ok: true, notified: adminIds.length, saudavel, nErro, nAviso, problemas });
  } catch (e) {
    console.error("[daily-health-report] error:", e);
    try { await heartbeat(false, String(e)); } catch (_) { /* best-effort */ }
    return json({ error: "internal_error", message: e instanceof Error ? e.message : String(e) }, 500);
  }
});
