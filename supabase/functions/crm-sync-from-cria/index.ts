// Sincroniza o Brandbook/nome do cliente que USA O CRIA para o CRM da agência.
// O gestor não tem RLS nos dados do cliente Cria, então isto roda com service role,
// validando que o crm_client é do gestor e que aponta pra um cria_owner_id.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
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

    const body = await req.json().catch(() => ({}));
    const crmClientId = String(body?.crm_client_id ?? "");
    if (!crmClientId) return json({ error: "missing_crm_client_id" }, 400);

    // O crm_client precisa ser do gestor e apontar pra uma conta Cria.
    const { data: cli } = await svc.from("crm_clients")
      .select("id, manager_id, cria_owner_id, name, segment, brand_core, persona")
      .eq("id", crmClientId).maybeSingle();
    if (!cli || (cli as any).manager_id !== user.id) return json({ error: "forbidden_client" }, 403);
    const ownerId = (cli as any).cria_owner_id as string | null;
    if (!ownerId) return json({ error: "not_cria_client", message: "Este cliente não usa o Cria." }, 400);

    // Dados que o cliente preencheu na conta Cria dele.
    const [profRes, pillarsRes, brandRes, persRes, moodRes] = await Promise.all([
      svc.from("profiles").select("name, niche").eq("id", ownerId).maybeSingle(),
      svc.from("pillars").select("name").eq("user_id", ownerId).order("position"),
      svc.from("brand_items").select("type, name").eq("user_id", ownerId),
      svc.from("personas").select("name, age_range, pain_points, interests").eq("user_id", ownerId).limit(1),
      svc.from("moodboard_entries").select("section, question_key, answer").eq("user_id", ownerId),
    ]);

    const prof = profRes.data as any;
    const bi = (brandRes.data ?? []) as any[];
    const pick = (t: string) => bi.filter((b) => b.type === t).map((b) => b.name);
    const persona = (persRes.data ?? [])[0] as any;
    const brandbookTxt = (moodRes.data ?? [])
      .filter((e: any) => e.answer && String(e.answer).trim())
      .map((e: any) => `- ${e.answer}`).join("\n").slice(0, 2000);

    const audience = persona
      ? [persona.name, persona.age_range, (persona.pain_points || []).length ? `dores: ${(persona.pain_points || []).join(", ")}` : "", (persona.interests || []).length ? `interesses: ${(persona.interests || []).join(", ")}` : ""].filter(Boolean).join(" · ")
      : "";

    // Chaves derivadas do Cria (sobrescrevem — o Cria é a fonte da verdade pra cliente Cria).
    const synced: Record<string, string> = {};
    const pilares = (pillarsRes.data ?? []).map((p: any) => p.name).join(", ");
    if (pilares) synced.contentThemes = pilares;
    if (pick("tom").length) synced.toneOfVoice = pick("tom").join(", ");
    if (pick("arquetipo").length) synced.archetype = pick("arquetipo").join(", ");
    if (pick("fonte").length) synced.typography = pick("fonte").join(", ");
    if (pick("cor").length) synced.colorPalette = pick("cor").join(", ");
    if (audience) synced.audience = audience;
    if (brandbookTxt) synced.criaBrandbook = brandbookTxt;
    synced.criaSyncedAt = new Date().toISOString();

    const newBrandCore = { ...((cli as any).brand_core ?? {}), ...synced };
    const update: Record<string, unknown> = { brand_core: newBrandCore };
    if (prof?.name && prof.name !== (cli as any).name) update.name = prof.name;
    if (prof?.niche && !(cli as any).segment) update.segment = prof.niche;

    const { error: upErr } = await svc.from("crm_clients").update(update).eq("id", crmClientId);
    if (upErr) return json({ error: "update_failed", message: upErr.message }, 500);

    return json({ ok: true, name: update.name ?? (cli as any).name, brand_core: newBrandCore, synced_keys: Object.keys(synced) });
  } catch (e) {
    console.error("[crm-sync-from-cria] unhandled", e);
    return json({ error: "internal_error", message: e instanceof Error ? e.message : String(e) }, 500);
  }
});
