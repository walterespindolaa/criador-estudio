// HUB CRIA — dispara um scraper do Apify (Instagram), resume o resultado e gera
// ideias de conteúdo por cliente. Gated: gestor com módulo hub_cria (ou admin).
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
    // input_handle deve ser a URL do post
    return { directUrls: [handle.trim()], resultsType: "comments", resultsLimit: limit, addParentData: false };
  }
  if (type === "stories") {
    return { directUrls: [`https://www.instagram.com/${h}/`], resultsType: "stories", resultsLimit: limit, addParentData: false };
  }
  if (type === "mentions") {
    return { directUrls: [`https://www.instagram.com/${h}/`], resultsType: "mentions", resultsLimit: limit, addParentData: false, ...period };
  }
  if (type === "reels") {
    // A aba /reels/ do perfil — SÓ reels. Antes caía no mesmo input de "posts"
    // e os dois traziam exatamente o mesmo resultado (com carrossel no meio).
    return { directUrls: [`https://www.instagram.com/${h}/reels/`], resultsType: "posts", resultsLimit: limit, addParentData: false, ...period };
  }
  // posts (feed)
  return { directUrls: [`https://www.instagram.com/${h}/`], resultsType: "posts", resultsLimit: limit, addParentData: false, ...period };
}

// Rede de segurança: mesmo puxando a aba /reels/, o ator às vezes devolve item que não é vídeo.
// Aqui garantimos que "reels" só tenha reel, e "posts do feed" não seja dominado por reels.
function isReel(it: any): boolean {
  const t = String(it?.type ?? "").toLowerCase();
  const pt = String(it?.productType ?? "").toLowerCase();
  return t === "video" || pt === "clips" || !!it?.videoUrl || it?.videoViewCount != null || it?.videoPlayCount != null;
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
  if (type === "ads") {
    const ads = items.filter((x) => x);
    return {
      summary: {
        kind: "ads",
        count: ads.length,
        top: ads.slice(0, 12).map((a: any) => {
          const archiveId = a.adArchiveID || a.ad_archive_id || a.adid || a.snapshot?.ad_archive_id || null;
          const pageId = a.pageId || a.snapshot?.page_id || a.page_id || null;
          const media = a.snapshot?.images?.[0]?.original_image_url || a.snapshot?.images?.[0]?.resized_image_url
            || a.snapshot?.videos?.[0]?.video_preview_image_url || a.imageUrl || a.thumbnailUrl || null;
          return {
            text: String(a.adText || a.snapshot?.body?.text || a.body || a.text || a.adCreativeBody || "").replace(/\s+/g, " ").slice(0, 240),
            page: a.pageName || a.snapshot?.page_name || a.pageId || null,
            since: a.startDate || a.adDeliveryStartTime || a.ad_delivery_start_time || a.startDateFormatted || null,
            active: a.isActive ?? a.active ?? null,
            link: a.linkUrl || a.snapshot?.link_url || a.link || null,
            // Link pra VER o anúncio (imagem/vídeo) na Biblioteca de Anúncios do Facebook.
            library_link: archiveId ? `https://www.facebook.com/ads/library/?id=${archiveId}`
              : (pageId ? `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${pageId}` : null),
            thumbnail: media,
          };
        }),
      },
      top: ads.slice(0, 12),
    };
  }
  if (type === "stories") {
    const st = items.filter((x) => x);
    return {
      summary: {
        kind: "stories",
        count: st.length,
        top: st.slice(0, 12).map((x: any) => ({
          type: x.type || (x.videoUrl ? "Video" : "Image"),
          url: x.url || x.displayUrl || null,
          caption: String(x.caption || "").slice(0, 120),
        })),
      },
      top: st,
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

    if (!(await rateOk(svc, user.id, "apify-scrape", 10))) {
      return json({ error: "rate_limited", message: "Muitos scrapes seguidos. Aguarde um minuto." }, 429);
    }

    const body = await req.json().catch(() => ({}));

    // Tenant efetivo: colaborador atua no gestor. Se veio manager_id no body e o usuário
    // é o próprio gestor OU colaborador ativo dele, grava no tenant do gestor.
    let mgr = user.id;
    const reqMgr = body?.manager_id ? String(body.manager_id) : null;
    if (reqMgr && reqMgr !== user.id) {
      const { data: link } = await svc.from("manager_members")
        .select("id").eq("manager_id", reqMgr).eq("member_id", user.id).eq("status", "ativo").maybeSingle();
      if (!link) return json({ error: "forbidden_team" }, 403);
      mgr = reqMgr;
    }

    // Gate: admin OU módulo hub_cria ativo (no tenant efetivo).
    const { data: prof } = await svc.from("profiles").select("role, niche").eq("id", mgr).single();
    let allowed = prof?.role === "admin";
    if (!allowed) {
      const { data: ent } = await svc.from("module_entitlements")
        .select("id").eq("manager_id", mgr).eq("module_code", "hub_cria").eq("status", "active").maybeSingle();
      allowed = !!ent;
    }
    if (!allowed) return json({ error: "forbidden", message: "Módulo HUB CRIA não liberado para esta conta." }, 403);

    const type = String(body?.type ?? "posts");
    const inputHandle = String(body?.input ?? "").trim();
    const crmClientId = body?.crm_client_id ? String(body.crm_client_id) : null;
    const limit = Math.max(1, Math.min(20, Number(body?.limit) || 10));
    const since = typeof body?.since === "string" && /^\d{4}-\d{2}-\d{2}/.test(body.since) ? body.since : undefined;
    if (!inputHandle) return json({ error: "missing_input" }, 400);
    if (!["posts", "reels", "profile", "hashtag", "comments", "transcription", "stories", "mentions", "ads"].includes(type)) return json({ error: "invalid_type" }, 400);

    // Cliente precisa ser do gestor.
    let client: Record<string, any> | null = null;
    if (crmClientId) {
      const { data: c } = await svc.from("crm_clients")
        .select("id, manager_id, segment, name, persona, brand_core, cria_owner_id")
        .eq("id", crmClientId).maybeSingle();
      if (!c || (c as { manager_id?: string }).manager_id !== mgr) return json({ error: "forbidden_client" }, 403);
      client = c as Record<string, any>;
    }

    const apifyToken = Deno.env.get("APIFY_TOKEN");
    if (!apifyToken) return json({ error: "apify_not_configured" }, 500);

    // Cria o job.
    const { data: scrapeRow, error: insErr } = await svc.from("competitor_scrapes").insert({
      manager_id: mgr, crm_client_id: crmClientId, scrape_type: type,
      input_handle: inputHandle, results_limit: limit, status: "running",
    }).select("id").single();
    if (insErr || !scrapeRow) return json({ error: "job_create_failed" }, 500);
    const scrapeId = scrapeRow.id;

    try {
      // Cada tipo pode usar um actor diferente do Apify.
      let actor: string;
      let input: Record<string, unknown>;
      if (type === "transcription") {
        // Aceita @ (reels recentes) OU link(s) de reel específicos (separados por vírgula/espaço).
        actor = "linen_snack~instagram-reel-transcript-ai-extractor";
        const isUrl = /instagram\.com|https?:\/\//i.test(inputHandle);
        if (isUrl) {
          // Com links, transcreve exatamente os que vieram (cap 15). Limpa params de tracking (?igsh=...) que quebram o ator.
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
        const adUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(cleanHandle(inputHandle))}&search_type=keyword_unordered`;
        input = { startUrls: [{ url: adUrl }], resultsLimit: limit, activeStatus: "active" };
      } else {
        actor = "apify~instagram-scraper";
        input = buildApifyInput(type, inputHandle, limit, since);
      }
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
      let items = await resp.json() as any[];
      // "reels" = só vídeo/clips. Sem isso, carrossel do feed vazava pro resultado de reels.
      if (type === "reels" && Array.isArray(items)) {
        const onlyReels = items.filter(isReel);
        if (onlyReels.length > 0) items = onlyReels;
      }
      const nItems = Array.isArray(items) ? items.length : 0;
      // Transcrição vazia = reel privado/indisponível ou link inválido. Não deixa "0 itens" silencioso.
      if (type === "transcription" && nItems === 0) {
        await svc.from("competitor_scrapes").update({
          status: "error", error: "Não consegui puxar esse reel (pode estar privado, indisponível ou o link tá com parâmetros). Tente colar o link limpo (sem ?igsh=...) ou usar o @ do perfil.", finished_at: new Date().toISOString(),
        }).eq("id", scrapeId);
        return json({ error: "transcription_empty", message: "Reel não retornou transcrição. Tente outro link (sem parâmetros) ou o @." }, 200);
      }
      const { summary, top } = summarize(Array.isArray(items) ? items : [], type);
      const perItem = type === "transcription" ? 0.015 : type === "ads" ? 0.006 : 0.0025;
      const costUsd = Number(((Array.isArray(items) ? items.length : 0) * perItem).toFixed(4));

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
          // Cliente SEM conta no Cria → usa o Brandbook que a social mídia cadastrou no CRM.
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
          clientCtx = `O cliente NÃO tem conta no Cria — use SÓ o Brandbook que a social mídia cadastrou no CRM.
Nicho/segmento: ${nicho}${brandLines ? `\n${brandLines}` : ""}${personaTxt ? `\nPersona (CRM): ${personaTxt}` : ""}`;
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
        } else if (type === "ads") {
          const as = top.slice(0, 10).map((a: any, i: number) =>
            `${i + 1}.${a.isActive ?? a.active ? " [ativo]" : ""} "${String(a.adText || a.snapshot?.body?.text || a.body || a.text || "").replace(/\s+/g, " ").slice(0, 180)}"`).join("\n");
          fonte = `=== ANÚNCIOS que @${cleanHandle(inputHandle)} está rodando (Meta Ad Library) ===\n${as}`;
          tarefa = `Esses são os anúncios que o concorrente PAGA pra promover — revelam a oferta, o ângulo e o gancho que funcionam pra ele. Gere ideias de conteúdo ORGÂNICO pro cliente (${clientName}) no nicho ${nicho}, inspiradas nesses ângulos (sem copiar a oferta).`;
        } else if (type === "stories") {
          const ss = top.slice(0, 12).map((x: any, i: number) =>
            `${i + 1}. ${x.type || ""} ${x.caption ? `"${String(x.caption).replace(/\s+/g, " ").slice(0, 120)}"` : "(sem texto na tela)"}`).join("\n");
          fonte = `=== STORIES recentes de @${cleanHandle(inputHandle)} ===\n${ss}`;
          tarefa = `Analise o tipo de story que o concorrente usa no dia a dia e gere ideias de stories pro cliente (${clientName}) no nicho ${nicho}, na estrutura que funciona.`;
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
          manager_id: mgr, crm_client_id: crmClientId, scrape_id: scrapeId, source: "scrape",
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
