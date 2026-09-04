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
// Extrai JSON de uma resposta de IA mesmo com texto/markdown em volta.
// Aceita objeto {..} ou array [..]. Em falha, joga o trecho cru pra diagnóstico.
function parseAiJson(raw: string): any {
  let s = String(raw || '').replace(/```json/gi, '').replace(/```/g, '').trim()
  const starts = [s.indexOf('{'), s.indexOf('[')].filter((i) => i >= 0)
  const start = starts.length ? Math.min(...starts) : -1
  const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'))
  if (start >= 0 && end > start) s = s.slice(start, end + 1)
  try {
    return JSON.parse(s)
  } catch {
    const snippet = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 160)
    throw new Error(`Invalid JSON from AI: «${snippet || '(resposta vazia do modelo)'}»`)
  }
}

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
OBRIGATÓRIO variar os tipos, inclua PELO MENOS 2 de cada: "formato" (formatos de vídeo/post em alta), "tema" (assuntos quentes), "gancho" (aberturas que retêm), "data" (datas comemorativas/sazonais próximas no Brasil). Seja específico e brasileiro. Nada genérico.`

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
  const tparsed = parseAiJson(String(tj.choices?.[0]?.message?.content || ''))
  const trendsArr = Array.isArray(tparsed) ? tparsed : (tparsed.trends || [])
  const allowed = new Set(['formato', 'tema', 'gancho', 'data'])
  const rows = (trendsArr || [])
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

// Banco de tendências de STORIES (compartilhado). Mesma ideia do runTrendRefresh.
async function runStoryTrendRefresh(admin: any, lovableApiKey: string, corsHeaders: Record<string, string>, _createdBy: string | null): Promise<Response> {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

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
            { role: 'system', content: 'Você é analista de Stories do Instagram no Brasil. Responda em português, objetivo e concreto, com base no que está em alta AGORA.' },
            { role: 'user', content: `Hoje é ${hoje}. Pesquise e liste o que está EM ALTA AGORA em STORIES do Instagram no Brasil: (1) formatos de story em alta (enquete, caixinha de perguntas, bastidores, tutorial rápido, antes/depois, contagem regressiva, quiz), (2) trends de áudio/figurinhas/interações, (3) ideias de story que estão engajando muito. Seja específico e atual, evite genérico.` },
          ],
          max_tokens: 900,
          temperature: 0.2,
        }),
      })
      if (pr.ok) {
        const pj = await pr.json()
        webResearch = String(pj.choices?.[0]?.message?.content || '').slice(0, 4000)
      } else { console.error('perplexity(story) error', pr.status, await pr.text()) }
    } catch (e) { console.error('perplexity(story) fetch failed', e) }
  }

  const sys = `Você é um analista de tendências de STORIES do Instagram no Brasil. Hoje é ${hoje}. Responda SOMENTE em JSON válido, sem markdown.`
  const usr = `${webResearch ? `PESQUISA DA WEB (use como base, é atual):\n${webResearch}\n\n` : ''}Gere de 8 a 12 tendências de STORIES no formato JSON abaixo. Escreva pra um LEIGO conseguir executar SEM dúvida, proibido ser abstrato ou genérico.
{"trends":[{"format":"enquete|caixinha|bastidor|tutorial|antes-depois|dica-rapida|contagem|quiz|trend","title":"nome curto e claro","description":"instrução direta de COMO fazer, em passo a passo curto","example":"um story PRONTO pra postar hoje, concreto: diga exatamente o que gravar, o TEXTO que vai na tela e a interação/sticker. Ex: 'Grave 10s mostrando sua mesa bagunçada e escreva na tela: \\'era isso ou desistir\\'. Coloque enquete: \\'você já pensou em desistir? Sim/Não\\''","why_trending":"por que engaja agora"}]}
REGRAS OBRIGATÓRIAS:
- "description" e "example" TÊM que ser concretos e específicos, como ensinando alguém que nunca postou um story.
- PROIBIDO frases vagas tipo "utilize vídeos para demonstrações" ou "compartilhe bastidores". Sempre diga O QUÊ, COM QUE TEXTO e QUAL interação.
- Português BR, informal.`

  const tr = await aiFetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [ { role: 'system', content: sys }, { role: 'user', content: usr } ],
      max_tokens: 4096,
      temperature: 0.7,
    }),
  })
  if (!tr.ok) { console.error('story trend gateway error', tr.status, await tr.text()); throw new Error('AI gateway error') }
  const tj = await tr.json()
  const sparsed = parseAiJson(String(tj.choices?.[0]?.message?.content || ''))
  const trendsArr = Array.isArray(sparsed) ? sparsed : (sparsed.trends || [])
  const rows = (trendsArr || [])
    .filter((t) => t && typeof t.title === 'string')
    .slice(0, 14)
    .map((t) => ({
      format: t.format ? String(t.format).slice(0, 40) : 'trend',
      title: String(t.title).slice(0, 120),
      description: t.description ? String(t.description).slice(0, 300) : null,
      example: t.example ? String(t.example).slice(0, 500) : null,
      why_trending: t.why_trending ? String(t.why_trending).slice(0, 300) : null,
    }))
  if (rows.length === 0) throw new Error('Nenhuma tendência de story gerada')

  await admin.from('story_trends').delete().not('id', 'is', null)
  const { error: insErr } = await admin.from('story_trends').insert(rows)
  if (insErr) { console.error('story trend insert error', insErr); throw new Error('Falha ao salvar tendências de stories') }

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
    const cronSecret = Deno.env.get('TREND_CRON_SECRET')
    if (internalSecret && cronSecret && internalSecret === cronSecret) {
      const cronBody = await req.json().catch(() => ({}))
      const cronOp = cronBody?.operation
      if (cronOp !== 'trend-bank-refresh' && cronOp !== 'story-trend-refresh') {
        return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); const lk = Deno.env.get('LOVABLE_API_KEY')
      if (!url || !key || !lk) throw new Error('Missing credentials')
      const cronAdmin = createClient(url, key)
      return cronOp === 'story-trend-refresh'
        ? await runStoryTrendRefresh(cronAdmin, lk, corsHeaders, null)
        : await runTrendRefresh(cronAdmin, lk, corsHeaders, null)
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
      .select("role, plan, subscription_status, trial_ends_at")
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

    // ── Recursos pagos por TIER (F19) ──────────────────────────────
    // A trava do frontend (roteador React / UpgradeGate) é UX. Ela não é
    // segurança: qualquer um chama a edge function direto. Quem decide é aqui.
    // Espelhamos o mapa recurso->tier de src/lib/plans.ts (FEATURES[*].minimo)
    // e rejeitamos qualquer operação cujo tier mínimo exceda o do chamador.
    // Trial entra como Studio de propósito (a pessoa precisa SENTIR o que perde
    // quando acabar). Admin passa direto. art-brief NÃO entra: é da agência
    // (módulo Cria Post, gate próprio), não é degrau de plano de criador.
    const TIER_RANK: Record<string, number> = { none: 0, essencial: 1, pro: 2, studio: 3 }
    const OP_MIN_TIER: Record<string, 'pro' | 'studio'> = {
      'art-prompt': 'pro',              // Cria Estúdio  (FEATURES.estudio.minimo = pro)
      'autopilot-cronograma': 'studio', // Cria Plano    (FEATURES["cria-plano"].minimo = studio)
      'story-plan-generate': 'studio',  // Cria Stories  (FEATURES.stories.minimo = studio)
    }
    const _minTier = OP_MIN_TIER[operation]
    if (_minTier && !_isAdmin) {
      const _callerTier = _trialOk ? 'studio' : (_isActive ? String(accessRow.plan ?? 'none') : 'none')
      if ((TIER_RANK[_callerTier] ?? 0) < TIER_RANK[_minTier]) {
        const _label = _minTier === 'studio' ? 'Studio' : 'Pro'
        return new Response(
          JSON.stringify({ error: 'upgrade_required', message: `Este recurso está no plano ${_label}.` }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

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
      try {
        return await runTrendRefresh(supabase, lovableApiKey, corsHeaders, userId)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('[trend-bank-refresh] failed:', msg)
        return new Response(JSON.stringify({ error: `trend-refresh: ${msg}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
    if (operation === 'story-trend-refresh') {
      if (!_isAdmin) {
        return new Response(JSON.stringify({ error: 'forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      try {
        return await runStoryTrendRefresh(supabase, lovableApiKey, corsHeaders, userId)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('[story-trend-refresh] failed:', msg)
        return new Response(JSON.stringify({ error: `story-refresh: ${msg}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
    // ── fim trend bank refresh ───────────────────────────────────────

    const truncate = (s: unknown, max: number) =>
      typeof s === 'string' ? s.slice(0, max) : s
    if (data) {
      data.titulo = truncate(data.titulo, 500)
      // 3000 cortava o brandbook de quem preencheu tudo (o da Gabriela passa
      // disso só no tom de voz) e a IA perdia justamente a persona, que vem
      // no FIM do texto. 9000 chars ~ 2.5k tokens: barato perto do estrago
      // de sugerir conteúdo pra pessoa errada.
      data.brandContext = truncate(data.brandContext, 9000)
      data.roteiro = truncate(data.roteiro, 5000)
      data.legenda_original = truncate(data.legenda_original, 3000)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // O QUE NÃO COBRA CRÉDITO
    //
    // Cobrar pela BUSCA de notícia era um erro caro: a pessoa clicava em
    // "amarrar com o que está quente" só pra VER as manchetes, e já tinha
    // pagado antes de decidir qualquer coisa. Aí gerava o prompt e pagava
    // de novo. Um post podia custar 2 créditos sem ela entender por quê.
    //
    // Regra: cobra o que ENTREGA (o prompt, o briefing, a leitura do PDF).
    // Não cobra o que só AJUDA A DECIDIR. A busca continua protegida pelo
    // rate-limit de 25/min, que é o que impede abuso de verdade.
    // ═══════════════════════════════════════════════════════════════════════
    const SEM_COTA = new Set(['hot-news'])

    // ── Cota mensal de IA por tier (pro 150 / studio 500) ──────
    const { data: quotaData, error: quotaErr } = SEM_COTA.has(operation)
      ? { data: null, error: null }
      : await supabase.rpc("bump_ai_quota", { _user: userId });

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

    // ═══════════════════════════════════════════════════════════════════════
    // LER O BRANDBOOK DE UM PDF (visão)
    //
    // O brandbook é o dado do qual TODA a IA do CRIA depende: legenda, roteiro,
    // prompt de arte, briefing. Sem ele, tudo sai genérico e a pessoa conclui
    // que "a IA do Cria é fraca" e cancela.
    //
    // Só que ele é um formulário de vinte campos, e ninguém preenche formulário
    // de vinte campos. Resultado: o campo mais importante do produto vive vazio.
    //
    // O dado JÁ EXISTE: a social mídia tem o moodboard do cliente em PDF, e a
    // criadora tem o dela. Então a gente para de pedir pra digitar e passa a
    // pedir o arquivo. "Digite vinte campos" vira "confere o que eu entendi" -
    // e confirmar é infinitamente mais fácil que criar.
    //
    // MOODBOARD É IMAGEM, NÃO TEXTO: a paleta e a tipografia moram no desenho
    // da página, não no texto extraível. Por isso mandamos as PÁGINAS RENDERIZADAS
    // pra um modelo que ENXERGA. Extrair só texto pegaria metade e a metade
    // menos importante.
    //
    // E NADA É SALVO AQUI. Isto só LÊ e devolve. Quem grava é a pessoa, depois
    // de conferir campo a campo. IA gravando calada a cor errada da marca do
    // cliente é pior que o campo vazio: o erro fica invisível e sai em 50 posts.
    // ═══════════════════════════════════════════════════════════════════════
    if (operation === 'brandbook-read') {
      const imagens: string[] = Array.isArray(data?.imagens) ? data.imagens.slice(0, 8) : []
      const alvo = data?.alvo === 'criador' ? 'criador' : 'cliente'
      if (imagens.length === 0) {
        return new Response(JSON.stringify({ error: 'sem_paginas', message: 'Não consegui ler nenhuma página do arquivo.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const sys = `Você lê brandbooks/moodboards e extrai a identidade da marca. Você olha as PÁGINAS como imagens.

REGRAS:
- Só afirme o que você REALMENTE VÊ. Campo que não aparece no documento vem como null. NUNCA invente pra preencher: preencher chutando destrói a confiança e sai errado em dezenas de posts depois.
- Cores: devolva os HEX que você vê nas páginas de paleta (ex: "#6B4E71"). Se a página mostra a cor mas não o código, estime o hex mais próximo e diga na origem que foi estimado.
- Fontes: os nomes das famílias tipográficas, e pra que serve cada uma (título, corpo).
- Persona/público: se o documento descreve o público-alvo, DESTRINCHE em campos separados: quem é (audience), dores/frustrações (personaPains), desejos/objetivos (personaDesires), OBJEÇÕES/medos/barreiras que travam a decisão (personaObjections), interesses/temas (personaInterests) e canais/onde consome conteúdo (personaChannels). Em cada um desses, separe os itens por ponto e vírgula (";"), não por vírgula, pra não picotar frases. Campo que o documento não trouxer vem null.
- Estratégia: quando o documento for um PLANEJAMENTO (e não só manual visual), extraia também a meta principal (mainGoal), a Big Idea (bigIdea: a ideia master, original e contraintuitiva, que norteia toda a produção) e a promessa (promise: a transformação que o cliente vive com o produto). Extraia ainda o que a empresa vende (mainProducts) e há quanto tempo existe (marketSince), quando aparecerem.
- "origem": em que página do documento você viu aquilo (número). Isso é o que permite a pessoa conferir.

RESPONDA APENAS JSON válido:
{"campos":{
 "colorPalette":{"valor":"#XXXXXX, #YYYYYY","origem":"página 4"} | null,
 "typography":{"valor":"Playfair Display (títulos), Inter (corpo)","origem":"página 5"} | null,
 "toneOfVoice":{"valor":"como a marca fala","origem":"página 7"} | null,
 "personality":{"valor":"traços de personalidade da marca","origem":"..."} | null,
 "audience":{"valor":"quem é o público (resumo em 1-2 frases)","origem":"..."} | null,
 "personaPains":{"valor":"dor 1; dor 2; dor 3","origem":"..."} | null,
 "personaDesires":{"valor":"desejo 1; desejo 2","origem":"..."} | null,
 "personaObjections":{"valor":"objeção 1; objeção 2","origem":"..."} | null,
 "personaInterests":{"valor":"interesse 1; interesse 2","origem":"..."} | null,
 "personaChannels":{"valor":"Instagram; TikTok; newsletter","origem":"..."} | null,
 "valueProp":{"valor":"o que a marca promete","origem":"..."} | null,
 "avoid":{"valor":"o que NUNCA fazer (visual e verbal)","origem":"..."} | null,
 "visualExpression":{"valor":"direção de arte: tipo de imagem, luz, composição","origem":"..."} | null,
 "contentThemes":{"valor":"temas/pilares de conteúdo","origem":"..."} | null,
 "archetype":{"valor":"arquétipo da marca","origem":"..."} | null,
 "mainGoal":{"valor":"a meta principal da estratégia de conteúdo","origem":"..."} | null,
 "bigIdea":{"valor":"a ideia master que norteia o conteúdo","origem":"..."} | null,
 "promise":{"valor":"a transformação prometida ao cliente","origem":"..."} | null,
 "mainProducts":{"valor":"produtos ou serviços que a empresa oferece","origem":"..."} | null,
 "marketSince":{"valor":"há quanto tempo a empresa está no mercado","origem":"..."} | null
},"resumo":"1 frase do que é esta marca"}`

      const conteudo: unknown[] = [
        { type: 'text', text: `Leia este brandbook e extraia a identidade da marca (${alvo === 'criador' ? 'de um criador de conteúdo' : 'de um cliente de agência'}). ${imagens.length} páginas.` },
        ...imagens.map((url) => ({ type: 'image_url', image_url: { url } })),
      ]

      const r = await aiFetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash', // o -lite não enxerga bem; aqui a leitura É o produto
          messages: [{ role: 'system', content: sys }, { role: 'user', content: conteudo }],
          max_tokens: 2500,
          temperature: 0.1, // leitura, não criação: quanto menos "criativo", melhor
        }),
      })
      if (!r.ok) {
        const t = await r.text()
        console.error('[brandbook-read] gateway', r.status, t.slice(0, 300))
        return new Response(JSON.stringify({ error: 'leitura_falhou', message: 'Não consegui ler o arquivo. Tente um PDF com as páginas de paleta e tipografia.' }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const j = await r.json()
      const bruto = String(j.choices?.[0]?.message?.content || '')
      const limpo = bruto.replace(/```json/gi, '').replace(/```/g, '').trim()
      const m = limpo.match(/\{[\s\S]*\}/)
      try {
        return new Response(JSON.stringify({ result: JSON.parse(m ? m[0] : limpo) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch {
        console.error('[brandbook-read] json inválido', limpo.slice(0, 300))
        return new Response(JSON.stringify({ error: 'leitura_falhou', message: 'Li o arquivo mas não entendi o conteúdo. Tente outro PDF.' }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LER O RELATÓRIO MESTRE (briefing completo do cliente)
    //
    // A social mídia faz um briefing rico com o cliente (história, diferenciais,
    // personas, diagnóstico do perfil, concorrentes) e esse documento morria num
    // PDF. Esta operação lê o PDF e devolve o conteúdo JÁ SEPARADO nas quatro
    // abas da ficha (Brandbook, Persona, Diagnóstico, Concorrência). Mesma regra
    // do brandbook-read: só afirmar o que está NO documento, nada de inventar, e
    // NADA é salvo sem a pessoa conferir (quem salva é a tela, depois da revisão).
    if (operation === 'relatorio-read') {
      const imagens: string[] = Array.isArray(data?.imagens) ? data.imagens.slice(0, 14) : []
      if (imagens.length === 0) {
        return new Response(JSON.stringify({ error: 'sem_paginas', message: 'Não consegui ler nenhuma página do arquivo.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const sys = `Você lê briefings/relatórios estratégicos de marca (agência de social media) e extrai o conteúdo pra ficha do cliente. Você olha as PÁGINAS como imagens.

REGRAS:
- Só afirme o que você REALMENTE VÊ no documento. Campo sem informação vem null. NUNCA invente.
- IGNORE texto de instrução/placeholder do template (ex.: "Registre aqui as informações...", "Insira aqui um resumo...", "COLOQUE AQUI", "NOME DA EMPRESA AQUI"). Isso é molde, não conteúdo. Se a seção só tem placeholder, o campo vem null.
- Textos longos: resuma com fidelidade, mantendo os fatos e o vocabulário do documento. Listas: um item por linha (\n).
- personas: até 3, na ordem do documento (principal primeiro).
- diagnostico: os checks vêm de tabelas Sim/Não ou de marcas visuais de certo/errado; "sim" | "nao" | null.
- concorrentes: os citados nominalmente; kind = "direto" | "indireto" quando o documento distinguir.

RESPONDA APENAS JSON válido:
{"brand":{
  "history":"como e por que a empresa nasceu"|null,
  "brandValues":"valores"|null,
  "impact":"impacto/transformação que quer gerar"|null,
  "vision":"onde quer chegar"|null,
  "specialty":"especialidade/domínio técnico"|null,
  "valueProp":"o que diz fazer melhor + diferencial percebido"|null,
  "offer":"o que vende (resumo)"|null,
  "products":"principais produtos/serviços e categorias"|null,
  "audience":"cliente ideal (resumo em 2-3 frases)"|null,
  "toneOfVoice":"tom de voz"|null,
  "personality":"imagem que a marca quer transmitir"|null,
  "avoid":"estilos/abordagens que prefere evitar"|null,
  "contentThemes":"temas centrais de conteúdo, um por linha"|null,
  "coreMessage":"objetivo/mensagem central do conteúdo + transformação desejada"|null,
  "admiredBrands":"marcas que admira, uma por linha com o motivo"|null},
"personas":[{
  "name":"nome simbólico"|null,"ageRange":null,"gender":null,"region":null,"spend":null,
  "lifestyle":"quem é essa pessoa"|null,"valuesWhat":"o que valoriza"|null,
  "habits":"interesses e hábitos"|null,"buying":"como costuma comprar"|null,
  "seeks":"o que busca ao escolher"|null,"loyalty":"o que fideliza"|null,
  "pains":"uma dor por linha"|null,"desires":"um desejo por linha"|null,
  "doubts":"dúvidas frequentes do público"|null,"howWeServe":"como a empresa atende essa persona"|null}],
"diagnostico":{
  "chkBio":"sim"|"nao"|null,"chkFeed":null,"chkPinned":null,"chkHighlights":null,
  "chkVisual":null,"chkSite":null,"chkContact":null,
  "bioSuggestion":"bio sugerida no documento"|null,
  "nameSuggestion":"nome de perfil sugerido"|null,
  "highlightsPlan":"destaques sugeridos, um por linha"|null,
  "pinnedPlan":"fixados sugeridos, um por linha"|null,
  "notes":"outras observações do diagnóstico"|null},
"concorrentes":[{"name":"...","instagram":null,"kind":"direto"|"indireto"|null,"note":"o que observar"|null}],
"resumo":"1 frase do que é esta marca"}`

      const conteudo: unknown[] = [
        { type: 'text', text: `Leia este briefing/relatório estratégico e extraia o conteúdo pra ficha do cliente. ${imagens.length} páginas.` },
        ...imagens.map((url) => ({ type: 'image_url', image_url: { url } })),
      ]

      const r = await aiFetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash', // leitura de documento: precisa enxergar bem
          messages: [{ role: 'system', content: sys }, { role: 'user', content: conteudo }],
          max_tokens: 5000,
          temperature: 0.1,
        }),
      })
      if (!r.ok) {
        const t = await r.text()
        console.error('[relatorio-read] gateway', r.status, t.slice(0, 300))
        return new Response(JSON.stringify({ error: 'leitura_falhou', message: 'Não consegui ler o relatório. Tente de novo em instantes.' }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const j = await r.json()
      const bruto = String(j.choices?.[0]?.message?.content || '')
      const limpo = bruto.replace(/```json/gi, '').replace(/```/g, '').trim()
      const m = limpo.match(/\{[\s\S]*\}/)
      try {
        return new Response(JSON.stringify({ result: JSON.parse(m ? m[0] : limpo) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch {
        console.error('[relatorio-read] json inválido', limpo.slice(0, 300))
        return new Response(JSON.stringify({ error: 'leitura_falhou', message: 'Li o arquivo mas não entendi o conteúdo. Tente outro PDF.' }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // O QUE ESTÁ QUENTE SOBRE ESTE TEMA
    //
    // O botão "amarrar com o que está quente" existia SEM ISTO: ele só mandava
    // uma instrução genérica pro modelo ("converse com o assunto do momento") e
    // a pessoa não via notícia nenhuma. Promessa vazia na tela não quebrava
    // nada, só mentia. Que é o pior tipo de defeito, porque ninguém reporta.
    //
    // Agora ele busca de verdade (Perplexity, com fonte e data) e a pessoa
    // ESCOLHE qual notícia entra. Sem chave configurada, ele não finge que
    // funcionou: devolve lista vazia e a tela diz que não achou nada.
    // ═══════════════════════════════════════════════════════════════════════
    if (operation === 'hot-news') {
      const pplxKey = Deno.env.get('PERPLEXITY_API_KEY')
      if (!pplxKey) {
        return new Response(JSON.stringify({ result: { noticias: [], motivo: 'sem_chave' } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      const tema = String(data?.tema ?? '').slice(0, 300)
      const nicho = String(data?.nicho ?? '').slice(0, 120)

      try {
        const pr = await aiFetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${pplxKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              { role: 'system', content: 'Você pesquisa notícias e assuntos em alta no Brasil. Responda SOMENTE em JSON válido, sem markdown. Só inclua o que você REALMENTE encontrou, com fonte real. Se não achar nada relevante, devolva a lista vazia jamais invente notícia.' },
              { role: 'user', content: `Hoje é ${hoje}. Sobre o tema "${tema}"${nicho ? ` (nicho: ${nicho})` : ''}, o que está sendo falado AGORA no Brasil? Traga no máximo 3 itens dos últimos 30 dias.
{"noticias":[{"titulo":"manchete curta","fonte":"veículo","quando":"há X dias","resumo":"1 frase do que mudou"}]}` },
            ],
            max_tokens: 700,
            temperature: 0.1,
          }),
        })
        if (!pr.ok) throw new Error(String(pr.status))
        const pj = await pr.json()
        const bruto = String(pj.choices?.[0]?.message?.content || '')
        const limpo = bruto.replace(/```json/gi, '').replace(/```/g, '').trim()
        const m = limpo.match(/\{[\s\S]*\}/)
        const parsed = JSON.parse(m ? m[0] : limpo)
        return new Response(JSON.stringify({ result: { noticias: (parsed.noticias ?? []).slice(0, 3) } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (e) {
        console.error('[hot-news] falhou', e)
        // Fail-soft: o Estúdio continua funcionando sem notícia. Ele não é a
        // funcionalidade é um tempero.
        return new Response(JSON.stringify({ result: { noticias: [], motivo: 'falhou' } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

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
- Nunca escreva o conteúdo pela pessoa, sugira, direcione, inspire
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
      case 'idea-suggestions': {
        /* v2 (Walter, 04/09: "as sugestões estão genéricas demais"). O que mudou:
           1. A pessoa escolhe o FORMATO (estático, carrossel, reels, story,
              youtube), e cada formato tem regra de construção própria.
           2. Modo TENDÊNCIAS: cruza a ideia com o banco de tendências do nicho
              (content_trends) e devolve uma ideia mais profunda, amarrada ao
              que está quente, com direção visual (moodboard em texto).
           3. Cada sugestão vem COMPLETA: gancho literal, estrutura passo a
              passo, CTA, por que funciona pra ESSA persona e referência visual.
           4. Modelo mais forte e temperatura criativa (ver a chamada abaixo). */
        const formatoPedido = String(data.formato || data.platform || 'reels').toLowerCase()
        const REGRAS_FORMATO: Record<string, string> = {
          estatico: 'POST ESTÁTICO (1 imagem): a headline na arte é o hook; a legenda desenvolve em 3 a 5 parágrafos curtos com uma virada no meio e CTA no fim. "estrutura" = [headline da arte, abertura da legenda, desenvolvimento, virada, CTA].',
          carrossel: 'CARROSSEL (6 a 8 lâminas): lâmina 1 = hook que obriga a arrastar; cada lâmina seguinte com UMA ideia só, em frase curta; penúltima = síntese; última = CTA. "estrutura" = uma string por lâmina, começando com "L1:", "L2:"...',
          reels: 'REELS (30 a 45s, vertical): os 2 primeiros segundos são o gancho falado + texto na tela; 3 a 5 cenas com fala e ação visual; final com CTA falado. "estrutura" = uma string por cena, com fala entre aspas e a ação visual entre colchetes.',
          story: 'SEQUÊNCIA DE STORIES (4 a 6 telas): tela 1 prende com pergunta ou afirmação forte; use enquete, caixinha ou quiz em pelo menos 1 tela; a última tela pede resposta ou clique. "estrutura" = uma string por tela, começando com "T1:", "T2:"... e dizendo qual sticker usar.',
          youtube: 'VÍDEO DE YOUTUBE (6 a 12 min): título com promessa clara + curiosidade; roteiro em blocos: gancho (0 a 30s), contexto, 3 a 5 blocos de conteúdo com exemplo real em cada, fechamento com próximo passo. "estrutura" = uma string por bloco, com a minutagem aproximada.',
        }
        const regraFormato = REGRAS_FORMATO[formatoPedido] ?? REGRAS_FORMATO.reels
        const modoTendencias = data.modo === 'tendencias'

        // Banco de tendências do nicho (tabela content_trends, alimentada pelo
        // robô de tendências). Só no modo tendências, pra não gastar tokens à toa.
        let blocoTendencias = ''
        if (modoTendencias) {
          try {
            const nicho = String(data.niche || 'geral')
            const { data: tr } = await supabase.from('content_trends')
              .select('kind,title,description,niche')
              .or(`niche.eq.${nicho},niche.eq.geral`)
              .order('created_at', { ascending: false })
              .limit(14)
            const lista = (tr ?? []) as Array<{ kind: string; title: string; description: string | null; niche: string | null }>
            if (lista.length) {
              blocoTendencias = `\n\nTENDÊNCIAS DO MOMENTO (banco do CRIA, nicho ${nicho}):\n` +
                lista.map((t) => `- [${t.kind}] ${t.title}${t.description ? `: ${t.description}` : ''}`).join('\n') +
                `\n\nMODO TENDÊNCIAS: cada sugestão PRECISA se apoiar em UMA tendência acima (nomeie em "tendencia"), cruzando com a ideia da pessoa. Não copie a tendência: traduza pro universo e pra persona dela. Vá mais fundo que o normal: o "porque" explica o encontro entre a tendência e a dor da persona; a "referencia_visual" descreve um moodboard (cena, luz, enquadramento, cores e tipografia do brandbook, textura, ritmo de corte) que a pessoa consiga reproduzir com celular.`
            } else {
              blocoTendencias = `\n\nMODO TENDÊNCIAS: o banco de tendências está vazio pra este nicho. Use o que você sabe de formatos e assuntos em alta nas redes brasileiras em 2026 e nomeie a tendência escolhida em "tendencia".`
            }
          } catch (e) {
            console.warn('idea-suggestions: tendências indisponíveis', String(e))
          }
        }

        operationPrompt = `Você é um diretor criativo sênior de conteúdo para redes sociais brasileiras. Sua marca registrada: ideias ESPECÍFICAS, com cena, número, nome de coisa, exemplo real. Nada de "dicas de X" ou "a importância de Y".

O QUE TORNA UMA SUGESTÃO BOA (critério de aprovação):
- Passa no teste do "só essa pessoa poderia postar isso": usa a profissão, o produto, a história e a persona do brandbook.
- O gancho gera uma pergunta na cabeça de quem lê em 2 segundos (curiosidade, contradição, promessa concreta, confissão).
- Tem um ângulo claro e diferente entre as 3: contra-intuitivo, bastidor com número, erro que custa caro, antes/depois, mito vs realidade, passo a passo com exemplo, opinião impopular.
- A estrutura já é quase o roteiro: quem ler consegue gravar ou diagramar sem pensar mais.
- Fala como gente, em português do Brasil, sem jargão de marketing.

FORMATO ESCOLHIDO PELA PESSOA: ${formatoPedido}.
${regraFormato}
TODAS as 3 sugestões são nesse formato; o que muda entre elas é o ÂNGULO e o OBJETIVO (engajamento, autoridade, venda ou relacionamento, sem repetir).${blocoTendencias}${data.brandContext ? `

BRANDBOOK DA PESSOA (fonte da verdade, leia ANTES de sugerir):
${data.brandContext}

REGRA MAIS IMPORTANTE: descubra no brandbook QUEM esta pessoa é (o que ela vende, qual serviço presta) e PRA QUEM ela fala (a persona dela). As 3 sugestões falam COM essa persona, na posição profissional DELA. Se o brandbook diz que ela é social media, nutricionista ou advogada, o conteúdo é sobre O SERVIÇO DELA pro PÚBLICO DELA. Sugestão que contradiz o brandbook está errada.` : ''}

RESPONDA APENAS COM UM ARRAY JSON de 3 objetos, com estes campos (todos em português, sem markdown):
[{"titulo":"o hook, máximo 70 caracteres","gancho":"a PRIMEIRA frase literal (falada ou escrita), máximo 140 caracteres","formato":"${formatoPedido}","angulo":"ângulo editorial específico, 3 a 8 palavras","objetivo":"engajamento|autoridade|venda|relacionamento","estrutura":["passo/lâmina/cena 1","passo 2","..."],"cta":"o pedido final, literal","porque":"1 frase: por que isso funciona pra ESSA persona","referencia_visual":"direção de arte em 1 ou 2 frases: cena, enquadramento, cores/tipografia do brandbook","tendencia":"nome da tendência usada, ou string vazia"}]`
        userPrompt = `IDEIA CRUA DA PESSOA: "${data.ideiaTexto || 'conteúdo geral'}"
FORMATO: ${formatoPedido}
PILAR: ${data.pilar || 'geral'}
NICHO: ${data.niche || 'lifestyle'}
${modoTendencias ? 'MODO: tendências (cruze a ideia com o que está quente).' : 'MODO: padrão.'}
Gere 3 sugestões completas. Seja específico: cena, número, exemplo. Zero genérico.
RESPONDA APENAS COM O ARRAY JSON. Nenhuma palavra antes ou depois dele.`
        // Sugestão completa (estrutura + moodboard) x3 não cabe em 900 tokens.
        maxTokens = 2600
        break
      }
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
- NUNCA comece com "Olá", "Ei", "Você sabia que", comece com IMPACTO
- Emojis: 2-3 no máximo, posicionados estrategicamente
- CTA no final: pergunta aberta, convite à ação, ou chamada pro próximo passo
- Se carrossel: legenda complementa os slides (não repete)
- Se reels: curta e direta (gancho → valor → CTA)
- Se story: ultra-curta, 1-2 linhas com CTA direto
- SEM hashtags (sistema adiciona separadamente)
- Linguagem natural brasileira, como pessoa real falando
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
1. NICHO (7 hashtags). Menos de 100K posts. Alta relevância, fácil de ranquear. Específicas pro sub-nicho do criador.
2. MÉDIO (7 hashtags), 100K-1M posts. Boa descoberta com competição moderada. Relevantes pro nicho geral.
3. AMPLO (6 hashtags), 1M+ posts. Alta descoberta, pouca chance de ranquear, mas amplia alcance.

REGRAS:
- EXATAMENTE 20 hashtags, nessa ordem: 7 nicho + 7 médio + 6 amplo
- Apenas em português BR (exceto termos universais: reels, tiktok, etc)
- SEM # na frente, apenas a palavra/frase
- Considere a plataforma: Instagram usa 15-20 no caption/comentário, TikTok usa 3-5 curtas
- Formato ${data.formato || 'post'}: reels/video usam hashtags de formato (#reelsbrasil), carrossel usa hashtags educativas
- Misture hashtags de comunidade (#criadorbrasileiro) com hashtags de tema (#dicasdeconteudo)
- NUNCA use hashtags genéricas demais (#love, #instagood), são inúteis
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

- Informal mas natural, como conversa no WhatsApp

- Prática e direta, entregue coisas PRONTAS PRA USAR, não teoria

- Emojis: 1-2 por resposta MAX

- NUNCA se apresente de novo se já falou

- Responda EXATAMENTE o que foi perguntado, não mude de assunto

EXPERTISE:

1. IDEIAS. Framework de 5 pilares: Educacional (40%), Bastidores (20%), Engajamento (15%), Prova Social (15%), Promocional (10%)

2. HOOKS. Fórmulas: curiosidade, contraste, identificação, storytelling, lista, polêmica

3. LEGENDAS. Frameworks: PAS, AIDA, Before-After-Bridge

4. ESTRATÉGIA. Mix de formatos, frequência, horários (11h-13h e 18h-20h no BR), repurposing

5. HASHTAGS, 3 camadas: nicho (<100K), médio (100K-1M), amplo (1M+)

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

- NUNCA copie o conteúdo original. REESCREVA com ângulo diferente

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
        operationPrompt = `Você é um gestor de social media sênior escrevendo, PARA O CLIENTE, a leitura do período no relatório dele.

REGRA DE OURO: todos os números já aparecem em cards e tabelas no relatório. NÃO os repita em lista, não reescreva "teve X de alcance e Y curtidas". Seu trabalho é INTERPRETAR e defender o trabalho com argumento, não descrever planilha.

ESTRUTURA DO RACIOCÍNIO (nessa ordem):
1. ENTREGA: quantas peças foram publicadas e como isso se compara ao período anterior. Se caiu, não esconda: explique.
2. RESULTADO: taxa de engajamento (interações ÷ alcance) contra a referência saudável (~3% a 6%). Diga se está acima ou abaixo.
3. GARGALO: o problema é ALCANCE (pouca gente vendo) ou ENGAJAMENTO (gente vê e não interage)? Escolha um e justifique.
4. O QUE FUNCIONOU: use o destaque do período e o formato campeão pra dizer o que repetir. Se houver pior desempenho, use como aprendizado, nunca como culpa.
5. FLUXO: se houver peças paradas esperando aprovação ou tempo de aprovação alto, diga isso com educação e objetividade. É informação de gestão, não cobrança.

REGRAS DURAS:
- Use SOMENTE os dados recebidos. Se um dado veio como "sem comparação" ou não veio, NÃO invente evolução, tendência nem número.
- Onde vier "primeiro período", trate como primeira medição e não finja que houve crescimento.
- Nada de conselho genérico ("poste mais", "use CTA", "seja consistente", "invista em vídeo").
- Não use jargão interno de agência nem nome de ferramenta. O cliente lê isso.
- Não use travessão (-) no texto.

TOM: profissional, direto, específico, português BR. Como quem explica o mês numa reunião e sabe do que está falando.

ENTREGUE:
- resumo: 3 a 5 frases de DIAGNÓSTICO seguindo a estrutura acima (pode citar no máximo 2 números-chave pra embasar).
- recomendacoes: 2 a 4 ações ESPECÍFICAS pro próximo período, cada uma amarrada a um dado recebido, algo que o cliente não concluiria só olhando os cards.

RESPONDA APENAS com JSON válido, sem texto antes ou depois:
{"resumo":"string","recomendacoes":["r1","r2"]}`
        userPrompt = `Cliente: ${data.cliente || 'cliente'}
Período: ${data.mes || ''}${data.periodoAnterior ? ` | Período anterior de comparação: ${data.periodoAnterior}` : ''}

ENTREGA (fluxo de produção e aprovação):
Publicados no período: ${data.publicados ?? 0}
Total de peças que passaram pelo período: ${data.total ?? 0}
Aprovadas: ${data.aprovados ?? 0} | Aguardando o cliente: ${data.aguardando ?? 0} | Em ajuste: ${data.ajustes ?? 0} | Em produção: ${data.emProducao ?? 0}
Por formato: ${data.formatos || '-'}
${data.tempoAprovacao ? `Tempo de aprovação: ${data.tempoAprovacao}` : ''}
${data.pendencias ? `Pendências: ${data.pendencias}` : ''}

DESEMPENHO REAL NO INSTAGRAM:
${data.igPosts ? `Publicações medidas: ${data.igPosts}
Alcance: ${data.igReach ?? 0} | Visualizações: ${data.igViews ?? 0}
Curtidas: ${data.igLikes ?? 0} | Comentários: ${data.igComments ?? 0} | Salvamentos: ${data.igSalvos ?? 0} | Interações: ${data.igInteractions ?? 0}
${data.taxaEngajamento != null ? `Taxa de engajamento: ${data.taxaEngajamento}%` : ''}
Top publicações: ${data.igDestaques || '-'}` : 'O cliente não tem Instagram conectado, então NÃO existem métricas de alcance/engajamento. Fale só de entrega, fluxo e formatos, e não especule desempenho.'}

CRUZAMENTO COM O PERÍODO ANTERIOR:
${data.comparativo || 'Sem período anterior para comparar.'}

LEITURA DO PERÍODO:
${data.destaque ? `Destaque: ${data.destaque}` : ''}
${data.piorDesempenho ? `Menor desempenho: ${data.piorDesempenho}` : ''}
${data.formatoCampeao ? `Formato campeão: ${data.formatoCampeao}` : ''}
${data.consistencia ? `Consistência: ${data.consistencia}` : ''}
${data.seguidores ? `Seguidores: ${data.seguidores}` : ''}
${data.stories ? `Stories: ${data.stories}` : ''}

CONTEXTO DO CLIENTE:
${data.segmento ? `Segmento: ${data.segmento}` : ''}
${data.servicos ? `Serviços contratados: ${data.servicos}` : ''}
${data.persona ? `Persona/público-alvo: ${data.persona}` : ''}
${data.titulos ? `Pautas do período: ${data.titulos}` : ''}`
        maxTokens = 8192
        break
      case 'insights-reading':
        operationPrompt = `Você é um analista de social media sênior. Recebe métricas REAIS de uma conta do Instagram e escreve uma leitura afiada e específica, nada de conselho genérico.

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
- Varie formatos entre reels, carrossel e foto, nada repetitivo. NÃO sugira "story"/"stories": eles têm um módulo próprio (Cria Stories). O cronograma é só pra posts de feed.
- Cada post traz uma legenda curta PRONTA pra usar.
- "porque": 1 frase ligando à estratégia/dados/nicho (ex.: "Reels foi seu maior alcance").
- Considere o FOCO informado.
- NÃO repita títulos/temas dos posts recentes listados.

RESPONDA APENAS com JSON válido, sem texto antes ou depois:
{"posts":[{"titulo":"gancho/título","formato":"reels|carrossel|foto","plataforma":"instagram","pilar":"nome do pilar","legenda":"legenda pronta curta","porque":"motivo curto"}]}`
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
      case 'story-plan-generate': {
        const perDia = Math.max(1, Math.min(6, Number(data.perDia) || 3))
        const dias = Math.max(1, Math.min(15, Number(data.dias) || 7))
        operationPrompt = `Você é um estrategista de STORIES do Instagram no Brasil. Monte um plano de stories PRONTO pra gravar, no tom da marca do criador.

OBJETIVO: ${perDia} stories por dia, por ${dias} dias. Cada story é acionável, específico ao nicho e à marca, nada genérico.

REGRAS:
- Varie os formatos ao longo do dia e da semana: enquete, caixinha de perguntas, bastidor, tutorial rápido, antes/depois, dica rápida, contagem regressiva, quiz, "assista até o fim".
- "roteiro": 1 a 3 frases dizendo EXATAMENTE o que gravar/mostrar e o texto que vai na tela.
- "horario": distribua ao longo do dia (manhã, almoço, noite) conforme o melhor engajamento.
- Use as tendências de stories informadas quando encaixarem no nicho.
- Português BR informal, como amigo falando.

RESPONDA APENAS com JSON válido, sem texto antes ou depois:
{"stories":[{"dia":0,"horario":"09:00","titulo":"curto","roteiro":"o que gravar + texto da tela","formato":"enquete|caixinha|bastidor|tutorial|antes-depois|dica-rapida|contagem|quiz|trend"}]}
- "dia" é o índice do dia (0 = primeiro dia), de 0 a ${dias - 1}.
- Gere EXATAMENTE ${perDia} stories por dia (total ${perDia * dias}).`
        userPrompt = `Nicho: ${data.nicho || 'lifestyle'}
Stories por dia: ${perDia}
Dias: ${dias}
Tendências de stories em alta: ${data.tendencias || '-'}
${data.brandContext ? `\nMARCA DO CRIADOR:\n${data.brandContext}` : ''}`
        maxTokens = 8192
        break
      }
      // ═══════════════════════════════════════════════════════════════════
      // CRIA ESTÚDIO o prompt da arte, dentro do post
      //
      // Não geramos imagem. Geramos o PROMPT, que a pessoa cola no gerador
      // que ela já usa. Imagem por IA custa dinheiro de verdade, sai fora da
      // identidade dela, e ela ia refazer no Canva de qualquer jeito.
      //
      // Duas decisões que estão no formato da resposta:
      // 1. UM BLOCO DE ESTILO que se repete em TODAS as páginas. Sem isso o
      //    carrossel sai com 5 imagens de 5 mundos diferentes e aí ela
      //    testa uma vez e nunca mais volta.
      // 2. pt + en. Mostramos em português (ela precisa CONFERIR se a IA
      //    entendeu a marca dela); o botão copia o inglês, que é o que os
      //    geradores de imagem entendem de verdade.
      // ═══════════════════════════════════════════════════════════════════
      case 'art-prompt': {
        const paginas = Array.isArray(data.paginas) ? data.paginas.slice(0, 12) : []
        const temTexto = paginas.some((p: any) => String(p?.texto || '').trim().length > 0)
        const n = Math.max(1, paginas.length || 1)

        operationPrompt = `Você é um diretor de arte de conteúdo para Instagram no Brasil. Sua tarefa é escrever PROMPTS DE IMAGEM para um gerador de IA (Midjourney/Sora/DALL·E), respeitando a identidade visual da pessoa.

REGRAS INEGOCIÁVEIS:
- Escreva UM "estilo" que descreva a estética que se repete em TODAS as páginas (tipo de imagem, luz, fundo, textura, atmosfera, paleta). É ele que dá unidade ao carrossel.
- Cada página repete esse estilo e muda SÓ o assunto. Nunca invente um estilo diferente por página.
- Nada de texto dentro da imagem: a pessoa escreve o texto por cima depois. Sempre inclua "sem texto na imagem" / "no text".
- Use as cores da marca informadas. Se não houver cores, descreva a paleta pelo tom da marca, sem inventar hex.
- "pt" é a versão em português (a pessoa vai LER e conferir). "en" é a MESMA imagem descrita em inglês (é o que ela vai colar no gerador). As duas descrevem exatamente a mesma cena.
- Nada de marca d'água, logo, rosto de celebridade ou pessoa real identificável.

RESPONDA APENAS com JSON válido, sem texto antes ou depois:
{"estilo":{"descricao":"1-2 frases da estética comum","en":"same style block in English"},"paginas":[{"n":1,"titulo":"do que é esta página","pt":"prompt em português","en":"prompt in English"}]}
- Gere EXATAMENTE ${n} ${n === 1 ? 'página' : 'páginas'}.`

        userPrompt = `Formato: ${data.formato || 'post'}
Título do post: ${data.titulo || '(sem título)'}
${temTexto
  ? `O QUE JÁ ESTÁ ESCRITO EM CADA PÁGINA (use isto, não chute):\n${paginas.map((p: any, i: number) => `${i + 1}. ${String(p?.texto || '').slice(0, 400)}`).join('\n')}`
  : `A pessoa ainda NÃO escreveu o conteúdo das páginas. Crie a partir do título, de forma coerente do começo ao fim.`}
${data.roteiro ? `\nRoteiro/legenda do post: ${String(data.roteiro).slice(0, 1200)}` : ''}
${data.cores ? `\nCores da marca: ${data.cores}` : ''}
${data.fontes ? `Fontes da marca: ${data.fontes}` : ''}
${data.tom ? `Tom da marca: ${data.tom}` : ''}
${data.contextoQuente ? `\nAMARRAR COM O QUE ESTÁ EM ALTA (só se encaixar naturalmente na cena; jamais force):\n${String(data.contextoQuente).slice(0, 600)}` : ''}`
        maxTokens = 4096
        break
      }
      // ═══════════════════════════════════════════════════════════════════
      // BRIEFING DE ARTE dentro do post do cliente (Cria Post)
      //
      // Aqui a pessoa NÃO quer um prompt de IA. Ela quer o que MANDAR PRO
      // DESIGNER: paleta com hex, fonte, o que pode e o que não pode, e o texto
      // que vai na peça. Ela escreve isso no WhatsApp, na mão, dez vezes por
      // semana e digita a paleta do cliente de cabeça toda vez.
      //
      // O prompt de IA é só UMA DAS SAÍDAS do mesmo briefing.
      // ═══════════════════════════════════════════════════════════════════
      case 'art-brief': {
        operationPrompt = `Você é um diretor de arte de uma agência de social media no Brasil. Escreva o BRIEFING DE ARTE de um post, pronto pra ser mandado pro designer no WhatsApp.

REGRAS:
- Fale com um designer humano: objetivo, concreto, sem enrolação e sem jargão de IA.
- "direcao": 3 a 5 instruções do que FAZER na peça (composição, tipo de imagem, luz, hierarquia).
- "evitar": 2 a 4 instruções do que NÃO fazer, tiradas da marca do cliente. Se a marca não disser nada, use o bom senso do segmento nunca invente uma regra específica do cliente.
- "textoPeca": o texto que vai DENTRO da arte, página por página. Curto, do jeito que cabe numa peça não é a legenda.
- "promptEn": o mesmo briefing traduzido em UM prompt de imagem em inglês, pra quem for gerar por IA em vez de desenhar. Sem texto na imagem ("no text").
- Não invente cor nem fonte que não foi informada.

RESPONDA APENAS JSON válido:
{"direcao":["..."],"evitar":["..."],"textoPeca":[{"n":1,"texto":"..."}],"promptEn":"..."}`

        userPrompt = `Cliente: ${data.cliente || '-'}
Segmento: ${data.segmento || '-'}
Post: ${data.titulo || '-'}
Formato: ${data.formato || 'post'}
${data.paginas ? `Conteúdo das páginas:\n${data.paginas}` : ''}
${data.legenda ? `Legenda do post: ${String(data.legenda).slice(0, 800)}` : ''}

MARCA DO CLIENTE (use SÓ o que está aqui):
Cores: ${data.cores || '(não informado)'}
Tipografia: ${data.fontes || '(não informado)'}
Tom de voz: ${data.tom || '(não informado)'}
Direção visual: ${data.visual || '(não informado)'}
Nunca fazer: ${data.evitar || '(não informado)'}
Público: ${data.publico || '(não informado)'}`
        maxTokens = 2000
        break
      }
      // ═══════════════════════════════════════════════════════════════════
      // O CONTEÚDO DE CADA LÂMINA (carrossel / cenas do reels)
      //
      // Isto existia no Cria Estúdio antigo e MORREU junto com a tela: a pessoa
      // dava o tema e ele escrevia lâmina por lâmina. Matar a tela sem trazer o
      // recurso junto foi erro meu o problema era a tela, não o recurso.
      //
      // Agora ele vive onde as lâminas vivem: na aba Roteiro do post. E é ele
      // que alimenta a aba Arte: com o texto de cada página escrito, o prompt
      // da arte nasce do conteúdo real, não de um chute em cima do título.
      // ═══════════════════════════════════════════════════════════════════
      case 'carousel-script': {
        const n = Math.max(2, Math.min(12, Number(data.qtd) || 5))
        const ehReels = String(data.formato ?? '').toLowerCase().includes('reels')
          || String(data.formato ?? '').toLowerCase().includes('video')

        operationPrompt = `Você é um redator sênior de conteúdo para Instagram no Brasil. Escreva o conteúdo ${ehReels ? 'de cada CENA de um reels' : 'de cada PÁGINA de um carrossel'}, no tom da marca desta pessoa.

REGRAS:
- ${n} ${ehReels ? 'cenas' : 'páginas'}, na ordem, contando UMA história do começo ao fim.
- A 1ª é o GANCHO: ela tem que parar o dedo. Nada de "hoje vou te contar sobre...".
- A última é o CTA: uma ação concreta (salvar, comentar, seguir, ir pro link).
- Cada ${ehReels ? 'cena' : 'página'} é CURTA é texto pra tela, não parágrafo de blog. No máximo 2 frases.
- Uma ideia por ${ehReels ? 'cena' : 'página'}. Se tem duas, quebre em duas.
- Português BR, direto, sem clichê de coach e sem emoji.
- Nada de "página 1", "slide 2" dentro do texto.

RESPONDA APENAS JSON válido:
{"hook":"o gancho, a frase que para o dedo","cta":"a ação final, concreta","laminas":[{"n":1,"texto":"o que vai escrito nesta página"}]}
- Exatamente ${n} itens em "laminas".
- "hook" e "cta" são os MESMOS da 1ª e da última ${ehReels ? 'cena' : 'página'}, mas escritos como campo isolado (o post tem um lugar próprio pra cada um).`

        userPrompt = `Formato: ${data.formato || 'carrossel'}
Tema/título: ${data.tema || data.titulo || '(sem título)'}
${data.angulo ? `Ângulo que a pessoa quer: ${data.angulo}` : ''}
${data.pilar ? `Pilar: ${data.pilar}` : ''}
${data.nicho ? `Nicho: ${data.nicho}` : ''}
${data.tom ? `Tom da marca: ${data.tom}` : ''}
${data.publico ? `Público: ${data.publico}` : ''}
${data.evitar ? `NUNCA usar: ${data.evitar}` : ''}
${data.contextoQuente ? `\nAMARRAR COM O QUE ESTÁ EM ALTA AGORA (use de verdade, cite o fato, não fale genérico):\n${String(data.contextoQuente).slice(0, 800)}` : ''}`
        maxTokens = 2500
        break
      }
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
        // Sugestões de post são CRIAÇÃO, não leitura: o -lite a 0.2 devolvia
        // "dicas de X" genéricas (Walter, 04/09). Modelo cheio + temperatura
        // alta só nessa operação; o resto continua barato e previsível.
        model: operation === 'idea-suggestions' ? 'google/gemini-2.5-flash' : 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: operation === 'daily-insight' ? 0.7 : operation === 'idea-suggestions' ? 0.85 : 0.2,
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

    if (operation === 'reference-filter' || operation === 'score-caption' || operation === 'client-report-insight' || operation === 'insights-reading' || operation === 'autopilot-cronograma' || operation === 'story-plan-generate' || operation === 'art-prompt' || operation === 'art-brief' || operation === 'carousel-script') {
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