// Callback do OAuth do Instagram (Instagram API with Instagram login).
// Recebe ?code & ?state (state = access_token do usuário CRIA), troca por token long-lived,
// busca a conta e grava em social_connections. Redireciona de volta pro app.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const APP_URL = Deno.env.get('APP_URL') || 'https://app.criasocialclub.com.br';

function redirect(status: 'connected' | 'error', detail?: string) {
  const url = `${APP_URL}/app/insights?ig=${status}${detail ? `&m=${encodeURIComponent(detail)}` : ''}`;
  return new Response(null, { status: 302, headers: { Location: url } });
}

Deno.serve(async (req) => {
  try {
    const u = new URL(req.url);
    const code = u.searchParams.get('code');
    const state = u.searchParams.get('state'); // JWT do usuário CRIA
    const err = u.searchParams.get('error');
    if (err) return redirect('error', err);
    if (!code || !state) return redirect('error', 'missing_code');

    const appId = Deno.env.get('INSTAGRAM_APP_ID')!;
    const appSecret = Deno.env.get('INSTAGRAM_APP_SECRET')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const redirectUri = `${supabaseUrl}/functions/v1/instagram-oauth`;

    const admin = createClient(supabaseUrl, serviceKey);

    // Identifica o usuário CRIA pelo JWT que veio no state
    const { data: userData, error: userErr } = await admin.auth.getUser(state);
    if (userErr || !userData?.user) return redirect('error', 'invalid_session');
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
    if (!igId) return redirect('error', 'account_fetch');

    // 4) grava a conexão
    const { error: upErr } = await admin.from('social_connections').upsert({
      user_id: criaUserId,
      provider: 'instagram',
      external_account_id: igId,
      username: me.username ?? null,
      account_type: me.account_type ?? null,
      access_token: longToken,
      token_expires_at: expiresAt,
      scopes: 'instagram_business_basic,instagram_business_manage_insights',
      updated_at: new Date().toISOString(),
    } as never, { onConflict: 'user_id,provider' });
    if (upErr) return redirect('error', 'save_failed');

    return redirect('connected');
  } catch (_e) {
    return redirect('error', 'unexpected');
  }
});
