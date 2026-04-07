const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');

  if (!googleClientId) {
    return new Response(
      JSON.stringify({ error: 'GOOGLE_CLIENT_ID not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ client_id: googleClientId }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
