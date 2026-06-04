import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const zone = Deno.env.get("BUNNY_STORAGE_ZONE");
    const host = Deno.env.get("BUNNY_STORAGE_HOST");
    const pass = Deno.env.get("BUNNY_STORAGE_PASSWORD");
    const pull = Deno.env.get("BUNNY_STORAGE_PULLZONE");
    if (!zone || !host || !pass || !pull) return json({ error: "Bunny Storage secrets não configurados" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: ud, error: ue } = await userClient.auth.getUser();
    if (ue || !ud?.user) return json({ error: "Não autenticado" }, 401);
    const userId = ud.user.id;

    const { post_id, file_name, file_type, data_base64 } = await req.json();
    if (!post_id || !data_base64) return json({ error: "post_id e arquivo obrigatórios" }, 400);

    const { data: post } = await userClient.from("posts").select("user_id, external_client_id").eq("id", post_id).maybeSingle();
    if (!post || post.user_id !== userId || !post.external_client_id) return json({ error: "Sem permissão" }, 403);
    const { data: hasMod } = await userClient.rpc("has_module", { _code: "aprovapost_externo", _user: userId });
    if (!hasMod) return json({ error: "Módulo inativo" }, 403);

    const bytes = Uint8Array.from(atob(data_base64), (c) => c.charCodeAt(0));
    const ext = (file_name?.split(".").pop() || file_type?.split("/")[1] || "bin").toLowerCase();
    const key = `${userId}/${post_id}/${crypto.randomUUID()}.${ext}`;
    const put = await fetch(`https://${host}/${zone}/${key}`, { method: "PUT", headers: { AccessKey: pass, "Content-Type": file_type || "application/octet-stream" }, body: bytes });
    if (!put.ok && put.status !== 201) { const d = await put.text().catch(() => ""); return json({ error: "Falha no upload Bunny Storage", detail: d, status: put.status }, 502); }

    const view_url = `https://${pull}/${key}`;
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: ins, error: ie } = await svc.from("external_media_refs").insert({
      user_id: userId, post_id, provider: "bunny_storage", external_file_id: key,
      file_name: file_name || key, file_type: file_type || null, file_size: bytes.length,
      view_url, thumbnail_url: view_url, download_url: view_url,
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    }).select("id").single();
    if (ie) return json({ error: "Falha ao salvar ref", detail: ie.message }, 500);
    return json({ id: ins.id, view_url, key });
  } catch (e) { return json({ error: String(e) }, 500); }
});
