// Conectar TikTok e YouTube (03/11/2026).
//
// Dois jeitos de chamar:
//   POST { rede, crm_client_id?, return_to? } com o JWT de quem clica:
//        cria o ticket de uso único (oauth_states) e devolve a URL de login;
//   GET  ?code&state (volta da rede): troca o code pelos tokens, grava a
//        conexão e manda a pessoa de volta pro app.
// O mesmo endereço serve de redirect pras duas redes (o ticket diz qual é).
// Endereço a cadastrar no TikTok e no Google:
//   https://app.criasocialclub.com.br/api/redes-oauth (repassado pelo vercel.json)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { ErroRede } from '../_shared/redes.ts';
import { ehMaster, PUBLICADORES } from '../_shared/redes-publicar.ts';

const APP_URL = Deno.env.get('APP_URL') || 'https://app.criasocialclub.com.br';
type RedeNova = 'tiktok' | 'youtube';
const ehRede = (r: unknown): r is RedeNova => r === 'tiktok' || r === 'youtube';

function volta(rede: string, status: 'ok' | 'erro', detalhe: string | null, crmClientId: string | null, returnTo: string | null) {
  const base = returnTo
    ? `${APP_URL}${returnTo}`
    : crmClientId ? `${APP_URL}/socialmidia/clientes/${crmClientId}` : `${APP_URL}/app/configuracoes`;
  const qs = new URLSearchParams({ rede, conexao: status });
  if (detalhe) qs.set('m', detalhe.slice(0, 160));
  return new Response(null, { status: 302, headers: { Location: `${base}${base.includes('?') ? '&' : '?'}${qs}` } });
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // Endereço de volta no domínio do Cria (o Google só verifica app com redirect
  // em domínio próprio). O vercel.json repassa /api/redes-oauth pra esta função.
  const redirectUri = Deno.env.get('REDES_OAUTH_REDIRECT')?.trim() || `${APP_URL}/api/redes-oauth`;

  // ── 1. Começar: ticket + URL de login ──
  if (req.method === 'POST') {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: u } = await admin.auth.getUser(jwt);
    const userId = u?.user?.id;
    if (!userId) return json({ error: 'unauthorized' }, 401);
    if (!(await ehMaster(admin, userId))) return json({ error: 'Conectar TikTok e YouTube ainda está em teste.' }, 403);
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (!ehRede(b.rede)) return json({ error: 'rede inválida' }, 400);
    const crmClientId = typeof b.crm_client_id === 'string' ? b.crm_client_id : null;
    const returnTo = typeof b.return_to === 'string' && /^\/(?!\/)[^\s]{0,300}$/.test(b.return_to) ? b.return_to : null;

    // O cliente tem que ser seu (mesma regra do Instagram).
    if (crmClientId) {
      const { data: dono } = await admin.from('crm_clients').select('manager_id').eq('id', crmClientId).maybeSingle();
      const managerId = (dono as { manager_id?: string } | null)?.manager_id;
      if (!managerId) return json({ error: 'client_not_found' }, 404);
      if (managerId !== userId) {
        const { data: m } = await admin.from('manager_members').select('id')
          .eq('manager_id', managerId).eq('member_id', userId).eq('status', 'ativo').maybeSingle();
        if (!m) return json({ error: 'forbidden' }, 403);
      }
    }
    const state = `${crypto.randomUUID()}${crypto.randomUUID().replace(/-/g, '')}`;
    const { error } = await admin.from('oauth_states').insert({ state, user_id: userId, crm_client_id: crmClientId, provider: b.rede, return_to: returnTo } as never);
    if (error) return json({ error: 'state_create_failed' }, 500);
    try {
      return json({ url: PUBLICADORES[b.rede].urlDeConexao(state, redirectUri) });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'erro' }, 500);
    }
  }

  // ── 2. Volta da rede ──
  const u = new URL(req.url);
  const code = u.searchParams.get('code');
  const state = u.searchParams.get('state');
  const errParam = u.searchParams.get('error');
  if (!state) return volta('rede', 'erro', 'sem ticket', null, null);

  const { data: st } = await admin.from('oauth_states')
    .select('user_id, crm_client_id, provider, expires_at, return_to').eq('state', state).maybeSingle();
  await admin.from('oauth_states').delete().eq('state', state);
  const s = st as { user_id: string; crm_client_id: string | null; provider: string; expires_at: string; return_to: string | null } | null;
  if (!s || !ehRede(s.provider)) return volta('rede', 'erro', 'ticket inválido', null, null);
  const rede = s.provider;
  if (errParam) return volta(rede, 'erro', errParam === 'access_denied' ? 'cancelado' : errParam, s.crm_client_id, s.return_to);
  if (!code) return volta(rede, 'erro', 'sem código', s.crm_client_id, s.return_to);
  if (new Date(s.expires_at).getTime() < Date.now()) return volta(rede, 'erro', 'o login demorou demais, tente de novo', s.crm_client_id, s.return_to);

  try {
    const t = await PUBLICADORES[rede].trocarCodigo(code, redirectUri);
    const payload = {
      user_id: s.user_id, crm_client_id: s.crm_client_id, provider: rede,
      external_account_id: t.contaId, username: t.usuario, profile_picture_url: t.foto ?? null,
      access_token: t.accessToken, token_expires_at: t.accessExpiraEm, scopes: t.escopos,
      needs_reconnect: false, updated_at: new Date().toISOString(),
    };
    let q = admin.from('social_connections').select('id').eq('user_id', s.user_id).eq('provider', rede);
    q = s.crm_client_id ? q.eq('crm_client_id', s.crm_client_id) : q.is('crm_client_id', null);
    const { data: existe } = await q.maybeSingle();
    let connectionId = (existe as { id?: string } | null)?.id ?? null;
    if (connectionId) {
      const r = await admin.from('social_connections').update(payload as never).eq('id', connectionId);
      if (r.error) throw new ErroRede(`save_failed: ${r.error.message}`);
    } else {
      const r = await admin.from('social_connections').insert(payload as never).select('id').single();
      if (r.error) throw new ErroRede(`save_failed: ${r.error.message}`);
      connectionId = (r.data as { id: string }).id;
    }
    if (t.refreshToken) {
      await admin.from('social_connection_tokens').upsert({
        connection_id: connectionId, refresh_token: t.refreshToken, refresh_expires_at: t.refreshExpiraEm ?? null, updated_at: new Date().toISOString(),
      } as never);
    }
    return volta(rede, 'ok', null, s.crm_client_id, s.return_to);
  } catch (e) {
    console.error('[redes-oauth]', rede, String(e));
    return volta(rede, 'erro', e instanceof Error ? e.message : 'erro inesperado', s.crm_client_id, s.return_to);
  }
});
