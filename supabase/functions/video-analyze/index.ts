// ═══════════════════════════════════════════════════════════════════════════
// ANÁLISE PROFUNDA DE VÍDEO (TwelveLabs / Pegasus 1.5)
//
// O Radar já traz o reel do concorrente (Apify): legenda, números, capa e a
// transcrição do áudio. O que faltava era ENXERGAR o vídeo: cortes, texto na
// tela, enquadramento, ritmo, o que segura a atenção. Aqui o vídeo vai pro
// TwelveLabs com um prompt de engenharia reversa e volta em JSON fixo.
//
// Fluxo: start -> cria a linha (queued) -> responde na hora -> o trabalho
// pesado roda em EdgeRuntime.waitUntil (resolver o mp4, mandar pro TwelveLabs,
// salvar). A tela faz polling na tabela video_analyses.
//
// Fase 1 (08/09/2026): SÓ ADMIN. Sem cobrança, sem cota. Primeiro a gente vê o
// que o modelo devolve, depois desenha layout, créditos e pacotes.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const TL_BASE = "https://api.twelvelabs.io/v1.3";
const MAX_BASE64_BYTES = 28 * 1024 * 1024; // teto da API é 30 MB em base64

// O PROMPT: em português, pensado pra social mídia. O schema abaixo manda na
// forma; o prompt manda no olhar (o que observar e como escrever).
const PROMPT = `Você é um diretor criativo sênior de conteúdo pra Instagram e TikTok, fazendo a engenharia reversa de um reel de concorrente pra uma social mídia brasileira reproduzir a fórmula (não o conteúdo) com o cliente dela.

Assista ao vídeo inteiro com atenção a imagem, som, fala e texto na tela. Responda SEMPRE em português do Brasil, direto, sem enrolação, como quem explica pra uma colega de agência. Nada de elogio genérico: cada observação tem que ser algo que dá pra copiar ou evitar.

O que observar:
- Gancho: o que acontece nos primeiros 3 segundos (imagem, fala, texto) e qual técnica está sendo usada (pergunta, promessa, contraste, curiosidade, dor, autoridade, humor, antes/depois etc).
- Estrutura: divida o vídeo em blocos com tempo de início e fim, o que acontece em cada um e a função dele (prender, provar, ensinar, vender, fechar).
- Ritmo: quantos cortes aproximadamente, cadência (lento, médio, frenético), onde a atenção pode cair.
- Texto na tela: liste os textos que aparecem, na ordem.
- Áudio: fala direta pra câmera, narração, só música, trend de áudio; resuma a fala.
- Visual: enquadramento (selfie, tripé, terceiro), cenário, iluminação, cores, estilo de edição (zoom, legendas dinâmicas, b-roll, transições).
- CTA: qual é e onde aparece.
- Por que funciona: 3 a 5 razões concretas.
- Como adaptar: 3 a 5 instruções práticas pra reproduzir a fórmula num cliente de outro nicho (fale de estrutura, não do assunto).
- Notas de 0 a 10 pra gancho, ritmo, clareza e CTA.
- Formato sugerido pra refazer: reels, carrossel, story ou youtube shorts.`;

