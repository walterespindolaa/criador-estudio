// Publica no TikTok e no YouTube (03/11/2026).
//
// Três jeitos de chamar:
//   { fila: true } com x-internal-secret: o robô de cada minuto. Publica as
//        linhas de post_publicacoes cujo horário chegou e confere as que o
//        TikTok ainda está processando;
//   { pub_id } com o JWT de quem clicou em "Publicar agora";
//   { acao: 'criador', post_id } com JWT: dados da conta do TikTok que a tela
//        de publicar é obrigada a mostrar (nome, privacidades, limites).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { ErroRede } from '../_shared/redes.ts';
import { conexaoComToken, conferirProcessando, ehMaster, publicarLinha } from '../_shared/redes-publicar.ts';
import { tiktok } from '../_shared/rede-tiktok.ts';

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  try {
    // ── Robô ──
    if (body.fila === true) {
      const interno = req.headers.get('x-internal-secret');
      if (!interno || interno !== Deno.env.get('INTERNAL_PUSH_SECRET')) return json({ error: 'unauthorized' }, 401);
      const inicio = Date.now();
      const feitos: Array<{ pub: string; estado: string }> = [];

      // Primeiro fecha quem está processando (é rápido).
      const { data: proc } = await admin.rpc('redes_processando', { _limite: 10 });
      for (const r of (proc ?? []) as Array<{ id: string }>) await conferirProcessando(admin, r.id);

      // Depois publica, um de cada vez, enquanto sobra tempo.
      while (Date.now() - inicio < 25_000 && feitos.length < 3) {
        const { data } = await admin.rpc('redes_pegar_da_fila');
        const id = (data as string | null) ?? null;
        if (!id) break;
        const r = await publicarLinha(admin, id, null, true);
        feitos.push({ pub: id, estado: r.estado });
      }
      await admin.from('cron_runs').upsert(
        { job: 'redes-publicar', last_run_at: new Date().toISOString(), ok: true, detail: feitos.length ? JSON.stringify(feitos) : null } as never,
        { onConflict: 'job' } as never,
      );
      return json({ feitos });
    }

    // ── Pessoa logada ──
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: u } = await admin.auth.getUser(jwt);
    const actor = u?.user?.id;
    if (!actor) return json({ error: 'unauthorized' }, 401);
    if (!(await ehMaster(admin, actor))) return json({ error: 'sem permissão' }, 403);

    if (body.acao === 'criador') {
      const postId = String(body.post_id ?? '');
      const cx = await conexaoComToken(admin, postId, 'tiktok', actor);
      return json({ criador: await tiktok.criador(cx.token) });
    }

    const pubId = String(body.pub_id ?? '');
    if (!pubId) return json({ error: 'pub_id obrigatório' }, 400);
    // Direito ao post e trava (um publica por vez).
    const { data: trava, error } = await admin.rpc('redes_travar_publicacao', { _pub_id: pubId, _actor: actor });
    if (error) return json({ error: error.message }, 403);
    if (trava !== 'ok') return json({ estado: 'ocupado', mensagem: trava === 'publicado' ? 'Já foi publicado.' : 'Já está sendo publicado.' });
    return json(await publicarLinha(admin, pubId, actor, false));
  } catch (e) {
    const msg = e instanceof ErroRede || e instanceof Error ? e.message : 'erro inesperado';
    console.error('[redes-publicar]', msg);
    return json({ error: msg }, e instanceof ErroRede ? 400 : 500);
  }
});
