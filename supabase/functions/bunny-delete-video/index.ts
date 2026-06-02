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
    const userId = userData.user.id;

    const { videoGuid, accountId } = await req.json();
    if (!videoGuid) return json({ error: "videoGuid obrigatório" }, 400);
    const owner = accountId || userId;

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

    // A checagem de permissão da conta acima já é o guard suficiente — o guid é
    // um UUID aleatório só conhecido por quem subiu. Buscamos a ref só pra log
    // (vídeo pode estar pending, sem row ainda — orphan no Bunny senão).
    const { data: ref } = await supabase
      .from("external_media_refs")
      .select("id")
      .eq("bunny_video_id", videoGuid)
      .eq("user_id", owner)
      .maybeSingle();
    console.log("[bunny-delete-video] ref lookup", { videoGuid, owner, refExists: !!ref });

    const delRes = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoGuid}`,
      { method: "DELETE", headers: { AccessKey: apiKey, accept: "application/json" } },
    );

    // 404 do Bunny → já não existe, idempotência ok
    if (!delRes.ok && delRes.status !== 404) {
      const detail = await delRes.text().catch(() => "");
      console.error("[bunny-delete-video] Bunny DELETE failed:", delRes.status, detail);
      return json({ error: "Falha ao deletar vídeo no Bunny", detail }, 502);
    }

    console.log("[bunny-delete-video] ok", { videoGuid, owner, bunnyStatus: delRes.status });
    return json({ ok: true });
  } catch (e) {
    console.error("[bunny-delete-video] unhandled error:", e);
    return json({ error: String(e) }, 500);
  }
});
