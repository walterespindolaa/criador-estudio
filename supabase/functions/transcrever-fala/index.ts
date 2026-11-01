import { createClient } from "npm:@supabase/supabase-js@2"

/* ═══════════════════════════════════════════════════════════════════════════
   FALA → TEXTO PELA NUVEM (01/11/2026)

   Walter gravou no onboarding e no brandbook pelo Android e pelo iPhone e
   nada aconteceu (no Android apareceu um aviso do próprio celular). O ditado
   usava o reconhecimento de fala do NAVEGADOR, que no celular depende do
   serviço de voz do sistema (Google no Android, Ditado/Siri no iPhone): se
   ele está desligado ou sem o pacote de idioma, não sai nada, e o nosso
   código engolia o erro. No Chrome do computador funciona (testado).

   Agora, fora do Chrome/Edge de computador, o app grava o áudio (MediaRecorder,
   funciona em todo navegador) e manda pra cá. Esta função passa pro Deepgram
   (mesma chave DEEPGRAM_API_KEY do Prompter, que nunca vai pro aparelho) e
   devolve o texto. O áudio não é guardado.

   Entrada: corpo = o áudio (audio/webm, audio/mp4, audio/ogg...), até 8 MB.
   Saída:   { texto }
   Regras:  sessão válida; 60 gravações por hora por pessoa.
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
const MAX_BYTES = 8 * 1024 * 1024

Deno.serve(async (req) => {
  const h = cors(req)
  const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...h, "Content-Type": "application/json" } })
  if (req.method === "OPTIONS") return new Response("ok", { headers: h })
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)

  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
    if (!jwt) return json({ error: "Unauthorized" }, 401)
    const chave = Deno.env.get("DEEPGRAM_API_KEY")
    if (!chave) return json({ error: "sem_chave", message: "A transcrição ainda não está configurada." }, 503)
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const { data: { user }, error: authErr } = await admin.auth.getUser(jwt)
    if (authErr || !user) return json({ error: "Invalid token" }, 401)

    const janela = new Date().toISOString().slice(0, 13)
    const { data: rl, error: rlErr } = await admin.rpc("check_and_increment_rate_limit", {
      _user_id: user.id, _scope: "transcrever-fala", _window_key: janela, _limit: 60,
    })
    const rlRow = Array.isArray(rl) ? rl[0] : rl
    if (rlErr || rlRow?.allowed !== true) return json({ error: "rate_limited", message: "Muitas gravações nesta hora. Tenta de novo daqui a pouco ou digita." }, 429)

    const tipo = (req.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase()
    if (!tipo.startsWith("audio/") && !tipo.startsWith("video/")) return json({ error: "formato", message: "Não recebi áudio." }, 400)
    const audio = new Uint8Array(await req.arrayBuffer())
    if (audio.byteLength < 800) return json({ texto: "" })
    if (audio.byteLength > MAX_BYTES) return json({ error: "grande", message: "Gravação longa demais. Fala em partes menores." }, 413)

    const q = new URLSearchParams({ model: "nova-3", language: "pt-BR", smart_format: "true", punctuate: "true" })
    const r = await fetch(`https://api.deepgram.com/v1/listen?${q}`, {
      method: "POST",
      headers: { "Authorization": `Token ${chave}`, "Content-Type": tipo },
      body: audio,
    })
    if (!r.ok) {
      console.error("[transcrever-fala] deepgram", r.status, (await r.text()).slice(0, 300))
      return json({ error: "transcricao", message: "Não consegui transcrever agora. Tenta de novo ou digita." }, 502)
    }
    const j = await r.json()
    const texto = String(j?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "").trim()
    return json({ texto })
  } catch (e) {
    console.error("[transcrever-fala]", (e as Error).message)
    return json({ error: "erro_interno", message: "Não consegui transcrever agora." }, 500)
  }
})
