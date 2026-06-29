// Ações da agência sobre um cliente coberto: pausar (inventário), reativar, editar, excluir.
// Gated: o cliente precisa ter agency_owner_id = caller.id.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Rate limit por usuário/minuto via RPC existente. Fail-open.
async function rateOk(svc: SupabaseClient, userId: string, scope: string, limit: number): Promise<boolean> {
  try {
    const windowKey = new Date().toISOString().slice(0, 16);
    const { data, error } = await svc.rpc("check_and_increment_rate_limit", {
      _user_id: userId, _scope: scope, _window_key: windowKey, _limit: limit,
    });
    if (error) return true;
    return data !== false;
  } catch { return true; }
}

const PARK_DAYS = 60;

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

    if (!(await rateOk(svc, user.id, "manager-client-actions", 30))) {
      return json({ error: "rate_limited", message: "Muitas ações em sequência. Aguarde um minuto." }, 429);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const clientId = String(body?.clientId ?? "");
    if (!action || !clientId) return json({ error: "missing_fields" }, 400);

    // Confirma que o cliente é coberto por essa agência.
    const { data: client } = await svc.from("profiles")
      .select("id, agency_owner_id, parked_at, seat_limit").eq("id", clientId).single();
    if (!client || client.agency_owner_id !== user.id) return json({ error: "forbidden" }, 403);

    if (action === "park") {
      const until = new Date(Date.now() + PARK_DAYS * 86400000).toISOString();
      await svc.from("profiles").update({
        parked_at: new Date().toISOString(), parked_until: until, subscription_status: "parked",
      }).eq("id", clientId);
      return json({ ok: true, parked_until: until });
    }

    if (action === "unpark") {
      // Precisa de assento livre.
      const { data: me } = await svc.from("profiles").select("seat_limit").eq("id", user.id).single();
      const { count: used } = await svc.from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("agency_owner_id", user.id).is("parked_at", null);
      if ((used ?? 0) >= Number(me?.seat_limit ?? 0)) return json({ error: "seats_full" }, 409);
      await svc.from("profiles").update({
        parked_at: null, parked_until: null, subscription_status: "active",
      }).eq("id", clientId);
      return json({ ok: true });
    }

    if (action === "edit") {
      const name = body?.name != null ? String(body.name).trim() : null;
      const email = body?.email != null ? String(body.email).trim().toLowerCase() : null;
      if (name) await svc.from("profiles").update({ name }).eq("id", clientId);
      if (email && email.includes("@")) {
        const { error: upErr } = await svc.auth.admin.updateUserById(clientId, { email });
        if (upErr) return json({ error: "email_update_failed", detail: upErr.message }, 400);
      }
      return json({ ok: true });
    }

    if (action === "delete") {
      await svc.auth.admin.deleteUser(clientId); // cascata remove o profile
      return json({ ok: true });
    }

    return json({ error: "invalid_action" }, 400);
  } catch (e) {
    console.error("[manager-client-actions] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
