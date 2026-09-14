import { createClient } from "npm:@supabase/supabase-js@2";

/* ═══════════════════════════════════════════════════════════════════════════
   LIMPEZA DO BUNNY: VÍDEO DE POST JÁ PUBLICADO (14/09/2026)

   O Bunny cobra armazenamento E entrega. Hoje todo vídeo de todo cliente fica
   lá pra sempre, mesmo meses depois de publicado, quando ninguém mais abre
   (Walter, 14/09/2026). Este robô apaga do Bunny o que já cumpriu função.

   REGRA DE OURO, aplicada no SQL (`bunny_limpaveis`): só entra quem TEM o
   arquivo no Drive (`download_url`). Vídeo que veio do aparelho não tem cópia
   em lugar nenhum, e apagar seria perder a peça. Depois de apagar, a mídia
   VOLTA a ser do Drive (`bunny_soltar_midia`), então o card continua tocando.

   Chamada por cron, protegida por segredo no cabeçalho (mesmo padrão do
   criapost-media-cleanup).
   ═══════════════════════════════════════════════════════════════════════════ */

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  try {
    if (req.headers.get("x-cleanup-secret") !== Deno.env.get("CRIAPOST_CLEANUP_SECRET")) {
      return json({ error: "unauthorized" }, 401);
    }
    const apiKey = Deno.env.get("BUNNY_STREAM_API_KEY");
    const lib = Deno.env.get("BUNNY_STREAM_LIBRARY_ID");
    if (!apiKey || !lib) return json({ error: "Bunny secrets não configurados" }, 500);

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Janela configurável pela chamada, 30 dias por padrão.
    let dias = 30;
    try {
      const body = await req.json();
      if (typeof body?.dias === "number" && body.dias > 0) dias = Math.floor(body.dias);
    } catch (_) { /* sem corpo: usa o padrão */ }

    const { data: alvos, error } = await svc.rpc("bunny_limpaveis", { _dias: dias });
    if (error) return json({ error: error.message }, 500);

    let liberados = 0;
    const falhas: string[] = [];
    // 404 = já não existe no Bunny, o que pra nós é o mesmo que apagado.
    const okOuSumiu = (r: Response) => r.ok || r.status === 404;

    for (const a of (alvos ?? []) as { media_id: string; bunny_video_id: string }[]) {
      try {
        const res = await fetch(
          `https://video.bunnycdn.com/library/${lib}/videos/${a.bunny_video_id}`,
          { method: "DELETE", headers: { AccessKey: apiKey } },
        ).catch(() => null);

        // Se o Bunny falhar, NÃO soltamos a mídia: na próxima rodada ela volta
        // pra fila. Soltar sem apagar deixaria vídeo pago e órfão lá dentro.
        if (!res || !okOuSumiu(res)) { falhas.push(a.media_id); continue; }

        const { error: solErr } = await svc.rpc("bunny_soltar_midia", { _media_id: a.media_id });
        if (solErr) { falhas.push(a.media_id); continue; }
        liberados++;
      } catch (e) {
        console.error("[bunny-cleanup-publicados] falhou", a.media_id, String(e));
        falhas.push(a.media_id);
      }
    }

    return json({ ok: true, dias, avaliados: (alvos ?? []).length, liberados, falhas: falhas.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
