/* ═══════════════════════════════════════════════════════════════════════════
   IA DO CRIA: GEMINI DIRETO (01/10/2026, Lovable removida em 13/10/2026)

   Toda chamada de chat da IA passa por iaFetch(IA_URL, ...). O pedido segue o
   formato OpenAI (model, messages) e vai pro endpoint compatível do Google com
   a GEMINI_API_KEY. IA_URL é só um endereço interno: quem chama não precisa
   saber de qual provedor é a IA.
   ═══════════════════════════════════════════════════════════════════════════ */
export const IA_URL = "cria://ia/chat";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

/** Chave de IA (Gemini). */
export function chaveIA(): string | undefined {
  return Deno.env.get("GEMINI_API_KEY") ?? undefined;
}

/* MODELO NA CHAVE PRÓPRIA (12/10/2026). Testado na chave nova do AI Studio:
   "models/gemini-2.5-flash-lite is no longer available to new users. Please
   update your code to use models/gemini-3.5-flash-lite". Conta nova no Google
   não tem o 2.5. O código das funções continua
   pedindo "google/gemini-2.5-flash(-lite)" e a troca acontece só aqui.
   Quando o Google aposentar de novo: trocar os segredos GEMINI_MODELO_FLASH /
   GEMINI_MODELO_LITE no painel, sem mexer em código. */
function modeloGemini(pedido: string): string {
  const nome = pedido.replace(/^google\//, "");
  if (/flash-lite/.test(nome)) return Deno.env.get("GEMINI_MODELO_LITE") ?? "gemini-3.5-flash-lite";
  if (/flash/.test(nome)) return Deno.env.get("GEMINI_MODELO_FLASH") ?? "gemini-3.5-flash";
  return nome;
}

/** fetch do chat da IA: IA_URL vai pro Gemini; qualquer outro endereço é um fetch comum. */
export async function iaFetch(url: string, init: RequestInit): Promise<Response> {
  if (url !== IA_URL) return fetch(url, init);
  const gemini = Deno.env.get("GEMINI_API_KEY");
  if (!gemini) throw new Error("GEMINI_API_KEY não configurada");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${gemini}`);
  headers.set("Content-Type", "application/json");
  let body = init.body;
  let pedido: Record<string, unknown> | null = null;
  if (typeof body === "string") {
    try {
      const j = JSON.parse(body);
      // As funções pedem "google/gemini-2.5-flash"; o Google usa "gemini-...".
      if (typeof j.model === "string") j.model = modeloGemini(j.model);
      pedido = j;
      body = JSON.stringify(j);
    } catch { /* corpo não é JSON: segue como veio */ }
  }

  /* GOOGLE SOBRECARREGADO (30/10/2026). O Gemini devolveu 503 "This model is
     currently experiencing high demand" duas vezes seguidas e a pessoa via
     erro ao gerar sugestões de ideia. É passageiro, então: tenta de novo
     depois de 1,5s; se o modelo cheio continuar sobrecarregado, responde com
     o -lite (outro pool de capacidade no Google) em vez de devolver erro. */
  const passageiro = (st: number) => st === 503 || st === 500 || st === 502 || st === 504;
  let r = await fetch(GEMINI_URL, { ...init, headers, body });
  if (!passageiro(r.status) || init.signal?.aborted) return r;
  console.warn("[ia] gemini", r.status, "em", pedido?.model, "- tentando de novo");
  await r.body?.cancel();
  await new Promise((ok) => setTimeout(ok, 1500));
  r = await fetch(GEMINI_URL, { ...init, headers, body });
  if (!passageiro(r.status) || !pedido || init.signal?.aborted) return r;
  const lite = Deno.env.get("GEMINI_MODELO_LITE") ?? "gemini-3.5-flash-lite";
  if (pedido.model === lite) return r;
  console.warn("[ia] gemini", r.status, "de novo - caindo pro", lite);
  await r.body?.cancel();
  return fetch(GEMINI_URL, { ...init, headers, body: JSON.stringify({ ...pedido, model: lite }) });
}
