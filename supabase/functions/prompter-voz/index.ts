import { createClient } from "npm:@supabase/supabase-js@2"

/* ═══════════════════════════════════════════════════════════════════════════
   PROMPTER QUE SEGUE A FALA (25/10/2026)

   O modo "Por voz" do Cria Prompter só detectava volume: andava enquanto a
   pessoa falava, sem saber em que palavra ela estava. O reconhecimento de fala
   do navegador não serve: no iPhone ele toma o microfone e o vídeo sai mudo.

   Agora o player manda o MESMO áudio que já vai pro gravador para o Deepgram
   (transcrição em tempo real) e casa as palavras com o roteiro. Esta função só
   entrega um TOKEN TEMPORÁRIO do Deepgram: a chave de verdade (segredo
   DEEPGRAM_API_KEY, permissão Member) nunca vai pro aparelho. O token vale
   60 s para ABRIR a conexão; a conexão aberta segue até o player fechar.

   Regras: sessão válida, conta ativa conferida, plano Studio (ou trial, ou
   admin), rajada de 40 tokens por hora (cada play abre uma conexão).

   Entrada: { accountId? }
   Saída:   { token, expira_em }
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

type Perfil = { role?: string | null; plan?: string | null; subscription_status?: string | null; trial_ends_at?: string | null }
/* Mesma regra do deriveTier do front (src/hooks/useTier.ts). */
function ehStudio(p: Perfil | null): boolean {
  if (!p) return false
  if (p.role === "admin") return true
  const s = p.subscription_status
  const temAssinatura = s === "active" || s === "trialing" || s === "past_due" || s === "unpaid"
  if (temAssinatura && p.plan === "studio") return true
  if (p.trial_ends_at && new Date(p.trial_ends_at) > new Date()) return true
  return false
}

Deno.serve(async (req) => {
  const h = cors(req)
  const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...h, "Content-Type": "application/json" } })
  if (req.method === "OPTIONS") return new Response("ok", { headers: h })
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)

  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
    if (!jwt) return json({ error: "Unauthorized" }, 401)
    const url = Deno.env.get("SUPABASE_URL")
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const chave = Deno.env.get("DEEPGRAM_API_KEY")
    if (!url || !service) throw new Error("credenciais ausentes")
    if (!chave) return json({ error: "sem_chave", message: "Transcrição ainda não configurada." }, 503)
    const admin = createClient(url, service)

    const { data: { user }, error: authErr } = await admin.auth.getUser(jwt)
    if (authErr || !user) return json({ error: "Invalid token" }, 401)

    const janela = new Date().toISOString().slice(0, 13)
    const { data: rl, error: rlErr } = await admin.rpc("check_and_increment_rate_limit", {
      _user_id: user.id, _scope: "prompter-voz", _window_key: janela, _limit: 40,
    })
    const rlRow = Array.isArray(rl) ? rl[0] : rl
    if (rlErr || rlRow?.allowed !== true) return json({ error: "rate_limited", message: "Muitas conexões nesta hora. Use a Rolagem por enquanto." }, 429)

    const body = await req.json().catch(() => ({}))
    let contaId = user.id
    const pedida = typeof body?.accountId === "string" ? body.accountId : null
    if (pedida && pedida !== user.id) {
      const { data: pode, error: podeErr } = await admin.rpc("conta_acessivel", { _actor: user.id, _owner: pedida })
      if (podeErr || pode !== true) return json({ error: "forbidden_account" }, 403)
      contaId = pedida
    }

    // Plano: vale o da conta ativa; admin da SESSÃO sempre passa (igual ao front).
    const { data: perfis } = await admin.from("profiles")
      .select("id, role, plan, subscription_status, trial_ends_at")
      .in("id", [...new Set([user.id, contaId])])
    const doUsuario = (perfis ?? []).find((p: { id: string }) => p.id === user.id) as Perfil | undefined
    const daConta = (perfis ?? []).find((p: { id: string }) => p.id === contaId) as Perfil | undefined
    if (!(doUsuario?.role === "admin" || ehStudio(daConta ?? null))) {
      return json({ error: "no_access", message: "O Prompter que segue a fala é do plano Studio." }, 402)
    }

    const r = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: { "Authorization": `Token ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl_seconds: 60 }),
    })
    if (!r.ok) {
      console.error("[prompter-voz] grant", r.status, (await r.text()).slice(0, 300))
      return json({ error: "grant_falhou", message: "Não consegui ligar a transcrição agora." }, 502)
    }
    const j = await r.json()
    return json({ token: j.access_token, expira_em: j.expires_in ?? 60 })
  } catch (e) {
    console.error("[prompter-voz]", (e as Error).message)
    return json({ error: "erro_interno" }, 500)
  }
})
