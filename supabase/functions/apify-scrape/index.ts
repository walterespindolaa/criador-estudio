// ═══════════════════════════════════════════════════════════════════════════
// HUB CRIA — análise de concorrente (Apify) → ideias por cliente
//
// REESCRITA. O que estava errado e por que "não funcionava":
//
// 1. TIMEOUT (a causa raiz). Usava `run-sync-get-dataset-items`, que ESPERA o
//    scrape inteiro terminar. Uma edge function morre em ~150s; transcrever 10
//    reels leva minutos. A função era cortada no meio, o job ficava com status
//    "running" pra sempre e a tela nunca mostrava nada. Agora é ASSÍNCRONO:
//    `start` dispara o run e devolve na hora; `poll` busca o resultado.
//
// 2. ANÚNCIOS TRAZIAM OUTRA COISA. Buscava por PALAVRA-CHAVE (`q=<handle>`), ou
//    seja, qualquer anúncio que MENCIONASSE o nome. Não eram os anúncios DELE.
//    Agora resolve o page_id do concorrente e busca a PÁGINA (view_all_page_id).
//
// 3. STORIES NUNCA IA FUNCIONAR. O scraper não vê stories sem sessão logada.
//    Era um botão que só podia falhar. Removido do produto até ter cookies.
//
// 4. O CUSTO ERA FICÇÃO. `cost_usd` vinha de números chutados no código. Agora
//    lê o `usageTotalUsd` do run — o valor real que o Apify cobrou.
//
// 5. NÃO HAVIA COTA. Só um rate-limit por minuto (anti-abuso), nada que segurasse
//    o custo do mês. Agora tem crédito, debitado por tipo de análise.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const cleanHandle = (s: string) => s.trim().replace(/^@/, "").replace(/\/+$/, "").split("/").pop() || "";

// Cada análise custa um tanto diferente pro Apify. Cobrar tudo igual seria ou
// prejuízo (na transcrição) ou roubo (no scrape simples).
const CREDITOS: Record<string, number> = {
  posts: 1, reels: 1, profile: 1, hashtag: 1, comments: 1, mentions: 1,
  ads: 2,
  transcription: 3,
};

const TIPOS = ["posts", "reels", "profile", "hashtag", "comments", "transcription", "mentions", "ads"];

function buildApifyInput(type: string, handle: string, limit: number, since?: string): Record<string, unknown> {
  const h = cleanHandle(handle);
  const period = since ? { onlyPostsNewerThan: since } : {};
  if (type === "profile") {
    return { directUrls: [`https://www.instagram.com/${h}/`], resultsType: "details", resultsLimit: 1, addParentData: false };
  }
  if (type === "hashtag") {
    const tag = h.replace(/^#/, "");
    return { directUrls: [`https://www.instagram.com/explore/tags/${tag}/`], resultsType: "posts", resultsLimit: limit, addParentData: false, ...period };
  }
  if (type === "comments") {
    return { directUrls: [handle.trim()], resultsType: "comments", resultsLimit: limit, addParentData: false };
  }
  if (type === "mentions") {
    return { directUrls: [`https://www.instagram.com/${h}/`], resultsType: "mentions", resultsLimit: limit, addParentData: false, ...period };
  }
  if (type === "reels") {
    return { directUrls: [`https://www.instagram.com/${h}/reels/`], resultsType: "posts", resultsLimit: limit, addParentData: false, ...period };
  }
  return { directUrls: [`https://www.instagram.com/${h}/`], resultsType: "posts", resultsLimit: limit, addParentData: false, ...period };
}

function isReel(it: any): boolean {
  const t = String(it?.type ?? "").toLowerCase();
  const pt = String(it?.productType ?? "").toLowerCase();
  return t === "video" || pt === "clips" || !!it?.videoUrl || it?.videoViewCount != null || it?.videoPlayCount != null;
}

// ── ANÚNCIOS: descobrir a PÁGINA do concorrente ────────────────────────────
// Buscar por keyword traz o anúncio de quem MENCIONA o nome. Pra trazer o que
// ELE paga, precisamos do page_id — que a própria busca da biblioteca devolve.
async function resolvePageId(handle: string, token: string): Promise<string | null> {
  try {
    const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(handle)}&search_type=keyword_unordered`;
    const r = await fetch(`https://api.apify.com/v2/acts/apify~facebook-ads-scraper/run-sync-get-dataset-items?token=${token}&maxItems=3`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startUrls: [{ url }], resultsLimit: 3, activeStatus: "active" }),
    });
    if (!r.ok) return null;
    const items = await r.json() as any[];
    const alvo = (items || []).find((a: any) => {
      const nome = String(a.pageName || a.snapshot?.page_name || "").toLowerCase().replace(/\s+/g, "");
      return nome.includes(handle.toLowerCase().replace(/\s+/g, ""));
    }) ?? items?.[0];
    return alvo?.pageId || alvo?.snapshot?.page_id || alvo?.page_id || null;
  } catch { return null; }
}

