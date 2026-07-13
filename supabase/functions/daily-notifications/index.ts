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
    // 1) Re-engajamento: sumiram há ~5 dias. 2) Acesso vencendo (~3 dias antes).
    const [goneRes, expRes] = await Promise.all([
      svc.from("profiles").select("id")
        .gte("last_seen_at", iso(now - 6 * dayMs)).lte("last_seen_at", iso(now - 5 * dayMs)),
      svc.from("profiles").select("id")
        .gte("access_expires_at", iso(now + 2 * dayMs)).lte("access_expires_at", iso(now + 3 * dayMs)),
    ]);
    const goneIds = ((goneRes.data ?? []) as { id: string }[]).map((p) => p.id);
    const expIds = ((expRes.data ?? []) as { id: string }[]).map((p) => p.id);

    // Dedup: não repetir quem já recebeu esse tipo nas últimas 48h (caso o cron rode 2x).
    const candidates = [...new Set([...goneIds, ...expIds])];
    const already = new Set<string>();
    if (candidates.length) {
      const { data: recent } = await svc.from("notifications")
        .select("user_id, type")
        .in("user_id", candidates)
        .in("type", ["volte", "acesso_vencendo"])
        .gte("created_at", iso(now - 2 * dayMs));
      for (const r of (recent ?? []) as { user_id: string; type: string }[]) already.add(`${r.user_id}:${r.type}`);
    }

    const rows: Record<string, unknown>[] = [];
    for (const id of goneIds) {
      if (already.has(`${id}:volte`)) continue;
      rows.push({ user_id: id, type: "volte", title: "Sentimos sua falta!", description: "Que tal voltar e planejar seu conteúdo da semana?", link: "/app" });
    }
    for (const id of expIds) {
      if (already.has(`${id}:acesso_vencendo`)) continue;
      rows.push({ user_id: id, type: "acesso_vencendo", title: "Seu acesso vence em breve", description: "Renove pra não perder seus conteúdos e o acesso à Cria IA.", link: "/app/configuracoes" });
    }

    // ── Aniversário de cliente: avisa o social mídia no dia (e 3 dias antes, pra dar tempo de preparar) ──
    const brNow = new Date(Date.now() - 3 * 60 * 60 * 1000); // UTC-3
    const mmdd = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const in3 = new Date(brNow); in3.setDate(in3.getDate() + 3);
    const alvos = new Map<string, "hoje" | "em3">([[mmdd(brNow), "hoje"], [mmdd(in3), "em3"]]);

    const { data: bdays } = await svc.from("crm_clients")
      .select("id, manager_id, name, birthday, status")
      .not("birthday", "is", null)
      .neq("status", "inativo")
      .is("deleted_at", null);

    // Não repete no mesmo dia.
    const { data: sentToday } = await svc.from("notifications")
      .select("user_id, link").eq("type", "aniversario_cliente").gte("created_at", iso(now - dayMs));
    const already2 = new Set((sentToday ?? []).map((r: { user_id: string; link: string }) => `${r.user_id}:${r.link}`));

    for (const c of (bdays ?? []) as { id: string; manager_id: string; name: string; birthday: string }[]) {
      const quando = alvos.get(c.birthday.slice(5)); // "MM-DD"
      if (!quando) continue;
      const link = `/socialmidia/criacrm/${c.id}`;
      if (already2.has(`${c.manager_id}:${link}`)) continue;
      rows.push({
        user_id: c.manager_id,
        type: "aniversario_cliente",
        title: quando === "hoje" ? `🎂 Hoje é aniversário de ${c.name}` : `🎂 ${c.name} faz aniversário em 3 dias`,
        description: quando === "hoje" ? "Mande uma mensagem ou um post de parabéns." : "Dá tempo de preparar um conteúdo especial.",
        link,
      });
    }

    // Insert em lote (1 chamada), o trigger de push dispara por linha.
    if (rows.length) await svc.from("notifications").insert(rows);

    return json({ ok: true, created: rows.length });
  } catch (e) {
    console.error("[daily-notifications] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
