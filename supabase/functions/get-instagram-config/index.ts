// Retorna a config pública do app do Instagram E cria um "ticket" (nonce) de uso único
// pro OAuth, guardado server-side. Antes o frontend colocava o JWT do usuário na URL
// do OAuth (?state=JWT), que vazava em histórico/logs. Agora vai só o ticket aleatório.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const clientId = Deno.env.get('INSTAGRAM_APP_ID')?.trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!clientId || !supabaseUrl || !serviceKey) {
    return json({ error: 'INSTAGRAM_APP_ID não configurado' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Identifica o usuário pelo JWT do header (a função é verify_jwt=false).
  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  // crm_client_id opcional (conectar a conta no contexto de um cliente gerenciado).
  let crmClientId: string | null = null;
  try { const b = await req.json(); if (b?.crm_client_id) crmClientId = String(b.crm_client_id); } catch { /* sem body */ }

  // Ticket aleatório de uso único (~2 UUIDs de entropia).
  const state = `${crypto.randomUUID()}${crypto.randomUUID().replace(/-/g, '')}`;
  const { error: insErr } = await admin.from('oauth_states')
    .insert({ state, user_id: userId, crm_client_id: crmClientId, provider: 'instagram' });
  if (insErr) return json({ error: 'state_create_failed' }, 500);

  return json({
    client_id: clientId,
    redirect_uri: `${supabaseUrl}/functions/v1/instagram-oauth`,
    scope: 'instagram_business_basic,instagram_business_manage_insights',
    state,
  });
});
