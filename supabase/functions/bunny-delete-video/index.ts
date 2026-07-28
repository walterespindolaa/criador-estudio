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

    // POSSE OBRIGATÓRIA: o videoGuid NÃO é segredo — ele aparece na URL de embed
    // do player (iframe.mediadelivery.net/embed/{lib}/{guid}), visível pra
    // clientes no portal de aprovação e pra colaboradores. Sem checar posse,
    // qualquer usuário logado deletaria o vídeo de outra conta. Exigimos que
    // exista uma ref ligando este guid à conta `owner` (que o usuário já provou
    // ser dono/gerente ativo acima). Sem ref correspondente → nega.
    const { data: ref } = await supabase
      .from("external_media_refs")
      .select("id, user_id")
      .eq("bunny_video_id", videoGuid)
      .maybeSingle();
    if (!ref || String((ref as { user_id?: string }).user_id) !== String(owner)) {
      console.warn("[bunny-delete-video] posse negada", { videoGuid, owner, userId });
      return json({ error: "Vídeo não pertence a esta conta" }, 403);
    }

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
