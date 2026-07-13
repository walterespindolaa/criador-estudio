// Renova tokens long-lived do Instagram antes de expirarem.
// O token da "Instagram API with Instagram login" dura 60 dias e pode ser renovado
// (ig_refresh_token) enquanto ainda é válido e tem >24h de vida. Sem isto, toda
// conexão morria em ~60 dias silenciosamente.
//
// Rodada por cron (ver migration ..._instagram_refresh_cron.sql) com header
// x-internal-secret. Renova quem expira nos próximos REFRESH_WINDOW_DAYS dias.
import { createClient } from 'npm:@supabase/supabase-js@2';

const REFRESH_WINDOW_DAYS = 10;

Deno.serve(async (req) => {
  // Auth interna: só o cron (com o segredo) pode disparar.
  const secret = req.headers.get('x-internal-secret');
  if (!secret || secret !== Deno.env.get('INTERNAL_PUSH_SECRET')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const cutoff = new Date(Date.now() + REFRESH_WINDOW_DAYS * 86400000).toISOString();

  // Conexões que expiram na janela (ou sem data conhecida), renova todas.
  const { data: conns, error } = await admin
    .from('social_connections')
    .select('id, access_token, token_expires_at')
    .eq('provider', 'instagram')
    .or(`token_expires_at.is.null,token_expires_at.lte.${cutoff}`);

  if (error) {
    console.error('[instagram-refresh] query error', error);
    return new Response(JSON.stringify({ error: 'query_failed' }), { status: 500 });
  }

  let refreshed = 0;
  let failed = 0;
  for (const c of (conns ?? []) as Array<{ id: string; access_token: string | null }>) {
    if (!c.access_token) continue;
    try {
      const r = await fetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${c.access_token}`,
      );
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body.access_token) {
        // Token provavelmente já expirou/foi revogado → não dá pra renovar.
        console.error('[instagram-refresh] refresh failed', c.id, r.status, body?.error);
        failed++;
        continue;
      }
      const expiresIn = Number(body.expires_in ?? 0);
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
      const { error: upErr } = await admin.from('social_connections').update({
        access_token: body.access_token as string,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      } as never).eq('id', c.id);
      if (upErr) { failed++; continue; }
      refreshed++;
    } catch (e) {
      console.error('[instagram-refresh] error', c.id, String(e));
      failed++;
    }
  }

  return new Response(JSON.stringify({ ok: true, refreshed, failed, considered: conns?.length ?? 0 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
