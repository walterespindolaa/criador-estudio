// Coleta insights do Instagram e grava no cache local.
// Tabelas: social_metrics_daily (1/dia), social_insights (1/mídia), social_audience
// (demografia por dimensão) e social_stories (snapshot de stories).
// Invocada pelo frontend (botão "Atualizar") com o JWT do usuário CRIA.
//
// Cobre TODAS as conexões de Instagram do usuário: a própria (crm_client_id null)
// e as conectadas no contexto de um cliente (crm_client_id setado). Cada conexão
// sincroniza pros seus próprios registros (user_id + crm_client_id), sem colisão.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const GRAPH = 'https://graph.instagram.com';

// Teto de mídias por sync (paginação): amplia a base histórica sem estourar rate limit.
const MEDIA_PAGE = 50;
const MAX_MEDIA = 150;
// Concorrência das chamadas de insight por mídia/story.
const POOL = 5;

// Faz a chamada e reporta se a Graph API respondeu erro. A Graph devolve HTTP 4xx
// com { error: {...} } quando o token expira/é revogado; sem checar isso, o corpo
// de erro era tratado como dado e gravava null por cima das métricas do dia.
async function fetchGraph(url: string): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  try {
    const r = await fetch(url);
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: r.ok && !body?.error, status: r.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: { error: { message: String(e) } } };
  }
}

// Best-effort: para insights opcionais onde "ausente" = 0 e não vale abortar o sync.
async function getJson(url: string): Promise<Record<string, unknown> & { data?: unknown }> {
  const { body } = await fetchGraph(url);
  return body;
}

// Extrai pares (valor_da_dimensão, contagem) da resposta de demografia com breakdown.
// Formato: data[].total_value.breakdowns[].results[] -> { dimension_values: [x], value }.
function parseDemographics(body: Record<string, unknown> & { data?: unknown }): Array<{ key: string; count: number }> {
  const out: Array<{ key: string; count: number }> = [];
  for (const row of (body.data ?? []) as Array<{ total_value?: { breakdowns?: Array<{ results?: Array<{ dimension_values?: unknown[]; value?: number }> }> } }>) {
    for (const bk of row?.total_value?.breakdowns ?? []) {
      for (const r of bk?.results ?? []) {
        const dv = Array.isArray(r.dimension_values) ? String(r.dimension_values[0] ?? '') : '';
        if (dv) out.push({ key: dv, count: Number(r.value ?? 0) });
      }
    }
  }
  return out;
}

type Conn = { id: string; access_token: string; external_account_id: string | null; crm_client_id: string | null };

