// Retorna a config pública do app do Instagram pro frontend iniciar o OAuth.
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const clientId = Deno.env.get('INSTAGRAM_APP_ID')?.trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!clientId || !supabaseUrl) {
    return new Response(JSON.stringify({ error: 'INSTAGRAM_APP_ID não configurado' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    client_id: clientId,
    redirect_uri: `${supabaseUrl}/functions/v1/instagram-oauth`,
    scope: 'instagram_business_basic,instagram_business_manage_insights',
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
