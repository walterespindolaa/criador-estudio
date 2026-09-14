import { createClient } from "npm:@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const { fileName, accountId, scope } = await req.json();
    const owner = accountId || userId;

    /* CADA COISA NA SUA LIBRARY (Walter, 14/09/2026).
       O front sempre mandou `scope: "criapost"`, e esta função IGNORAVA: tudo
       ia parar na library do Cria (CriaSocialClub), misturando vídeo de peça de
       cliente com arquivo interno do produto. Agora o escopo manda: peça do
       Cria Post vai pra library cria-criapost, o resto segue na de sempre.

       ATENÇÃO: a chave do Bunny é POR LIBRARY. Chave e id têm que ser do mesmo
       par, senão a criação falha (ou pior: cria num lugar e o player procura em
       outro, que é o sintoma de "Processing video" pra sempre). */
    const ehCriaPost = scope === "criapost";
    const apiKey = ehCriaPost
      ? (Deno.env.get("BUNNY_CRIAPOST_API_KEY") ?? Deno.env.get("BUNNY_STREAM_API_KEY"))
      : Deno.env.get("BUNNY_STREAM_API_KEY");
    const libraryId = ehCriaPost
      ? (Deno.env.get("BUNNY_CRIAPOST_LIBRARY_ID") ?? Deno.env.get("BUNNY_STREAM_LIBRARY_ID"))
      : Deno.env.get("BUNNY_STREAM_LIBRARY_ID");
    if (!apiKey || !libraryId) return json({ error: "Bunny secrets não configurados" }, 500);

    // Permissão: dono OU gerente ativo da conta
    // account_members: owner_id = conta gerenciada, member_id = o gerente, status = 'active'
    if (owner !== userId) {
      const { data: membership } = await supabase
        .from("account_members")
        .select("id")
        .eq("owner_id", owner)
        .eq("member_id", userId)
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
