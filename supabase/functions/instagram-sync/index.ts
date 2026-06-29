// Coleta insights do Instagram e grava no cache local (social_metrics_daily + social_insights).
// Invocada pelo frontend (botão "Atualizar") com o JWT do usuário CRIA.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const GRAPH = 'https://graph.instagram.com';

async function getJson(url: string) {
  const r = await fetch(url);
  return await r.json().catch(() => ({}));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);
    const userId = userData.user.id;

    // conexão + token
    const { data: conn } = await admin.from('social_connections')
      .select('access_token,external_account_id')
      .eq('user_id', userId).eq('provider', 'instagram').maybeSingle();
    const token = (conn as { access_token?: string } | null)?.access_token;
    if (!token) return json({ error: 'not_connected' }, 400);

    // 1) conta -> métricas diárias + atualiza a conexão
    const me = await getJson(`${GRAPH}/me?fields=username,account_type,followers_count,media_count,profile_picture_url&access_token=${token}`);
    const today = new Date().toISOString().slice(0, 10);

    // Insights de conta (best-effort): série diária de alcance (gráfico) + visitas ao perfil
    const until = Math.floor(Date.now() / 1000);
    const since = until - 29 * 86400;
    const reachSeries = await getJson(`${GRAPH}/me/insights?metric=reach&period=day&metric_type=time_series&since=${since}&until=${until}&access_token=${token}`);
    for (const row of (reachSeries.data ?? []) as Array<{ values?: Array<{ value: number; end_time?: string }> }>) {
      for (const v of (row.values ?? [])) {
        const d = String(v.end_time ?? '').slice(0, 10);
        if (d) await admin.from('social_metrics_daily').upsert({
          user_id: userId, provider: 'instagram', date: d, reach: Number(v.value ?? 0), captured_at: new Date().toISOString(),
        } as never, { onConflict: 'user_id,provider,date' });
      }
    }
    const acctTotals = await getJson(`${GRAPH}/me/insights?metric=profile_views,accounts_engaged,total_interactions&period=day&metric_type=total&since=${since}&until=${until}&access_token=${token}`);
    const tot: Record<string, number> = {};
    for (const row of (acctTotals.data ?? []) as Array<{ name: string; total_value?: { value: number }; values?: Array<{ value: number }> }>) {
      tot[row.name] = Number(row.total_value?.value ?? row.values?.[0]?.value ?? 0);
    }

    await admin.from('social_metrics_daily').upsert({
      user_id: userId, provider: 'instagram', date: today,
      followers: me.followers_count ?? null,
      profile_views: tot.profile_views ?? null,
      accounts_engaged: tot.accounts_engaged ?? null,
      total_interactions: tot.total_interactions ?? null,
      metrics: { media_count: me.media_count ?? null },
      captured_at: new Date().toISOString(),
    } as never, { onConflict: 'user_id,provider,date' });
    await admin.from('social_connections').update({
      username: me.username ?? null, account_type: me.account_type ?? null,
      profile_picture_url: me.profile_picture_url ?? null, updated_at: new Date().toISOString(),
    } as never).eq('user_id', userId).eq('provider', 'instagram');

    // 2) mídias + insights por post
    const mediaRes = await getJson(
      `${GRAPH}/me/media?fields=id,caption,media_type,thumbnail_url,media_url,permalink,timestamp,like_count,comments_count&limit=25&access_token=${token}`,
    );
    const items = (mediaRes.data ?? []) as Array<Record<string, unknown>>;
    let saved = 0;
    for (const it of items) {
      const id = String(it.id);
      const type = String(it.media_type ?? '');
      // alcance numa chamada isolada (quase sempre disponível) — não quebra com métrica inválida
      const reachIns = await getJson(`${GRAPH}/${id}/insights?metric=reach&access_token=${token}`);
      const extraIns = await getJson(`${GRAPH}/${id}/insights?metric=saved,shares,total_interactions&access_token=${token}`);
      const rows = [...(reachIns.data ?? []), ...(extraIns.data ?? [])];
      // visualizações (reels/vídeo) numa chamada isolada — tenta 'views', cai pra 'plays'
      if (type === 'VIDEO' || type === 'REELS') {
        let v = await getJson(`${GRAPH}/${id}/insights?metric=views&access_token=${token}`);
        if (!(v.data?.length)) v = await getJson(`${GRAPH}/${id}/insights?metric=plays&access_token=${token}`);
        rows.push(...(v.data ?? []));
      }
      const metrics: Record<string, number> = {
        likes: Number(it.like_count ?? 0), comments: Number(it.comments_count ?? 0),
      };
      for (const row of rows as Array<{ name: string; values?: Array<{ value: number }> }>) {
        metrics[row.name] = Number(row.values?.[0]?.value ?? 0);
      }
      const { error: upErr } = await admin.from('social_insights').upsert({
        user_id: userId, provider: 'instagram', object_type: 'media', object_id: id,
        media_type: type || null, caption: (it.caption as string) ?? null,
        permalink: (it.permalink as string) ?? null,
        thumbnail_url: (it.thumbnail_url as string) ?? (it.media_url as string) ?? null,
        posted_at: (it.timestamp as string) ?? null, metrics,
        captured_at: new Date().toISOString(),
      } as never, { onConflict: 'user_id,provider,object_type,object_id' });
      if (!upErr) saved++;
    }

    return json({ ok: true, followers: me.followers_count ?? null, media_synced: saved });
  } catch (e) {
    return json({ error: 'unexpected', detail: String(e) }, 500);
  }
});
