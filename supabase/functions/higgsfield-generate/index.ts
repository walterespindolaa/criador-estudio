// Cria Estúdio — gera prompts de imagem (com a marca do usuário) e dispara no
// Higgsfield (modelo Soul). Assíncrono: action "generate" cria o job + envia à fila;
// action "poll" consulta o status e traz as imagens prontas. Admin-only.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const HF_BASE = "https://platform.higgsfield.ai";
// API v1 do Higgsfield (Soul text-to-image). Endpoint e formato conforme SDK oficial
// (github.com/higgsfield-ai/higgsfield-js). Antes usávamos endpoint/params inexistentes → 422.
const HF_SOUL_ENDPOINT = "/v1/text2image/soul";

// Autenticação oficial (SDK v2): "Authorization: Key KEY_ID:KEY_SECRET".
function hfHeaders(): Record<string, string> {
  const key = Deno.env.get("HIGGSFIELD_API_KEY") ?? "";
  const secret = Deno.env.get("HIGGSFIELD_API_SECRET") ?? "";
  return {
    "Authorization": `Key ${key}:${secret}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "cria-studio/1.0",
  };
}

// aspect_ratio da UI → width_and_height suportado pelo Soul (valores reais do SDK).
const SOUL_SIZE: Record<string, string> = {
  "1:1": "1536x1536",
  "4:5": "1536x2048",
  "9:16": "1152x2048",
  "16:9": "2048x1152",
  "2:3": "1344x2016",
  "3:2": "2016x1344",
};
const soulSize = (aspect: string): string => SOUL_SIZE[aspect] ?? "1536x2048";
// resolução da UI → quality do Soul (só 720p/1080p).
const soulQuality = (res: string): string => (res.includes("720") ? "720p" : "1080p");

// Perplexity (sonar) — pesquisa web atual com fontes. Fail-soft: sem chave/erro → "".
async function pplx(userPrompt: string): Promise<string> {
  const key = Deno.env.get("PERPLEXITY_API_KEY");
  if (!key) return "";
  try {
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "Você é um pesquisador de tendências de conteúdo para redes sociais no Brasil. Responda em português, com dados recentes e verificáveis, sempre citando a fonte." },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3, max_tokens: 900,
      }),
    });
    if (!r.ok) { console.error("[pplx] error", r.status, (await r.text()).slice(0, 200)); return ""; }
    const j = await r.json();
    return String(j.choices?.[0]?.message?.content || "");
  } catch (e) { console.error("[pplx] fetch failed", e); return ""; }
}

function extractJson(raw: string): string {
  let s = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const st = s.indexOf("{"); const en = s.lastIndexOf("}");
  if (st >= 0 && en > st) s = s.slice(st, en + 1);
  return s;
}

// Texto livre via Lovable AI (Gemini). Lança erro "ai_not_configured" / "ai_failed:...".
async function aiText(sys: string, usr: string, maxTokens = 1200): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("ai_not_configured");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST", headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "system", content: sys }, { role: "user", content: usr }], max_tokens: maxTokens, temperature: 0.5 }),
  });
  if (!r.ok) throw new Error(`ai_failed:IA ${r.status}`);
  const j = await r.json();
  return String(j.choices?.[0]?.message?.content || "");
}

type Page = { role: string; screen_text: string; prompt: string; request_id?: string; image_url?: string; status?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const svc: SupabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: prof } = await svc.from("profiles").select("role, niche, name").eq("id", user.id).single();
    if (prof?.role !== "admin") return json({ error: "forbidden", message: "Cria Estúdio é admin-only." }, 403);

    if (!Deno.env.get("HIGGSFIELD_API_KEY") || !Deno.env.get("HIGGSFIELD_API_SECRET")) {
      return json({ error: "higgsfield_not_configured", message: "Faltam os secrets HIGGSFIELD_API_KEY / HIGGSFIELD_API_SECRET." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "generate");

    // ── POLL ──────────────────────────────────────────────
    if (action === "poll") {
      const jobId = String(body?.job_id ?? "");
      if (!jobId) return json({ error: "missing_job_id" }, 400);
      const { data: job } = await svc.from("higgsfield_jobs").select("*").eq("id", jobId).maybeSingle();
      if (!job || (job as any).user_id !== user.id) return json({ error: "forbidden_job" }, 403);
      const pages: Page[] = ((job as any).pages ?? []) as Page[];

      for (const pg of pages) {
        if (!pg.request_id || pg.image_url || pg.status === "failed" || pg.status === "nsfw" || pg.status === "canceled") continue;
        try {
          // Oficial: GET /requests/{request_id}/status → { status, images:[{url}], video:{url} }.
          const r = await fetch(`${HF_BASE}/requests/${pg.request_id}/status`, { headers: hfHeaders() });
          if (!r.ok) { pg.status = `err_${r.status}`; continue; }
          const j = await r.json();
          pg.status = j.status || pg.status;
          const url = j.images?.[0]?.url || j.image?.url
            || j.jobs?.[0]?.results?.raw?.url || j.jobs?.[0]?.results?.min?.url || null;
          if (url) pg.image_url = url;
        } catch (e) { console.error("[higgsfield] poll error", e); }
      }

      const done = pages.every((p) => p.image_url || p.status === "failed" || p.status === "nsfw" || p.status === "canceled" || (p.status || "").startsWith("err_"));
      const anyImg = pages.some((p) => p.image_url);
      const status = done ? (anyImg ? "done" : "error") : "running";
      await svc.from("higgsfield_jobs").update({ pages, status, finished_at: done ? new Date().toISOString() : null }).eq("id", jobId);
      return json({ job_id: jobId, status, pages });
    }

    // ── TEMAS EM ALTA (Perplexity) ────────────────────────
    if (action === "hot_themes") {
      const niche = (String(body?.niche ?? "").trim() || prof?.niche || "geral");
      const topic = String(body?.topic ?? "").trim().slice(0, 200);
      const raw = await pplx(`Liste 5 temas/ganchos de conteúdo EM ALTA agora (últimas 2 semanas) para Instagram (carrossel/estático)${topic ? `, todos DIRETAMENTE relacionados ao assunto "${topic}"` : ` no nicho "${niche}"`} (contexto do criador: nicho ${niche}). Cada um: um título curto e chamativo + uma frase do porquê está quente agora${topic ? ` e como conecta com "${topic}"` : ""}. Responda SOMENTE JSON: {"themes":[{"titulo":"...","porque":"..."}]}`);
      if (!raw) return json({ error: "pplx_unavailable", message: "Perplexity indisponível (sem chave ou erro)." }, 502);
      let themes: Array<{ titulo?: string; porque?: string }> = [];
      try { themes = (JSON.parse(extractJson(raw)).themes ?? []); } catch { /* fallback abaixo */ }
      if (themes.length === 0) {
        themes = raw.split("\n").map((l) => l.replace(/^[\d\-\*\.\)\s]+/, "").trim()).filter(Boolean).slice(0, 5).map((t) => ({ titulo: t }));
      }
      return json({ ok: true, themes: themes.slice(0, 6) });
    }

    // ── NEWSJACKING (Perplexity) ──────────────────────────
    if (action === "news") {
      const niche = (String(body?.niche ?? "").trim() || prof?.niche || "geral");
      const topic = String(body?.topic ?? "").trim().slice(0, 200);
      const raw = await pplx(`Traga UMA notícia ou acontecimento RECENTE (últimos 7 dias)${topic ? ` DIRETAMENTE relacionado ao assunto "${topic}"` : ` relevante para o nicho "${niche}"`} (contexto do criador: nicho ${niche}), que renda um carrossel de Instagram. Se não houver notícia ligada ao assunto, traga a mais próxima possível dele. Responda SOMENTE JSON: {"titulo":"manchete curta","resumo":"2 frases","angulo":"como transformar isso num carrossel conectado a ${topic || niche} (gancho)","fonte":"nome ou url"}`);
      if (!raw) return json({ error: "pplx_unavailable", message: "Perplexity indisponível." }, 502);
      let news: Record<string, string> = {};
      try { news = JSON.parse(extractJson(raw)); } catch { news = { titulo: raw.slice(0, 120), resumo: raw.slice(0, 400) }; }
      return json({ ok: true, news });
    }

    // ── Parâmetros comuns ─────────────────────────────────
    const title = String(body?.title ?? "").trim();
    const format = body?.format === "estatico" ? "estatico" : "carrossel";
    const slides = format === "estatico" ? 1 : Math.max(2, Math.min(10, Number(body?.slides) || 6));
    const aspect = String(body?.aspect_ratio ?? "4:5");
    const resolution = String(body?.resolution ?? "1080p");
    const postId = body?.post_id ? String(body.post_id) : null;
    // Conteúdo já escrito no Cria Plano (roteiro/legenda do post) — vira a espinha dorsal dos slides.
    const sourceContent = String(body?.source_content ?? "").trim().slice(0, 4000);
    // Pesquisa atual do Perplexity (dados/estatísticas com fonte), preenchida sob demanda no draft.
    let extraResearch = "";

    // Contexto RICO da marca — igual o Cria IA usa (perfil + pilares + persona + Brandbook).
    // Sem isso o modelo alucina em títulos metafóricos (ex.: "Atlas" vira atlas geográfico).
    const [brandRes, pillarsRes, personaRes, moodRes] = await Promise.all([
      svc.from("brand_items").select("type, name").eq("user_id", user.id),
      svc.from("pillars").select("name").eq("user_id", user.id).order("position"),
      svc.from("personas").select("name, age_range, pain_points, interests").eq("user_id", user.id).limit(1),
      svc.from("moodboard_entries").select("section, question_key, answer").eq("user_id", user.id),
    ]);
    const bi = brandRes.data ?? [];
    const pick = (t: string) => bi.filter((b: any) => b.type === t).map((b: any) => b.name);
    const cores = pick("cor").join(", ");
    const fontes = pick("fonte").join(", ");
    const tom = pick("tom").join(", ");
    const arquetipo = pick("arquetipo").join(", ");
    const expressoes = pick("expressao").join(", ");
    const evitar = pick("evitar").join(", ");
    const pilares = (pillarsRes.data ?? []).map((p: any) => p.name).join(", ");
    const persona = (personaRes.data ?? [])[0] as any;
    const brandbook = (moodRes.data ?? [])
      .filter((e: any) => e.answer && String(e.answer).trim())
      .map((e: any) => `- ${e.answer}`).join("\n").slice(0, 1400);

    const brandCtx = `Criador: ${prof?.name || "-"} · Nicho: ${prof?.niche || "geral"}
${pilares ? `Pilares de conteúdo: ${pilares}` : ""}
Tom de voz: ${tom || "direto e autêntico"}${arquetipo ? ` · Arquétipo: ${arquetipo}` : ""}
${expressoes ? `Expressões da marca: ${expressoes}` : ""}${evitar ? `\nEvitar: ${evitar}` : ""}
Paleta (pro visual): ${cores || "(livre, moderna)"} · Fontes: ${fontes || "sans-serif moderna"}
${persona ? `Público: ${persona.name || "principal"}${persona.pain_points?.length ? ` · Dores: ${persona.pain_points.join(", ")}` : ""}${persona.interests?.length ? ` · Interesses: ${persona.interests.join(", ")}` : ""}` : ""}
${brandbook ? `\nO QUE A MARCA/PRODUTO REALMENTE É (Brandbook do criador — esta é a FONTE DA VERDADE sobre o produto; use pra entender o tema, não invente):\n${brandbook}` : ""}`.trim();

    // IA escreve os textos dos slides + prompts (capa forte + âncora de estilo).
    async function writePages(): Promise<Array<{ role?: string; screen_text?: string; prompt?: string }>> {
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableKey) throw new Error("ai_not_configured");
      const sys = `Você é diretor de arte + copywriter especialista em carrosséis de Instagram no Brasil. Escreve o texto de cada slide E o prompt de imagem pro Higgsfield (modelo Soul, text-to-image), mantendo IDENTIDADE VISUAL consistente. Você NUNCA inventa fatos sobre a marca/produto: usa só o CONTEXTO DA MARCA, o roteiro e a pesquisa. Responda SOMENTE JSON válido.`;
      const usr = `CONTEXTO DA MARCA (entenda o que a marca/produto É antes de escrever):
${brandCtx}

TEMA/IDEIA DO POST: ${title}
FORMATO: ${format === "carrossel" ? `carrossel de ${slides} páginas` : "imagem estática única"}
${sourceContent ? `\nROTEIRO/LEGENDA JÁ ESCRITOS (FONTE DA VERDADE do conteúdo — fatie e enxugue ISSO; não troque de assunto):\n${sourceContent}\n` : ""}${extraResearch ? `\nPESQUISA ATUAL (dados/estatísticas reais com fonte — INCORPORE nos slides pra dar autoridade; cite o número no texto):\n${extraResearch}\n` : ""}
ENTENDIMENTO DO TEMA (crítico):
- O TÍTULO pode ser METAFÓRICO ou poético. NÃO interprete ao pé da letra. Ex.: se o título fala em "mapa/atlas" mas a marca é de finanças, o tema é FINANÇAS, não geografia.
- Descubra o tema real cruzando o CONTEXTO DA MARCA + o ROTEIRO. Na dúvida, siga o roteiro e o que a marca vende.
- Se faltar informação concreta, fique no que o roteiro/marca já dizem — NÃO invente estatística, história ou fato.

REGRAS DE ESCRITA:
- Cada "screen_text" tem que ser CONCRETO e específico ao produto/tema — nada de frase vaga tipo "alcance seus objetivos" ou "sem surpresas". Diga algo real e útil.
- CAPA (página 1): gancho forte que para o scroll, conectado ao tema real.
- Demais páginas: desenvolvem a ideia (contexto → benefício concreto → prova/exemplo → CTA claro), no mesmo estilo.
- "prompt": em INGLÊS. Inclua a paleta (cite as cores), estilo, mood, enquadramento e "clean space for text overlay". Coerente com o tema REAL (ex.: finanças = interface/gráficos/organização, não mapas-múndi).

Responda:
{"pages":[{"role":"capa|desenvolvimento|prova|cta","screen_text":"texto PT curto e concreto","prompt":"image prompt in English"}]}
Gere EXATAMENTE ${slides} página(s).`;
      const air = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST", headers: { "Authorization": `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "system", content: sys }, { role: "user", content: usr }], max_tokens: 4096, temperature: 0.4 }),
      });
      if (!air.ok) { console.error("[higgsfield] prompt gen error", air.status); throw new Error(`prompt_gen_failed:IA ${air.status}`); }
      const aj = await air.json();
      let s = String(aj.choices?.[0]?.message?.content || "").replace(/```json/gi, "").replace(/```/g, "").trim();
      const st = s.indexOf("{"); const en = s.lastIndexOf("}");
      if (st >= 0 && en > st) s = s.slice(st, en + 1);
      let parsed: { pages?: Array<{ role?: string; screen_text?: string; prompt?: string }> } = {};
      try { parsed = JSON.parse(s); } catch { throw new Error(`prompt_parse_failed:${s.slice(0, 120)}`); }
      return (parsed.pages ?? []).slice(0, slides);
    }

    // ── REELS SCRIPT ───────────────────────────────────────
    // Roteiro de reels/shorts marcado por tempo, pra você fatiar dentro do sistema. Não usa Higgsfield.
    if (action === "reels_script") {
      if (!title) return json({ error: "missing_title", message: "Escolha um post ou digite um tema." }, 400);
      const seconds = Math.max(10, Math.min(180, Number(body?.seconds) || 30));
      if (body?.enrich) {
        const niche = prof?.niche || "geral";
        const research = await pplx(`Sobre "${title}" (nicho ${niche}): dados/fatos atuais e verificáveis com fonte pra citar num reels. 3 a 5 bullets curtos.`);
        if (research) extraResearch = research.slice(0, 1500);
      }
      const sys = `Você é roteirista de Reels/Shorts para o Brasil. Escreve roteiros prontos pra gravar, com marcação de tempo, falas diretas e indicação do que mostrar na tela. Você NUNCA inventa fatos sobre a marca/produto — usa só o contexto, o roteiro e a pesquisa.`;
      const usr = `CONTEXTO DA MARCA (entenda o que a marca/produto É):
${brandCtx}

TEMA: ${title}
DURAÇÃO ALVO: ${seconds} segundos
${sourceContent ? `ROTEIRO/LEGENDA JÁ ESCRITOS (FONTE DA VERDADE — use como espinha dorsal, não troque de assunto):\n${sourceContent}\n` : ""}${extraResearch ? `PESQUISA ATUAL (cite os dados no roteiro):\n${extraResearch}\n` : ""}
IMPORTANTE: o TÍTULO pode ser metafórico — NÃO interprete ao pé da letra. Descubra o tema real cruzando o contexto da marca + o roteiro. Não invente fatos.

Entregue um ROTEIRO fatiado por blocos de tempo cobrindo ~${seconds}s:
- Gancho (0-3s) forte que segura o scroll
- Desenvolvimento em 2 a 4 blocos, cada um com faixa de tempo aproximada
- CTA no final
Para cada bloco use o formato: [0-3s] FALA/AÇÃO — o que mostrar na tela.
Português, direto, sem enrolação, sem markdown pesado.`;
      let script: string;
      try { script = await aiText(sys, usr, 1400); }
      catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const [code, detail] = msg.split(":");
        return json({ error: code || "ai_failed", message: detail || msg }, code === "ai_not_configured" ? 500 : 502);
      }
      if (!script.trim()) return json({ error: "empty_script", message: "A IA não retornou roteiro. Tente de novo." }, 502);
      return json({ ok: true, script: script.trim(), seconds, enriched: !!extraResearch });
    }

    // ── DRAFT ──────────────────────────────────────────────
    // Só monta os textos dos slides + prompts pra você revisar. NÃO dispara no Higgsfield.
    if (action === "draft") {
      if (!title) return json({ error: "missing_title", message: "Escolha um post ou digite um tema." }, 400);
      // Enriquecimento opcional: puxa dados atuais do Perplexity pra dar autoridade aos slides.
      if (body?.enrich) {
        const niche = prof?.niche || "geral";
        const research = await pplx(`Sobre o tema "${title}" (nicho ${niche}): traga dados, estatísticas, números e exemplos ATUAIS e verificáveis, cada um com a fonte, que dariam autoridade a um carrossel de Instagram. Responda em 4 a 6 bullets curtos.`);
        if (research) extraResearch = research.slice(0, 2000);
      }
      let drafted: Array<{ role?: string; screen_text?: string; prompt?: string }>;
      try { drafted = await writePages(); }
      catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const [code, detail] = msg.split(":");
        return json({ error: code || "draft_failed", message: detail || msg }, code === "ai_not_configured" ? 500 : 502);
      }
      if (drafted.length === 0) return json({ error: "no_prompts", message: "A IA não retornou páginas. Tente de novo." }, 500);
      const pages = drafted.map((p, i) => ({
        role: p.role || (i === 0 ? "capa" : "pagina"),
        screen_text: p.screen_text || "",
        prompt: p.prompt || title,
      }));
      return json({ ok: true, pages, format, slides, aspect_ratio: aspect, resolution, enriched: !!extraResearch });
    }

    // ── GENERATE ──────────────────────────────────────────
    if (!title) return json({ error: "missing_title" }, 400);

    // Se vieram páginas revisadas do front, usa elas. Senão, a IA escreve na hora (retrocompat).
    const reviewed = Array.isArray(body?.pages) ? (body.pages as Array<{ role?: string; screen_text?: string; prompt?: string }>) : null;
    let rawPages: Array<{ role?: string; screen_text?: string; prompt?: string }>;
    if (reviewed && reviewed.length > 0) {
      rawPages = reviewed.slice(0, slides);
    } else {
      try { rawPages = await writePages(); }
      catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const [code, detail] = msg.split(":");
        return json({ error: code || "prompt_gen_failed", message: detail || msg }, code === "ai_not_configured" ? 500 : 502);
      }
    }
    if (rawPages.length === 0) return json({ error: "no_prompts" }, 500);

    // 2) Dispara cada página no Higgsfield. POST /v1/text2image/soul com o corpo PLANO (SDK oficial).
    const pages: Page[] = [];
    let firstErrDetail = "";
    for (const rp of rawPages) {
      const prompt = String(rp.prompt || title).slice(0, 1500);
      try {
        const r = await fetch(`${HF_BASE}${HF_SOUL_ENDPOINT}`, {
          method: "POST",
          headers: hfHeaders(),
          body: JSON.stringify({ params: {
            prompt,
            width_and_height: soulSize(aspect),
            quality: soulQuality(resolution),
            batch_size: 1,
            enhance_prompt: true,
          } }),
        });
        const txt = await r.text();
        let jr: any = {};
        try { jr = JSON.parse(txt); } catch { /* ignore */ }
        if (!r.ok) {
          console.error("[higgsfield] submit error", r.status, txt.slice(0, 400));
          if (!firstErrDetail) firstErrDetail = `${r.status}: ${txt.slice(0, 300)}`;
          pages.push({ role: rp.role || "pagina", screen_text: rp.screen_text || "", prompt, status: `err_${r.status}`, image_url: undefined });
        } else {
          // Resposta oficial: { request_id, status, status_url, ... }.
          const reqId = jr.request_id || jr.id || jr.jobs?.[0]?.id;
          pages.push({ role: rp.role || "pagina", screen_text: rp.screen_text || "", prompt, request_id: reqId, status: jr.status || "queued" });
        }
      } catch (e) {
        console.error("[higgsfield] submit exception", e);
        if (!firstErrDetail) firstErrDetail = String(e).slice(0, 200);
        pages.push({ role: rp.role || "pagina", screen_text: rp.screen_text || "", prompt, status: "err_exception" });
      }
    }

    const anyQueued = pages.some((p) => p.request_id);
    const { data: jobRow, error: insErr } = await svc.from("higgsfield_jobs").insert({
      user_id: user.id, title, format, aspect_ratio: aspect, resolution, post_id: postId,
      status: anyQueued ? "running" : "error", pages,
      error: anyQueued ? null : "Nenhuma página foi aceita pelo Higgsfield — confira a chave/plano.",
    }).select("id").single();
    if (insErr || !jobRow) return json({ error: "job_create_failed" }, 500);

    // Se nada foi pra fila, devolve o erro real da API (inclui o corpo da resposta) pra diagnóstico.
    if (!anyQueued) {
      const firstErr = pages.find((p) => (p.status || "").startsWith("err_"))?.status;
      const hint = firstErr === "err_401" || firstErr === "err_403"
        ? "Chave/secret inválidos ou sem créditos."
        : firstErr === "err_422"
        ? "Parâmetros recusados pela API."
        : "Erro na chamada.";
      return json({ error: "higgsfield_rejected", message: `Higgsfield recusou (${firstErr}). ${hint}${firstErrDetail ? ` — Detalhe: ${firstErrDetail}` : ""}`, job_id: jobRow.id }, 502);
    }

    return json({ ok: true, job_id: jobRow.id, status: "running", pages });
  } catch (e) {
    console.error("[higgsfield-generate] unhandled", e);
    return json({ error: "internal_error", message: e instanceof Error ? e.message : String(e) }, 500);
  }
});
