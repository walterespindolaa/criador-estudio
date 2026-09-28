import { createClient } from "npm:@supabase/supabase-js@2";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  try {
    if (req.headers.get("x-cleanup-secret") !== Deno.env.get("CRIAPOST_CLEANUP_SECRET")) return json({ error: "unauthorized" }, 401);
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const zone = Deno.env.get("BUNNY_STORAGE_ZONE"), host = Deno.env.get("BUNNY_STORAGE_HOST"), pass = Deno.env.get("BUNNY_STORAGE_PASSWORD")!;
    const apiKey = Deno.env.get("BUNNY_CRIAPOST_API_KEY")!, lib = Deno.env.get("BUNNY_CRIAPOST_LIBRARY_ID");

    const { data: refs } = await svc.from("external_media_refs")
      .select("id, provider, external_file_id, bunny_video_id, post_id")
      .not("expires_at", "is", null).lt("expires_at", new Date().toISOString()).limit(200);

    /* MÍDIA DE POST QUE AINDA VAI SAIR NÃO VENCE (ciclo 3 do plano de publicar,
       28/09/2026). Antes a mídia vencia em 7 dias contados do upload, sem olhar
       o post: um post agendado pra daqui 10 dias perdia a mídia antes da data
       e a publicação automática falharia. Agora pula quando o post está na
       fila de publicação, publicando, ou tem data de hoje em diante e ainda
       não foi publicado. Esses voltam pra fila depois que o post sair. */
    const postIds = [...new Set((refs ?? []).map((r) => r.post_id).filter(Boolean))] as string[];
    const protegidos = new Set<string>();
    if (postIds.length) {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data: posts } = await svc.from("posts")
        .select("id, scheduled_date, published_at, publish_status, approval_status, status, deleted_at")
        .in("id", postIds);
      for (const p of (posts ?? []) as Array<Record<string, string | null>>) {
        if (p.deleted_at) continue;
        const publicado = !!p.published_at || p.publish_status === "publicado"
          || p.approval_status === "postado" || p.status === "publicado";
        const naFila = p.publish_status === "na_fila" || p.publish_status === "publicando";
        const vaiSair = !publicado && !!p.scheduled_date && p.scheduled_date >= hoje;
        if (naFila || vaiSair) protegidos.add(p.id as string);
      }
    }
    let removed = 0;
    // 404 = o arquivo já não existe no Bunny → tratamos como sucesso (ok deletar a ref).
    const okOrGone = (res: Response) => res.ok || res.status === 404;
    for (const r of refs ?? []) {
      if (r.post_id && protegidos.has(r.post_id)) {
        // Empurra a validade 2 dias: sem isso as protegidas voltariam sempre
        // no topo da lista (limite 200) e travariam a faxina das outras.
        await svc.from("external_media_refs")
          .update({ expires_at: new Date(Date.now() + 2 * 86400000).toISOString() }).eq("id", r.id);
        continue;
      }
      try {
        // Só apagamos a ref do banco (nosso ÚNICO índice do arquivo) se o delete
        // remoto realmente confirmou. Se o Bunny falhar (rate limit / instabilidade),
        // logamos e PULAMOS esta ref na próxima rodada ela ainda estará aqui pra
        // ser removida. Perder a ref sem apagar o arquivo = mídia órfã paga.
        let remoteOk = true;
        if (r.provider === "bunny_storage" && r.external_file_id) {
          const res = await fetch(`https://${host}/${zone}/${r.external_file_id}`, { method: "DELETE", headers: { AccessKey: pass } })
            .catch((e) => { console.error("[criapost-media-cleanup] bunny storage delete threw", r.id, String(e)); return null; });
          if (!res || !okOrGone(res)) { console.error("[criapost-media-cleanup] bunny storage delete falhou", r.id, res?.status); remoteOk = false; }
        }
        if (remoteOk && r.bunny_video_id) {
          const res = await fetch(`https://video.bunnycdn.com/library/${lib}/videos/${r.bunny_video_id}`, { method: "DELETE", headers: { AccessKey: apiKey } })
            .catch((e) => { console.error("[criapost-media-cleanup] bunny video delete threw", r.id, String(e)); return null; });
          if (!res || !okOrGone(res)) { console.error("[criapost-media-cleanup] bunny video delete falhou", r.id, res?.status); remoteOk = false; }
        }
        if (!remoteOk) continue; // não apaga a ref: preserva o único índice do arquivo
        await svc.from("external_media_refs").delete().eq("id", r.id);
        removed++;
      } catch (_) {}
    }
    return json({ ok: true, removed });
  } catch (e) { return json({ error: String(e) }, 500); }
});
