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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("BUNNY_STREAM_API_KEY");
    const libraryId = Deno.env.get("BUNNY_STREAM_LIBRARY_ID");
    if (!apiKey || !libraryId) return json({ error: "Bunny secrets não configurados" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Não autenticado" }, 401);

    const { videoGuid } = await req.json();
    if (!videoGuid) return json({ error: "videoGuid ausente" }, 400);

    const res = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoGuid}`,
      { headers: { AccessKey: apiKey, accept: "application/json" } },
    );
    if (!res.ok) return json({ error: "Falha ao consultar status", status: res.status }, 502);
    const v = await res.json();
    // Bunny: 0 created,1 uploaded,2 processing,3 transcoding,4 finished,5 error,6 uploadFailed
    const status = typeof v.status === "number" ? v.status : null;
    const encodeProgress = typeof v.encodeProgress === "number" ? v.encodeProgress : null;
    // Só está realmente tocável quando o encoding chega a 100% E o status é Finished (4).
    // status >= 4 sozinho é cedo demais — o player ainda mostra "Processing".
    const ready = status === 4 && (encodeProgress ?? 0) >= 100;
    return json({ status, encodeProgress, ready });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
