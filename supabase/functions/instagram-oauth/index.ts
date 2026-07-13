// Callback do OAuth do Instagram (Instagram API with Instagram login).
// Recebe ?code & ?state (state = access_token do usuário CRIA), troca por token long-lived,
// busca a conta e grava em social_connections. Redireciona de volta pro app.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const APP_URL = Deno.env.get('APP_URL') || 'https://app.criasocialclub.com.br';

function redirect(status: 'connected' | 'error', detail?: string, toClient?: boolean) {
  const base = toClient ? `${APP_URL}/socialmidia/criapost` : `${APP_URL}/app/insights`;
  const url = `${base}?ig=${status}${detail ? `&m=${encodeURIComponent(detail)}` : ''}`;
  return new Response(null, { status: 302, headers: { Location: url } });
}

Deno.serve(async (req) => {
  try {
    const u = new URL(req.url);
    const code = u.searchParams.get('code');
    const state = u.searchParams.get('state'); // ticket de uso único (nonce)
    const err = u.searchParams.get('error');
    if (err) return redirect('error', err);
    if (!code || !state) return redirect('error', 'missing_code');

    const appId = Deno.env.get('INSTAGRAM_APP_ID')!.trim();
    const appSecret = Deno.env.get('INSTAGRAM_APP_SECRET')!.trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const redirectUri = `${supabaseUrl}/functions/v1/instagram-oauth`;

    const admin = createClient(supabaseUrl, serviceKey);

    // Troca o ticket (state) pelo usuário. Uso único: apaga logo após ler.
    const { data: st } = await admin.from('oauth_states')
      .select('user_id, crm_client_id, expires_at').eq('state', state).maybeSingle();
    await admin.from('oauth_states').delete().eq('state', state);
    if (!st) return redirect('error', 'invalid_state');
    if (new Date((st as { expires_at: string }).expires_at).getTime() < Date.now()) {
      return redirect('error', 'state_expired');
    }
    const criaUserId = (st as { user_id: string }).user_id;
    const crmClientId = (st as { crm_client_id: string | null }).crm_client_id ?? null;
    const toClient = !!crmClientId;

    // 1) code -> token curto
    const form = new URLSearchParams({
      client_id: appId, client_secret: appSecret, grant_type: 'authorization_code',
      redirect_uri: redirectUri, code,
    });
    const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form,
    });
    const shortJson = await shortRes.json();
    if (!shortRes.ok || !shortJson.access_token) return redirect('error', 'token_exchange');
    const shortToken = shortJson.access_token as string;

    // 2) token curto -> token longo (60 dias)
    // Se a troca falhar, ABORTA, não salvar o token curto (~1h) como se estivesse
    // "conectado", senão a conexão morre em 1h sem o usuário saber.
    const longRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`,
    );
    const longJson = await longRes.json();
    if (!longRes.ok || !longJson.access_token) {
      console.error('[instagram-oauth] long-lived exchange failed', longRes.status, longJson?.error);
      return redirect('error', 'token_exchange_long', toClient);
    }
    const longToken = longJson.access_token as string;
    const expiresIn = Number(longJson.expires_in ?? 0);
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    // 3) dados da conta
    const meRes = await fetch(
      `https://graph.instagram.com/me?fields=user_id,username,account_type&access_token=${longToken}`,
    );
    const me = await meRes.json();
    const igId = String(me.user_id ?? me.id ?? '');
    if (!igId) return redirect('error', 'account_fetch', toClient);

    // 4) grava a conexão (manual: índices parciais não funcionam bem com upsert onConflict).
    const payload = {
      user_id: criaUserId,
      crm_client_id: crmClientId,
      provider: 'instagram',
      external_account_id: igId,
      username: me.username ?? null,
      account_type: me.account_type ?? null,
      access_token: longToken,
      token_expires_at: expiresAt,
      scopes: 'instagram_business_basic,instagram_business_manage_insights',
      updated_at: new Date().toISOString(),
    };
    let q = admin.from('social_connections').select('id')
      .eq('user_id', criaUserId).eq('provider', 'instagram');
    q = crmClientId ? q.eq('crm_client_id', crmClientId) : q.is('crm_client_id', null);
    const { data: existing } = await q.maybeSingle();
    const res = existing
      ? await admin.from('social_connections').update(payload as never).eq('id', (existing as { id: string }).id)
      : await admin.from('social_connections').insert(payload as never);
    if (res.error) return redirect('error', 'save_failed', toClient);

    return redirect('connected', undefined, toClient);
  } catch (_e) {
    return redirect('error', 'unexpected');
  }
});
