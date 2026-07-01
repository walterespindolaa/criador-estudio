import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

// Helpers embutidos (sem depender de _shared no bundle do deploy).
const ALLOWED_ORIGINS = [
  "https://app.criasocialclub.com.br", "https://criasocialclub.com.br",
  "https://criador-estudio.lovable.app", "http://localhost:5173", "http://localhost:8080",
]
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? ""
  const isLovable = /^https:\/\/[a-zA-Z0-9-]+\.lovable\.app$/.test(origin)
  const allow = ALLOWED_ORIGINS.includes(origin) || isLovable ? origin : ALLOWED_ORIGINS[0]
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  }
}
class AiTimeoutError extends Error { constructor() { super("ai_timeout"); this.name = "AiTimeoutError" } }
async function aiFetch(url: string, init: RequestInit, timeoutMs = 30000): Promise<Response> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try { return await fetch(url, { ...init, signal: ac.signal }) }
  catch (e) { if (e instanceof DOMException && e.name === "AbortError") throw new AiTimeoutError(); throw e }
  finally { clearTimeout(t) }
}
// deno-lint-ignore no-explicit-any
async function checkRateLimit(admin: any, userId: string, scope: string, limit: number): Promise<boolean> {
  try {
    const windowKey = new Date().toISOString().slice(0, 16)
    const { data, error } = await admin.rpc("check_and_increment_rate_limit", { _user_id: userId, _scope: scope, _window_key: windowKey, _limit: limit })
    if (error) { console.error("[rate-limit] rpc error, fail-closed:", error.message); return false } // fail-closed
    if (data == null) return false
    const row = Array.isArray(data) ? data[0] : data
    return row?.allowed === true
  } catch (e) { console.error("[rate-limit] exception, fail-closed:", e); return false }
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

// Refresh do banco de tendências: pesquisa web (Perplexity) + formata (Gemini) + grava.
// deno-lint-ignore no-explicit-any
async function runTrendRefresh(admin: any, lovableApiKey: string, corsHeaders: Record<string, string>, createdBy: string | null): Promise<Response> {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  // 1) Pesquisa ao vivo na web (Perplexity Sonar). Se falhar/faltar chave, degrada.
  let webResearch = ''
  const pplxKey = Deno.env.get('PERPLEXITY_API_KEY')
  if (pplxKey) {
    try {
      const pr = await aiFetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${pplxKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            { role: 'system', content: 'Você é analista de tendências de redes sociais no Brasil. Responda em português, objetivo e concreto, com base no que está em alta AGORA na web.' },
            { role: 'user', content: `Hoje é ${hoje}. Pesquise e liste o que está EM ALTA AGORA para criadores de conteúdo no Brasil (Instagram, TikTok, Reels): (1) formatos de vídeo/post em alta, (2) temas/assuntos quentes do momento, (3) ganchos/aberturas que estão retendo, (4) datas comemorativas e sazonais nas próximas 4-6 semanas. Seja específico e atual, evite genérico.` },
          ],
          max_tokens: 900,
          temperature: 0.2,
        }),
      })
      if (pr.ok) {
        const pj = await pr.json()
        webResearch = String(pj.choices?.[0]?.message?.content || '').slice(0, 4000)
      } else {
        console.error('perplexity error', pr.status, await pr.text())
      }
    } catch (e) { console.error('perplexity fetch failed', e) }
  }

  // 2) Formata a pesquisa nos cards (Gemini).
  const trendSys = `Você é um analista de tendências de conteúdo para criadores e social medias no Brasil. Hoje é ${hoje}. Gere um banco de tendências ATUAL e prático para Instagram, TikTok e Reels. Responda SOMENTE em JSON válido, sem markdown.`
  const trendUsr = `${webResearch ? `PESQUISA DA WEB (use como base, é atual):\n${webResearch}\n\n` : ''}Gere de 10 a 14 tendências variadas e acionáveis no formato:
{"trends":[{"kind":"formato|tema|gancho|data","title":"curto (max 8 palavras)","description":"1 frase prática de como usar","niche":"geral"}]}
OBRIGATÓRIO variar os tipos — inclua PELO MENOS 2 de cada: "formato" (formatos de vídeo/post em alta), "tema" (assuntos quentes), "gancho" (aberturas que retêm), "data" (datas comemorativas/sazonais próximas no Brasil). Seja específico e brasileiro. Nada genérico.`

  const tr = await aiFetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [ { role: 'system', content: trendSys }, { role: 'user', content: trendUsr } ],
      max_tokens: 4096,
      temperature: 0.7,
    }),
  })
  if (!tr.ok) { console.error('trend refresh gateway error', tr.status, await tr.text()); throw new Error('AI gateway error') }
  const tj = await tr.json()
  const tcleaned = String(tj.choices?.[0]?.message?.content || '').replace(/```json/gi, '').replace(/```/g, '').trim()
  const tmatch = tcleaned.match(/\{[\s\S]*\}/)
  let parsed: { trends?: Array<Record<string, unknown>> } = {}
  try { parsed = JSON.parse(tmatch ? tmatch[0] : tcleaned) } catch { throw new Error('Invalid JSON from AI') }
  const allowed = new Set(['formato', 'tema', 'gancho', 'data'])
  const rows = (parsed.trends || [])
    .filter((t) => t && typeof t.title === 'string')
    .slice(0, 16)
    .map((t) => ({
      kind: allowed.has(String(t.kind)) ? String(t.kind) : 'tema',
      title: String(t.title).slice(0, 120),
      description: t.description ? String(t.description).slice(0, 300) : null,
      niche: t.niche ? String(t.niche).slice(0, 60) : 'geral',
      created_by: createdBy,
    }))
  if (rows.length === 0) throw new Error('Nenhuma tendência gerada')

  await admin.from('content_trends').delete().not('id', 'is', null)
  const { error: insErr } = await admin.from('content_trends').insert(rows)
  if (insErr) { console.error('trend insert error', insErr); throw new Error('Falha ao salvar tendências') }

  return new Response(JSON.stringify({ result: { count: rows.length } }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Cron interno (sem JWT): x-internal-secret válido só pode disparar o refresh de tendências.
    const internalSecret = req.headers.get('x-internal-secret')
    if (internalSecret && internalSecret === Deno.env.get('INTERNAL_PUSH_SECRET')) {
      const cronBody = await req.json().catch(() => ({}))
      if (cronBody?.operation !== 'trend-bank-refresh') {
        return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); const lk = Deno.env.get('LOVABLE_API_KEY')
      if (!url || !key || !lk) throw new Error('Missing credentials')
      return await runTrendRefresh(createClient(url, key), lk, corsHeaders, null)
    }

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

    // Limite de rajada por usuário (além da cota mensal): 25 chamadas/min.
    const rlOk = await checkRateLimit(supabase, user.id, 'ai-context-builder', 25)
    if (!rlOk) {
      return new Response(JSON.stringify({ error: 'rate_limited', message: 'Muitas requisições. Aguarde um pouco.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Access gate: trial ativo, subscription ativa, ou admin ─────
    const { data: accessRow, error: accessErr } = await supabase
      .from("profiles")
      .select("role, subscription_status, trial_ends_at")
      .eq("id", user.id)
      .single();

    if (accessErr || !accessRow) {
      return new Response(
        JSON.stringify({ error: "profile_not_found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const _isAdmin = accessRow.role === "admin";
    const _isActive = accessRow.subscription_status === "active";
    const _trialEnds = accessRow.trial_ends_at ? new Date(accessRow.trial_ends_at).getTime() : 0;
    const _trialOk = _trialEnds > Date.now();

    if (!_isAdmin && !_isActive && !_trialOk) {
      return new Response(
        JSON.stringify({ error: "subscription_required", message: "Seu período de teste encerrou. Assine para continuar usando a IA." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // ── fim access gate ───────────────────────────────────────────

    const { operation, data } = await req.json()
    const userId = user.id // use this, ignore userId from body

    // ── Operações admin (não consome cota) ──
    if (operation === 'admin-system-insight') {
      if (!_isAdmin) {
        return new Response(JSON.stringify({ error: 'forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const sys = `Você é um consultor estratégico sênior analisando métricas do CreatorsFlow. Responda APENAS JSON válido, sem markdown.`
      const usr = `Dados administrativos: ${JSON.stringify(data || {})}
Gere um insight estratégico conciso em português BR no formato:
{"titulo":"string","insight":"string","acoes":["a1","a2","a3"]}`
      const r = await aiFetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
          max_tokens: 2000,
          temperature: 0.3,
        }),
      })
      if (!r.ok) throw new Error('AI gateway error')
      const j = await r.json()
      const c = String(j.choices?.[0]?.message?.content || '')
      const cleaned = c.replace(/```json/gi, '').replace(/```/g, '').trim()
      const m = cleaned.match(/\{[\s\S]*\}/)
      try {
        return new Response(JSON.stringify({ result: JSON.parse(m ? m[0] : cleaned) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch {
        return new Response(JSON.stringify({ result: { titulo: 'Insight', insight: cleaned.slice(0, 600), acoes: [] } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
    if (operation === 'trend-bank-refresh') {
      if (!_isAdmin) {
        return new Response(JSON.stringify({ error: 'forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return await runTrendRefresh(supabase, lovableApiKey, corsHeaders, userId)
    }
    // ── fim trend bank refresh ───────────────────────────────────────

    const truncate = (s: unknown, max: number) =>
      typeof s === 'string' ? s.slice(0, max) : s
    if (data) {
      data.titulo = truncate(data.titulo, 500)
      data.brandContext = truncate(data.brandContext, 3000)
      data.roteiro = truncate(data.roteiro, 5000)
      data.legenda_original = truncate(data.legenda_original, 3000)
    }

    // ── Cota mensal de IA por tier (pro 150 / studio 500) ──────
    const { data: quotaData, error: quotaErr } = await supabase.rpc("bump_ai_quota", {
      _user: userId,
    });

    if (quotaErr) {
      const msg = quotaErr.message ?? "";
      if (msg.includes("quota_exceeded")) {
        return new Response(
          JSON.stringify({
            error: "quota_exceeded",
            message: "Você atingiu o limite de gerações de IA deste mês. Faça upgrade para continuar.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (msg.includes("no_access")) {
        return new Response(
          JSON.stringify({
            error: "no_access",
            message: "Seu acesso não permite usar a IA. Assine um plano para continuar.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // erro inesperado: fail-CLOSED (não libera IA paga em falha da cota).
      console.error("[ai-context-builder] bump_ai_quota unexpected error, fail-closed:", msg);
      return new Response(
        JSON.stringify({ error: "quota_unavailable", message: "Não foi possível validar sua cota agora. Tente de novo em instantes." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // ── fim cota ───────────────────────────────────────────────

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
[{"titulo":"Minha rotina antes de abrir o Instagram mudou tudo","formato":"reels","angulo":"bastidor com storytelling pessoal","objetivo":"relacionamento"},{"titulo":"5 coisas que faço antes das 8h que triplicaram meu engajamento","formato":"carrossel","angulo":"lista prática com resultados","objetivo":"autoridade"},{"titulo":"Sua rotina matinal tá sabotando seu conteúdo. Veja porquê.","formato":"story","angulo":"opinião provocativa com dica","objetivo":"engajamento"}]${data.brandContext ? `\nCONTEXTO DA MARCA DO CRIADOR:\n${data.brandContext}\nUse essas informações pra personalizar o conteúdo ao estilo e tom da marca.` : ''}`
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

RESPONDA APENAS COM A LEGENDA. Sem título, sem aspas, sem explicação.${data.brandContext ? `\nCONTEXTO DA MARCA DO CRIADOR:\n${data.brandContext}\nUse essas informações pra personalizar o conteúdo ao estilo e tom da marca.` : ''}`
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
["hashtag1","hashtag2","hashtag3",...,"hashtag20"]${data.brandContext ? `\nCONTEXTO DA MARCA DO CRIADOR:\n${data.brandContext}\nUse essas informações pra personalizar o conteúdo ao estilo e tom da marca.` : ''}`
        userPrompt = `TÍTULO: "${data.titulo || ''}"
FORMATO: ${data.formato || 'post'}
PLATAFORMA: ${data.plataforma || 'instagram'}
PILAR: ${data.pilar || 'geral'}
NICHO: ${data.nicho || 'lifestyle'}
LEGENDA: ${(data.legenda || '').slice(0, 200)}`
        maxTokens = 400
        break
      case 'onboarding-setup':
        operationPrompt = `Você é um estrategista de conteúdo brasileiro. Configure o espaço criativo de um novo criador, personalizando ao máximo com base no objetivo, público e tom informados. Retorne APENAS JSON válido, sem texto antes ou depois.
{"pilares":[{"name":"string","color":"#hex"}],"habitos":["string"],"ideias":[{"title":"string","format":"string","platform":"string"}]}`
        userPrompt = `Nicho: ${data.nicho || 'lifestyle'}
Plataformas: ${Array.isArray(data.plataformas) ? data.plataformas.join(', ') : data.plataformas || 'instagram'}
Objetivo principal: ${data.objetivo || 'crescer audiência'}
Público-alvo: ${data.publico || 'não informado'}
Tom de voz: ${data.tom || 'autêntico'}
Use o objetivo, o público e o tom pra deixar os pilares e as ideias bem específicos e relevantes pra essa pessoa.`
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

${Array.isArray(data.historico) ? data.historico.map((m: any) => `${m.role}: ${m.content}`).join('\n') : 'Início da conversa.'}${data.brandContext ? `\nCONTEXTO DA MARCA DO CRIADOR:\n${data.brandContext}\nUse essas informações pra personalizar o conteúdo ao estilo e tom da marca.` : ''}`
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
      case 'refine-caption':
        operationPrompt = `Você é um copywriter expert em redes sociais brasileiras.

Recebeu uma legenda existente e uma instrução de como refiná-la.

Aplique a instrução e retorne APENAS a legenda nova, sem explicações, sem aspas, sem prefixo.

Mantenha os emojis se houver. Mantenha hashtags se houver.

Linguagem natural brasileira.${data.brandContext ? `\nCONTEXTO DA MARCA DO CRIADOR:\n${data.brandContext}\nUse essas informações pra personalizar o conteúdo ao estilo e tom da marca.` : ''}`
        userPrompt = `INSTRUÇÃO: ${data.instrucao || 'Reescreva'}

LEGENDA ORIGINAL:

${data.legenda_original || ''}

PLATAFORMA: ${data.plataforma || 'instagram'}

FORMATO: ${data.formato || 'post'}

NICHO: ${data.nicho || 'geral'}`
        maxTokens = 500
        break
      case 'score-caption':
        operationPrompt = `Você é um analista de copy de redes sociais brasileiras. Avalie a legenda recebida.

CRITÉRIOS (o que faz uma legenda performar):
- Gancho na 1ª linha (para o scroll?)
- Clareza da mensagem
- Emoção / curiosidade / identificação
- CTA que provoca resposta
- Ritmo: usa line breaks, não é um bloco
- Sem clichê ("Olá", "Você sabia", "Bora?")

ENTREGUE:
- nota: de 0 a 10, uma casa decimal, pra força do gancho + potencial de engajamento
- veredito: 1 frase direta e honesta
- melhorias: 2 a 3 ações concretas pra subir a nota
- variacoes: 3 versões alternativas da legenda, cada uma com um gancho diferente, prontas pra copiar e colar (mantenha o idioma português BR, tom natural)

RESPONDA APENAS com JSON válido, sem texto antes ou depois:
{"nota":7.5,"veredito":"string","melhorias":["m1","m2"],"variacoes":["v1","v2","v3"]}`
        userPrompt = `LEGENDA:
${(data.legenda || '').slice(0, 1000)}

FORMATO: ${data.formato || 'post'}
PLATAFORMA: ${data.plataforma || 'instagram'}
NICHO: ${data.nicho || 'geral'}`
        maxTokens = 8192
        break
      case 'client-report-insight':
        operationPrompt = `Você é um gestor de social media sênior escrevendo a análise de um relatório mensal pro cliente.

REGRA DE OURO: os números (alcance, visualizações, curtidas, comentários, interações) JÁ aparecem em cards no relatório. NÃO os repita como lista nem reescreva "teve X de alcance e Y curtidas". Isso é repetição inútil. Seu trabalho é INTERPRETAR.

O QUE FAZER:
- Calcule e comente a TAXA DE ENGAJAMENTO (interações ÷ alcance) e compare com referência saudável (~3% a 6%). Diga se está acima/abaixo.
- Identifique o GARGALO: o problema é alcance (pouca gente vendo) ou conversão/engajamento (gente vê mas não interage)? Aponte qual.
- Leia os DESTAQUES: qual formato puxou resultado e o que isso sugere.
- Explique o PORQUÊ provável, não só o "o quê". Conecte ao segmento/persona quando houver.
- Sem números reais de Instagram? Aí sim fale da produção/fluxo.

TOM: profissional, direto, específico. Português BR. Nada de conselho genérico ("poste mais", "use CTA", "seja consistente").

ENTREGUE:
- resumo: 2 a 3 frases de DIAGNÓSTICO (pode citar no máximo 1 número-chave pra embasar, mas o foco é a leitura, não repetir os cards).
- recomendacoes: 2 a 3 ações ESPECÍFICAS e acionáveis ligadas ao diagnóstico e ao nicho — algo que o cliente não saberia só olhando os cards.

RESPONDA APENAS com JSON válido, sem texto antes ou depois:
{"resumo":"string","recomendacoes":["r1","r2"]}`
        userPrompt = `Cliente: ${data.cliente || 'cliente'}
Mês: ${data.mes || ''}

DESEMPENHO REAL NO INSTAGRAM (mês):
Posts publicados: ${data.igPosts ?? 0}
Alcance: ${data.igReach ?? 0} | Visualizações: ${data.igViews ?? 0}
Curtidas: ${data.igLikes ?? 0} | Comentários: ${data.igComments ?? 0} | Interações: ${data.igInteractions ?? 0}
Destaques: ${data.igDestaques || '-'}

PRODUÇÃO NO FLUXO (Cria Post):
Total de posts: ${data.total ?? 0} | Aprovados: ${data.aprovados ?? 0} | Aguardando: ${data.aguardando ?? 0} | Ajustes: ${data.ajustes ?? 0}
Por formato: ${data.formatos || '-'}
${data.segmento ? `Segmento do cliente: ${data.segmento}` : ''}
${data.servicos ? `Serviços contratados: ${data.servicos}` : ''}
${data.persona ? `Persona/público-alvo: ${data.persona}` : ''}`
        maxTokens = 8192
        break
      case 'insights-reading':
        operationPrompt = `Você é um analista de social media sênior. Recebe métricas REAIS de uma conta do Instagram e escreve uma leitura afiada e específica — nada de conselho genérico.

REGRAS:
- Cite números, formatos e comparações dos dados recebidos.
- Conecte causa e efeito (ex: "Reels puxaram X% mais alcance que foto").
- Português BR, direto.

ENTREGUE:
- leituras: 3 a 4 observações concretas baseadas nos números.
- acoes: 2 a 3 ações práticas pra próxima semana, conectadas às observações.

RESPONDA APENAS com JSON válido, sem texto antes ou depois:
{"leituras":["..."],"acoes":["..."]}`
        userPrompt = `Período: ${data.periodo || '30 dias'}
Seguidores: ${data.followers ?? '-'} (variação no período: ${data.followersDelta ?? 0})
Alcance total dos posts: ${data.reach ?? 0}
Interações totais (curtidas+coment+salvos+compart): ${data.interactions ?? 0}
Visitas ao perfil: ${data.profileViews ?? '-'}
Qtde de posts no período: ${data.mediaCount ?? 0}
Melhor formato (maior alcance médio): ${data.bestFormat || '-'}
Pior formato (menor alcance médio): ${data.worstFormat || '-'}
Post de maior alcance: ${data.topPost || '-'}
Post mais salvo: ${data.topSaved || '-'}
Nicho: ${data.nicho || '-'}`
        maxTokens = 700
        break
      case 'autopilot-cronograma':
        operationPrompt = `Você é um estrategista de conteúdo brasileiro montando um cronograma pronto pra um criador.

OBJETIVO: ${data.qtd || 8} posts pro período (${data.periodo || 'semana'}), no TOM DA MARCA, com variedade de formatos e pilares, SEM repetir o que a pessoa já fez, priorizando o que performou.

REGRAS:
- Gancho forte na 1ª linha (sem clichê tipo "Olá"/"Você sabia").
- Varie formatos (reels, carrossel, foto, story) e pilares — nada repetitivo.
- Cada post traz uma legenda curta PRONTA pra usar.
- "porque": 1 frase ligando à estratégia/dados/nicho (ex.: "Reels foi seu maior alcance").
- Considere o FOCO informado.
- NÃO repita títulos/temas dos posts recentes listados.

RESPONDA APENAS com JSON válido, sem texto antes ou depois:
{"posts":[{"titulo":"gancho/título","formato":"reels|carrossel|foto|story","plataforma":"instagram","pilar":"nome do pilar","legenda":"legenda pronta curta","porque":"motivo curto"}]}`
        userPrompt = `Nicho: ${data.nicho || 'lifestyle'}
Plataformas: ${data.plataformas || 'instagram'}
Pilares disponíveis: ${data.pilares || '-'}
Foco: ${data.foco || 'crescimento'}
Quantidade: ${data.qtd || 8}
O que mais performou (priorizar): ${data.performou || '-'}
Tendências do nicho (se houver): ${data.tendencias || '-'}
Posts recentes (NÃO repetir): ${data.recentes || '-'}
${data.contexto ? `Contexto/tema do período (priorizar): ${data.contexto}` : ''}
${data.publico ? `Público-alvo: ${data.publico}` : ''}
${data.brandContext ? `\nMARCA DO CRIADOR:\n${data.brandContext}` : ''}`
        maxTokens = 8192
        break
      default:
        throw new Error('Invalid operation')
    }

    const systemPrompt = `${userContext}\n\nTAREFA ESPECÍFICA:\n${operationPrompt}`

    const response = await aiFetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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

    if (operation === 'reference-filter' || operation === 'score-caption' || operation === 'client-report-insight' || operation === 'insights-reading' || operation === 'autopilot-cronograma') {
      const cleaned = String(content).replace(/```json/gi, '').replace(/```/g, '').trim()
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[0] : cleaned
      try {
        return new Response(JSON.stringify({ result: JSON.parse(jsonStr) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch {
        console.error('Failed to parse JSON response', content)
        // client-report-insight nunca deve quebrar o relatório: devolve um fallback usável.
        if (operation === 'client-report-insight') {
          return new Response(JSON.stringify({ result: { resumo: cleaned.slice(0, 600), recomendacoes: [] } }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        if (operation === 'insights-reading') {
          return new Response(JSON.stringify({ result: { leituras: [cleaned.slice(0, 400)], acoes: [] } }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        throw new Error('Invalid JSON from AI')
      }
    }

    return new Response(JSON.stringify({ result: content.trim() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    if (error instanceof AiTimeoutError) {
      return new Response(JSON.stringify({ error: 'ai_timeout', message: 'A IA demorou demais. Tente de novo.' }), {
        status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    console.error('[ai-context-builder] unhandled error:', error)
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})