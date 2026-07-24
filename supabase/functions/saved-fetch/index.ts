// Puxa capa + legenda + @autor de um link do Instagram (via Apify) pro "Salvos".
// Qualquer usuário logado. TikTok/outros: retorna sem preview (salva mesmo assim).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function rateOk(svc: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const windowKey = new Date().toISOString().slice(0, 16);
    const { data, error } = await svc.rpc("check_and_increment_rate_limit", {
      _user_id: userId, _scope: "saved-fetch", _window_key: windowKey, _limit: 20,
    });
    if (error) return true;
    return data !== false;
  } catch { return true; }
}

function platformOf(url: string): string {
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  return "outro";
}

// Baixa a capa da URL efêmera do CDN (Instagram/TikTok) e sobe pro bucket
// público 'saved-covers' via service role. Retorna a public URL persistente.
// Best-effort: se qualquer passo falhar, devolve a URL original do CDN.
const MAX_COVER_BYTES = 8 * 1024 * 1024; // 8 MB
function extFor(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  return "jpg"; // jpeg/default
}
async function persistCover(svc: SupabaseClient, userId: string, cdnUrl: string | null): Promise<string | null> {
  if (!cdnUrl || !/^https?:\/\//i.test(cdnUrl)) return cdnUrl;
  try {
    const resp = await fetch(cdnUrl);
    if (!resp.ok) return cdnUrl;
    const ct = (resp.headers.get("content-type") || "image/jpeg").toLowerCase();
    if (!ct.startsWith("image/")) return cdnUrl;
    const len = Number(resp.headers.get("content-length") || 0);
    if (len && len > MAX_COVER_BYTES) return cdnUrl;
    const buf = new Uint8Array(await resp.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_COVER_BYTES) return cdnUrl;
    const path = `${userId}/${crypto.randomUUID()}.${extFor(ct)}`;
    const { error } = await svc.storage.from("saved-covers").upload(path, buf, {
      contentType: ct, upsert: false,
    });
    if (error) { console.error("[saved-fetch] cover upload", error.message); return cdnUrl; }
    const pub = svc.storage.from("saved-covers").getPublicUrl(path).data.publicUrl;
    return pub || cdnUrl;
  } catch (e) {
    console.error("[saved-fetch] persistCover", e instanceof Error ? e.message : String(e));
    return cdnUrl;
  }
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
    if (!(await rateOk(svc, user.id))) return json({ error: "rate_limited", message: "Muitos links seguidos. Aguarde um minuto." }, 429);

    const body = await req.json().catch(() => ({}));
    const url = String(body?.url ?? "").trim().split("?")[0];
    if (!url) return json({ error: "missing_url" }, 400);
    const platform = platformOf(url);

    // Só Instagram tem preview automático na v1.
    if (platform !== "instagram") {
      return json({ ok: true, platform, thumbnail: null, caption: null, author: null, media_type: null });
    }

    const token = Deno.env.get("APIFY_TOKEN");
    if (!token) return json({ ok: true, platform, thumbnail: null, caption: null, author: null, media_type: null, note: "sem apify token" });

    const apifyUrl = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&maxItems=1`;
    const r = await fetch(apifyUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directUrls: [url], resultsType: "details", resultsLimit: 1, addParentData: false }),
    });
    if (!r.ok) {
      console.error("[saved-fetch] apify", r.status);
      return json({ ok: true, platform, thumbnail: null, caption: null, author: null, media_type: null, note: `apify ${r.status}` });
    }
    const items = await r.json() as any[];
    const it = Array.isArray(items) && items[0] ? items[0] : null;
    if (!it) return json({ ok: true, platform, thumbnail: null, caption: null, author: null, media_type: null });

    const type = String(it.type || "").toLowerCase();
    const media_type = type.includes("video") ? "video" : type.includes("sidecar") ? "carousel" : "image";
    // URL efêmera do CDN -> persiste numa storage nossa pra capa não morrer.
    const cdnThumb = it.displayUrl || it.thumbnailUrl || (it.images?.[0] ?? null) || null;
    const thumbnail = await persistCover(svc, user.id, cdnThumb);
    return json({
      ok: true,
      platform,
      thumbnail,
      caption: it.caption ? String(it.caption).slice(0, 800) : null,
      author: it.ownerUsername || it.ownerFullName || null,
      media_type,
    });
  } catch (e) {
    console.error("[saved-fetch] unhandled", e);
    return json({ error: "internal_error", message: e instanceof Error ? e.message : String(e) }, 500);
  }
});