const SCHEMA = {
  type: "object",
  properties: {
    resumo: { type: "string" },
    gancho: {
      type: "object",
      properties: {
        texto: { type: "string" },
        tecnica: { type: "string" },
        segundos: { type: "number" },
      },
      required: ["texto", "tecnica", "segundos"],
    },
    estrutura: {
      type: "array",
      items: {
        type: "object",
        properties: {
          inicio: { type: "number" },
          fim: { type: "number" },
          o_que_acontece: { type: "string" },
          funcao: { type: "string" },
        },
        required: ["inicio", "fim", "o_que_acontece", "funcao"],
      },
    },
    ritmo: {
      type: "object",
      properties: {
        cortes_estimados: { type: "integer" },
        cadencia: { type: "string" },
        onde_a_atencao_cai: { type: "string" },
      },
      required: ["cortes_estimados", "cadencia", "onde_a_atencao_cai"],
    },
    texto_na_tela: { type: "array", items: { type: "string" } },
    audio: {
      type: "object",
      properties: {
        tipo: { type: "string" },
        fala_resumida: { type: "string" },
        musica: { type: "string" },
      },
      required: ["tipo", "fala_resumida", "musica"],
    },
    visual: {
      type: "object",
      properties: {
        enquadramento: { type: "string" },
        cenario: { type: "string" },
        iluminacao_e_cores: { type: "string" },
        edicao: { type: "string" },
      },
      required: ["enquadramento", "cenario", "iluminacao_e_cores", "edicao"],
    },
    cta: { type: "string" },
    por_que_funciona: { type: "array", items: { type: "string" } },
    como_adaptar: { type: "array", items: { type: "string" } },
    notas: {
      type: "object",
      properties: {
        gancho: { type: "integer", minimum: 0, maximum: 10 },
        ritmo: { type: "integer", minimum: 0, maximum: 10 },
        clareza: { type: "integer", minimum: 0, maximum: 10 },
        cta: { type: "integer", minimum: 0, maximum: 10 },
      },
      required: ["gancho", "ritmo", "clareza", "cta"],
    },
    formato_sugerido: { type: "string" },
  },
  required: ["resumo", "gancho", "estrutura", "ritmo", "texto_na_tela", "audio", "visual", "cta", "por_que_funciona", "como_adaptar", "notas", "formato_sugerido"],
};

