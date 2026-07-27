import { createClient } from "npm:@supabase/supabase-js@2";

// Proxy de download de UMA mídia. O Bunny CDN (criapost.b-cdn.net) não manda header
// de CORS, então o fetch->blob direto do navegador quebra no mobile ("Load failed")
// e o app acaba abrindo a imagem numa aba (no iOS vira share sheet) em vez de baixar.
// Aqui buscamos o arquivo no servidor (sem CORS) e devolvemos os bytes com CORS
// liberado + Content-Disposition: attachment. Assim o front pega um blob same-origin
// e o <a download> força o download de verdade, inclusive no iOS.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: ud, error: ue } = await userClient.auth.getUser();
    if (ue || !ud?.user) return json({ error: "Não autenticado" }, 401);
    const userId = ud.user.id;

    const { media_id } = await req.json();
    if (!media_id) return json({ error: "media_id obrigatório" }, 400);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: ref } = await svc.from("external_media_refs")
      .select("user_id, post_id, provider, file_name, file_type, view_url, download_url, bunny_video_id")
      .eq("id", media_id).maybeSingle();
    if (!ref) return json({ error: "Mídia não encontrada" }, 404);

    // Posse: dono da mídia OU dono do post ao qual ela pertence.
    let owns = ref.user_id === userId;
    if (!owns && ref.post_id) {
      const { data: post } = await svc.from("posts").select("user_id").eq("id", ref.post_id).maybeSingle();
      owns = post?.user_id === userId;
    }
    if (!owns) return json({ error: "Sem permissão" }, 403);

    // Vídeo do Bunny Stream não tem arquivo direto pra baixar por aqui.
    if (ref.bunny_video_id || (ref.provider ?? "").toLowerCase() === "bunny_stream") {
      return json({ error: "Vídeo não pode ser baixado por aqui." }, 422);
    }

    const src = ref.download_url || ref.view_url;
    if (!src) return json({ error: "Arquivo indisponível." }, 404);

    const upstream = await fetch(src);
    if (!upstream.ok || !upstream.body) return json({ error: `Falha ao buscar arquivo (${upstream.status}).` }, 502);

    // Nome seguro pro header (o front também manda seu próprio nome no <a download>).
    const name = (ref.file_name || "arquivo").replace(/[^\w.\-]+/g, "_");
    // Content-Type octet-stream garante que o supabase.functions.invoke devolva Blob
    // (ele só faz .blob() pra application/octet-stream; outros mimes viram texto).
    return new Response(upstream.body, {
      headers: {
        ...cors,
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