// ── Resumo do que voltou ───────────────────────────────────────────────────
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
        avatar: p.profilePicUrlHD || p.profilePicUrl || null,
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

  if (type === "ads") {
    const ads = items.filter((x) => x);

    // A DATA VINHA CRUA. O ator devolve epoch em SEGUNDOS ("1777446000"), e a tela
    // mostrava "desde 1777446000". Aqui vira ISO, e a tela formata em pt-BR.
    const dataDe = (v: unknown): string | null => {
      if (v == null || v === "") return null;
      const n = Number(v);
      if (Number.isFinite(n) && n > 1000000000) {
        // segundos ou milissegundos, os dois aparecem
        const ms = n < 100000000000 ? n * 1000 : n;
        return new Date(ms).toISOString();
      }
      const d = new Date(String(v));
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    };

    // A CAPA NÃO APARECIA. O criativo do anúncio mora em vários lugares diferentes
    // dependendo do formato (imagem, vídeo, carrossel), e a gente só olhava dois.
    const capaDe = (a: any): string | null => {
      const s = a.snapshot ?? {};
      return (
        s.images?.[0]?.original_image_url ||
        s.images?.[0]?.resized_image_url ||
        s.videos?.[0]?.video_preview_image_url ||
        s.videos?.[0]?.video_preview_url ||
        s.cards?.[0]?.original_image_url ||       // carrossel
        s.cards?.[0]?.resized_image_url ||
        s.creatives?.[0]?.image_url ||
        a.imageUrl || a.thumbnailUrl || a.originalImageUrl || a.previewImageUrl ||
        null
      );
    };

    return {
      summary: {
        kind: "ads",
        count: ads.length,
        top: ads.slice(0, 12).map((a: any) => {
          const s = a.snapshot ?? {};
          const archiveId = a.adArchiveID || a.ad_archive_id || a.adArchiveId || a.adid || s.ad_archive_id || null;
          const pageId = a.pageId || s.page_id || a.page_id || null;
          return {
            text: String(a.adText || s.body?.text || a.body || a.text || a.adCreativeBody || "").replace(/\s+/g, " ").slice(0, 400),
            titulo: String(s.title || s.link_description || a.title || "").slice(0, 120) || null,
            page: a.pageName || s.page_name || null,
            since: dataDe(a.startDate ?? a.adDeliveryStartTime ?? a.ad_delivery_start_time ?? a.startDateFormatted ?? s.start_date),
            active: a.isActive ?? a.active ?? null,
            link: a.linkUrl || s.link_url || a.link || null,
            cta: s.cta_text || a.ctaText || s.cta_type || null,
            // SEM LINK ela não conseguia VER o anúncio. Se não tiver o id do
            // arquivo, cai na página do anunciante na biblioteca — melhor que nada.
            library_link: archiveId
              ? `https://www.facebook.com/ads/library/?id=${archiveId}`
              : (pageId ? `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${pageId}` : null),
            thumbnail: capaDe(a),
          };
        }),
      },
      top: ads.slice(0, 12),
    };
  }

  // ── Posts / Reels / Hashtag / Menções / Transcrição ──
  // A TRANSCRIÇÃO caía aqui e era ordenada por CURTIDAS — que o ator de
  // transcrição não devolve. Resultado: "top 8" em ordem aleatória, sem capa,
  // sem link, sem views. Não era design ruim: era dado faltando.
  const transcriptOf = (x: any): string =>
    String(x.transcript || x.transcriptText || x.transcription || x.captions || x.text || "").trim();

  const norm = (x: any) => ({
    caption: String(x.caption || x.title || x.description || "").slice(0, 600),
    likes: Number(x.likesCount ?? x.likes ?? 0) || 0,
    comments: Number(x.commentsCount ?? x.comments ?? 0) || 0,
    views: Number(x.videoPlayCount ?? x.videoViewCount ?? x.playCount ?? x.views ?? 0) || null,
    format: x.productType || x.type || (type === "transcription" ? "clips" : "outro"),
    url: x.url || x.reelUrl || x.postUrl || (x.shortCode ? `https://www.instagram.com/p/${x.shortCode}/` : null),
    thumbnail: x.displayUrl || x.thumbnailUrl || x.thumbnail || x.coverUrl || x.images?.[0] || null,
    posted_at: x.timestamp || x.takenAt || null,
    music: x.musicInfo?.song_name ?? null,
    duration: x.videoDuration ?? x.duration ?? null,
    transcript: type === "transcription" ? transcriptOf(x).slice(0, 4000) : undefined,
    resumo: type === "transcription" ? String(x.summary || x.aiSummary || "").slice(0, 600) || undefined : undefined,
  });

  const brutos = items.filter((x) => x && (x.likesCount != null || x.commentsCount != null || transcriptOf(x)));
  const posts = brutos.map(norm);

  // Ordena por ENGAJAMENTO; na transcrição (que não tem curtidas) ordena por VIEWS,
  // e se nem views vier, mantém a ordem que o Apify devolveu (mais recentes).
  const peso = (p: ReturnType<typeof norm>) =>
    (p.likes + p.comments) || (p.views ?? 0);
  const top = [...posts].sort((a, b) => peso(b) - peso(a)).slice(0, 10);

  const fmt: Record<string, number> = {};
  for (const p of posts) fmt[p.format] = (fmt[p.format] || 0) + 1;
  const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
  const totalComments = posts.reduce((s, p) => s + p.comments, 0);
  const comViews = posts.filter((p) => p.views != null);

  return {
    summary: {
      kind: type,
      count: posts.length,
      avg_likes: posts.length ? Math.round(totalLikes / posts.length) : 0,
      avg_comments: posts.length ? Math.round(totalComments / posts.length) : 0,
      avg_views: comViews.length ? Math.round(comViews.reduce((s, p) => s + (p.views || 0), 0) / comViews.length) : null,
      formats: fmt,
      top,
    },
    top: brutos,
  };
}

