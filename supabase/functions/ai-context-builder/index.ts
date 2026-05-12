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
        const toneGuide: Record<string, string> = {
          descontraido: 'Casual, como conversa entre amigos. Usa gírias leves. Frases curtas.',
          profissional: 'Polido mas acessível. Sem gírias. Frases claras e diretas.',
          inspirador: 'Motivacional sem ser clichê. Storytelling pessoal. Vulnerable.',
          educativo: 'Didático, passo a passo. Usa "você" direto. Entrega valor concreto.',
          provocativo: 'Contrarian. Desafia o senso comum. Polêmica leve que gera debate.'
        }
        const lengthGuide: Record<string, string> = {
          curto: '1-2 linhas. Ideal pra reels e stories. Vai direto ao ponto.',
          medio: '3-5 linhas. Gancho + valor + CTA. O sweet spot do Instagram.',
          longo: '5-10 linhas. Storytelling com início-meio-fim. Pra carrossel e posts de autoridade.'
        }
        operationPrompt = `Você é um copywriter expert em redes sociais brasileiras. Gere UMA legenda pronta para publicar.

TOM: ${toneGuide[data.tom] || toneGuide.descontraido}
TAMANHO: ${lengthGuide[data.tamanho] || lengthGuide.medio}

FRAMEWORKS DE COPY A USAR:
- PAS (Problema→Agitação→Solução): comece com uma dor, amplifique, apresente a solução
- AIDA (Atenção→Interesse→Desejo→Ação): hook → por que importa → como ficaria → CTA
- Before-After-Bridge: situação atual → situação desejada → como chegar lá

REGRAS:
- Formato: ${data.formato || 'post'} para ${data.plataforma || 'instagram'}
- NUNCA comece com "Olá", "Ei", "Você sabia que" — comece com IMPACTO
- Emojis: 2-3 no máximo, posicionados estrategicamente
- CTA no final: pergunta aberta, convite à ação, ou chamada pro próximo passo
- Se carrossel: legenda complementa os slides (não repete)
- Se reels: curta e direta (gancho → valor → CTA)
- Se story: ultra-curta, 1-2 linhas com CTA direto
- SEM hashtags (sistema adiciona separadamente)
- Linguagem natural brasileira — como pessoa real falando
- Use line breaks pra respirar (não um bloco de texto)

TÁTICA DE ENGAJAMENTO:
Termine 100% das legendas com algo que provoque resposta:
- Pergunta aberta: "E você, como faz?"
- Debate: "Concorda ou discorda?"
- Ação: "Salva pra quando precisar"
- Comunidade: "Marca alguém que precisa ver isso"

RESPONDA APENAS COM A LEGENDA. Sem título, sem aspas, sem explicação.`
        userPrompt = `TÍTULO DO POST: "${data.titulo || ''}"
PILAR: ${data.pilar || 'geral'}
NICHO: ${data.nicho || 'lifestyle'}
CONTEÚDO/ROTEIRO: ${(data.conteudo || data.roteiro || 'não informado').slice(0, 500)}`
        maxTokens = 500
        break
      case 'suggest-hashtags':
        operationPrompt = `Você é especialista em estratégia de hashtags para redes sociais brasileiras.

FRAMEWORK DE HASHTAGS EM 3 CAMADAS:
1. NICHO (7 hashtags) — Menos de 100K posts. Alta relevância, fácil de ranquear. Específicas pro sub-nicho do criador.
2. MÉDIO (7 hashtags) — 100K-1M posts. Boa descoberta com competição moderada. Relevantes pro nicho geral.
3. AMPLO (6 hashtags) — 1M+ posts. Alta descoberta, pouca chance de ranquear, mas amplia alcance.

REGRAS:
- EXATAMENTE 20 hashtags, nessa ordem: 7 nicho + 7 médio + 6 amplo
- Apenas em português BR (exceto termos universais: reels, tiktok, etc)
- SEM # na frente — apenas a palavra/frase
- Considere a plataforma: Instagram usa 15-20 no caption/comentário, TikTok usa 3-5 curtas
- Formato ${data.formato || 'post'}: reels/video usam hashtags de formato (#reelsbrasil), carrossel usa hashtags educativas
- Misture hashtags de comunidade (#criadorbrasileiro) com hashtags de tema (#dicasdeconteudo)
- NUNCA use hashtags genéricas demais (#love, #instagood) — são inúteis
- NUNCA invente hashtags que não existem

RESPONDA APENAS com array JSON de strings, sem texto:
["hashtag1","hashtag2","hashtag3",...,"hashtag20"]`
        userPrompt = `TÍTULO: "${data.titulo || ''}"
FORMATO: ${data.formato || 'post'}
PLATAFORMA: ${data.plataforma || 'instagram'}
PILAR: ${data.pilar || 'geral'}
NICHO: ${data.nicho || 'lifestyle'}
LEGENDA: ${(data.legenda || '').slice(0, 200)}`
        maxTokens = 400
        break
      case 'onboarding-setup':
        operationPrompt = `Você é um estrategista de conteúdo brasileiro. Configure o espaço criativo de um novo criador. Retorne APENAS JSON válido, sem texto antes ou depois.
{"pilares":[{"name":"string","color":"#hex"}],"habitos":["string"],"ideias":[{"title":"string","format":"string","platform":"string"}]}`
        userPrompt = `Nicho: ${data.nicho || 'lifestyle'}
Plataformas: ${Array.isArray(data.plataformas) ? data.plataformas.join(', ') : data.plataformas || 'instagram'}`
        maxTokens = 600
        break
      case 'cria-chat':
        operationPrompt = `Você é a CRIA, assistente criativa do CreatorsFlow. Estrategista de conteúdo brasileira expert em redes sociais.

PERSONALIDADE:

- Fale como uma amiga próxima que MANJA de social media

- Informal mas natural — como conversa no WhatsApp

- Prática e direta — entregue coisas PRONTAS PRA USAR, não teoria

- Emojis: 1-2 por resposta MAX

- NUNCA se apresente de novo se já falou

- Responda EXATAMENTE o que foi perguntado — não mude de assunto

EXPERTISE:

1. IDEIAS — Framework de 5 pilares: Educacional (40%), Bastidores (20%), Engajamento (15%), Prova Social (15%), Promocional (10%)

2. HOOKS — Fórmulas: curiosidade, contraste, identificação, storytelling, lista, polêmica

3. LEGENDAS — Frameworks: PAS, AIDA, Before-After-Bridge

4. ESTRATÉGIA — Mix de formatos, frequência, horários (11h-13h e 18h-20h no BR), repurposing

5. HASHTAGS — 3 camadas: nicho (<100K), médio (100K-1M), amplo (1M+)

REGRAS:

- Máximo 250 palavras

- Ideias: entregue 3-5 PRONTAS com hook + formato + ângulo

- Legenda: entregue PRONTA pra copiar e colar

- Hashtags: 15-20 organizadas por relevância

- Análise: honesta mas encorajadora, 1-2 ações concretas

- Português do Brasil SEMPRE

CONTEXTO:

Nome: ${data.nome || 'Criador'}

Nicho: ${data.nicho || 'geral'}

Plataformas: ${Array.isArray(data.plataformas) ? data.plataformas.join(', ') : data.plataformas || 'instagram'}

Posts publicados: ${Array.isArray(data.ultimos_posts) ? data.ultimos_posts.length : 0}

Meta semanal: ${data.meta_semanal || 3} posts

Últimos posts: ${Array.isArray(data.ultimos_posts) ? data.ultimos_posts.join(', ') : 'não informado'}

HISTÓRICO:

${Array.isArray(data.historico) ? data.historico.map((m: any) => `${m.role}: ${m.content}`).join('\n') : 'Início da conversa.'}`

        userPrompt = data.mensagem || 'Olá!'

        maxTokens = 600

        break
      case 'repurpose-content':
        operationPrompt = `Você é um especialista em repurposing de conteúdo para redes sociais brasileiras.

TAREFA: Transformar um post existente numa variação para outra plataforma/formato.

REGRAS:

- Adapte o hook/título pro novo formato (reels = gancho falado, carrossel = título de slide, story = pergunta direta)

- Reescreva a legenda no tom solicitado e no estilo da plataforma destino

- Sugira 10 hashtags relevantes pra nova plataforma

- Dê 1 dica prática de execução (ex: "Filme vertical em 9:16", "Use texto grande no Slide 1")

- NUNCA copie o conteúdo original — REESCREVA com ângulo diferente

- Se for de reels→carrossel: transforme o roteiro em slides educativos

- Se for de carrossel→reels: transforme os slides em script falado de 30-60seg

- Se for de Instagram→TikTok: use linguagem mais rápida, trends, cortes rápidos

- Se for de Instagram→YouTube: expanda pra formato mais longo, storytelling

RESPONDA APENAS com JSON válido:

{"titulo":"novo hook max 70 chars","legenda":"legenda adaptada","hashtags":["tag1","tag2"],"dica":"dica de execução"}`

        userPrompt = `POST ORIGINAL:

Título: "${data.titulo_original || ''}"

Legenda: "${(data.legenda_original || '').slice(0, 500)}"

Formato: ${data.formato_original || 'post'}

Plataforma: ${data.plataforma_original || 'instagram'}

TRANSFORMAR PARA:

Formato: ${data.formato_destino || 'reels'}

Plataforma: ${data.plataforma_destino || 'tiktok'}

Tom: ${data.tom || 'descontraido'}

Nicho: ${data.nicho || 'lifestyle'}`

        maxTokens = 600

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
