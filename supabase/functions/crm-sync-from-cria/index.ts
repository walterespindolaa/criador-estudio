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
      .select("id, manager_id, cria_owner_id, name, segment, brand_core, persona, logo")
      .eq("id", crmClientId).maybeSingle();
    // Dono OU colaborador ativo do time podem sincronizar.
    if (!cli) return json({ error: "forbidden_client" }, 403);
    const mgrId = (cli as any).manager_id as string;
    if (mgrId !== user.id) {
      const { data: link } = await svc.from("manager_members")
        .select("id").eq("manager_id", mgrId).eq("member_id", user.id).eq("status", "ativo").maybeSingle();
      if (!link) return json({ error: "forbidden_client" }, 403);
    }
    const ownerId = (cli as any).cria_owner_id as string | null;
    if (!ownerId) return json({ error: "not_cria_client", message: "Este cliente não usa o Cria." }, 400);

    // F3/F8/F14: cria_owner_id é auto-declarado no crm_clients e NÃO serve de prova
    // de autorização. Exige vínculo CONSENTIDO pela conta do cliente: account_members
    // ativo entre o cliente (owner_id) e a gestora dona do crm_client (mgrId).
    const { data: consent } = await svc.from("account_members")
      .select("id").eq("owner_id", ownerId).eq("member_id", mgrId).eq("status", "active").maybeSingle();
    if (!consent) return json({ error: "forbidden_no_consent", message: "Vínculo com este cliente ainda não foi confirmado." }, 403);

    // Dados que o cliente preencheu na conta Cria dele.
    const [profRes, pillarsRes, brandRes, persRes, moodRes] = await Promise.all([
      svc.from("profiles").select("name, niche, avatar_url").eq("id", ownerId).maybeSingle(),
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

    // Chaves derivadas do Cria (sobrescrevem, o Cria é a fonte da verdade pra cliente Cria).
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
    // Foto: a do Cria é a fonte da verdade pro cliente que usa o app.
    // (Antes ela não vinha, trocava no Cria e o Cria Gestão continuava com a antiga.)
    if ((prof as any)?.avatar_url && (prof as any).avatar_url !== (cli as any).logo) {
      update.logo = (prof as any).avatar_url;
    }

    // Persona do Cria → persona do CRM (nome, faixa, dores/desejos).
    const personaPatch: Record<string, string> = {};
    if (persona?.name) personaPatch.name = persona.name;
    if (persona?.age_range) personaPatch.ageRange = persona.age_range;
    if ((persona?.pain_points || []).length) personaPatch.pains = (persona.pain_points || []).join("\n");
    if ((persona?.interests || []).length) personaPatch.desires = (persona.interests || []).join("\n");
    if (Object.keys(personaPatch).length) {
      // Persona no CRM é uma LISTA (até 3). Mescla na primeira, preservando as demais.
      const raw = (cli as any).persona;
      const list: Record<string, unknown>[] = Array.isArray(raw) ? raw : (raw && typeof raw === "object" && Object.keys(raw).length ? [raw] : [{}]);
      list[0] = { ...(list[0] ?? {}), ...personaPatch };
      update.persona = list;
    }

    const { error: upErr } = await svc.from("crm_clients").update(update).eq("id", crmClientId);
    if (upErr) return json({ error: "update_failed", message: upErr.message }, 500);

    return json({ ok: true, name: update.name ?? (cli as any).name, brand_core: newBrandCore, synced_keys: Object.keys(synced) });
  } catch (e) {
    console.error("[crm-sync-from-cria] unhandled", e);
    return json({ error: "internal_error", message: e instanceof Error ? e.message : String(e) }, 500);
  }
});
