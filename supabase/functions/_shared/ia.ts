/* ═══════════════════════════════════════════════════════════════════════════
   IA FORA DA LOVABLE (01/10/2026)

   As funções chamavam o gateway de IA da Lovable (ai.gateway.lovable.dev) com
   a LOVABLE_API_KEY, que só existe dentro da Lovable Cloud. Na Supabase própria
   a IA passa a ir direto pro Gemini, pelo endpoint compatível com OpenAI do
   Google (mesmo formato de pedido e de resposta, mesmo modelo de hoje).

   Regra: com GEMINI_API_KEY configurado, tudo vai pro Google; sem ele, segue
   pela Lovable como antes. Assim o mesmo código roda nos dois lados durante
   a migração.
   ═══════════════════════════════════════════════════════════════════════════ */
const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

/** Chave de IA disponível (Gemini direto ou, na Lovable, a chave dela). */
export function chaveIA(): string | undefined {
  return Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("LOVABLE_API_KEY") ?? undefined;
}

/* MODELO NA CHAVE PRÓPRIA (12/10/2026). Testado na chave nova do AI Studio:
   "models/gemini-2.5-flash-lite is no longer available to new users. Please
   update your code to use models/gemini-3.5-flash-lite". A Lovable ainda tinha
   acesso ao 2.5; conta nova no Google, não. O código das funções continua
   pedindo "google/gemini-2.5-flash(-lite)" e a troca acontece só aqui.
   Quando o Google aposentar de novo: trocar os segredos GEMINI_MODELO_FLASH /
   GEMINI_MODELO_LITE no painel, sem mexer em código. */
function modeloGemini(pedido: string): string {
  const nome = pedido.replace(/^google\//, "");
  if (/flash-lite/.test(nome)) return Deno.env.get("GEMINI_MODELO_LITE") ?? "gemini-3.5-flash-lite";
  if (/flash/.test(nome)) return Deno.env.get("GEMINI_MODELO_FLASH") ?? "gemini-3.5-flash";
  return nome;
}

/** fetch do chat da IA. Recebe a mesma chamada de antes e redireciona pro Gemini quando houver chave. */
export async function iaFetch(url: string, init: RequestInit): Promise<Response> {
  const gemini = Deno.env.get("GEMINI_API_KEY");
  if (!gemini || url !== LOVABLE_URL) return fetch(url, init);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${gemini}`);
  headers.set("Content-Type", "application/json");
  let body = init.body;
  if (typeof body === "string") {
    try {
      const j = JSON.parse(body);
      // O gateway usava "google/gemini-2.5-flash"; o Google usa "gemini-...".
      if (typeof j.model === "string") j.model = modeloGemini(j.model);
      body = JSON.stringify(j);
    } catch { /* corpo não é JSON: segue como veio */ }
  }
  return fetch(GEMINI_URL, { ...init, headers, body });
}
