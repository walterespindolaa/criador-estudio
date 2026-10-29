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
//
// 21/10/2026: + "clique" (todo clique na página, com seção e altura) e
// "leitura" (acumulado da visita, vai pra site_leituras). Ver migração
// 20261021000025_lp_comportamento.
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGENS_OK = ["https://criasocialclub.com.br", "https://www.criasocialclub.com.br"];

function cors(req: Request) {
  const o = req.headers.get("origin") ?? "";
  const permitido = ORIGENS_OK.includes(o) || /^https:\/\/(criador|socialmedia)\.criasocialclub\.com\.br$/.test(o) || /^https:\/\/cria-[a-z0-9-]+\.vercel\.app$/.test(o) || /^https?:\/\/localhost(:\d+)?$/.test(o);
  return {
    "Access-Control-Allow-Origin": permitido ? o : ORIGENS_OK[0],
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const EVENTOS = new Set(["view", "cta", "leu", "ficou30", "preco", "clique", "leitura"]);
const ID = /^[a-z0-9_-]{1,40}$/i;
const inteiro = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
// Robôs não contam (21/10/2026). As 5 primeiras "visitas" depois do deploy
// eram robô: pares com 6 ms de diferença e sessões diferentes (checagem do
// deploy) e uma "Meta / pago" às 12h21 com o anúncio ainda em zero impressão
// (o robô da Meta conferindo o link). Nenhuma rolou a página. Navegador de
// verdade sempre manda user-agent de navegador.
// Só nomes de robô: app de rede social (Instagram, Pinterest, LinkedIn) abre a
// página no navegador interno com user-agent de gente e TEM que contar.
const ROBO = /bot[\/;-]|\bbot\b|crawl|spider|slurp|facebookexternalhit|facebookcatalog|meta-externalagent|meta-externalfetcher|headless|lighthouse|pagespeed|vercel|embedly|curl|wget|python|node-fetch|undici|axios|go-http|java\/|okhttp|postman|insomnia/i;
const ehRobo = (ua: string) => !ua || !/mozilla|opera/i.test(ua) || ROBO.test(ua);
const corta = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

function publico(pagina: string, campanha: string | null): "criador" | "social" | "outro" {
  const c = (campanha ?? "").toLowerCase();
  if (c.includes("social")) return "social";
  if (c.includes("criador")) return "criador";
  if (pagina.startsWith("/social-media") || pagina.startsWith("/lp/social")) return "social";
  if (pagina.startsWith("/lp/criador")) return "criador";
  if (["/", "/index", "/index.html", "/funcionalidades", "/funcionalidades.html"].includes(pagina)) return "criador";
  return "outro";
}

Deno.serve(async (req) => {
  const h = cors(req);
  const ok = () => new Response('{"ok":true}', { headers: { ...h, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return ok();
  if (ehRobo(req.headers.get("user-agent") ?? "")) return ok();
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

    const comuns = {
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
    };

    // LEITURA (21/10/2026): o acumulado de uma visita (tempo ativo, rolagem,
    // segundos por seção, onde saiu). Chega várias vezes por visita, sempre
    // com o total até ali: upsert pela visita, então reenviar não duplica.
    if (evento === "leitura") {
      const visita = corta(b?.visita, 40);
      if (!visita || !ID.test(visita)) return ok();
      const secoes: Record<string, number> = {};
      if (b?.secoes && typeof b.secoes === "object" && !Array.isArray(b.secoes)) {
        for (const [k, v] of Object.entries(b.secoes).slice(0, 40)) if (ID.test(k)) secoes[k] = inteiro(v, 7200);
      }
      const mapa = Array.isArray(b?.mapa) ? b.mapa.filter((x: unknown) => typeof x === "string" && ID.test(x)).slice(0, 40) : null;
      const saida = typeof b?.saida === "string" && ID.test(b.saida) ? b.saida : null;
      await svc.from("site_leituras").upsert({
        visita, ...comuns,
        atualizado_em: new Date().toISOString(),
        tempo_ativo_s: inteiro(b?.tempo, 7200),
        scroll_max: inteiro(b?.scroll, 100),
        secoes, mapa, secao_saida: saida,
        cliques: inteiro(b?.cliques, 500),
        converteu: b?.converteu === true,
      }, { onConflict: "visita" });
      return ok();
    }

    await svc.from("site_visitas").insert({
      evento,
      ...comuns,
      alvo: corta(b?.alvo, 80),
      secao: typeof b?.secao === "string" && ID.test(b.secao) ? b.secao : null,
      pos_y: b?.pos_y == null ? null : inteiro(b.pos_y, 100),
    });
    return ok();
  } catch (e) {
    console.error("[site-track]", e instanceof Error ? e.message : String(e));
    return ok();
  }
});
