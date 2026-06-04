import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: ud, error: ue } = await userClient.auth.getUser();
    if (ue || !ud?.user) return json({ error: "Não autenticado" }, 401);
    const userId = ud.user.id;

    const { media_id } = await req.json();
    if (!media_id) return json({ error: "media_id obrigatório" }, 400);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: ref } = await svc.from("external_media_refs").select("id, post_id, provider, external_file_id, bunny_video_id").eq("id", media_id).maybeSingle();
    if (!ref) return json({ ok: true });
    const { data: post } = await svc.from("posts").select("user_id, external_client_id").eq("id", ref.post_id).maybeSingle();
    if (!post || post.user_id !== userId || !post.external_client_id) return json({ error: "Sem permissão" }, 403);

    if (ref.provider === "bunny_storage" && ref.external_file_id) {
      const zone = Deno.env.get("BUNNY_STORAGE_ZONE"), host = Deno.env.get("BUNNY_STORAGE_HOST"), pass = Deno.env.get("BUNNY_STORAGE_PASSWORD")!;
      await fetch(`https://${host}/${zone}/${ref.external_file_id}`, { method: "DELETE", headers: { AccessKey: pass } }).catch(() => {});
    }
    if (ref.bunny_video_id) {
      const apiKey = Deno.env.get("BUNNY_CRIAPOST_API_KEY")!, lib = Deno.env.get("BUNNY_CRIAPOST_LIBRARY_ID");
      await fetch(`https://video.bunnycdn.com/library/${lib}/videos/${ref.bunny_video_id}`, { method: "DELETE", headers: { AccessKey: apiKey } }).catch(() => {});
    }
    await svc.from("external_media_refs").delete().eq("id", media_id);
    return json({ ok: true });
  } catch (e) { return json({ error: String(e) }, 500); }
});