// ── Geração das ideias ─────────────────────────────────────────────────────
async function gerarIdeias(
  svc: SupabaseClient, type: string, inputHandle: string, top: any[],
  client: Record<string, any> | null, lovableKey: string,
): Promise<Array<{ title: string; format: string; rationale: string }>> {
  const clientName = client?.name || "o cliente";
  let nicho = client?.segment || "geral";
  let clientCtx = "";
  const ownerId = client?.cria_owner_id as string | null | undefined;

  if (ownerId) {
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
    clientCtx = `O cliente TEM conta no Cria, use a marca REAL dele.
Nicho: ${nicho}
Pilares de conteúdo: ${pilares || "-"}
Tom de voz: ${tom || "-"}${evitar ? `\nEvitar: ${evitar}` : ""}${persona ? `\nPersona: ${persona.name || ""}, dores: ${(persona.pain_points || []).join(", ")}; interesses: ${(persona.interests || []).join(", ")}` : ""}
Conteúdo que o cliente JÁ fez (NÃO repita, complemente): ${recentes || "-"}`;
  } else {
    const bc = (client?.brand_core && typeof client.brand_core === "object" ? client.brand_core : {}) as Record<string, string>;
    const brandLines = [
      bc.offer && `O que vende: ${bc.offer}`,
      bc.valueProp && `Proposta de valor/diferencial: ${bc.valueProp}`,
      bc.audience && `Público-alvo: ${bc.audience}`,
      bc.contentThemes && `Temas/pilares: ${bc.contentThemes}`,
      bc.toneOfVoice && `Tom de voz: ${bc.toneOfVoice}`,
      bc.personality && `Personalidade: ${bc.personality}`,
      bc.avoid && `EVITAR: ${bc.avoid}`,
    ].filter(Boolean).join("\n");
    const personaTxt = client?.persona && typeof client.persona === "object" ? JSON.stringify(client.persona).slice(0, 600) : "";
    clientCtx = `O cliente NÃO tem conta no Cria, use SÓ o Brandbook que a social mídia cadastrou no CRM.
Nicho/segmento: ${nicho}${brandLines ? `\n${brandLines}` : ""}${personaTxt ? `\nPersona (CRM): ${personaTxt}` : ""}`;
  }

  const sys = `Você é estrategista de conteúdo brasileiro. Gere ideias PRONTAS pro cliente, SEMPRE dentro da marca e do nicho DELE. O concorrente serve só de inspiração de FORMATO/gancho/roteiro, nunca copie o assunto se for de outro nicho. Responda SOMENTE JSON válido.`;

  const h = cleanHandle(inputHandle);
  let fonte = "";
  let tarefa = "";

  if (type === "comments") {
    const cs = top.slice(0, 25).map((c: any, i: number) => `${i + 1}. "${String(c.text || "").replace(/\s+/g, " ").slice(0, 160)}"`).join("\n");
    fonte = `=== COMENTÁRIOS do público no post de @${h} ===\n${cs}`;
    tarefa = `Leia os comentários, identifique as DÚVIDAS, pedidos e objeções recorrentes e transforme em PAUTAS pro cliente (${clientName}), no nicho ${nicho}. Cada dúvida vira uma ideia que responde/resolve.`;
  } else if (type === "transcription") {
    const ts = top.slice(0, 8).map((x: any, i: number) => {
      const t = String(x.transcript || x.transcriptText || x.transcription || x.captions || x.text || "").replace(/\s+/g, " ").slice(0, 600);
      const v = x.videoPlayCount || x.playCount || x.views;
      return `${i + 1}.${v ? ` [${v} views]` : ""} roteiro: "${t}"`;
    }).join("\n");
    fonte = `=== REELS de @${h} (roteiro transcrito do áudio) ===\n${ts}`;
    tarefa = `Analise a ESTRUTURA dos roteiros que funcionaram (o gancho dos 3 primeiros segundos, a ordem das ideias, o CTA) e gere ideias de reels pro cliente (${clientName}) no nicho ${nicho}, usando a mesma estrutura mas com o assunto DELE.`;
  } else if (type === "ads") {
    const as = top.slice(0, 10).map((a: any, i: number) =>
      `${i + 1}.${a.isActive ?? a.active ? " [ativo]" : ""} "${String(a.adText || a.snapshot?.body?.text || a.body || a.text || "").replace(/\s+/g, " ").slice(0, 180)}"`).join("\n");
    fonte = `=== ANÚNCIOS que @${h} está PAGANDO pra rodar (Meta Ad Library) ===\n${as}`;
    tarefa = `Esses são os anúncios que o concorrente PAGA pra promover — revelam a oferta, o ângulo e o gancho que funcionam pra ele. Gere ideias de conteúdo ORGÂNICO pro cliente (${clientName}) no nicho ${nicho}, inspiradas nesses ângulos (sem copiar a oferta).`;
  } else {
    const ps = top.slice(0, 8).map((x: any, i: number) =>
      `${i + 1}. [${x.productType || x.type}] ${x.likesCount || 0} curtidas, ${x.commentsCount || 0} coment${x.videoPlayCount ? `, ${x.videoPlayCount} views` : ""}, "${(x.caption || "").replace(/\s+/g, " ").slice(0, 120)}"`).join("\n");
    fonte = `=== CONCORRENTE @${h}, o que mais engajou ===\n${ps}`;
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
    if (!air.ok) { console.error("[apify-scrape] ideas gateway error", air.status); return []; }
    const aj = await air.json();
    let s = String(aj.choices?.[0]?.message?.content || "").replace(/```json/gi, "").replace(/```/g, "").trim();
    const st = s.indexOf("{"); const en = s.lastIndexOf("}");
    if (st >= 0 && en > st) s = s.slice(st, en + 1);
    const parsed = JSON.parse(s);
    return Array.isArray(parsed?.ideas) ? parsed.ideas : [];
  } catch (e) { console.error("[apify-scrape] ideas gen failed", e); return []; }
}

