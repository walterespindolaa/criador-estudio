// Prepara as mídias de um post pra publicação no Instagram (ciclo 3 do plano
// de publicar, 28/09/2026). Não publica nada: só garante que cada mídia tem
// uma URL pública no formato que a API aceita e diz o que falta, em português.
//
// Quem chama:
//   - o navegador (botão "Checar mídia" do ciclo 5), com o JWT de quem clica;
//   - o motor de publicação (ciclos 4 e 6), com x-internal-secret + actor_id.
// Nos dois casos quem pede tem que ter direito ao post (ig_conexao_do_post
// barra estranho com "sem permissão para este post").
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { prepararMidiaDoPost } from '../_shared/ig-midia.ts';

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const postId = typeof body?.post_id === 'string' ? body.post_id : null;
    if (!postId) return json({ error: 'post_id obrigatório' }, 400);

    // Quem está pedindo.
    let actor: string | null = null;
    const interno = req.headers.get('x-internal-secret');
    if (interno && interno === Deno.env.get('INTERNAL_PUSH_SECRET')) {
      actor = typeof body?.actor_id === 'string' ? body.actor_id : null;
    } else {
      const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
      const { data } = await admin.auth.getUser(jwt);
      actor = data?.user?.id ?? null;
    }
    if (!actor) return json({ error: 'unauthorized' }, 401);

    // Direito ao post: a mesma regra de quem pode publicar.
    const { error: permErr } = await admin.rpc('ig_conexao_do_post', { _post_id: postId, _actor: actor });
    if (permErr) return json({ error: permErr.message }, 403);

    const resultado = await prepararMidiaDoPost(admin, postId);
    return json(resultado);
  } catch (e) {
    console.error('[instagram-preparar-midia]', String(e));
    return json({ error: e instanceof Error ? e.message : 'erro inesperado' }, 500);
  }
});
