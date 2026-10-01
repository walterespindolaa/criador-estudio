// ═══════════════════════════════════════════════════════════════════════════
// MIGRAR-SEGREDOS (01/10/2026) · TEMPORÁRIA, só admin · apagar depois da migração
//
// Copia as chaves secretas da Lovable Cloud direto pro projeto NOVO da
// Supabase, pela API de gerenciamento da Supabase. Nenhum valor aparece na
// resposta, no log ou no chat: a função só devolve os NOMES copiados.
//
// Precisa de dois segredos nesta Lovable (colados pelo Walter, sem mostrar):
//   SUPABASE_PAT         token pessoal da conta Supabase (Account > Access Tokens)
//   SUPABASE_NOVO_REF    ref do projeto novo (não é segredo)
//
//   { acao: "previa" }   -> nomes que seriam copiados e os que faltam
//   { acao: "copiar" }   -> copia e devolve só os nomes
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Os que o código usa. Fora: SUPABASE_* (o projeto novo já tem os dele) e LOVABLE_* (saem).
const NOMES = [
  "APP_URL", "ALLOWED_ORIGIN", "INTERNAL_PUSH_SECRET", "CRIAPOST_CLEANUP_SECRET", "CRON_SECRET", "TREND_CRON_SECRET",
  "STRIPE_SECRET_KEY", "STRIPE_PRICE_PRO", "STRIPE_PRICE_STUDIO", "STRIPE_PRICE_ESSENCIAL", "STRIPE_PRICE_AGENCY_SEAT",
  "STRIPE_COLLAB_SEAT_PRICE_ID", "STRIPE_CLIENT_PACK_PRICE_ID",
  "BUNNY_STREAM_API_KEY", "BUNNY_STREAM_LIBRARY_ID", "BUNNY_STREAM_CDN_HOST", "BUNNY_CRIAPOST_API_KEY",
  "BUNNY_CRIAPOST_LIBRARY_ID", "BUNNY_CRIAPOST_CDN_HOSTNAME", "BUNNY_CRIAPOST_CDN_HOST", "BUNNY_STORAGE_ZONE",
  "BUNNY_STORAGE_PASSWORD", "BUNNY_STORAGE_HOST", "BUNNY_STORAGE_PULLZONE",
  "INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET", "INSTAGRAM_PUBLISH_ALL", "META_PIXEL_ID", "META_CAPI_TOKEN",
  "GOOGLE_CLIENT_ID", "GOOGLE_API_KEY", "PERPLEXITY_API_KEY", "APIFY_TOKEN", "TWELVELABS_API_KEY",
  "HIGGSFIELD_API_KEY", "HIGGSFIELD_API_SECRET", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "ELEVENLABS_API_KEY",
];
// O webhook do Stripe NÃO vai: o projeto novo ganha um webhook novo, com segredo novo.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const uc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await uc.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (caller?.role !== "admin") return json({ error: "forbidden" }, 403);

    const pat = Deno.env.get("SUPABASE_PAT");
    const ref = Deno.env.get("SUPABASE_NOVO_REF");
    if (!pat || !ref) return json({ error: "faltam SUPABASE_PAT e/ou SUPABASE_NOVO_REF nos segredos da Lovable" }, 400);
    if (!/^[a-z0-9]{20}$/.test(ref) || Deno.env.get("SUPABASE_URL")!.includes(ref)) return json({ error: "ref do projeto novo inválido" }, 400);

    const tem = NOMES.filter((n) => (Deno.env.get(n) ?? "") !== "");
    const faltam = NOMES.filter((n) => !tem.includes(n));
    const { acao } = await req.json().catch(() => ({}));
    if (acao === "previa") return json({ destino: ref, vai_copiar: tem, nao_existe_aqui: faltam });
    if (acao !== "copiar") return json({ error: "ação inválida" }, 400);

    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
      body: JSON.stringify(tem.map((name) => ({ name, value: Deno.env.get(name)! }))),
    });
    if (!r.ok) return json({ error: "a Supabase recusou", status: r.status, detalhe: (await r.text()).slice(0, 300) }, 502);
    return json({ ok: true, copiados: tem, nao_existe_aqui: faltam });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
