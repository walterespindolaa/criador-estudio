import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* DUAS LIBRARIES (05/11/2026). O editor sobe vídeo de post na library
   cria-criapost (bunny-create-video com scope "criapost"), mas esta função só
   olhava a library principal: o status voltava 404 e a prévia nunca sabia
   quando o vídeo ficava pronto, então mostrava o player do Bunny com
   "Processing video" gigante. Agora consulta a library que veio na URL do
   player (se for uma das duas conhecidas) e, sem ela, tenta as duas. */
type Lib = { id: string; key: string };
function libraries(): Lib[] {
  const out: Lib[] = [];
  const cpId = Deno.env.get("BUNNY_CRIAPOST_LIBRARY_ID");
  const cpKey = Deno.env.get("BUNNY_CRIAPOST_API_KEY") ?? Deno.env.get("BUNNY_STREAM_API_KEY");
  const mainId = Deno.env.get("BUNNY_STREAM_LIBRARY_ID");
  const mainKey = Deno.env.get("BUNNY_STREAM_API_KEY");
  if (cpId && cpKey) out.push({ id: cpId, key: cpKey });
  if (mainId && mainKey && mainId !== cpId) out.push({ id: mainId, key: mainKey });
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const libs = libraries();
    if (libs.length === 0) return json({ error: "Bunny secrets não configurados" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Não autenticado" }, 401);

    const { videoGuid, libraryId } = await req.json();
    if (!videoGuid || !/^[0-9a-f-]{36}$/i.test(String(videoGuid))) return json({ error: "videoGuid inválido" }, 400);

    // Só aceita library conhecida (a chave vem do servidor, nunca do cliente).
    const pedida = libs.find((l) => l.id === String(libraryId ?? ""));
    const ordem = pedida ? [pedida, ...libs.filter((l) => l !== pedida)] : libs;

    let ultimo = 0;
    for (const lib of ordem) {
      const res = await fetch(
        `https://video.bunnycdn.com/library/${lib.id}/videos/${videoGuid}`,
        { headers: { AccessKey: lib.key, accept: "application/json" } },
      );
      if (!res.ok) { ultimo = res.status; continue; }
      const v = await res.json();
      // Bunny: 0 created,1 uploaded,2 processing,3 transcoding,4 finished,5 error,6 uploadFailed
      const status = typeof v.status === "number" ? v.status : null;
      const encodeProgress = typeof v.encodeProgress === "number" ? v.encodeProgress : null;
      // Só está tocável com status Finished (4) E encoding em 100%.
      const ready = status === 4 && (encodeProgress ?? 0) >= 100;
      const failed = status === 5 || status === 6;
      return json({ status, encodeProgress, ready, failed });
    }
    return json({ error: "Falha ao consultar status", status: ultimo }, 502);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
