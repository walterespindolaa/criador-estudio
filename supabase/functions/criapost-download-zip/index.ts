import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Nome de arquivo seguro pro zip.
function slug(s: string): string {
  return (s || "post").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase().slice(0, 60) || "post";
}
function extFrom(fileType: string | null, fileName: string | null, fallback: string): string {
  const m = (fileName || "").match(/\.([a-z0-9]{2,5})$/i);
  if (m) return m[1].toLowerCase();
  if (fileType?.includes("png")) return "png";
  if (fileType?.includes("jpeg") || fileType?.includes("jpg")) return "jpg";
  if (fileType?.includes("webp")) return "webp";
  if (fileType?.includes("mp4")) return "mp4";
  return fallback;
}
function driveDownloadUrl(id: string): string {
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
}

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

    const { post_id } = await req.json();
    if (!post_id) return json({ error: "post_id obrigatório" }, 400);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: post } = await svc.from("posts")
      .select("user_id, title, caption").eq("id", post_id).maybeSingle();
    if (!post) return json({ error: "Post não encontrado" }, 404);
    if (post.user_id !== userId) return json({ error: "Sem permissão" }, 403);

    const { data: refs } = await svc.from("external_media_refs")
      .select("provider, external_file_id, file_name, file_type, view_url, download_url, bunny_video_id, position")
      .eq("post_id", post_id)
      .order("position", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });

    const zip = new JSZip();
    // Legenda
    zip.file("legenda.txt", (post.caption ?? "") + "");

    const skipped: string[] = [];
    let n = 0;
    for (const m of (refs ?? []) as Array<Record<string, string | null>>) {
      const provider = (m.provider ?? "").toLowerCase();
      // Vídeo do Bunny Stream não tem MP4 direto — anota e pula.
      if (m.bunny_video_id || provider === "bunny_stream") { skipped.push(m.file_name || "vídeo"); continue; }

      let url: string | null = null;
      if (provider === "gdrive" || provider === "google_drive" || provider === "drive") {
        url = m.external_file_id ? driveDownloadUrl(m.external_file_id) : (m.download_url || m.view_url);
      } else {
        url = m.download_url || m.view_url;
      }
      if (!url) { skipped.push(m.file_name || "mídia"); continue; }

      try {
        let resp = await fetch(url);
        // Drive interstitial de arquivo grande: tenta confirmar.
        const ct = resp.headers.get("content-type") ?? "";
        if (ct.includes("text/html") && (provider.includes("drive") || provider === "gdrive")) {
          resp = await fetch(url + "&confirm=t");
        }
        if (!resp.ok) { skipped.push(m.file_name || "mídia"); continue; }
        const buf = new Uint8Array(await resp.arrayBuffer());
        n++;
        const isVid = (m.file_type ?? "").startsWith("video") || provider === "bunny_stream";
        const base = isVid ? "video" : "imagem";
        const ext = extFrom(m.file_type, m.file_name, isVid ? "mp4" : "jpg");
        zip.file(`${base}-${n}.${ext}`, buf);
      } catch {
        skipped.push(m.file_name || "mídia");
      }
    }

    if (skipped.length) {
      zip.file("_avisos.txt", "Não foi possível baixar automaticamente (baixe manualmente):\n- " + skipped.join("\n- "));
    }

    const b64 = await zip.generateAsync({ type: "base64" });
    return json({ filename: `${slug(post.title || "post")}.zip`, zip_base64: b64, count: n, skipped: skipped.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
