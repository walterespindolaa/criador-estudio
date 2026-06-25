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
    const state = u.searchParams.get('state'); // "JWT" ou "JWT::crmClientId"
    const err = u.searchParams.get('error');
    if (err) return redirect('error', err);
    if (!code || !state) return redirect('error', 'missing_code');

    // state pode carregar o cliente: "JWT::clientId"
    const [jwt, clientIdRaw] = state.split('::');
    const crmClientId = clientIdRaw && clientIdRaw.length > 0 ? clientIdRaw : null;
    const toClient = !!crmClientId;

    const appId = Deno.env.get('INSTAGRAM_APP_ID')!.trim();
    const appSecret = Deno.env.get('INSTAGRAM_APP_SECRET')!.trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const redirectUri = `${supabaseUrl}/functions/v1/instagram-oauth`;

    const admin = createClient(supabaseUrl, serviceKey);

    // Identifica o usuário CRIA pelo JWT que veio no state
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return redirect('error', 'invalid_session', toClient);
    const criaUserId = userData.user.id;

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
    const longRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`,
    );
    const longJson = await longRes.json();
    const longToken = (longJson.access_token as string) || shortToken;
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
