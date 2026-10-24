import { createClient } from "npm:@supabase/supabase-js@2"

/* ═══════════════════════════════════════════════════════════════════════════
   BRANDBOOK FALADO (onboarding, 24/10/2026, ideia do Walter)

   Ninguém preenche 33 perguntas de brandbook. O PDF (ai-context-builder,
   brandbook-read) resolve pra quem tem manual de marca; esta é a outra porta:
   a pessoa fala UMA vez, livre, sobre quem é, o que faz e pra quem fala. O
   navegador transcreve (Web Speech, custo zero, o áudio não sai do aparelho)
   e aqui a IA só DISTRIBUI o que ela disse nas perguntas. Pergunta que a fala
   não cobre volta vazia; o resto ela completa depois, e o app sugere isso.

   Função própria (e não mais uma operação do ai-context-builder) pra poder
   publicar sozinha: aquele arquivo tem 1.700 linhas. As regras são as mesmas
   de lá: sessão válida, conta ativa conferida no banco, rajada de 25/min e
   1 geração da cota (cobra o que ENTREGA).

   NADA é gravado aqui. Quem grava é o front, só onde a resposta está vazia.

   Entrada: { texto, perguntas: [{ id: "secao/chave", label }], accountId? }
   Saída:   { result: { respostas: { "secao/chave": "texto" }, resumo } }
   ═══════════════════════════════════════════════════════════════════════════ */

const ALLOWED_ORIGINS = [
  "https://app.criasocialclub.com.br", "https://criasocialclub.com.br",
  "http://localhost:5173", "http://localhost:8080",
]
function cors(req: Request) {
  const origin = req.headers.get("origin") ?? ""
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  }
}

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
/* Mesmo modelo que o resto da IA usa pra "flash" (ver _shared/ia.ts): o nome
   real mora no segredo GEMINI_MODELO_FLASH. */
const modelo = () => Deno.env.get("GEMINI_MODELO_FLASH") ?? "gemini-3.5-flash"

