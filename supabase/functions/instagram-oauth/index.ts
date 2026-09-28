// Callback do OAuth do Instagram (Instagram API with Instagram login).
// Recebe ?code & ?state (state = access_token do usuário CRIA), troca por token long-lived,
// busca a conta e grava em social_connections. Redireciona de volta pro app.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const APP_URL = Deno.env.get('APP_URL') || 'https://app.criasocialclub.com.br';

// Volta pra ONDE a pessoa estava. Conexão de cliente volta pra aba Instagram
// DAQUELE cliente (antes caía na home do Cria Post, sem toast nenhum: sucesso
// e erro pareciam a mesma coisa, "não aconteceu nada").
function redirect(status: 'connected' | 'error', detail?: string, crmClientId?: string | null, returnTo?: string | null) {
  /* `returnTo` vem do ticket (validado na get-instagram-config: caminho
     interno). É o que deixa o onboarding conectar o Instagram e voltar pro
     passo seguinte, em vez de cair em /app/insights. */
  const base = returnTo
    ? `${APP_URL}${returnTo}`
    : crmClientId
      ? `${APP_URL}/socialmidia/clientes/${crmClientId}/instagram`
      : `${APP_URL}/app/insights`;
  const sep = base.includes('?') ? '&' : '?';
  const url = `${base}${sep}ig=${status}${detail ? `&m=${encodeURIComponent(detail)}` : ''}`;
  return new Response(null, { status: 302, headers: { Location: url } });
}

// CONVITE (link que a social mídia mandou pra cliente): a cliente não tem login
// no Cria, então volta pra página PÚBLICA do convite, com o resultado.
function voltaConvite(token: string, status: 'ok' | 'erro', detalhe?: string, usuario?: string | null) {
  const qs = new URLSearchParams({ r: status });
  if (detalhe) qs.set('m', detalhe.slice(0, 160));
  if (usuario) qs.set('u', usuario);
  return new Response(null, { status: 302, headers: { Location: `${APP_URL}/conectar/${token}?${qs}` } });
}

