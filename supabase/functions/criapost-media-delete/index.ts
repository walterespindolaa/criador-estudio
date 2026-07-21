import { createClient } from "npm:@supabase/supabase-js@2";
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
    // A posse já é garantida por user_id. NÃO exigir external_client_id: o rascunho
    // (Novo post) nasce sem cliente vinculado e a pessoa anexa/remove mídia nele.
    if (!post || post.user_id !== userId) return json({ error: "Sem permissão" }, 403);

    // Só remove a ref do banco se o delete no Bunny confirmar (ou o recurso já não existir).
    // Sem isto, um 401/500 do Bunny era engolido e a ref sumia → mídia órfã cobrada pra sempre.
    const bunnyDelete = async (url: string, headers: Record<string, string>): Promise<boolean> => {
      try {
        const r = await fetch(url, { method: "DELETE", headers });
        return r.ok || r.status === 404; // 404 = já não existe → ok remover a ref
      } catch { return false; }
    };

    let allOk = true;
    if (ref.provider === "bunny_storage" && ref.external_file_id) {
      const zone = Deno.env.get("BUNNY_STORAGE_ZONE"), host = Deno.env.get("BUNNY_STORAGE_HOST"), pass = Deno.env.get("BUNNY_STORAGE_PASSWORD")!;
      allOk = (await bunnyDelete(`https://${host}/${zone}/${ref.external_file_id}`, { AccessKey: pass })) && allOk;
    }
    if (ref.bunny_video_id) {
      // Os vídeos do Cria Post são criados na library BUNNY_STREAM (bunny-create-video).
      // O delete PRECISA usar a MESMA library, senão apaga na errada e deixa órfão.
      const apiKey = Deno.env.get("BUNNY_STREAM_API_KEY")!, lib = Deno.env.get("BUNNY_STREAM_LIBRARY_ID");
      allOk = (await bunnyDelete(`https://video.bunnycdn.com/library/${lib}/videos/${ref.bunny_video_id}`, { AccessKey: apiKey })) && allOk;
    }
    if (!allOk) {
      console.error("[criapost-media-delete] bunny delete falhou, mantendo ref p/ retry", media_id);
      return json({ error: "Falha ao remover a mídia do Bunny. Tente de novo." }, 502);
    }
    await svc.from("external_media_refs").delete().eq("id", media_id);
    return json({ ok: true });
  } catch (e) { return json({ error: String(e) }, 500); }
});
