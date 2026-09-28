// Publica no Instagram (ciclos 4 e 6 do plano de publicar, 28/09/2026).
//
// Dois jeitos de chamar:
//   { post_id }  com o JWT de quem clicou em "Publicar agora";
//   { fila: true } com x-internal-secret: o robô de cada minuto, que publica
//                  os posts com publicação automática cujo horário chegou.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { publicarPost } from '../_shared/ig-publicar.ts';

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const body = await req.json().catch(() => ({}));

  try {
    // ── Robô da fila ──
    const interno = req.headers.get('x-internal-secret');
    if (body?.fila === true) {
      if (!interno || interno !== Deno.env.get('INTERNAL_PUSH_SECRET')) return json({ error: 'unauthorized' }, 401);
      const inicio = Date.now();
      const feitos: Array<{ post_id: string; estado: string }> = [];
      // Um de cada vez enquanto sobra tempo (vídeo pode levar mais de 1 min).
      while (Date.now() - inicio < 30_000 && feitos.length < 5) {
        const { data } = await admin.from('posts')
          .select('id, user_id, publish_by')
          .eq('auto_publish', true).eq('publish_status', 'na_fila')
          .lte('publicar_em', new Date().toISOString()).is('deleted_at', null)
          .order('publicar_em', { ascending: true }).limit(1);
        const alvo = (data as Array<{ id: string; user_id: string; publish_by: string | null }> | null)?.[0];
        if (!alvo) break;
        const r = await publicarPost(admin, alvo.id, alvo.publish_by ?? alvo.user_id, true);
        feitos.push({ post_id: alvo.id, estado: r.estado });
        if (r.estado === 'ocupado') break; // outro robô pegou: não briga
      }
      await admin.from('cron_runs').upsert(
        { job: 'instagram-publish', last_run_at: new Date().toISOString(), ok: true, detail: feitos.length ? JSON.stringify(feitos) : null } as never,
        { onConflict: 'job' } as never,
      );
      return json({ ok: true, feitos });
    }

    // ── Publicar agora (clique) ──
    const postId = typeof body?.post_id === 'string' ? body.post_id : null;
    if (!postId) return json({ error: 'post_id obrigatório' }, 400);
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: u } = await admin.auth.getUser(jwt);
    const actor = u?.user?.id;
    if (!actor) return json({ error: 'unauthorized' }, 401);

    // Direito ao post ANTES da trava: estranho não pode nem marcar tentativa.
    const { error: permErr } = await admin.rpc('ig_conexao_do_post', { _post_id: postId, _actor: actor });
    if (permErr) return json({ error: permErr.message }, 403);

    const r = await publicarPost(admin, postId, actor, false);
    return json(r);
  } catch (e) {
    console.error('[instagram-publish]', String(e));
    return json({ error: e instanceof Error ? e.message : 'erro inesperado' }, 500);
  }
});