Deno.serve(async (req) => {
  try {
    const u = new URL(req.url);
    const code = u.searchParams.get('code');
    const state = u.searchParams.get('state'); // ticket de uso único (nonce)
    const err = u.searchParams.get('error');
    if (err) {
      // Cliente cancelou na tela do Instagram: se veio de convite, volta pro convite.
      if (state) {
        const { data: s0 } = await createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
          .from('oauth_states').select('convite_id, ig_convites(token)').eq('state', state).maybeSingle();
        const tk = (s0 as { ig_convites?: { token?: string } | null } | null)?.ig_convites?.token;
        if (tk) return voltaConvite(tk, 'erro', 'cancelado');
      }
      return redirect('error', err);
    }
    if (!code || !state) return redirect('error', 'missing_code');

    const appId = Deno.env.get('INSTAGRAM_APP_ID')!.trim();
    const appSecret = Deno.env.get('INSTAGRAM_APP_SECRET')!.trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const redirectUri = `${supabaseUrl}/functions/v1/instagram-oauth`;

    const admin = createClient(supabaseUrl, serviceKey);

    // Troca o ticket (state) pelo usuário. Uso único: apaga logo após ler.
    const { data: st } = await admin.from('oauth_states')
      .select('user_id, crm_client_id, expires_at, return_to, convite_id').eq('state', state).maybeSingle();
    await admin.from('oauth_states').delete().eq('state', state);
    if (!st) return redirect('error', 'invalid_state');
    if (new Date((st as { expires_at: string }).expires_at).getTime() < Date.now()) {
      return redirect('error', 'state_expired');
    }
    const conviteId = (st as { convite_id?: string | null }).convite_id ?? null;
    let conviteToken: string | null = null;
    if (conviteId) {
      const { data: cv } = await admin.from('ig_convites').select('token').eq('id', conviteId).maybeSingle();
      conviteToken = (cv as { token?: string } | null)?.token ?? null;
    }
    // Veio de convite: erro e sucesso voltam pra página pública, não pro app.
    const falha = (motivo: string) => conviteToken ? voltaConvite(conviteToken, 'erro', motivo) : null;
    const criaUserId = (st as { user_id: string }).user_id;
    const crmClientId = (st as { crm_client_id: string | null }).crm_client_id ?? null;
    const returnTo = (st as { return_to?: string | null }).return_to ?? null;

    // 1) code -> token curto
    const form = new URLSearchParams({
      client_id: appId, client_secret: appSecret, grant_type: 'authorization_code',
      redirect_uri: redirectUri, code,
    });
    const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form,
    });
    const shortRaw = await shortRes.json();
    // A Meta já devolveu esse corpo em dois formatos: plano ({access_token,
    // permissions}) e embrulhado ({data:[{...}]}). Aceita os dois.
    const shortJson = (Array.isArray(shortRaw?.data) ? shortRaw.data[0] : shortRaw) ?? {};
    if (!shortRes.ok || !shortJson.access_token) return falha('token_exchange') ?? redirect('error', 'token_exchange', crmClientId, returnTo);
    const shortToken = shortJson.access_token as string;

    /* PERMISSÕES DE VERDADE (ciclo 2). Antes gravava a lista "no chute"; se a
       pessoa desmarcasse "publicar" na tela da Meta, o Cria acharia que pode
       publicar e o post agendado falharia na hora H. Agora grava o que a Meta
       devolveu. Sem essa informação na resposta, cai no básico (nunca supõe
       publicar). */
    const permsRaw = shortJson.permissions as string | string[] | undefined;
    const permsLista = (Array.isArray(permsRaw) ? permsRaw : String(permsRaw ?? '').split(','))
      .map((p) => String(p).trim()).filter(Boolean);
    const escoposConcedidos = permsLista.length
      ? permsLista.join(',')
      : 'instagram_business_basic,instagram_business_manage_insights';

    // 2) token curto -> token longo (60 dias)
    // Se a troca falhar, ABORTA, não salvar o token curto (~1h) como se estivesse
    // "conectado", senão a conexão morre em 1h sem o usuário saber.
    const longRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`,
    );
    const longJson = await longRes.json();
    if (!longRes.ok || !longJson.access_token) {
      console.error('[instagram-oauth] long-lived exchange failed', longRes.status, JSON.stringify(longJson?.error ?? longJson));
      // Devolve o motivo REAL da Meta junto do código. Antes só aparecia
      // "token_exchange_long" na tela, que não dizia nada nem pra gente nem pro
      // usuário, e obrigava a cavar o log da função pra descobrir o porquê.
      const metaMsg = (longJson?.error?.message ?? longJson?.error_message ?? '') as string;
      const detalhe = metaMsg ? `token_exchange_long: ${metaMsg.slice(0, 160)}` : 'token_exchange_long';
      return falha(detalhe) ?? redirect('error', detalhe, crmClientId, returnTo);
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
    if (!igId) return falha('account_fetch') ?? redirect('error', 'account_fetch', crmClientId, returnTo);

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
      scopes: escoposConcedidos,
      // Conectou de novo: o aviso "Reconecte" some.
      needs_reconnect: false,
      updated_at: new Date().toISOString(),
    };
    let q = admin.from('social_connections').select('id')
      .eq('user_id', criaUserId).eq('provider', 'instagram');
    q = crmClientId ? q.eq('crm_client_id', crmClientId) : q.is('crm_client_id', null);
    const { data: existing } = await q.maybeSingle();
    const res = existing
      ? await admin.from('social_connections').update(payload as never).eq('id', (existing as { id: string }).id)
      : await admin.from('social_connections').insert(payload as never);
    if (res.error) {
      console.error('[instagram-oauth] save falhou', JSON.stringify(res.error));
      // O motivo REAL vai na URL: era isto que faltava pra diagnosticar o
      // 'não aconteceu nada' (ex.: coluna crm_client_id ausente no banco).
      return falha('save_failed') ?? redirect('error', `save_failed: ${String(res.error.message ?? '').slice(0, 140)}`, crmClientId, returnTo);
    }

    if (conviteId && conviteToken) {
      // Convite cumprido: marca como usado (link não serve mais) e avisa quem
      // convidou, com o @ que foi conectado (se for a conta errada, ela vê na hora).
      const usuario = (me.username as string | undefined) ?? null;
      await admin.from('ig_convites').update({ usado_em: new Date().toISOString(), username_conectado: usuario } as never).eq('id', conviteId);
      const { data: cli } = await admin.from('crm_clients').select('name').eq('id', crmClientId).maybeSingle();
      await admin.from('notifications').insert({
        user_id: criaUserId, type: 'cria_post',
        title: 'Instagram da cliente conectado',
        description: `${(cli as { name?: string } | null)?.name ?? 'A cliente'} liberou o acesso${usuario ? `: @${usuario}` : ''}. Os números já começam a aparecer.`,
        link: crmClientId ? `/socialmidia/clientes/${crmClientId}/instagram` : '/socialmidia',
        read: false,
      } as never);
      return voltaConvite(conviteToken, 'ok', undefined, usuario);
    }

    return redirect('connected', undefined, crmClientId, returnTo);
  } catch (_e) {
    return redirect('error', 'unexpected');
  }
});