// ═══════════════════════════════════════════════════════════════════════════
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

    const body = await req.json().catch(() => ({}));
    const apifyToken = Deno.env.get("APIFY_TOKEN");
    if (!apifyToken) return json({ error: "apify_not_configured" }, 500);

    // Tenant efetivo (colaborador atua no gestor).
    let mgr = user.id;
    const reqMgr = body?.manager_id ? String(body.manager_id) : null;
    if (reqMgr && reqMgr !== user.id) {
      const { data: link } = await svc.from("manager_members")
        .select("id").eq("manager_id", reqMgr).eq("member_id", user.id).eq("status", "ativo").maybeSingle();
      if (!link) return json({ error: "forbidden_team" }, 403);
      mgr = reqMgr;
    }

    const { data: prof } = await svc.from("profiles").select("role").eq("id", mgr).single();
    const isAdmin = prof?.role === "admin";
    let allowed = isAdmin;
    if (!allowed) {
      const { data: ent } = await svc.from("module_entitlements")
        .select("id").eq("manager_id", mgr).eq("module_code", "hub_cria").eq("status", "active").maybeSingle();
      allowed = !!ent;
    }
    if (!allowed) return json({ error: "forbidden", message: "Módulo HUB CRIA não liberado para esta conta." }, 403);

    const action = String(body?.action ?? "start");

    // ─────────────────────────────────────────────────────────────────────
    // POLL: a tela pergunta "já terminou?". Aqui a gente checa o run no Apify,
    // e SÓ quando ele termina é que baixamos os itens, resumimos, geramos as
    // ideias e lemos o CUSTO REAL. Nada disso cabia num request só.
    // ─────────────────────────────────────────────────────────────────────
    if (action === "poll") {
      const scrapeId = String(body?.scrape_id ?? "");
      if (!scrapeId) return json({ error: "missing_scrape_id" }, 400);

      const { data: job } = await svc.from("competitor_scrapes")
        .select("*").eq("id", scrapeId).eq("manager_id", mgr).maybeSingle();
      if (!job) return json({ error: "not_found" }, 404);
      if (job.status === "done" || job.status === "error") {
        return json({ ok: true, status: job.status, summary: job.result_summary, error: job.error, cost_usd: job.cost_usd });
      }
      if (!job.apify_run_id) return json({ ok: true, status: "running" });

      const runResp = await fetch(`https://api.apify.com/v2/actor-runs/${job.apify_run_id}?token=${apifyToken}`);
      if (!runResp.ok) return json({ ok: true, status: "running" });
      const run = (await runResp.json())?.data;
      const st = String(run?.status ?? "");

      if (st === "RUNNING" || st === "READY") return json({ ok: true, status: "running" });

      if (st !== "SUCCEEDED") {
        await svc.from("competitor_scrapes").update({
          status: "error",
          error: `O Apify não conseguiu completar a análise (${st}). Tente de novo em alguns minutos.`,
          finished_at: new Date().toISOString(),
        }).eq("id", scrapeId);
        return json({ ok: true, status: "error", error: `apify_${st}` });
      }

      // Terminou. Baixa os itens.
      const dsId = run?.defaultDatasetId;
      const itemsResp = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${apifyToken}&clean=true&limit=${job.results_limit || 20}`);
      let items = await itemsResp.json() as any[];
      if (!Array.isArray(items)) items = [];

      if (job.scrape_type === "reels") {
        const onlyReels = items.filter(isReel);
        if (onlyReels.length > 0) items = onlyReels;
      }

      // O CUSTO REAL, cobrado pelo Apify. Antes era um número chutado no código.
      const costUsd = Number(run?.usageTotalUsd ?? 0) || 0;

      if (items.length === 0) {
        await svc.from("competitor_scrapes").update({
          status: "error", cost_usd: costUsd,
          error: "A análise rodou mas voltou vazia. Confira o @ (perfil privado não dá) ou tente outro período.",
          finished_at: new Date().toISOString(),
        }).eq("id", scrapeId);
        return json({ ok: true, status: "error", error: "empty" });
      }

      const { summary, top } = summarize(items, job.scrape_type);

      // Ideias (o perfil é só raio-x, não gera pauta).
      let ideas: Array<{ title: string; format: string; rationale: string }> = [];
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (lovableKey && job.scrape_type !== "profile" && top.length > 0) {
        let client: Record<string, any> | null = null;
        if (job.crm_client_id) {
          const { data: c } = await svc.from("crm_clients")
            .select("id, manager_id, segment, name, persona, brand_core, cria_owner_id")
            .eq("id", job.crm_client_id).maybeSingle();
          client = (c as Record<string, any>) ?? null;
        }
        ideas = await gerarIdeias(svc, job.scrape_type, job.input_handle, top, client, lovableKey);
      }

      if (ideas.length > 0) {
        await svc.from("creative_ideas").insert(ideas.slice(0, 10).map((i) => ({
          manager_id: mgr, crm_client_id: job.crm_client_id, scrape_id: scrapeId, source: "scrape",
          title: String(i.title || "Ideia").slice(0, 200),
          format: i.format ? String(i.format).slice(0, 40) : null,
          rationale: i.rationale ? String(i.rationale).slice(0, 400) : null,
          status: "novo",
        })));
      }

      await svc.from("competitor_scrapes").update({
        status: "done", result_summary: summary, cost_usd: costUsd, finished_at: new Date().toISOString(),
      }).eq("id", scrapeId);

      return json({ ok: true, status: "done", summary, ideas_count: ideas.length, cost_usd: costUsd });
    }

    // ─────────────────────────────────────────────────────────────────────
    // START: debita o crédito, dispara o run e VOLTA NA HORA.
    // ─────────────────────────────────────────────────────────────────────
    const type = String(body?.type ?? "posts");
    const inputHandle = String(body?.input ?? "").trim();
    const crmClientId = body?.crm_client_id ? String(body.crm_client_id) : null;
    const limit = Math.max(1, Math.min(20, Number(body?.limit) || 10));
    const since = typeof body?.since === "string" && /^\d{4}-\d{2}-\d{2}/.test(body.since) ? body.since : undefined;

    if (!inputHandle) return json({ error: "missing_input" }, 400);
    if (!TIPOS.includes(type)) return json({ error: "invalid_type" }, 400);

    // COTA. Admin não debita (é a sua conta de testes).
    const custo = CREDITOS[type] ?? 1;
    if (!isAdmin) {
      const { data: saldo, error: credErr } = await svc.rpc("bump_hub_credits", { _manager: mgr, _cost: custo });
      if (credErr) {
        const m = credErr.message ?? "";
        if (m.includes("sem_creditos")) {
          return json({ error: "no_credits", message: "Seus créditos do HUB CRIA acabaram neste mês. Compre um pacote extra pra continuar." }, 402);
        }
        console.error("[apify-scrape] credits error", m);
        return json({ error: "credits_unavailable", message: "Não consegui validar seus créditos agora." }, 500);
      }
      console.log("[apify-scrape] créditos", { mgr, custo, saldo });
    }

    if (crmClientId) {
      const { data: c } = await svc.from("crm_clients").select("id, manager_id").eq("id", crmClientId).maybeSingle();
      if (!c || (c as { manager_id?: string }).manager_id !== mgr) return json({ error: "forbidden_client" }, 403);
    }

    // Concorrente do radar (opcional): é o que permite dizer, depois, "esse
    // concorrente está sem leitura há 31 dias".
    const competitorId = body?.competitor_id ? String(body.competitor_id) : null;
    if (competitorId) {
      const { data: comp } = await svc.from("hub_competitors")
        .select("id, manager_id").eq("id", competitorId).maybeSingle();
      if (!comp || (comp as { manager_id?: string }).manager_id !== mgr) {
        return json({ error: "forbidden_competitor" }, 403);
      }
      await svc.from("hub_competitors")
        .update({ last_read_at: new Date().toISOString() }).eq("id", competitorId);
    }

    const { data: scrapeRow, error: insErr } = await svc.from("competitor_scrapes").insert({
      manager_id: mgr, crm_client_id: crmClientId, competitor_id: competitorId, scrape_type: type,
      input_handle: inputHandle, results_limit: limit, status: "running",
    }).select("id").single();
    if (insErr || !scrapeRow) return json({ error: "job_create_failed" }, 500);
    const scrapeId = scrapeRow.id;

    try {
      let actor: string;
      let input: Record<string, unknown>;

      if (type === "transcription") {
        actor = "linen_snack~instagram-reel-transcript-ai-extractor";
        const isUrl = /instagram\.com|https?:\/\//i.test(inputHandle);
        if (isUrl) {
          const urls = inputHandle.split(/[\s,]+/)
            .filter((u) => /instagram\.com/i.test(u))
            .map((u) => u.split("?")[0].replace(/\/+$/, "") + "/")
            .slice(0, 15);
          input = { reelUrls: urls, language: "pt", enableSummary: true };
        } else {
          input = { usernames: [cleanHandle(inputHandle)], maxReelsPerUsername: limit, language: "pt", enableSummary: true };
        }
      } else if (type === "ads") {
        actor = "apify~facebook-ads-scraper";
        // A CORREÇÃO: pega os anúncios DA PÁGINA do concorrente, não os anúncios
        // que MENCIONAM o nome dele. Se não achar a página, avisa em vez de
        // entregar lixo silenciosamente.
        const pageId = await resolvePageId(cleanHandle(inputHandle), apifyToken);
        if (!pageId) {
          await svc.from("competitor_scrapes").update({
            status: "error",
            error: "Não achei a página desse anunciante na biblioteca da Meta. Ou ele não roda anúncios, ou o nome da página é diferente do @ do Instagram. Tente o nome exato da página do Facebook.",
            finished_at: new Date().toISOString(),
          }).eq("id", scrapeId);
          return json({ ok: true, scrape_id: scrapeId, status: "error", message: "Não achei anúncios ativos dessa página." });
        }
        const adUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${pageId}`;
        input = { startUrls: [{ url: adUrl }], resultsLimit: limit, activeStatus: "active" };
      } else {
        actor = "apify~instagram-scraper";
        input = buildApifyInput(type, inputHandle, limit, since);
      }

      // ASSÍNCRONO. `/runs` dispara e devolve na hora; nada de esperar o scrape
      // dentro do request (era isso que estourava o tempo da edge function).
      const runResp = await fetch(`https://api.apify.com/v2/acts/${actor}/runs?token=${apifyToken}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
      });
      if (!runResp.ok) {
        const t = await runResp.text();
        console.error("[apify-scrape] apify start error", runResp.status, t.slice(0, 300));
        await svc.from("competitor_scrapes").update({
          status: "error", error: `Não consegui iniciar a análise (Apify ${runResp.status}).`, finished_at: new Date().toISOString(),
        }).eq("id", scrapeId);
        return json({ error: "apify_failed", message: `Apify retornou ${runResp.status}.` }, 502);
      }
      const runId = (await runResp.json())?.data?.id;

      await svc.from("competitor_scrapes").update({ apify_run_id: runId }).eq("id", scrapeId);

      return json({ ok: true, scrape_id: scrapeId, status: "running", credits_used: isAdmin ? 0 : custo });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[apify-scrape] start failed", msg);
      await svc.from("competitor_scrapes").update({ status: "error", error: msg.slice(0, 200), finished_at: new Date().toISOString() }).eq("id", scrapeId);
      return json({ error: "scrape_failed", message: msg }, 500);
    }
  } catch (e) {
    console.error("[apify-scrape] unhandled", e);
    return json({ error: "internal_error" }, 500);
  }
});