// ── Resolver o mp4 ──────────────────────────────────────────────────────────
// O Radar guarda a url do POST, não do arquivo. O CDN do Instagram expira o
// link do mp4 em horas, então a gente pede um fresco ao Apify (run-sync, um
// post só, centavos) sempre que não vier um utilizável.
async function resolverVideoUrl(postUrl: string, videoUrl: string | null, apifyToken: string | null): Promise<string | null> {
  if (videoUrl && await urlViva(videoUrl)) return videoUrl;
  if (!apifyToken) return null;
  try {
    const resp = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=90`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directUrls: [postUrl], resultsType: "posts", resultsLimit: 1 }),
        signal: AbortSignal.timeout(95000),
      },
    );
    if (!resp.ok) return null;
    const itens = await resp.json() as Array<Record<string, unknown>>;
    const it = Array.isArray(itens) ? itens[0] : null;
    const u = it ? String(it.videoUrl || it.video_url || "") : "";
    return u || null;
  } catch {
    return null;
  }
}

async function urlViva(u: string): Promise<boolean> {
  try {
    const r = await fetch(u, { method: "GET", headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(8000) });
    return r.ok || r.status === 206;
  } catch {
    return false;
  }
}

// ── TwelveLabs ──────────────────────────────────────────────────────────────
async function analisar(apiKey: string, video: Record<string, string>) {
  const resp = await fetch(`${TL_BASE}/analyze`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model_name: "pegasus1.5",
      video,
      prompt: PROMPT,
      stream: false,
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_schema", json_schema: SCHEMA },
    }),
    signal: AbortSignal.timeout(170000),
  });
  const texto = await resp.text();
  if (!resp.ok) throw new Error(`twelvelabs ${resp.status}: ${texto.slice(0, 400)}`);
  const out = JSON.parse(texto) as { data?: string; finish_reason?: string; usage?: unknown; error?: { message?: string } };
  return out;
}

// Base64 de um arquivo remoto (fallback quando o TwelveLabs não consegue
// puxar a url do CDN do Instagram direto).
async function baixarBase64(u: string): Promise<string | null> {
  const r = await fetch(u, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) return null;
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.byteLength > MAX_BASE64_BYTES) return null;
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  return btoa(bin);
}

function parseResultado(data: string | undefined): Record<string, unknown> | null {
  if (!data) return null;
  try { return JSON.parse(data); } catch { /* segue */ }
  const m = data.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* segue */ } }
  return null;
}

// ── O trabalho pesado (roda depois da resposta) ─────────────────────────────
async function processar(svc: SupabaseClient, id: string, postUrl: string, videoUrl: string | null, apiKey: string, apifyToken: string | null) {
  const falhar = async (msg: string) => {
    await svc.from("video_analyses").update({ status: "error", error: msg.slice(0, 500), finished_at: new Date().toISOString() }).eq("id", id);
  };
  try {
    await svc.from("video_analyses").update({ status: "running" }).eq("id", id);
    const mp4 = await resolverVideoUrl(postUrl, videoUrl, apifyToken);
    if (!mp4) { await falhar("Não consegui obter o arquivo do vídeo (link do Instagram expirado e sem Apify)."); return; }
    await svc.from("video_analyses").update({ video_url: mp4 }).eq("id", id);

    let out;
    try {
      out = await analisar(apiKey, { type: "url", url: mp4 });
    } catch (e) {
      // O CDN do Instagram às vezes recusa o download feito pelo TwelveLabs.
      // Segundo tiro: a gente baixa e manda os bytes.
      console.warn("[video-analyze] url falhou, tentando base64:", (e as Error).message);
      const b64 = await baixarBase64(mp4);
      if (!b64) throw e;
      out = await analisar(apiKey, { type: "base64_string", base64_string: b64 });
    }

    const resultado = parseResultado(out.data);
    if (!resultado) { await falhar(`Resposta fora do formato (${out.finish_reason ?? "?"}): ${(out.data ?? "").slice(0, 200)}`); return; }
    await svc.from("video_analyses").update({
      status: "done",
      result: resultado,
      usage: { ...(out.usage as Record<string, unknown> ?? {}), finish_reason: out.finish_reason ?? null, truncado: out.finish_reason === "length" },
      finished_at: new Date().toISOString(),
    }).eq("id", id);
  } catch (e) {
    console.error("[video-analyze] falhou:", e);
    await falhar((e as Error).message || "erro desconhecido");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const svc: SupabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const apiKey = Deno.env.get("TWELVELABS_API_KEY");
    if (!apiKey) return json({ error: "twelvelabs_not_configured", message: "TWELVELABS_API_KEY não cadastrada." }, 500);
    const apifyToken = Deno.env.get("APIFY_TOKEN") ?? null;

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    // Tenant efetivo: colaborador atua no gestor (mesma regra do apify-scrape).
    let mgr = user.id;
    const reqMgr = body.manager_id ? String(body.manager_id) : null;
    if (reqMgr && reqMgr !== user.id) {
      const { data: link } = await svc.from("manager_members")
        .select("id").eq("manager_id", reqMgr).eq("member_id", user.id).eq("status", "ativo").maybeSingle();
      if (!link) return json({ error: "forbidden_team" }, 403);
      mgr = reqMgr;
    }

    // FASE 1: só admin. Quem não é recebe 403 com mensagem clara; a tela nem
    // mostra o botão, isto é a trava de verdade.
    const { data: prof } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (prof?.role !== "admin") return json({ error: "forbidden", message: "Análise profunda em teste fechado." }, 403);

    const postUrl = String(body.post_url ?? "").trim();
    if (!/^https?:\/\//i.test(postUrl)) return json({ error: "post_url_invalida" }, 400);
    const videoUrl = body.video_url ? String(body.video_url) : null;
    const thumbnail = body.thumbnail ? String(body.thumbnail) : null;
    const crmClientId = body.crm_client_id ? String(body.crm_client_id) : null;
    const scrapeId = body.scrape_id ? String(body.scrape_id) : null;
    const origem = body.origem === "studio" ? "studio" : "radar";

    // Uma linha por (gestor, post). Rodar de novo reaproveita a linha.
    const { data: linha, error: upErr } = await svc.from("video_analyses").upsert({
      manager_id: mgr, post_url: postUrl, video_url: videoUrl, thumbnail,
      crm_client_id: crmClientId, scrape_id: scrapeId, origem,
      status: "queued", error: null, result: null, usage: null, finished_at: null,
    }, { onConflict: "manager_id,post_url" }).select("id").single();
    if (upErr || !linha) return json({ error: "db", message: upErr?.message }, 500);

    const tarefa = processar(svc, linha.id, postUrl, videoUrl, apiKey, apifyToken);
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(tarefa);
    else await tarefa; // ambiente sem waitUntil (local): roda inline

    return json({ ok: true, id: linha.id });
  } catch (e) {
    console.error("[video-analyze]", e);
    return json({ error: "internal", message: (e as Error).message }, 500);
  }
});
