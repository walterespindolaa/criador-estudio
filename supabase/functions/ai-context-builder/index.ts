import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const getNichePresets = (niche: string): string => {
  const presets: Record<string, string> = {
    'Lifestyle': `- Conteúdos que performam bem: rotina matinal, antes/depois, bastidores, comparações
- Hooks mais eficazes: identificação ("Se você também..."), curiosidade ("O que mudou na minha rotina...")
- Frequência ideal: 5-7x/semana entre todas as plataformas
- Pilares sugeridos: Rotina, Bem-estar, Viagens, Bastidores, Dicas`,
    'Fitness': `- Conteúdos que performam bem: demonstrações de exercícios, transformações, mitos x verdades, receitas fit
- Hooks mais eficazes: desafio ("Tenta fazer isso..."), promessa ("Em X semanas...")
- Frequência ideal: 5x/semana
- Pilares sugeridos: Treinos, Alimentação, Motivação, Resultados, Educação`,
    'Moda': `- Conteúdos que performam bem: looks do dia, combinações, tendências, dupes
- Hooks mais eficazes: contraste ("Gastei R$50 nesse look..."), curiosidade ("Tendência que vai bombar...")
- Frequência ideal: 4-6x/semana
- Pilares sugeridos: Looks, Tendências, Dicas de estilo, Compras, Inspiração`,
    'Beleza': `- Conteúdos que performam bem: tutoriais, reviews, antes/depois, rotinas de skincare
- Hooks mais eficazes: revelação ("O produto que mudou minha pele..."), problema ("Se você tem pele oleosa...")
- Frequência ideal: 4-5x/semana
- Pilares sugeridos: Skincare, Maquiagem, Cabelo, Reviews, Tutoriais`,
    'Culinária': `- Conteúdos que performam bem: receitas rápidas, versões fit, erros comuns, hacks de cozinha
- Hooks mais eficazes: promessa ("Receita em 10 minutos..."), curiosidade ("Ingrediente secreto...")
- Frequência ideal: 4x/semana
- Pilares sugeridos: Receitas, Dicas, Reviews, Fit, Doces`,
    'Educação': `- Conteúdos que performam bem: listas práticas, erros comuns, ferramentas, passo a passo
- Hooks mais eficazes: dor ("O erro que impede você de..."), autoridade ("Depois de X anos...")
- Frequência ideal: 3-4x/semana
- Pilares sugeridos: Dicas, Tutoriais, Ferramentas, Carreira, Produtividade`,
    'Negócios': `- Conteúdos que performam bem: bastidores, resultados, estratégias, erros e aprendizados
- Hooks mais eficazes: resultado ("Como eu faturei X..."), autoridade, polêmica
- Frequência ideal: 3-5x/semana
- Pilares sugeridos: Estratégia, Bastidores, Finanças, Marketing, Mindset`,
  };
  return presets[niche] || `- Adapte as sugestões ao contexto específico do nicho ${niche}`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, operation, data } = await req.json()

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase credentials")
    }
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured")
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Fetch user context
    let userContext = ''
    if (userId) {
      const [profileRes, pillarsRes, brandRes, personaRes, moodboardRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('pillars').select('*').eq('user_id', userId).order('position'),
        supabase.from('brand_items').select('*').eq('user_id', userId).order('position'),
        supabase.from('personas').select('*').eq('user_id', userId).limit(1),
        supabase.from('moodboard_entries').select('section, question_key, answer').eq('user_id', userId),
      ])

      const profile = profileRes.data
      const pillars = pillarsRes.data || []
      const brandItems = brandRes.data || []
      const persona = personaRes.data?.[0]
      const moodboardEntries = moodboardRes.data || []

      if (profile) {
        const nicho = profile.niche || 'creator de conteúdo'
        const plataformas = (profile.platforms || []).join(', ')
        const pilaresNomes = pillars.map((p: any) => p.name).join(', ')
        const tom = brandItems.find((b: any) => b.type === 'tom')?.name || 'autêntico e próximo'
        const arquetipo = brandItems.find((b: any) => b.type === 'arquetipo')?.name
        const expressoes = brandItems.filter((b: any) => b.type === 'expressao').map((b: any) => b.name).join(', ')
        const evitar = brandItems.filter((b: any) => b.type === 'evitar').map((b: any) => b.name).join(', ')
        const dores = persona?.pain_points?.join(', ')
        const interesses = persona?.interests?.join(', ')

        userContext = `
Você está auxiliando ${profile.name}, um(a) creator de conteúdo no nicho de ${nicho}.

PERFIL DO CREATOR:
- Nome: ${profile.name}
- Nicho: ${nicho}
- Plataformas: ${plataformas}
- Pilares de conteúdo: ${pilaresNomes}
- Meta semanal: ${profile.weekly_goal || 3} posts por semana

IDENTIDADE DA MARCA:
- Tom de voz: ${tom}
${arquetipo ? `- Arquétipo: ${arquetipo}` : ''}
${expressoes ? `- Expressões que usa: ${expressoes}` : ''}
${evitar ? `- Evitar: ${evitar}` : ''}

${persona ? `PÚBLICO-ALVO (PERSONA):
- Perfil: ${persona.name || 'público principal'}
${persona.age_range ? `- Faixa etária: ${persona.age_range}` : ''}
${dores ? `- Principais dores: ${dores}` : ''}
${interesses ? `- Interesses: ${interesses}` : ''}` : ''}

BRANDBOOK (respostas do criador):
${moodboardEntries.length > 0 ? moodboardEntries.filter((e: any) => e.answer && e.answer.trim()).map((e: any) => `- [${e.section}/${e.question_key}]: ${e.answer}`).join('\n') : '(não preenchido)'}

PRESETS POR NICHO:
${getNichePresets(nicho)}

REGRAS DE COMPORTAMENTO:
- Sempre responda em português brasileiro informal
- Use o nome ${profile.name} quando for pessoal ou encorajador
- Adapte sugestões ao nicho e ao tom de voz definido
- Considere o público-alvo em todas as sugestões
- Use o contexto do Brandbook para personalizar ao máximo
- Nunca escreva o conteúdo pela pessoa — sugira, direcione, inspire
- Seja encorajador mas direto
`
      }
    }

    // Build operation-specific prompt
    let operationPrompt = ''
    let userPrompt = ''
    let maxTokens = 80

    switch (operation) {
      case 'tag-suggestion':
        operationPrompt = "Dado o título de uma ideia e os pilares disponíveis, retorne APENAS o nome do pilar mais adequado. Nenhuma palavra a mais."
        userPrompt = `Título: ${data.ideaTitle}\nPilares disponíveis: ${(data.pillars || []).map((p: any) => p.name || p).join(', ')}`
        maxTokens = 30
        break
      case 'reference-filter':
        operationPrompt = "Retorne JSON com hook_categories (array, max 2) e format_type (string) mais relevantes para este post."
        userPrompt = `Plataforma: ${data.platform}, Formato: ${data.format}, Pilar: ${data.pillar}, Título: ${data.title}`
        maxTokens = 80
        break
      case 'archive-summary':
        operationPrompt = "Gere uma frase-resumo de exatamente 6-8 palavras em português para identificar este post no histórico. Apenas a frase."
        userPrompt = `Título: ${data.title}, Plataforma: ${data.platform}, Formato: ${data.format}, Pilar: ${data.pillar}`
        maxTokens = 30
        break
      case 'daily-insight':
        operationPrompt = "Gere UMA frase de insight personalizado (máximo 25 palavras) sobre a consistência ou padrão de publicação desta pessoa. Tom encorajador e direto."
        userPrompt = `Posts esta semana: ${data.postsThisWeek}, Meta semanal: ${data.weeklyGoal}, Pilar mais postado: ${data.topPillar}, Último post publicado: ${data.lastPublished || 'nunca'}`
        maxTokens = 60
        break
      default:
        throw new Error('Invalid operation')
    }

    const systemPrompt = `${userContext}\n\nTAREFA ESPECÍFICA:\n${operationPrompt}`

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: operation === 'daily-insight' ? 0.7 : 0.2,
      }),
    })

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const errorText = await response.text()
      console.error('AI gateway error:', response.status, errorText)
      throw new Error('AI gateway error')
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content || ''

    if (operation === 'reference-filter') {
      try {
        const jsonMatch = content.match(/\{.*\}/s)
        const jsonStr = jsonMatch ? jsonMatch[0] : content
        return new Response(JSON.stringify({ result: JSON.parse(jsonStr) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch {
        console.error('Failed to parse JSON response', content)
        throw new Error('Invalid JSON from AI')
      }
    }

    return new Response(JSON.stringify({ result: content.trim() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('ai-context-builder error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
