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

  // Heartbeat honesto: registra o RESULTADO da rodada no final (ok) ou no catch
  // (ok:false). No início ainda não sabemos se vai dar certo.
  const heartbeat = (ok: boolean, detail: string | null = null) =>
    admin.from('cron_runs').upsert(
      { job: 'instagram-refresh', last_run_at: new Date().toISOString(), ok, detail } as never,
      { onConflict: 'job' } as never,
    );

  try {
    const cutoff = new Date(Date.now() + REFRESH_WINDOW_DAYS * 86400000).toISOString();

    // Conexões que expiram na janela (ou sem data conhecida), renova todas.
    const { data: conns, error } = await admin
      .from('social_connections')
      .select('id, access_token, token_expires_at')
      .eq('provider', 'instagram')
      .or(`token_expires_at.is.null,token_expires_at.lte.${cutoff}`);

    if (error) {
      console.error('[instagram-refresh] query error', error);
      await heartbeat(false, error.message);
      return new Response(JSON.stringify({ error: 'query_failed' }), { status: 500 });
    }

    let refreshed = 0;
    let failed = 0;
    let dead = 0; // tokens em falha DEFINITIVA (400/401/403): não adianta re-tentar.
    for (const c of (conns ?? []) as Array<{ id: string; access_token: string | null }>) {
      if (!c.access_token) continue;
      try {
        const r = await fetch(
          `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${c.access_token}`,
        );
        const body = await r.json().catch(() => ({}));
        if (!r.ok || !body.access_token) {
          // Token provavelmente já expirou/foi revogado → não dá pra renovar.
          // 400/401/403 do endpoint de refresh = falha DEFINITIVA (token morto):
          // essa conexão precisa que o usuário reconecte, e volta pra fila todo dia.
          const definitiva = r.status === 400 || r.status === 401 || r.status === 403;
          console.error('[instagram-refresh] refresh failed', c.id, r.status, body?.error, definitiva ? '(token morto/definitivo — precisa reconectar)' : '(possivelmente transitório)');
          // TODO(schema): social_connections NÃO tem coluna de status/reconexão
          // (colunas: username, account_type, access_token, token_expires_at, scopes,
          // connected_at, updated_at, profile_picture_url, crm_client_id). Hoje o
          // instagram-sync só sinaliza `reconnect` no PAYLOAD de resposta, sem persistir.
          // Sem uma coluna tipo `needs_reconnect boolean` (+ `last_refresh_error text`)
          // não dá pra marcar o token morto e tirar a conexão da fila diária. Quando a
          // coluna existir: aqui, se `definitiva`, setar needs_reconnect=true na conexão.
          if (definitiva) dead++;
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

    await heartbeat(true);
    return new Response(JSON.stringify({ ok: true, refreshed, failed, dead, considered: conns?.length ?? 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[instagram-refresh] unhandled', String(e));
    try { await heartbeat(false, String(e)); } catch (_) { /* heartbeat é best-effort */ }
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
  }
});
