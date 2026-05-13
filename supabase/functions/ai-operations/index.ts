import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase credentials")
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { operation, data, userContext } = await req.json()
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set')
    }

    let systemPrompt = ''
    let userPrompt = ''
    let maxTokens = 80
    let temperature = 0.2

    switch (operation) {
      case 'tag-suggestion':
        systemPrompt = "Você organiza conteúdo de creators. Dado o título de uma ideia e os pilares disponíveis, retorne APENAS o nome do pilar mais adequado. Nenhuma palavra a mais."
        userPrompt = `Título: ${data.ideaTitle}\nPilares disponíveis: ${data.pillars.join(', ')}`
        maxTokens = 30
        break
      case 'reference-filter':
        systemPrompt = "Retorne JSON com hook_categories (array, max 2) e format_type (string) mais relevantes para este post."
        userPrompt = `Plataforma: ${data.platform}, Formato: ${data.format}, Pilar: ${data.pillar}, Título: ${data.title}`
        maxTokens = 80
        break
      case 'archive-summary':
        systemPrompt = "Gere uma frase-resumo de exatamente 6-8 palavras em português para identificar este post no histórico. Apenas a frase."
        userPrompt = `Título: ${data.title}, Plataforma: ${data.platform}, Formato: ${data.format}, Pilar: ${data.pillar}`
        maxTokens = 30
        temperature = 0.3
        break
      case 'daily-insight':
        systemPrompt = "Você é assistente de um creator brasileiro. Gere UMA frase de insight personalizado (máximo 25 palavras) sobre a consistência ou padrão de publicação desta pessoa. Tom encorajador e direto."
        userPrompt = `Posts esta semana: ${data.postsThisWeek}, Meta semanal: ${data.weeklyGoal}, Pilar mais postado: ${data.topPillar}, Último post publicado: ${data.lastPublished}`
        maxTokens = 60
        temperature = 0.7
        break
      default:
        throw new Error('Invalid operation')
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: maxTokens,
        temperature: temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const result = await response.json()
    const content = result.content[0].text

    if (operation === 'reference-filter') {
      try {
        const jsonMatch = content.match(/\{.*\}/s)
        const jsonStr = jsonMatch ? jsonMatch[0] : content
        return new Response(jsonStr, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (e) {
        console.error('Failed to parse JSON response', content)
        throw new Error('Invalid JSON from AI')
      }
    }

    return new Response(JSON.stringify(content), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
