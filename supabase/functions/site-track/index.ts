// Visitas e cliques da LP (criasocialclub.com.br) -> public.site_visitas.
//
// Motor de tráfego (21/10/2026). O pixel da Meta só mede quem aceitou cookie e
// entrega o número dentro da Meta. Aqui é a contagem NOSSA: página, origem
// (UTM) e uma sessão aleatória da aba, sem IP, sem e-mail, sem cookie. É o que
// permite ver no admin quantas pessoas cada campanha e o link da bio trouxeram
// pra página do criador e pra página da social mídia.
//
// Público, sem JWT (a LP não tem login). Freio por IP via rate_touch: 60
// eventos/min por IP. Métrica perdida não é problema, então estourou = ok.
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGENS_OK = ["https://criasocialclub.com.br", "https://www.criasocialclub.com.br"];

function cors(req: Request) {
  const o = req.headers.get("origin") ?? "";
  const permitido = ORIGENS_OK.includes(o) || /^https:\/\/cria-[a-z0-9-]+\.vercel\.app$/.test(o) || /^https?:\/\/localhost(:\d+)?$/.test(o);
  return {
    "Access-Control-Allow-Origin": permitido ? o : ORIGENS_OK[0],
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const EVENTOS = new Set(["view", "cta", "leu", "ficou30", "preco"]);
const corta = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

function publico(pagina: string, campanha: string | null): "criador" | "social" | "outro" {
  const c = (campanha ?? "").toLowerCase();
  if (c.includes("social")) return "social";
  if (c.includes("criador")) return "criador";
  if (pagina.startsWith("/social-media")) return "social";
  if (["/", "/index", "/index.html", "/funcionalidades", "/funcionalidades.html"].includes(pagina)) return "criador";
  return "outro";
}

Deno.serve(async (req) => {
  const h = cors(req);
  const ok = () => new Response('{"ok":true}', { headers: { ...h, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return ok();
  try {
    // sendBeacon manda text/plain: lê como texto e faz o parse aqui.
    const b = JSON.parse(await req.text() || "{}");
    const evento = String(b?.evento ?? "");
    if (!EVENTOS.has(evento)) return ok();
    const pagina = (corta(b?.pagina, 200) ?? "/").split("?")[0];

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "sem-ip";
    const { data: pode } = await svc.rpc("rate_touch", { _key: `site:${ip}`, _limit: 60 });
    if (pode === false) return ok();

    const u = b?.utm ?? {};
    const campanha = corta(u.utm_campaign, 120);
    let refHost: string | null = null;
    try { refHost = b?.ref ? new URL(String(b.ref)).hostname.slice(0, 120) : null; } catch { refHost = null; }
    if (refHost && /criasocialclub\.com\.br$/.test(refHost)) refHost = null; // navegação interna não é origem

    await svc.from("site_visitas").insert({
      evento,
      pagina,
      publico: publico(pagina, campanha),
      sessao: corta(b?.sessao, 64),
      utm_source: corta(u.utm_source, 80),
      utm_medium: corta(u.utm_medium, 80),
      utm_campaign: campanha,
      utm_content: corta(u.utm_content, 120),
      tem_fbclid: Boolean(u.fbclid),
      referrer_host: refHost,
      dispositivo: b?.disp === "mobile" ? "mobile" : b?.disp === "desktop" ? "desktop" : null,
      alvo: corta(b?.alvo, 80),
    });
    return ok();
  } catch (e) {
    console.error("[site-track]", e instanceof Error ? e.message : String(e));
    return ok();
  }
});
