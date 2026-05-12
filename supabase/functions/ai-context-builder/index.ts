import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://localhost:8080',
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { operation, data } = await req.json()
    const userId = user.id // use this, ignore userId from body

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
      case 'idea-suggestions':
        operationPrompt = `Você é um estrategista de conteúdo especialista em redes sociais brasileiras. Gere EXATAMENTE 3 posts prontos para executar.

FRAMEWORK DE PILARES DE CONTEÚDO:
Cada sugestão deve cobrir um pilar diferente:
1. EDUCACIONAL (40% do mix) — How-tos, dicas, frameworks, erros comuns
2. BASTIDORES (20%) — Processo, rotina, dia-a-dia, vulnerabilidade
3. ENGAJAMENTO (15%) — Perguntas, debates, polêmicas leves, "qual você prefere?"
4. PROVA SOCIAL (15%) — Resultados, transformações, antes/depois, depoimentos
5. PROMOCIONAL (10%) — Produtos, serviços, ofertas, CTAs diretos

FÓRMULAS DE HOOK POR PLATAFORMA:
Instagram/Reels: "Save isso pra depois", "Testei [X] por [tempo]. Resultado:", "POV: você acabou de descobrir [benefício]", "O que [público] erra sobre [tema]:", "Meu processo exato pra [resultado]:"
TikTok: "Espera, você ainda faz [jeito antigo]?", "O hack de [tema] que ninguém te mostrou", "Se você é [público], assiste isso", "Story time: [setup intrigante]"
YouTube: "Tutorial completo:", "[número] erros que estão travando seu [tema]", "Testei por [tempo] — vale a pena?"

REGRAS:
- Títulos são HOOKS — a primeira coisa que a pessoa lê/ouve. Máximo 70 caracteres.
- Cada sugestão com ângulo editorial DIFERENTE: tutorial, bastidor, opinião, storytelling, lista, antes/depois, mito vs verdade, trend adaptada
- Formatos: varie entre reels, carrossel, foto, video, story, shorts
- Objetivos: engajamento, autoridade, venda, relacionamento — varie entre as 3
- Linguagem de rede social BR: informal, direta, como amigo falando
- NUNCA use títulos genéricos como "Reflexão sobre X" ou "Dicas de X"

FORMATO JSON (APENAS o array, sem texto):
[{"titulo":"max 70 chars","formato":"reels|carrossel|foto|video|story","angulo":"descritivo e específico","objetivo":"engajamento|autoridade|venda|relacionamento"}]

EXEMPLO para "rotina matinal":
[{"titulo":"Minha rotina antes de abrir o Instagram mudou tudo","formato":"reels","angulo":"bastidor com storytelling pessoal","objetivo":"relacionamento"},{"titulo":"5 coisas que faço antes das 8h que triplicaram meu engajamento","formato":"carrossel","angulo":"lista prática com resultados","objetivo":"autoridade"},{"titulo":"Sua rotina matinal tá sabotando seu conteúdo. Veja porquê.","formato":"story","angulo":"opinião provocativa com dica","objetivo":"engajamento"}]`
        userPrompt = `IDEIA: "${data.ideiaTexto || 'conteúdo geral'}"
PLATAFORMA: ${data.platform || 'instagram'}
PILAR: ${data.pilar || 'geral'}
NICHO: ${data.niche || 'lifestyle'}
Gere 3 posts. Títulos são hooks virais, não títulos de blog.`
        maxTokens = 600
        break
      case 'generate-caption':

        operationPrompt = `Você é um copywriter expert em redes sociais brasileiras. Gere UMA legenda pronta para publicar.

REGRAS:

- Tom: ${data.tom || 'descontraido'}

- Tamanho: ${data.tamanho === 'curto' ? '1-2 linhas' : data.tamanho === 'longo' ? '5-8 linhas com storytelling' : '3-5 linhas'}

- Formato: ${data.formato || 'post'} para ${data.plataforma || 'instagram'}

- Use emojis com moderação (2-3 por legenda, MAX)

- Inclua um CTA no final (pergunta, chamada pra ação, ou convite)

- Se o formato for carrossel, a legenda deve complementar os slides (não repetir)

- Se for reels, a legenda deve ser curta e direta (gancho → valor → CTA)

- NÃO inclua hashtags (o sistema adiciona separadamente)

- Linguagem natural brasileira, como se fosse uma pessoa real falando

- NUNCA comece com "Olá" ou "Ei" ou "Você sabia que" — comece com impacto

RESPONDA APENAS COM A LEGENDA, sem título, sem explicação, sem aspas.`

        userPrompt = `Título do post: "${data.titulo || ''}"

Conteúdo/roteiro do post: ${data.conteudo || data.roteiro || 'não informado'}

Pilar de conteúdo: ${data.pilar || 'geral'}

Nicho: ${data.nicho || 'lifestyle'}`

        maxTokens = 400

        break
      case 'suggest-hashtags':
        operationPrompt = `Você é um especialista em hashtags para redes sociais brasileiras. Gere uma lista de hashtags relevantes para o post.

REGRAS:

Gere EXATAMENTE 20 hashtags

Ordene por relevância: as 7 primeiras devem ser as mais relevantes e populares, as 7 seguintes de média popularidade, as 6 últimas devem ser de nicho específico (menos concorrência, mais chances de aparecer no Explore)

Apenas hashtags em português do Brasil (exceto termos universais como #reels, #tiktok, etc)

SEM # na frente — apenas a palavra

Considere a plataforma: Instagram usa hashtags no caption ou primeiro comentário, TikTok usa hashtags curtas e trends

Considere o formato: reels/video usam hashtags diferentes de foto/carrossel

Misture hashtags de volume alto (500K+ posts) com médio (50K-500K) e nicho (<50K)

RESPONDA APENAS com um array JSON de strings. Sem texto antes ou depois. Exemplo: ["marketingdigital","dicasdeconteudo","criadoresdeconteudo","instagrambrasil","socialmedia","reelsbrasil","dicasinstagram","empreendedorismodigital","marketingdeconteudo","produçãodeconteudo","criadorbrasileiro","vidadecriador","conteudodigital","estrategiadeconteudo","nichodigital","microinfluencer","crescimentoorganico","algoritmoinstagram","planejamentodeconteudo","criatividade"]`
        userPrompt = `Título do post: "${data.titulo || ''}"

Formato: ${data.formato || 'post'}

Plataforma: ${data.plataforma || 'instagram'}

Pilar de conteúdo: ${data.pilar || 'geral'}

Nicho do criador: ${data.nicho || 'lifestyle'}

Legenda: ${(data.legenda || '').slice(0, 200)}`
        maxTokens = 400
        break
      case 'onboarding-setup':
        operationPrompt = `Você é um estrategista de conteúdo brasileiro. Configure o espaço criativo de um novo criador.

Baseado no nicho e plataformas do criador, retorne um JSON com:

1. pilares: 3 pilares de conteúdo (name + color hex)

2. habitos: 3 hábitos diários de criação (strings curtas)

3. ideias: 5 ideias de posts (title + format + platform)

REGRAS:

- Pilares devem ser específicos pro nicho (não genéricos como "Educação")

- Hábitos devem ser ações concretas e rápidas (ex: "Filmar 1 story", não "Criar conteúdo")

- Ideias devem ter títulos estilo hook viral (como se fossem o gancho do post)

- Formatos: reels, carrossel, foto, story, video, shorts

- Cores dos pilares: use cores vibrantes distintas (#FF6B6B, #4DABF7, #FFBE0B, #20B2AA, #FF69B4, #7C5CFC)

RESPONDA APENAS com JSON válido:

{"pilares":[{"name":"string","color":"#hex"}],"habitos":["string"],"ideias":[{"title":"string","format":"string","platform":"string"}]}`

        userPrompt = `Nicho: ${data.nicho || 'lifestyle'}

Plataformas: ${(data.plataformas || ['instagram']).join(', ')}`

        maxTokens = 600

        break
      case 'cria-chat':
        operationPrompt = `Você é a Cria, assistente criativa do CreatorsFlow. Você ajuda criadores de conteúdo brasileiros.

PERSONALIDADE:

- Fale como uma amiga próxima que entende de social media

- Use linguagem informal mas não forçada

- Seja prática e direta — dê respostas acionáveis

- Use emojis com moderação (1-2 por resposta)

- Se o criador pedir algo específico (ideia, legenda, hashtag), entregue pronto pra usar

- Se pedir análise, seja honesta mas encorajadora

- Máximo 200 palavras por resposta

- Responda sempre em português do Brasil

- NUNCA se apresente de novo se já se apresentou

- Responda EXATAMENTE o que o criador pediu, não mude de assunto

CONTEXTO DO CRIADOR:

Nome: ${data.creatorName || 'Criador'}

Nicho: ${data.creatorNiche || 'geral'}

Posts publicados: ${data.postCount || 0}

Meta semanal: ${data.weeklyGoal || 3} posts`

        userPrompt = data.message || 'Olá!'

        maxTokens = 500

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
