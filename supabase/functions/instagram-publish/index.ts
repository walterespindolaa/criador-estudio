// Publica no Instagram (ciclos 4 e 6 do plano de publicar, 28/09/2026).
//
// Dois jeitos de chamar:
//   { post_id }  com o JWT de quem clicou em "Publicar agora";
//   { fila: true } com x-internal-secret: o robô de cada minuto, que publica
//                  os posts com publicação automática cujo horário chegou.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { lerCota, publicarPost } from '../_shared/ig-publicar.ts';

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

    // ── Cota de 24 h da conta do post (painel de publicar) ──
    if (typeof body?.cota_post_id === 'string') {
      const jwtC = (req.headers.get('Authorization') || '').replace('Bearer ', '');
      const { data: uc } = await admin.auth.getUser(jwtC);
      if (!uc?.user?.id) return json({ error: 'unauthorized' }, 401);
      const { data: cx, error: cxErr } = await admin.rpc('ig_conexao_do_post', { _post_id: body.cota_post_id, _actor: uc.user.id });
      if (cxErr) return json({ error: cxErr.message }, 403);
      const conn = (cx as Array<{ connection_id: string | null; ig_user_id: string | null; pode_publicar: boolean }> | null)?.[0];
      if (!conn?.connection_id || !conn.ig_user_id) return json({ cota: null });
      const { data: tk } = await admin.from('social_connections').select('access_token').eq('id', conn.connection_id).maybeSingle();
      const token = (tk as { access_token?: string } | null)?.access_token;
      return json({ cota: token ? await lerCota(conn.ig_user_id, token) : null });
    }

    // ── Publicar de novo: apagaram no Instagram (Walter, 29/10/2026) ──
    // O post "Publicado" não tinha volta: se apagaram no Instagram (ex.: saiu
    // na hora errada), o Cria não deixava agendar de novo. Aqui confere no
    // próprio Instagram se o post ainda existe. Existe: recusa (duplicaria).
    // Não existe: devolve o post pra "Pronto pra sair", guardando o histórico.
    // Sem como conferir (token, rede): só segue com confirmação explícita.
    if (typeof body?.republicar_post_id === 'string') {
      const pid = body.republicar_post_id as string;
      const jwtR = (req.headers.get('Authorization') || '').replace('Bearer ', '');
      const { data: ur } = await admin.auth.getUser(jwtR);
      const ator = ur?.user?.id;
      if (!ator) return json({ error: 'unauthorized' }, 401);
      const { data: cxr, error: cxrErr } = await admin.rpc('ig_conexao_do_post', { _post_id: pid, _actor: ator });
      if (cxrErr) return json({ error: cxrErr.message }, 403);
      const conn = (cxr as Array<{ connection_id: string | null }> | null)?.[0];
      const { data: pr } = await admin.from('posts')
        .select('id, publish_status, ig_media_id, ig_permalink, published_at').eq('id', pid).maybeSingle();
      const post = pr as { publish_status: string | null; ig_media_id: string | null; ig_permalink: string | null; published_at: string | null } | null;
      if (!post) return json({ error: 'Post não encontrado.' }, 404);
      if (post.publish_status !== 'publicado') return json({ ok: false, motivo: 'nao_publicado' });

      let situacao: 'apagado' | 'no_ar' | 'sem_conferir' = 'sem_conferir';
      if (post.ig_media_id && conn?.connection_id) {
        const { data: tk } = await admin.from('social_connections').select('access_token').eq('id', conn.connection_id).maybeSingle();
        const token = (tk as { access_token?: string } | null)?.access_token;
        if (token) {
          try {
            const r = await fetch(`https://graph.instagram.com/v23.0/${encodeURIComponent(post.ig_media_id)}?fields=id&access_token=${encodeURIComponent(token)}`);
            if (r.ok) situacao = 'no_ar';
            else {
              const b = await r.json().catch(() => ({}));
              // 100 = objeto não existe (apagado). Outro código: não dá pra afirmar.
              if (b?.error?.code === 100) situacao = 'apagado';
            }
          } catch { /* fica sem_conferir */ }
        }
      }
      if (situacao === 'no_ar') return json({ ok: false, motivo: 'no_ar' });
      if (situacao === 'sem_conferir' && body?.forcar !== true) return json({ ok: false, motivo: 'sem_conferir' });

      const quando = post.published_at
        ? new Date(post.published_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : 'antes';
      const { error: upErr } = await admin.from('posts').update({
        publish_status: null, auto_publish: false, publicar_em: null, published_at: null,
        ig_media_id: null, ig_permalink: null, ig_container_id: null,
        publish_error: null, publish_attempts: 0, publish_started_at: null,
        publish_conferido_por: null, publish_conferido_em: null,
        publish_aviso: `Já tinha saído em ${quando} e foi apagado no Instagram${post.ig_permalink ? ` (${post.ig_permalink})` : ''}.`,
      } as never).eq('id', pid).eq('publish_status', 'publicado');
      if (upErr) return json({ error: upErr.message }, 500);
      return json({ ok: true, situacao });
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
