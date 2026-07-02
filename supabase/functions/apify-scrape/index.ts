// HUB CRIA — dispara um scraper do Apify (Instagram), resume o resultado e gera
// ideias de conteúdo por cliente. Gated: gestor com módulo hub_cria (ou admin).
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function rateOk(svc: SupabaseClient, userId: string, scope: string, limit: number): Promise<boolean> {
  try {
    const windowKey = new Date().toISOString().slice(0, 16);
    const { data, error } = await svc.rpc("check_and_increment_rate_limit", {
      _user_id: userId, _scope: scope, _window_key: windowKey, _limit: limit,
    });
    if (error) return true;
    return data !== false;
  } catch { return true; }
}

const cleanHandle = (s: string) => s.trim().replace(/^@/, "").replace(/\/+$/, "").split("/").pop() || "";

function buildApifyInput(type: string, handle: string, limit: number): Record<string, unknown> {
  const h = cleanHandle(handle);
  if (type === "profile") {
    return { directUrls: [`https://www.instagram.com/${h}/`], resultsType: "details", resultsLimit: 1, addParentData: false };
  }
  if (type === "hashtag") {
    const tag = h.replace(/^#/, "");
    return { directUrls: [`https://www.instagram.com/explore/tags/${tag}/`], resultsType: "posts", resultsLimit: limit, addParentData: false };
  }
  if (type === "comments") {
    // input_handle deve ser a URL do post
    return { directUrls: [handle.trim()], resultsType: "comments", resultsLimit: limit, addParentData: false };
  }
  // posts | reels
  return { directUrls: [`https://www.instagram.com/${h}/`], resultsType: "posts", resultsLimit: limit, addParentData: false };
}

// Resumo compacto do que voltou (top posts por engajamento + distribuição de formato).
function summarize(items: any[], type: string): { summary: Record<string, unknown>; top: any[] } {
  if (type === "profile") {
    const p = items[0] || {};
    return {
      summary: {
        kind: "profile",
        username: p.username, fullName: p.fullName, biography: p.biography,
        followers: p.followersCount, following: p.followsCount, posts: p.postsCount,
        verified: p.verified, private: p.private, isBusiness: p.isBusinessAccount,
        category: p.businessCategoryName ?? p.categoryName ?? null,
        externalUrl: p.externalUrl ?? p.externalUrls?.[0]?.url ?? null,
        url: p.url,
      },
      top: [],
    };
  }
  if (type === "comments") {
    const comments = items.filter((x) => x && (x.text || x.ownerUsername));
    const topC = [...comments].sort((a, b) => (Number(b.likesCount) || 0) - (Number(a.likesCount) || 0)).slice(0, 25);
    return {
      summary: {
        kind: "comments",
        count: comments.length,
        top: topC.map((c) => ({ text: String(c.text || "").slice(0, 220), user: c.ownerUsername, likes: c.likesCount || 0 })),
      },
      top: topC,
    };
  }
  const transcriptOf = (x: any): string =>
    String(x.transcript || x.transcriptText || x.transcription || x.captions || x.text || "").slice(0, 800);
  const posts = items.filter((x) => x && (x.likesCount != null || x.commentsCount != null || transcriptOf(x)));
  const eng = (x: any) => (Number(x.likesCount) || 0) + (Number(x.commentsCount) || 0);
  const top = [...posts].sort((a, b) => eng(b) - eng(a)).slice(0, 8);
  const fmt: Record<string, number> = {};
  for (const x of posts) { const k = x.productType || x.type || "outro"; fmt[k] = (fmt[k] || 0) + 1; }
  const totalLikes = posts.reduce((s, x) => s + (Number(x.likesCount) || 0), 0);
  const totalComments = posts.reduce((s, x) => s + (Number(x.commentsCount) || 0), 0);
  return {
    summary: {
      kind: type,
      count: posts.length,
      avg_likes: posts.length ? Math.round(totalLikes / posts.length) : 0,
      avg_comments: posts.length ? Math.round(totalComments / posts.length) : 0,
      formats: fmt,
      top: top.map((x) => ({
        caption: (x.caption || "").slice(0, 140),
        likes: x.likesCount, comments: x.commentsCount,
        views: x.videoPlayCount ?? x.videoViewCount ?? null,
        format: x.productType || x.type, url: x.url,
        music: x.musicInfo?.song_name ?? null,
        transcript: type === "transcription" ? transcriptOf(x).slice(0, 300) : undefined,
      })),
    },
    top,
  };
}

serve(async (req) => {
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

    if (!(await rateOk(svc, user.id, "apify-scrape", 10))) {
      return json({ error: "rate_limited", message: "Muitos scrapes seguidos. Aguarde um minuto." }, 429);
    }

    // Gate: admin OU módulo hub_cria ativo.
    const { data: prof } = await svc.from("profiles").select("role, niche").eq("id", user.id).single();
    let allowed = prof?.role === "admin";
    if (!allowed) {
      const { data: ent } = await svc.from("module_entitlements")
        .select("id").eq("manager_id", user.id).eq("module_code", "hub_cria").eq("status", "active").maybeSingle();
      allowed = !!ent;
    }
    if (!allowed) return json({ error: "forbidden", message: "Módulo HUB CRIA não liberado para esta conta." }, 403);

    const body = await req.json().catch(() => ({}));
    const type = String(body?.type ?? "posts");
    const inputHandle = String(body?.input ?? "").trim();
    const crmClientId = body?.crm_client_id ? String(body.crm_client_id) : null;
    const limit = Math.max(1, Math.min(20, Number(body?.limit) || 10));
    if (!inputHandle) return json({ error: "missing_input" }, 400);
    if (!["posts", "reels", "profile", "hashtag", "comments", "transcription"].includes(type)) return json({ error: "invalid_type" }, 400);

    // Cliente precisa ser do gestor.
    let client: Record<string, any> | null = null;
    if (crmClientId) {
      const { data: c } = await svc.from("crm_clients")
        .select("id, manager_id, segment, name, persona, brand_core, cria_owner_id")
        .eq("id", crmClientId).maybeSingle();
      if (!c || (c as { manager_id?: string }).manager_id !== user.id) return json({ error: "forbidden_client" }, 403);
      client = c as Record<string, any>;
    }

    const apifyToken = Deno.env.get("APIFY_TOKEN");
    if (!apifyToken) return json({ error: "apify_not_configured" }, 500);

    // Cria o job.
    const { data: scrapeRow, error: insErr } = await svc.from("competitor_scrapes").insert({
      manager_id: user.id, crm_client_id: crmClientId, scrape_type: type,
      input_handle: inputHandle, results_limit: limit, status: "running",
    }).select("id").single();
    if (insErr || !scrapeRow) return json({ error: "job_create_failed" }, 500);
    const scrapeId = scrapeRow.id;

    try {
      // Transcrição usa um actor dedicado (scrape de reels + Whisper); o resto usa o instagram-scraper.
      const isTranscript = type === "transcription";
      const actor = isTranscript ? "makework36~instagram-reels-transcript-scraper" : "apify~instagram-scraper";
      const input = isTranscript
        ? { profiles: [cleanHandle(inputHandle)], maxPostsPerProfile: limit, onlyVideos: true, transcribe: true, language: "pt" }
        : buildApifyInput(type, inputHandle, limit);
      const apifyUrl = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${apifyToken}&maxItems=${limit}`;
      const resp = await fetch(apifyUrl, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
      });
      if (!resp.ok) {
        const t = await resp.text();
        console.error("[apify-scrape] apify error", resp.status, t.slice(0, 300));
        await svc.from("competitor_scrapes").update({ status: "error", error: `apify ${resp.status}`, finished_at: new Date().toISOString() }).eq("id", scrapeId);
        return json({ error: "apify_failed", message: `Apify retornou ${resp.status}.` }, 502);
      }
      const items = await resp.json() as any[];
      const { summary, top } = summarize(Array.isArray(items) ? items : [], type);
      const costUsd = Number(((Array.isArray(items) ? items.length : 0) * (type === "transcription" ? 0.015 : 0.0025)).toFixed(4));

      await svc.from("competitor_scrapes").update({
        status: "done", result_summary: summary, cost_usd: costUsd, finished_at: new Date().toISOString(),
      }).eq("id", scrapeId);

      // Gera ideias (só pra posts/reels/hashtag — profile é só raio-x).
      let ideas: Array<{ title: string; format: string; rationale: string }> = [];
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (lovableKey && type !== "profile" && top.length > 0) {
        const clientName = client?.name || "o cliente";
        let nicho = client?.segment || "geral";
        let clientCtx = "";
        const ownerId = client?.cria_owner_id as string | null | undefined;

        if (ownerId) {
          // Cliente TEM conta no Cria → usa os dados ricos dele (marca + o que já faz).
          const [prof2, pilRes, brandRes, persRes, recentRes] = await Promise.all([
            svc.from("profiles").select("niche").eq("id", ownerId).maybeSingle(),
            svc.from("pillars").select("name").eq("user_id", ownerId),
            svc.from("brand_items").select("type, name").eq("user_id", ownerId),
            svc.from("personas").select("name, pain_points, interests").eq("user_id", ownerId).limit(1),
            svc.from("posts").select("title").eq("user_id", ownerId).order("created_at", { ascending: false }).limit(15),
          ]);
          nicho = (prof2.data as any)?.niche || nicho;
          const pilares = (pilRes.data || []).map((p: any) => p.name).join(", ");
          const brand = brandRes.data || [];
          const tom = brand.filter((b: any) => b.type === "tom").map((b: any) => b.name).join(", ");
          const evitar = brand.filter((b: any) => b.type === "evitar").map((b: any) => b.name).join(", ");
          const persona = (persRes.data || [])[0] as any;
          const recentes = (recentRes.data || []).map((p: any) => p.title).filter(Boolean).slice(0, 12).join("; ");
          clientCtx = `O cliente TEM conta no Cria — use a marca REAL dele.
Nicho: ${nicho}
Pilares de conteúdo: ${pilares || "-"}
Tom de voz: ${tom || "-"}${evitar ? `\nEvitar: ${evitar}` : ""}${persona ? `\nPersona: ${persona.name || ""} — dores: ${(persona.pain_points || []).join(", ")}; interesses: ${(persona.interests || []).join(", ")}` : ""}
Conteúdo que o cliente JÁ fez (NÃO repita, complemente): ${recentes || "-"}`;
        } else {
          // Cliente SEM conta no Cria → usa o que a social mídia cadastrou no CRM.
          const personaTxt = client?.persona && typeof client.persona === "object" ? JSON.stringify(client.persona).slice(0, 400) : "";
          const brandTxt = client?.brand_core && typeof client.brand_core === "object" ? JSON.stringify(client.brand_core).slice(0, 400) : "";
          clientCtx = `O cliente NÃO tem conta no Cria — use SÓ o que a social mídia cadastrou no CRM.
Nicho/segmento: ${nicho}${personaTxt ? `\nPersona (CRM): ${personaTxt}` : ""}${brandTxt ? `\nMarca (CRM): ${brandTxt}` : ""}`;
        }

        const sys = `Você é estrategista de conteúdo brasileiro. Gere ideias PRONTAS pro cliente, SEMPRE dentro da marca e do nicho DELE. O concorrente serve só de inspiração de FORMATO/gancho/roteiro — nunca copie o assunto se for de outro nicho. Responda SOMENTE JSON válido.`;

        let fonte = "";
        let tarefa = "";
        if (type === "comments") {
          const cs = top.slice(0, 25).map((c: any, i: number) => `${i + 1}. "${String(c.text || "").replace(/\s+/g, " ").slice(0, 160)}"`).join("\n");
          fonte = `=== COMENTÁRIOS do público no post de @${cleanHandle(inputHandle)} ===\n${cs}`;
          tarefa = `Leia os comentários, identifique as DÚVIDAS, pedidos e objeções recorrentes do público e transforme em PAUTAS de conteúdo pro cliente (${clientName}), no nicho ${nicho}. Cada dúvida vira uma ideia que responde/resolve.`;
        } else if (type === "transcription") {
          const ts = top.slice(0, 8).map((x: any, i: number) => `${i + 1}. [${x.likesCount || 0} curtidas${x.videoPlayCount ? `, ${x.videoPlayCount} views` : ""}] roteiro: "${String(x.transcript || x.transcriptText || x.transcription || x.captions || "").replace(/\s+/g, " ").slice(0, 400)}"`).join("\n");
          fonte = `=== REELS de @${cleanHandle(inputHandle)} que engajaram (roteiro transcrito) ===\n${ts}`;
          tarefa = `Analise a ESTRUTURA dos roteiros que funcionaram (gancho, ordem das ideias, CTA) e gere ideias de reels pro cliente (${clientName}) no nicho ${nicho}, usando a mesma estrutura mas com o assunto DELE.`;
        } else {
          const ps = top.slice(0, 8).map((x: any, i: number) =>
            `${i + 1}. [${x.productType || x.type}] ${x.likesCount || 0} curtidas, ${x.commentsCount || 0} coment${x.videoPlayCount ? `, ${x.videoPlayCount} views` : ""} — "${(x.caption || "").replace(/\s+/g, " ").slice(0, 120)}"`).join("\n");
          fonte = `=== CONCORRENTE @${cleanHandle(inputHandle)} — o que mais engajou ===\n${ps}`;
          tarefa = `Aproveite o FORMATO/gancho que funcionou no concorrente e gere ideias no nicho ${nicho} e na VOZ do cliente.`;
        }

        const usr = `=== CLIENTE: ${clientName} ===
${clientCtx}

${fonte}

${tarefa}
Gere de 5 a 8 ideias PRO CLIENTE (${clientName}). Formato:
{"ideas":[{"title":"gancho/título pronto (max 80 chars)","format":"reels|carrossel|foto","rationale":"1 frase: por que essa ideia (ligada à fonte acima)"}]}
REGRAS: 100% no nicho ${nicho}; se a fonte for de outro nicho, use SÓ a estrutura/gancho, nunca o tema; não repita o que o cliente já faz. Português BR, específico.`;
        try {
          const air = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST", headers: { "Authorization": `Bearer ${lovableKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "google/gemini-2.5-flash-lite", messages: [{ role: "system", content: sys }, { role: "user", content: usr }], max_tokens: 2048, temperature: 0.4 }),
          });
          if (air.ok) {
            const aj = await air.json();
            let s = String(aj.choices?.[0]?.message?.content || "").replace(/```json/gi, "").replace(/```/g, "").trim();
            const st = s.indexOf("{"); const en = s.lastIndexOf("}");
            if (st >= 0 && en > st) s = s.slice(st, en + 1);
            const parsed = JSON.parse(s);
            ideas = Array.isArray(parsed?.ideas) ? parsed.ideas : [];
          } else {
            console.error("[apify-scrape] ideas gateway error", air.status);
          }
        } catch (e) { console.error("[apify-scrape] ideas gen failed", e); }
      }

      if (ideas.length > 0) {
        const rows = ideas.slice(0, 10).map((i) => ({
          manager_id: user.id, crm_client_id: crmClientId, scrape_id: scrapeId, source: "scrape",
          title: String(i.title || "Ideia").slice(0, 200),
          format: i.format ? String(i.format).slice(0, 40) : null,
          rationale: i.rationale ? String(i.rationale).slice(0, 400) : null,
          status: "novo",
        }));
        await svc.from("creative_ideas").insert(rows);
      }

      return json({ ok: true, scrape_id: scrapeId, summary, ideas_count: ideas.length, cost_usd: costUsd });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[apify-scrape] run failed", msg);
      await svc.from("competitor_scrapes").update({ status: "error", error: msg.slice(0, 200), finished_at: new Date().toISOString() }).eq("id", scrapeId);
      return json({ error: "scrape_failed", message: msg }, 500);
    }
  } catch (e) {
    console.error("[apify-scrape] unhandled", e);
    return json({ error: "internal_error" }, 500);
  }
});