// Sincroniza UMA conexão. Isolada em try/catch pelo chamador: uma falha (token
// revogado de um cliente) não derruba as demais conexões do usuário.
async function syncConnection(
  admin: ReturnType<typeof createClient>,
  userId: string,
  conn: Conn,
): Promise<{ crm_client_id: string | null; ok: boolean; reconnect?: boolean; followers?: number | null; media_synced?: number; stories_synced?: number; demographics_rows?: number; detail?: string }> {
  const token = conn.access_token;
  const crmClientId = conn.crm_client_id ?? null;

  // 1) conta -> métricas diárias + atualiza a conexão.
  // Token expirado/revogado: aborta ESTA conexão (não sobrescreve as métricas do
  // dia com null) e sinaliza reconexão só pra ela.
  const meRes = await fetchGraph(`${GRAPH}/me?fields=username,account_type,followers_count,media_count,profile_picture_url&access_token=${token}`);
  if (!meRes.ok) {
    console.error('[instagram-sync] graph /me error', conn.id, meRes.status, meRes.body?.error);
    return { crm_client_id: crmClientId, ok: false, reconnect: true, detail: (meRes.body?.error as { message?: string } | undefined)?.message ?? 'graph_error' };
  }
  const me = meRes.body as Record<string, number | string | undefined>;
  // Dia de calendário no fuso do Brasil (servidor roda em UTC).
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const capturedAt = new Date().toISOString();

  // Insights de conta (best-effort): série diária de alcance (gráfico) + visitas ao perfil.
  const until = Math.floor(Date.now() / 1000);
  const since = until - 29 * 86400;
  const reachSeries = await getJson(`${GRAPH}/me/insights?metric=reach&period=day&metric_type=time_series&since=${since}&until=${until}&access_token=${token}`);
  const reachRows: Array<Record<string, unknown>> = [];
  for (const row of (reachSeries.data ?? []) as Array<{ values?: Array<{ value: number; end_time?: string }> }>) {
    for (const v of (row.values ?? [])) {
      const d = String(v.end_time ?? '').slice(0, 10);
      if (d) reachRows.push({ user_id: userId, crm_client_id: crmClientId, provider: 'instagram', date: d, reach: Number(v.value ?? 0), captured_at: capturedAt });
    }
  }
  if (reachRows.length) {
    await admin.from('social_metrics_daily').upsert(reachRows as never, { onConflict: 'user_id,crm_client_id,provider,date' });
  }
  const acctTotals = await getJson(`${GRAPH}/me/insights?metric=profile_views,accounts_engaged,total_interactions&period=day&metric_type=total_value&since=${since}&until=${until}&access_token=${token}`);
  const tot: Record<string, number> = {};
  for (const row of (acctTotals.data ?? []) as Array<{ name: string; total_value?: { value: number }; values?: Array<{ value: number }> }>) {
    tot[row.name] = Number(row.total_value?.value ?? row.values?.[0]?.value ?? 0);
  }

  await admin.from('social_metrics_daily').upsert({
    user_id: userId, crm_client_id: crmClientId, provider: 'instagram', date: today,
    followers: me.followers_count ?? null,
    profile_views: tot.profile_views ?? null,
    accounts_engaged: tot.accounts_engaged ?? null,
    total_interactions: tot.total_interactions ?? null,
    metrics: { media_count: me.media_count ?? null },
    captured_at: new Date().toISOString(),
  } as never, { onConflict: 'user_id,crm_client_id,provider,date' });
  await admin.from('social_connections').update({
    username: me.username ?? null, account_type: me.account_type ?? null,
    profile_picture_url: me.profile_picture_url ?? null, updated_at: new Date().toISOString(),
  } as never).eq('id', conn.id);

  // 1b) DEMOGRAFIA DE AUDIÊNCIA (follower_demographics / engaged_audience_demographics).
  // A API exige period=lifetime + timeframe + 1 chamada por breakdown. Cada chamada
  // isolada: se plano/timeframe não liberar, loga e segue (não quebra o sync).
  const demoRows: Array<Record<string, unknown>> = [];
  let demoErr: string | null = null; // primeiro erro real da demografia, pra devolver no response.
  const demoMetrics: Array<{ metric: string; key: string }> = [
    { metric: 'follower_demographics', key: 'followers' },
    { metric: 'engaged_audience_demographics', key: 'engaged' },
  ];
  const breakdowns = ['age', 'gender', 'city', 'country'];
  for (const dm of demoMetrics) {
    for (const bd of breakdowns) {
      try {
        let res = await getJson(`${GRAPH}/me/insights?metric=${dm.metric}&period=lifetime&metric_type=total_value&timeframe=this_month&breakdown=${bd}&access_token=${token}`);
        let parsed = parseDemographics(res);
        if (!parsed.length) {
          // Fallback de timeframe: contas novas/pouco volume podem não ter "this_month".
          res = await getJson(`${GRAPH}/me/insights?metric=${dm.metric}&period=lifetime&metric_type=total_value&timeframe=last_30_days&breakdown=${bd}&access_token=${token}`);
          parsed = parseDemographics(res);
        }
        // Sem dados: a API quase sempre devolveu um objeto de erro (permissão/escopo,
        // param invalido). Loga o erro REAL pra aparecer nos logs da edge, senao fica
        // aquele silencio de social_audience vazia sem pista nenhuma.
        if (!parsed.length) {
          const err = (res as { error?: unknown })?.error;
          const detalhe = err ? JSON.stringify(err) : JSON.stringify(res).slice(0, 300);
          console.warn('[instagram-sync] demographics vazio', dm.metric, bd, detalhe);
          // Guarda o primeiro erro da metrica PRINCIPAL (follower_demographics) pra
          // devolver no response e mostrar no app, sem precisar cavar log.
          if (!demoErr && dm.metric === 'follower_demographics') demoErr = `${bd}: ${detalhe}`;
        }
        for (const p of parsed) {
          demoRows.push({
            user_id: userId, crm_client_id: crmClientId, provider: 'instagram',
            metric: dm.key, dimension: bd, breakdown_value: p.key, value: p.count, captured_at: capturedAt,
          });
        }
      } catch (e) {
        console.warn('[instagram-sync] demographics fail', dm.metric, bd, String(e));
      }
    }
  }
  // Snapshot limpo: apaga a demografia anterior desta conexão e regrava a atual
  // (buckets que sumiram não ficam presos). Falha aqui não derruba o resto.
  if (demoRows.length) {
    try {
      let del = admin.from('social_audience').delete().eq('user_id', userId).eq('provider', 'instagram');
      del = crmClientId ? del.eq('crm_client_id', crmClientId) : del.is('crm_client_id', null);
      await del;
      await admin.from('social_audience').insert(demoRows as never);
    } catch (e) {
      console.warn('[instagram-sync] social_audience write fail', String(e));
    }
  }

  // 2) MÍDIAS + insights por post (com paginação até MAX_MEDIA).
  const items: Array<Record<string, unknown>> = [];
  let nextUrl: string | null =
    `${GRAPH}/me/media?fields=id,caption,media_type,thumbnail_url,media_url,permalink,timestamp,like_count,comments_count&limit=${MEDIA_PAGE}&access_token=${token}`;
  while (nextUrl && items.length < MAX_MEDIA) {
    const page: Record<string, unknown> & { data?: unknown; paging?: { next?: string } } = await getJson(nextUrl);
    const pageItems = (page.data ?? []) as Array<Record<string, unknown>>;
    items.push(...pageItems);
    nextUrl = (page.paging?.next as string | undefined) ?? null;
    if (!pageItems.length) break;
  }
  const mediaItems = items.slice(0, MAX_MEDIA);

  // Monta a linha de cada mídia (chamadas de insight em paralelo, com pool de concorrência).
  const buildRow = async (it: Record<string, unknown>) => {
    const id = String(it.id);
    const type = String(it.media_type ?? '');
    const isVideo = type === 'VIDEO' || type === 'REELS';
    const [reachIns, extraIns] = await Promise.all([
      getJson(`${GRAPH}/${id}/insights?metric=reach&access_token=${token}`),
      getJson(`${GRAPH}/${id}/insights?metric=saved,shares,total_interactions&access_token=${token}`),
    ]);
    const rows = [...(reachIns.data as unknown[] ?? []), ...(extraIns.data as unknown[] ?? [])];
    if (isVideo) {
      let v = await getJson(`${GRAPH}/${id}/insights?metric=views&access_token=${token}`);
      if (!((v.data as unknown[])?.length)) v = await getJson(`${GRAPH}/${id}/insights?metric=plays&access_token=${token}`);
      rows.push(...(v.data as unknown[] ?? []));
      // RETENÇÃO DE REELS (defensivo, chamada separada pra não derrubar 'views').
      const ret = await getJson(`${GRAPH}/${id}/insights?metric=ig_reels_avg_watch_time,ig_reels_video_view_total_time&access_token=${token}`);
      if ((ret.data as unknown[])?.length) rows.push(...(ret.data as unknown[]));
    }
    const metrics: Record<string, number> = {
      likes: Number(it.like_count ?? 0), comments: Number(it.comments_count ?? 0),
    };
    for (const row of rows as Array<{ name: string; values?: Array<{ value: number }> }>) {
      metrics[row.name] = Number(row.values?.[0]?.value ?? 0);
    }
    return {
      user_id: userId, crm_client_id: crmClientId, provider: 'instagram', object_type: 'media', object_id: id,
      media_type: type || null, caption: (it.caption as string) ?? null,
      permalink: (it.permalink as string) ?? null,
      thumbnail_url: (it.thumbnail_url as string) ?? (it.media_url as string) ?? null,
      posted_at: (it.timestamp as string) ?? null, metrics,
      captured_at: new Date().toISOString(),
    };
  };

  const built: Array<Record<string, unknown>> = [];
  for (let i = 0; i < mediaItems.length; i += POOL) {
    const chunk = mediaItems.slice(i, i + POOL);
    const rows = await Promise.all(chunk.map((it) => buildRow(it).catch(() => null)));
    for (const r of rows) if (r) built.push(r);
  }
  let saved = 0;
  if (built.length) {
    const { error: upErr } = await admin.from('social_insights')
      .upsert(built as never, { onConflict: 'user_id,crm_client_id,provider,object_type,object_id' });
    if (!upErr) saved = built.length;
    else console.error('[instagram-sync] bulk upsert error', upErr);
  }

  // 3) STORIES (somem em 24h -> guardamos o snapshot do que capturarmos).
  let storiesSynced = 0;
  try {
    const storiesRes = await getJson(`${GRAPH}/me/stories?fields=id,media_type,timestamp,permalink,thumbnail_url,media_url&access_token=${token}`);
    const storyItems = (storiesRes.data ?? []) as Array<Record<string, unknown>>;

    const buildStory = async (st: Record<string, unknown>) => {
      const id = String(st.id);
      const metrics: Record<string, number> = {};
      // Lote de métricas de story; se a API recusar o conjunto, tenta uma a uma
      // (impressions/taps_* podem estar depreciados na conta).
      const batch = await getJson(`${GRAPH}/${id}/insights?metric=reach,replies,total_interactions,navigation&access_token=${token}`);
      const batchRows = (batch.data ?? []) as Array<{ name: string; values?: Array<{ value: number }> }>;
      if (batchRows.length) {
        for (const r of batchRows) metrics[r.name] = Number(r.values?.[0]?.value ?? 0);
      } else {
        for (const m of ['reach', 'replies', 'total_interactions', 'navigation']) {
          try {
            const one = await getJson(`${GRAPH}/${id}/insights?metric=${m}&access_token=${token}`);
            const rr = (one.data ?? []) as Array<{ name: string; values?: Array<{ value: number }> }>;
            if (rr[0]) metrics[rr[0].name] = Number(rr[0].values?.[0]?.value ?? 0);
          } catch { /* métrica indisponível: segue */ }
        }
      }
      return {
        user_id: userId, crm_client_id: crmClientId, provider: 'instagram',
        external_story_id: id, media_type: (st.media_type as string) ?? null,
        permalink: (st.permalink as string) ?? null,
        thumbnail_url: (st.thumbnail_url as string) ?? (st.media_url as string) ?? null,
        media_url: (st.media_url as string) ?? null,
        posted_at: (st.timestamp as string) ?? null, metrics,
        captured_at: new Date().toISOString(),
      };
    };

    const storyRows: Array<Record<string, unknown>> = [];
    for (let i = 0; i < storyItems.length; i += POOL) {
      const chunk = storyItems.slice(i, i + POOL);
      const rows = await Promise.all(chunk.map((st) => buildStory(st).catch(() => null)));
      for (const r of rows) if (r) storyRows.push(r);
    }
    if (storyRows.length) {
      const { error: stErr } = await admin.from('social_stories')
        .upsert(storyRows as never, { onConflict: 'user_id,crm_client_id,provider,external_story_id' });
      if (!stErr) storiesSynced = storyRows.length;
      else console.error('[instagram-sync] stories upsert error', stErr);
    }
  } catch (e) {
    console.warn('[instagram-sync] stories fail', String(e));
  }

  return {
    crm_client_id: crmClientId, ok: true,
    followers: (me.followers_count as number) ?? null,
    media_synced: saved, stories_synced: storiesSynced, demographics_rows: demoRows.length,
    demographics_error: demoErr,
  };
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

    // TODAS as conexões do usuário (própria + por cliente). Corrige o "caminho morto"
    // do filtro `.is('crm_client_id', null)`, que impedia o sync das conexões que o
    // gestor conecta no contexto de um cliente.
    const { data: conns } = await admin.from('social_connections')
      .select('id,access_token,external_account_id,crm_client_id')
      .eq('user_id', userId).eq('provider', 'instagram');
    const list = (conns ?? []) as unknown as Conn[];
    if (!list.length) return json({ error: 'not_connected' }, 400);

    // Sincroniza cada conexão isoladamente; falha de uma não derruba as outras.
    const results: Array<Record<string, unknown>> = [];
    for (const conn of list) {
      if (!conn.access_token) { results.push({ crm_client_id: conn.crm_client_id ?? null, ok: false, reconnect: true, detail: 'no_token' }); continue; }
      try {
        results.push(await syncConnection(admin, userId, conn));
      } catch (e) {
        console.error('[instagram-sync] connection failed', conn.id, String(e));
        results.push({ crm_client_id: conn.crm_client_id ?? null, ok: false, detail: String(e) });
      }
    }

    // Compat: mantém followers/media_synced no topo pro caminho da conta própria.
    const self = results.find((r) => (r.crm_client_id ?? null) === null);
    const selfOk = self?.ok === true;
    const anyOk = results.some((r) => r.ok);
    const payload = {
      ok: anyOk,
      reconnect: self ? self.reconnect === true : false,
      followers: selfOk ? (self?.followers ?? null) : null,
      media_synced: selfOk ? (self?.media_synced ?? 0) : 0,
      demographics_rows: selfOk ? (self?.demographics_rows ?? 0) : 0,
      demographics_error: self?.demographics_error ?? null,
      connections: results,
    };
    // Nenhuma conexão sincronizou (ex.: token revogado): devolve 502 pra o front
    // tratar como erro/pedir reconexão, igual ao comportamento anterior.
    return json(payload, anyOk ? 200 : 502);
  } catch (e) {
    return json({ error: 'unexpected', detail: String(e) }, 500);
  }
});
