// Social mídia (manager) adiciona um cliente coberto pelos assentos da agência.
// Gated por seat_limit. Cria a conta de criadora, vincula e devolve link branded /ativar.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const svc: SupabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Caller precisa ser manager com assentos.
    const { data: caller } = await svc.from("profiles")
      .select("account_type, seat_limit, name").eq("id", user.id).single();
    if (caller?.account_type !== "manager") return json({ error: "forbidden_not_manager" }, 403);
    const seatLimit = Number(caller?.seat_limit ?? 0);
    if (seatLimit <= 0) return json({ error: "no_seats" }, 402);

    // Conta assentos usados (clientes cobertos por essa agência).
    const { count: used } = await svc.from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("agency_owner_id", user.id);
    if ((used ?? 0) >= seatLimit) return json({ error: "seats_full", used, seatLimit }, 409);

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!name || !email || !email.includes("@")) return json({ error: "missing_fields" }, 400);
    if (email === (user.email ?? "").toLowerCase()) return json({ error: "use_different_email" }, 400);

    const origin = req.headers.get("origin") ?? "https://app.criasocialclub.com.br";

    // Gera invite (cria o usuário). Se já existir, manda magiclink.
    const { data: list } = await svc.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
    const type: "magiclink" | "invite" = existing ? "magiclink" : "invite";
    const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
      type, email, options: { redirectTo: origin + "/app" },
    });
    if (linkErr || !linkData?.properties?.action_link || !linkData.user) {
      return json({ error: "link_failed" }, 400);
    }
    const creatorId = linkData.user.id;
    const hashed = linkData.properties.hashed_token;
    const inviteLink = hashed
      ? `${origin}/ativar?th=${hashed}&type=${type}&to=${encodeURIComponent("/app")}`
      : linkData.properties.action_link;

    // Conta de criadora coberta pela agência (studio, acesso ativo, sem cobrança própria).
    await svc.from("profiles").update({
      name, plan: "studio", subscription_status: "active",
      agency_owner_id: user.id, must_change_password: true,
    }).eq("id", creatorId);

    // Vincula a social mídia como gestora.
    await svc.from("account_members").upsert({
      owner_id: creatorId, member_email: user.email, member_id: user.id,
      role: "manager", status: "active", accepted_at: new Date().toISOString(),
    }, { onConflict: "owner_id,member_email" });

    return json({ ok: true, email, inviteLink, used: (used ?? 0) + 1, seatLimit });
  } catch (e) {
    console.error("[manager-add-client] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
