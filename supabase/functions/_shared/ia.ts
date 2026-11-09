/* ═══════════════════════════════════════════════════════════════════════════
   IA DO CRIA: GEMINI DIRETO (01/10/2026, Lovable removida em 13/10/2026)

   Toda chamada de chat da IA passa por iaFetch(IA_URL, ...). O pedido segue o
   formato OpenAI (model, messages) e vai pro endpoint compatível do Google com
   a GEMINI_API_KEY. IA_URL é só um endereço interno: quem chama não precisa
   saber de qual provedor é a IA.
   ═══════════════════════════════════════════════════════════════════════════ */
import { AsyncLocalStorage } from "node:async_hooks";
import { createClient } from "npm:@supabase/supabase-js@2";

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

/* ═══════════════════════════════════════════════════════════════════════════
   CUSTO DA IA (Piloto do admin, 08/11/2026)

   Cada chamada de chat grava uma linha em ia_chamadas (função, conta, modelo,
   tokens e custo). Quem chama não precisa mudar nada: a edge diz uma vez, logo
   depois de saber quem é a pessoa, `definirContextoIA({ funcao, userId,
   contaId })`, e todo iaFetch daquele pedido herda isso (AsyncLocalStorage,
   então dois pedidos ao mesmo tempo no mesmo isolate não se misturam). Também
   dá pra passar o meta direto no 3º parâmetro do iaFetch.

   O registro roda em segundo plano, numa cópia da resposta (clone), e nunca
   lança: log que falha não pode derrubar a IA de ninguém.
   ═══════════════════════════════════════════════════════════════════════════ */
export type MetaIA = { funcao: string; userId?: string | null; contaId?: string | null };
const ctxIA = new AsyncLocalStorage<MetaIA>();

/** Marca o pedido atual: as chamadas de IA dele vão pro ia_chamadas com esse meta. */
export function definirContextoIA(meta: MetaIA) {
  try { ctxIA.enterWith(meta); } catch { /* sem contexto, grava como "desconhecida" */ }
}

/* Preço em USD por 1 milhão de tokens (entrada, saída), tabela padrão (não
   batch) do Google. Conferido em 09/11/2026: o Gemini 3.5 Flash custa 5x o
   2.5 na entrada (1,50 contra 0,30) e o Flash-Lite 3x (0,30 contra 0,10).
   Antes daqui o custo da IA no Piloto saía subestimado. Dá pra trocar sem
   mexer no código pelo segredo IA_PRECOS_JSON, ex:
   {"gemini-3.5-flash":[1.5,9],"gemini-3.5-flash-lite":[0.3,2.5]} */
const PRECOS_PADRAO: Record<string, [number, number]> = {
  "gemini-3.5-flash": [1.50, 9.00],
  "gemini-3.5-flash-lite": [0.30, 2.50],
  "gemini-2.5-flash": [0.30, 2.50],
  "gemini-2.5-flash-lite": [0.10, 0.40],
  "sonar": [1.00, 1.00],
  "sonar-pro": [3.00, 15.00],
};
function precoDe(modelo: string): [number, number] | null {
  let tabela = PRECOS_PADRAO;
  try {
    const extra = Deno.env.get("IA_PRECOS_JSON");
    if (extra) tabela = { ...PRECOS_PADRAO, ...JSON.parse(extra) };
  } catch { /* JSON inválido no segredo: fica o padrão */ }
  const nome = modelo.replace(/^(google|models)\//, "");
  return tabela[nome] ?? null;
}

// deno-lint-ignore no-explicit-any
let _svc: any = null;
function svcIA() {
  if (_svc) return _svc;
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  _svc = createClient(url, key, { auth: { persistSession: false } });
  return _svc;
}

async function registrarUso(r: Response, modeloPedido: string, meta: MetaIA | undefined, ms: number, stream: boolean) {
  try {
    const svc = svcIA();
    if (!svc) return;
    let entrada: number | null = null, saida: number | null = null, modelo = modeloPedido;
    if (r.ok && !stream) {
      const j = await r.json().catch(() => null) as { model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number } } | null;
      if (j?.usage) {
        entrada = Number(j.usage.prompt_tokens) || 0;
        saida = Number(j.usage.completion_tokens) || 0;
      }
      if (typeof j?.model === "string" && j.model) modelo = j.model;
    } else {
      await r.body?.cancel().catch(() => {});
    }
    const preco = precoDe(modelo);
    const custo = preco && entrada != null && saida != null
      ? (entrada * preco[0] + saida * preco[1]) / 1_000_000
      : null;
    await svc.from("ia_chamadas").insert({
      user_id: meta?.userId ?? null,
      conta_id: meta?.contaId ?? null,
      funcao: (meta?.funcao ?? "desconhecida").slice(0, 80),
      modelo: modelo.slice(0, 80),
      tokens_entrada: entrada,
      tokens_saida: saida,
      custo_usd: custo,
      ok: r.ok,
      ms: Math.round(ms),
    });
  } catch { /* sem registro, segue */ }
}

/** fetch do chat da IA: IA_URL vai pro Gemini; qualquer outro endereço é um fetch comum.
 *  Chat do Gemini e da Perplexity ficam registrados em ia_chamadas (ver acima). */
export async function iaFetch(url: string, init: RequestInit, meta?: MetaIA): Promise<Response> {
  const m = meta ?? ctxIA.getStore();
  const t0 = performance.now();
  const r = await iaFetchCru(url, init);
  if (url === IA_URL || /api\.perplexity\.ai\/chat/.test(url)) {
    let modelo = "", stream = false;
    try {
      const j = typeof init.body === "string" ? JSON.parse(init.body) : null;
      modelo = typeof j?.model === "string" ? (url === IA_URL ? modeloGemini(j.model) : j.model) : "";
      stream = j?.stream === true;
    } catch { /* corpo não é JSON */ }
    try {
      const tarefa = registrarUso(r.clone(), modelo, m, performance.now() - t0, stream);
      // Na Supabase, waitUntil segura o isolate até o registro terminar,
      // mesmo depois da resposta já ter saído pra pessoa.
      // deno-lint-ignore no-explicit-any
      const er = (globalThis as any).EdgeRuntime;
      if (er?.waitUntil) er.waitUntil(tarefa); else void tarefa;
    } catch { /* clone falhou: sem registro */ }
  }
  return r;
}

async function iaFetchCru(url: string, init: RequestInit): Promise<Response> {
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
  /* reasoning_effort (09/11/2026) controla quanto o modelo pensa. Se algum
     modelo recusar o campo com 400, repete sem ele em vez de quebrar. */
  if (r.status === 400 && pedido && "reasoning_effort" in pedido && !init.signal?.aborted) {
    console.warn("[ia] gemini recusou reasoning_effort em", pedido.model, "- repetindo sem");
    await r.body?.cancel();
    const { reasoning_effort: _re, ...semEsforco } = pedido;
    pedido = semEsforco;
    body = JSON.stringify(semEsforco);
    r = await fetch(GEMINI_URL, { ...init, headers, body });
  }
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