Deno.serve(async (req) => {
  const h = cors(req)
  const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...h, "Content-Type": "application/json" } })
  if (req.method === "OPTIONS") return new Response("ok", { headers: h })
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)

  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
    if (!token) return json({ error: "Unauthorized" }, 401)
    const url = Deno.env.get("SUPABASE_URL")
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const gemini = Deno.env.get("GEMINI_API_KEY")
    if (!url || !service || !gemini) throw new Error("credenciais ausentes")
    const admin = createClient(url, service)

    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return json({ error: "Invalid token" }, 401)

    // Rajada por pessoa, a mesma chave do ai-context-builder (25/min no total).
    const janela = new Date().toISOString().slice(0, 16)
    const { data: rl, error: rlErr } = await admin.rpc("check_and_increment_rate_limit", {
      _user_id: user.id, _scope: "ai-context-builder", _window_key: janela, _limit: 25,
    })
    const rlRow = Array.isArray(rl) ? rl[0] : rl
    if (rlErr || rlRow?.allowed !== true) return json({ error: "rate_limited", message: "Muitas requisições. Aguarde um pouco." }, 429)

    const body = await req.json().catch(() => ({}))

    // Conta ativa (Meu perfil / cliente): a IA trabalha e cobra pra ela.
    let contaId = user.id
    const pedida = typeof body?.accountId === "string" ? body.accountId : null
    if (pedida && pedida !== user.id) {
      const { data: pode, error: podeErr } = await admin.rpc("conta_acessivel", { _actor: user.id, _owner: pedida })
      if (podeErr || pode !== true) return json({ error: "forbidden_account", message: "Você não tem acesso a esta conta." }, 403)
      contaId = pedida
    }

    const texto = typeof body?.texto === "string" ? body.texto.trim().slice(0, 6000) : ""
    const perguntas: { id: string; label: string }[] = (Array.isArray(body?.perguntas) ? body.perguntas : [])
      .filter((q: { id?: unknown; label?: unknown }) =>
        typeof q?.id === "string" && /^[a-z-]{2,40}\/[a-z-]{2,40}$/.test(q.id) && typeof q?.label === "string")
      .slice(0, 40)
      .map((q: { id: string; label: string }) => ({ id: q.id, label: q.label.slice(0, 200) }))
    if (texto.length < 30 || perguntas.length === 0) {
      return json({ error: "sem_texto", message: "Fala um pouco mais sobre você pra eu conseguir preencher." }, 400)
    }

    // Cota (e acesso: sem trial nem plano, a RPC recusa com no_access).
    const { error: cotaErr } = await admin.rpc("bump_ai_quota", { _user: contaId })
    if (cotaErr) {
      const m = cotaErr.message ?? ""
      if (m.includes("quota_exceeded")) return json({ error: "quota_exceeded", message: "Você atingiu o limite de gerações de IA deste mês." }, 429)
      if (m.includes("no_access")) return json({ error: "no_access", message: "Seu acesso não permite usar a IA." }, 402)
      console.error("[brandbook-fala] bump_ai_quota:", m)
      return json({ error: "quota_unavailable", message: "Não foi possível validar sua cota agora." }, 503)
    }

    const sys = `Você recebe a TRANSCRIÇÃO de uma pessoa que cria conteúdo (criadora, profissional ou dona de negócio, no Brasil) falando livremente sobre ela mesma, e distribui o que ela disse nas perguntas do brandbook dela.

REGRAS:
- Só use o que ela REALMENTE DISSE. Pergunta que a fala não responde vem null. NUNCA invente nem complete com suposição: resposta inventada vira legenda errada depois.
- Escreva em primeira pessoa, como se ela mesma tivesse respondido, com as palavras dela sempre que der. Corrija só os tropeços da fala (repetição, "né", "tipo", frase cortada).
- Curto: 1 a 3 frases por resposta.
- A transcrição vem do reconhecimento de voz e pode ter palavra trocada. Trecho sem sentido: ignore em vez de adivinhar.
- Sem travessão e sem markdown.
- Use o id exato de cada pergunta como chave.

RESPONDA APENAS JSON válido:
{"respostas":{"secao/chave":"resposta" | null},"resumo":"1 frase de quem ela é"}`

    const lista = perguntas.map((q) => `${q.id}: ${q.label}`).join("\n")
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 40000)
    let r: Response
    try {
      r = await fetch(GEMINI_URL, {
        method: "POST",
        signal: ac.signal,
        headers: { "Authorization": `Bearer ${gemini}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelo(),
          messages: [
            { role: "system", content: sys },
            { role: "user", content: `PERGUNTAS (id: pergunta):\n${lista}\n\nO QUE ELA FALOU:\n"""${texto}"""` },
          ],
          max_tokens: 3000,
          temperature: 0.2,
        }),
      })
    } finally { clearTimeout(t) }
    if (!r.ok) {
      console.error("[brandbook-fala] gemini", r.status, (await r.text()).slice(0, 300))
      return json({ error: "leitura_falhou", message: "Não consegui organizar sua fala agora." }, 502)
    }
    const j = await r.json()
    const bruto = String(j.choices?.[0]?.message?.content || "")
    const limpo = bruto.replace(/```json/gi, "").replace(/```/g, "").trim()
    const m = limpo.match(/\{[\s\S]*\}/)
    let lido: { respostas?: Record<string, unknown>; resumo?: unknown }
    try { lido = JSON.parse(m ? m[0] : limpo) } catch {
      console.error("[brandbook-fala] json inválido", limpo.slice(0, 300))
      return json({ error: "leitura_falhou", message: "Não consegui organizar sua fala agora." }, 502)
    }

    // Só volta id que foi perguntado e resposta que é texto de verdade.
    const validos = new Set(perguntas.map((q) => q.id))
    const respostas: Record<string, string> = {}
    for (const [k, v] of Object.entries(lido.respostas ?? {})) {
      if (validos.has(k) && typeof v === "string" && v.trim().length > 1) {
        respostas[k] = v.trim().replace(/\s+[—–]\s+/g, ", ").slice(0, 600)
      }
    }
    return json({ result: { respostas, resumo: typeof lido.resumo === "string" ? lido.resumo : null } })
  } catch (e) {
    const abortou = e instanceof DOMException && e.name === "AbortError"
    console.error("[brandbook-fala] erro:", e)
    return json({ error: abortou ? "ai_timeout" : "erro_interno", message: "Não consegui organizar sua fala agora." }, abortou ? 504 : 500)
  }
})
