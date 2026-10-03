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

// F25 (SSRF): o `src` vem de external_media_refs, uma linha gravavel pelo cliente.
// So deixamos o servidor buscar em hosts esperados e sempre por https. Sem isso,
// alguem gravaria uma url interna (169.254.169.254, localhost, etc.) e o edge
// buscaria por ela. Allowlist: pull zone do Bunny, Bunny Stream, Google Drive
// (e o redirect de download do Drive) e o storage do proprio Supabase (providers
// device/storage guardam a url publica do bucket).
function fetchHostAllowed(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  const pull = (Deno.env.get("BUNNY_STORAGE_PULLZONE") || "").toLowerCase();
  let supaHost = "";
  try { supaHost = new URL(Deno.env.get("SUPABASE_URL") || "").hostname.toLowerCase(); } catch { /* ignore */ }
  if (pull && h === pull) return true;
  if (h.endsWith(".b-cdn.net")) return true;                 // Bunny Storage pull zone
  if (h === "video.bunnycdn.com" || h.endsWith(".mediadelivery.net")) return true; // Bunny Stream
  if (supaHost && h === supaHost) return true;               // Supabase Storage (device/storage)
  if (h === "drive.google.com" || h === "drive.usercontent.google.com") return true;
  if (h.endsWith(".googleusercontent.com")) return true;     // redirect de download do Drive
  return false;
}

/** File id do Drive numa URL (/file/d/<id> ou ?id=<id>). Só caracteres de id: a
 *  URL de download é montada AQUI, nunca a que veio do banco (sem SSRF). */
function driveIdDe(url: string | null | undefined): string | null {
  if (!url || !/drive\.google\.com|drive\.usercontent\.google\.com/i.test(url)) return null;
  return url.match(/\/(?:file\/)?d\/([-\w]{25,})/)?.[1] || url.match(/[?&]id=([-\w]{25,})/)?.[1] || null;
}

/** Arquivo original do Drive: com o token da pessoa (arquivo que ela escolheu
 *  pelo seletor do Google) e, se não der, pelo download público. */
async function baixarDoDrive(id: string, token: string | null): Promise<Response> {
  if (token) {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok && r.body) return r;
    try { await r.body?.cancel(); } catch { /* ignore */ }
  }
  return await fetch(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`);
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

    const { media_id, drive_token } = await req.json();
    if (!media_id) return json({ error: "media_id obrigatório" }, 400);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: ref } = await svc.from("external_media_refs")
      .select("user_id, post_id, provider, file_name, file_type, view_url, download_url, bunny_video_id")
      .eq("id", media_id).maybeSingle();
    if (!ref) return json({ error: "Mídia não encontrada" }, 404);

    // Posse: dono da mídia OU dono do post ao qual ela pertence.
    let owns = ref.user_id === userId;
    let donoDaConta: string | null = ref.user_id ?? null;
    if (!owns && ref.post_id) {
      const { data: post } = await svc.from("posts").select("user_id").eq("id", ref.post_id).maybeSingle();
      owns = post?.user_id === userId;
      if (post?.user_id) donoDaConta = post.user_id;
    }
    /* EQUIPE TAMBÉM BAIXA (Walter, 03/10/2026 · "Salvar no celular").
       A colaboradora ativa da conta (manager_members, papel que não é de
       parceiro) já vê e edita esses posts pela RLS; só o download recusava.
       is_team_member roda com o token DELA, então checa auth.uid() certo. */
    if (!owns && donoDaConta) {
      const { data: daEquipe } = await userClient.rpc("is_team_member", { target: donoDaConta });
      owns = daEquipe === true;
    }
    if (!owns) return json({ error: "Sem permissão" }, 403);

    /* VÍDEO QUE VEIO DO DRIVE (Walter, 03/10/2026). O vídeo colado do Drive é
       copiado pro Bunny pra tocar melhor, mas o link de origem continua em
       download_url (bunny-ingerir-drive não apaga). O Bunny não entrega MP4
       dessa library, e a cópia dele ainda expira com a limpeza; o arquivo
       original do Drive não. Então o download desse vídeo sai do Drive.
       Vídeo subido direto no Bunny (sem origem no Drive) continua recusado. */
    const ehBunny = !!ref.bunny_video_id || (ref.provider ?? "").toLowerCase() === "bunny_stream";
    let upstream: Response;
    if (ehBunny) {
      const driveId = driveIdDe(ref.download_url);
      if (!driveId) return json({ error: "Vídeo não pode ser baixado por aqui." }, 422);
      upstream = await baixarDoDrive(driveId, typeof drive_token === "string" ? drive_token : null);
      const tipo = upstream.headers.get("content-type") ?? "";
      if (!upstream.ok || !upstream.body || tipo.includes("text/html")) {
        try { await upstream.body?.cancel(); } catch { /* ignore */ }
        return json({ error: "O Drive não liberou esse vídeo. Ele precisa estar como \"qualquer pessoa com o link\"." }, 422);
      }
    } else {
      const src = ref.download_url || ref.view_url;
      if (!src) return json({ error: "Arquivo indisponível." }, 404);
      if (!fetchHostAllowed(src)) return json({ error: "Origem do arquivo não permitida." }, 400);
      upstream = await fetch(src);
      if (!upstream.ok || !upstream.body) return json({ error: `Falha ao buscar arquivo (${upstream.status}).` }, 502);
    }

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
