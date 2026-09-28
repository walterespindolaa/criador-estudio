// Começa o login do Instagram a partir de um CONVITE (link que a social mídia
// mandou pra cliente no WhatsApp). Sem login no Cria: quem abre é a cliente.
// O convite é conferido aqui (existe, não venceu, não foi usado/cancelado) e
// vira um ticket de uso único do OAuth, com o convite anexado. O callback
// (instagram-oauth) grava a conexão na ficha da cliente, em nome de quem
// convidou, e marca o convite como usado.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    // Token tem 64 caracteres hex: qualquer outra coisa nem vai ao banco.
    if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: 'convite_invalido' }, 400);

    const clientId = Deno.env.get('INSTAGRAM_APP_ID')?.trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    if (!clientId) return json({ error: 'integracao_nao_configurada' }, 500);
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: conv } = await admin.from('ig_convites')
      .select('id, crm_client_id, criado_por, expira_em, usado_em, cancelado_em')
      .eq('token', token).maybeSingle();
    const c = conv as { id: string; crm_client_id: string; criado_por: string; expira_em: string; usado_em: string | null; cancelado_em: string | null } | null;
    if (!c) return json({ error: 'convite_invalido' }, 404);
    if (c.usado_em) return json({ error: 'convite_usado' }, 410);
    if (c.cancelado_em) return json({ error: 'convite_cancelado' }, 410);
    if (new Date(c.expira_em).getTime() < Date.now()) return json({ error: 'convite_vencido' }, 410);

    // Ticket de uso único do OAuth (mesmo mecanismo do botão Conectar),
    // agora com o convite junto. 30 min: a cliente pode demorar pra achar a senha.
    const state = `${crypto.randomUUID()}${crypto.randomUUID().replace(/-/g, '')}`;
    const { error: insErr } = await admin.from('oauth_states').insert({
      state, user_id: c.criado_por, crm_client_id: c.crm_client_id, provider: 'instagram',
      convite_id: c.id, expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    } as never);
    if (insErr) return json({ error: 'state_create_failed' }, 500);

    // Convite = conta da CLIENTE: só números (a permissão aprovada pela Meta).
    // Publicar entra quando a Meta aprovar e INSTAGRAM_PUBLISH_ALL=true.
    const escopos = ['instagram_business_basic', 'instagram_business_manage_insights'];
    if (Deno.env.get('INSTAGRAM_PUBLISH_ALL')?.trim() === 'true') escopos.push('instagram_business_content_publish');

    const url = `https://www.instagram.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}`
      + `&redirect_uri=${encodeURIComponent(`${supabaseUrl}/functions/v1/instagram-oauth`)}`
      + `&response_type=code&scope=${encodeURIComponent(escopos.join(','))}&state=${encodeURIComponent(state)}`;
    return json({ url });
  } catch (e) {
    console.error('[ig-convite-iniciar]', String(e));
    return json({ error: 'erro_inesperado' }, 500);
  }
});
