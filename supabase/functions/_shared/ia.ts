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
      // O gateway usava "google/gemini-2.5-flash"; o Google usa "gemini-2.5-flash".
      if (typeof j.model === "string") j.model = j.model.replace(/^google\//, "");
      body = JSON.stringify(j);
    } catch { /* corpo não é JSON: segue como veio */ }
  }
  return fetch(GEMINI_URL, { ...init, headers, body });
}
