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
const HF_MODEL = "higgsfield-ai/soul/standard";

function hfAuth(): string {
  const key = Deno.env.get("HIGGSFIELD_API_KEY");
  const secret = Deno.env.get("HIGGSFIELD_API_SECRET");
  return `Key ${key}:${secret}`;
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
        if (!pg.request_id || pg.image_url || pg.status === "failed" || pg.status === "nsfw") continue;
        try {
          const r = await fetch(`${HF_BASE}/requests/${pg.request_id}/status`, { headers: { "Authorization": hfAuth(), "Accept": "application/json" } });
          if (!r.ok) { pg.status = `err_${r.status}`; continue; }
          const j = await r.json();
          pg.status = j.status || pg.status;
          const url = j.images?.[0]?.url || j.image?.url || j.video?.url || null;
          if (url) pg.image_url = url;
        } catch (e) { console.error("[higgsfield] poll error", e); }
      }

      const done = pages.every((p) => p.image_url || p.status === "failed" || p.status === "nsfw" || (p.status || "").startsWith("err_"));
      const anyImg = pages.some((p) => p.image_url);
      const status = done ? (anyImg ? "done" : "error") : "running";
      await svc.from("higgsfield_jobs").update({ pages, status, finished_at: done ? new Date().toISOString() : null }).eq("id", jobId);
      return json({ job_id: jobId, status, pages });
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

    // Contexto de marca (moodboard) do usuário.
    const { data: brand } = await svc.from("brand_items").select("type, name").eq("user_id", user.id);
    const bi = brand ?? [];
    const cores = bi.filter((b: any) => b.type === "cor").map((b: any) => b.name).join(", ");
    const fontes = bi.filter((b: any) => b.type === "fonte").map((b: any) => b.name).join(", ");
    const tom = bi.filter((b: any) => b.type === "tom").map((b: any) => b.name).join(", ");
    const brandCtx = `Nicho: ${prof?.niche || "geral"}. Paleta: ${cores || "(livre, moderna)"}. Fontes: ${fontes || "sans-serif moderna"}. Tom: ${tom || "direto e autêntico"}.`;

    // IA escreve os textos dos slides + prompts (capa forte + âncora de estilo).
    async function writePages(): Promise<Array<{ role?: string; screen_text?: string; prompt?: string }>> {
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableKey) throw new Error("ai_not_configured");
      const sys = `Você é diretor de arte especialista em carrosséis de Instagram. Escreve o texto de cada slide E o prompt de imagem pro Higgsfield (modelo Soul, text-to-image), mantendo IDENTIDADE VISUAL consistente entre as páginas. Responda SOMENTE JSON válido.`;
      const usr = `MARCA (use a MESMA paleta e estilo em TODAS as páginas — "âncora de estilo"):
${brandCtx}

TEMA/IDEIA: ${title}
FORMATO: ${format === "carrossel" ? `carrossel de ${slides} páginas` : "imagem estática única"}
${sourceContent ? `\nCONTEÚDO JÁ ESCRITO (roteiro/legenda do post — USE ISSO como base do texto dos slides, apenas fatiando/enxugando; NÃO invente um tema diferente):\n${sourceContent}\n` : ""}
REGRAS:
- CAPA (página 1): visual CHAMATIVO e MODERNO, alto contraste, que para o scroll; espaço pro título grande.
- Demais páginas: desenvolvem a ideia (desenvolvimento → prova/exemplo → CTA), no MESMO estilo/paleta da capa.
- "prompt": em INGLÊS (o modelo rende melhor). Inclua a paleta (cite as cores), o estilo, o mood, enquadramento e "clean space for text overlay".
- "screen_text": o texto em PORTUGUÊS que vai na tela daquela página (curto).${sourceContent ? " Baseie-se no CONTEÚDO JÁ ESCRITO acima." : ""}

Responda:
{"pages":[{"role":"capa|desenvolvimento|prova|cta","screen_text":"texto PT curto","prompt":"image prompt in English"}]}
Gere EXATAMENTE ${slides} página(s).`;
      const air = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST", headers: { "Authorization": `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash-lite", messages: [{ role: "system", content: sys }, { role: "user", content: usr }], max_tokens: 4096, temperature: 0.5 }),
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

    // ── DRAFT ──────────────────────────────────────────────
    // Só monta os textos dos slides + prompts pra você revisar. NÃO dispara no Higgsfield.
    if (action === "draft") {
      if (!title) return json({ error: "missing_title", message: "Escolha um post ou digite um tema." }, 400);
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
      return json({ ok: true, pages, format, slides, aspect_ratio: aspect, resolution });
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

    // 2) Dispara cada página no Higgsfield.
    const pages: Page[] = [];
    for (const rp of rawPages) {
      const prompt = String(rp.prompt || title).slice(0, 1500);
      try {
        const r = await fetch(`${HF_BASE}/${HF_MODEL}`, {
          method: "POST",
          headers: { "Authorization": hfAuth(), "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ prompt, aspect_ratio: aspect, resolution }),
        });
        const txt = await r.text();
        let jr: any = {};
        try { jr = JSON.parse(txt); } catch { /* ignore */ }
        if (!r.ok) {
          console.error("[higgsfield] submit error", r.status, txt.slice(0, 300));
          pages.push({ role: rp.role || "pagina", screen_text: rp.screen_text || "", prompt, status: `err_${r.status}`, image_url: undefined });
        } else {
          pages.push({ role: rp.role || "pagina", screen_text: rp.screen_text || "", prompt, request_id: jr.request_id, status: jr.status || "queued" });
        }
      } catch (e) {
        console.error("[higgsfield] submit exception", e);
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

    // Se nada foi pra fila, devolve o erro da primeira página pra diagnóstico.
    if (!anyQueued) {
      const firstErr = pages.find((p) => (p.status || "").startsWith("err_"))?.status;
      return json({ error: "higgsfield_rejected", message: `Higgsfield recusou (${firstErr}). Verifique a chave/secret e o plano.`, job_id: jobRow.id }, 502);
    }

    return json({ ok: true, job_id: jobRow.id, status: "running", pages });
  } catch (e) {
    console.error("[higgsfield-generate] unhandled", e);
    return json({ error: "internal_error", message: e instanceof Error ? e.message : String(e) }, 500);
  }
});
