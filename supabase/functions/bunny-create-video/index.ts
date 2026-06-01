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

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
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
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const { fileName, accountId } = await req.json();
    const owner = accountId || userId;

    // Permissão: dono OU gerente ativo da conta
    if (owner !== userId) {
      const { data: membership } = await supabase
        .from("account_members")
        .select("id")
        .eq("manager_id", userId)
        .eq("client_id", owner)
        .eq("status", "active")
        .maybeSingle();
      if (!membership) return json({ error: "Sem permissão para essa conta" }, 403);
    }

    // 1) cria o vídeo na library
    const createRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
      method: "POST",
      headers: { AccessKey: apiKey, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ title: fileName || "video" }),
    });
    if (!createRes.ok) {
      const detail = await createRes.text();
      return json({ error: "Falha ao criar vídeo no Bunny", detail }, 502);
    }
    const created = await createRes.json();
    const videoGuid = created.guid as string;

    // 2) assina o upload TUS (válido por 1h)
    const expiration = Math.floor(Date.now() / 1000) + 3600;
    const signature = await sha256Hex(`${libraryId}${apiKey}${expiration}${videoGuid}`);

    return json({ videoGuid, libraryId, signature, expiration });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
