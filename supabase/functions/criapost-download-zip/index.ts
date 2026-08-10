import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  // Expõe os metadados do zip pro fetch do front conseguir ler (nome + quantos pularam).
  "Access-Control-Expose-Headers": "X-Zip-Filename, X-Zip-Count, X-Zip-Skipped",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Teto de memória: o edge tem RAM limitada e as fotos têm 7-8MB cada. Se juntar
// tudo em memória (bytes crus + zip + base64) o worker é morto e o front recebe um
// "non-2xx" sem corpo. Somamos os bytes e paramos antes de estourar; o resto vira aviso.
const MAX_TOTAL_BYTES = 120 * 1024 * 1024; // ~120MB de mídia por zip
const MAX_FILE_BYTES = 50 * 1024 * 1024; // pula arquivo gigante isolado

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

// F26/F25 (SSRF): a url vem de external_media_refs (gravavel pelo cliente). So
// buscamos em hosts esperados e por https. Mesma allowlist do criapost-download-file.
function fetchHostAllowed(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  const pull = (Deno.env.get("BUNNY_STORAGE_PULLZONE") || "").toLowerCase();
  let supaHost = "";
  try { supaHost = new URL(Deno.env.get("SUPABASE_URL") || "").hostname.toLowerCase(); } catch { /* ignore */ }
  if (pull && h === pull) return true;
  if (h.endsWith(".b-cdn.net")) return true;
  if (h === "video.bunnycdn.com" || h.endsWith(".mediadelivery.net")) return true;
  if (supaHost && h === supaHost) return true;
  if (h === "drive.google.com" || h === "drive.usercontent.google.com") return true;
  if (h.endsWith(".googleusercontent.com")) return true;
  return false;
}

// F26: impoe o teto ANTES de alocar o corpo inteiro. Se o upstream manda
// Content-Length, rejeita na hora. Senao le o body como stream, acumulando, e
// aborta (reader.cancel) assim que passar do teto. `cap` = maximo permitido pra
// ESTE arquivo. Devolve null quando estoura (o chamador poe no aviso).
async function pullCapped(resp: Response, cap: number): Promise<Uint8Array | null> {
  const clen = Number(resp.headers.get("content-length") || "");
  if (Number.isFinite(clen) && clen > cap) { try { await resp.body?.cancel(); } catch { /* ignore */ } return null; }
  const reader = resp.body?.getReader();
  if (!reader) {
    const b = new Uint8Array(await resp.arrayBuffer());
    return b.byteLength > cap ? null : b;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      size += value.byteLength;
      if (size > cap) { try { await reader.cancel(); } catch { /* ignore */ } return null; }
      chunks.push(value);
    }
  }
  const out = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
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
    let total = 0;
    for (const m of (refs ?? []) as Array<Record<string, string | null>>) {
      const provider = (m.provider ?? "").toLowerCase();
      // Vídeo do Bunny Stream não tem MP4 direto anota e pula.
      if (m.bunny_video_id || provider === "bunny_stream") { skipped.push(`${m.file_name || "vídeo"} (vídeo)`); continue; }

      // Já bateu no teto de memória: manda o resto pro aviso pra não derrubar o worker.
      if (total >= MAX_TOTAL_BYTES) { skipped.push(`${m.file_name || "mídia"} (limite do zip)`); continue; }

      let url: string | null = null;
      if (provider === "gdrive" || provider === "google_drive" || provider === "drive") {
        url = m.external_file_id ? driveDownloadUrl(m.external_file_id) : (m.download_url || m.view_url);
      } else {
        url = m.download_url || m.view_url;
      }
      if (!url) { skipped.push(m.file_name || "mídia"); continue; }

      // F25/F26 (SSRF): so busca em host esperado e por https.
      if (!fetchHostAllowed(url)) { skipped.push(`${m.file_name || "mídia"} (origem não permitida)`); continue; }

      try {
        let resp = await fetch(url);
        // Drive interstitial de arquivo grande: tenta confirmar.
        const ct = resp.headers.get("content-type") ?? "";
        if (ct.includes("text/html") && (provider.includes("drive") || provider === "gdrive")) {
          resp = await fetch(url + "&confirm=t");
        }
        if (!resp.ok) { skipped.push(`${m.file_name || "mídia"} (erro ${resp.status})`); continue; }
        // F26: teto imposto ANTES de alocar o corpo. O que este arquivo pode
        // ocupar e o menor entre o teto por arquivo e o que resta do teto total.
        const cap = Math.min(MAX_FILE_BYTES, MAX_TOTAL_BYTES - total);
        const buf = await pullCapped(resp, cap);
        // Arquivo gigante isolado ou que estouraria o teto: pula com aviso.
        if (buf === null) {
          skipped.push(`${m.file_name || "mídia"} (arquivo grande, baixe individual)`);
          continue;
        }
        total += buf.byteLength;
        n++;
        const isVid = (m.file_type ?? "").startsWith("video") || provider === "bunny_stream";
        const base = isVid ? "video" : "imagem";
        const ext = extFrom(m.file_type, m.file_name, isVid ? "mp4" : "jpg");
        // STORE (sem compressão): imagens/vídeos já são comprimidos, deflate só gasta
        // CPU e memória à toa. Assim o zip sai rápido e leve.
        zip.file(`${base}-${n}.${ext}`, buf, { compression: "STORE" });
      } catch (e) {
        skipped.push(`${m.file_name || "mídia"} (${e instanceof Error ? e.message : "falha"})`);
      }
    }

    if (skipped.length) {
      zip.file("_avisos.txt", "Não foi possível incluir automaticamente (baixe individualmente):\n- " + skipped.join("\n- "));
    }

    const filename = `${slug(post.title || "post")}.zip`;
    // Gera o zip em STREAM e devolve como binário (application/zip). Evita montar o
    // base64 gigante em memória (o que estourava o edge e causava o non-2xx).
    const internal = zip.generateInternalStream({ type: "uint8array", streamFiles: true });
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        internal.on("data", (chunk: Uint8Array) => controller.enqueue(chunk));
        internal.on("error", (err: unknown) => controller.error(err));
        internal.on("end", () => controller.close());
        internal.resume();
      },
    });

    return new Response(body, {
      headers: {
        ...cors,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Zip-Filename": filename,
        "X-Zip-Count": String(n),
        "X-Zip-Skipped": String(skipped.length),
      },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
