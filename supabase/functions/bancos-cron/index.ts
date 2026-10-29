// Robô dos bancos de Tendências e Stories (Walter, 19/10/2026: segunda e quinta).
//
// Por que existe: o agendamento antigo (trend-bank-weekly) sumiu do cron e o
// banco ficou parado de 28/08 até a atualização manual. Ele dependia de colar o
// TREND_CRON_SECRET no SQL. Aqui o pg_cron chama com o mesmo segredo dos outros
// robôs (INTERNAL_PUSH_SECRET, lido do gatilho de push, ninguém vê) e esta função
// repassa ao ai-context-builder com o TREND_CRON_SECRET que já está nos segredos.
// Só dispara os dois refresh; nada mais.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/* PAINEL DOS ROBÔS (29/10/2026): cada refresh grava o resultado em cron_runs
   (job = nome da operação). O cron só diz que o pedido saiu; isto diz se o
   ai-context-builder respondeu certo, e é o que o Admin → Robôs mostra. */
async function registrar(op: string, ok: boolean, detalhe: string) {
  try {
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await svc.from("cron_runs").upsert(
      { job: op, last_run_at: new Date().toISOString(), ok, detail: detalhe.slice(0, 300) },
      { onConflict: "job" },
    );
  } catch (e) { console.error(`[bancos-cron] não registrou ${op}`, e); }
}

const OPS = ["trend-bank-refresh", "story-trend-refresh"] as const;

async function rodar(op: string, url: string, anon: string, trendSecret: string) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${url}/functions/v1/ai-context-builder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anon}`,
        "x-internal-secret": trendSecret,
      },
      body: JSON.stringify({ operation: op }),
    });
    const txt = await r.text();
    console.log(`[bancos-cron] ${op} status=${r.status} ms=${Date.now() - t0} ${txt.slice(0, 200)}`);
    await registrar(op, r.ok, r.ok ? txt : `HTTP ${r.status}: ${txt}`);
  } catch (e) {
    console.error(`[bancos-cron] ${op} falhou`, e);
    await registrar(op, false, String(e));
  }
}

Deno.serve(async (req) => {
  const segredo = Deno.env.get("INTERNAL_PUSH_SECRET");
  if (!segredo || req.headers.get("x-internal-secret") !== segredo) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const trendSecret = Deno.env.get("TREND_CRON_SECRET") ?? "";
  if (!trendSecret) {
    console.error("[bancos-cron] TREND_CRON_SECRET não está nos segredos");
    return new Response(JSON.stringify({ error: "TREND_CRON_SECRET ausente" }), { status: 500 });
  }
  // Responde na hora (o pg_net desiste em segundos) e roda os dois em segundo plano.
  // @ts-ignore EdgeRuntime existe no runtime da Supabase
  EdgeRuntime.waitUntil(Promise.all(OPS.map((op) => rodar(op, url, anon, trendSecret))));
  return new Response(JSON.stringify({ ok: true, disparados: OPS }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
});
