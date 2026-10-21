/* ═══════════════════════════════════════════════════════════════════════════
   PRÉVIA DOS LINKS NO WHATSAPP · Routing Middleware da Vercel
   (Walter, 19/10/2026; mockup aprovado)

   O app é uma SPA: todo link devolve o mesmo index.html, então o WhatsApp
   mostrava sempre "Cria Social Club | Seu Estúdio Criativo" com o logo pequeno.
   Aqui, SÓ quando quem pede é um robô de prévia (WhatsApp, Facebook/Instagram,
   iMessage, Telegram, Slack, LinkedIn, Discord), devolvemos um HTML mínimo com
   título, descrição e a arte daquele link (api/og). Gente passa direto: a
   função retorna sem resposta e a Vercel segue pro app normal.

   Os textos saem de src/lib/previa-link.ts (testado) com os dados da RPC
   link_previa, lidos NA HORA: mês do período do link, nome da conta dona do
   link. Banco fora ou link inválido: prévia genérica, nunca erro.
   ═══════════════════════════════════════════════════════════════════════════ */
import { ehRoboDePrevia, lerRota, montarPrevia, escaparHtml, type DadosPrevia, type TipoLink } from "./src/lib/previa-link";
import { SUPABASE_URL_PUBLICA, SUPABASE_ANON_PUBLICA } from "./src/lib/supabase-publico";
import { lerRotaBio, montarPreviaBio, type DadosBio } from "./src/lib/previa-bio";

export const config = {
  matcher: [
    "/aprovar/:token", "/materiais/:token", "/roteiros/:token", "/cronograma/:token",
    "/proposta/:token", "/agendar/:token", "/cadastro/:token", "/acessos/:token",
    "/conectar/:token", "/p/:codigo", "/signup",
    // Link na bio (Walter, 21/10): criaclub.bio/nome e /bio/nome.
    "/bio/:slug", "/:slug",
  ],
};

async function buscarDados(tipo: TipoLink, token: string | null): Promise<DadosPrevia> {
  if (!token || tipo === "signup") return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(`${SUPABASE_URL_PUBLICA}/rest/v1/rpc/link_previa`, {
      method: "POST", signal: ctrl.signal,
      headers: { apikey: SUPABASE_ANON_PUBLICA, Authorization: `Bearer ${SUPABASE_ANON_PUBLICA}`, "Content-Type": "application/json" },
      body: JSON.stringify({ _tipo: tipo, _token: token }),
    });
    if (!r.ok) return null;
    return (await r.json()) as DadosPrevia;
  } catch { return null; } finally { clearTimeout(t); }
}

/** Muda quando os dados mudam: o CDN não segura arte velha de outro mês. */
function versao(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

async function buscarBio(slug: string): Promise<DadosBio> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(`${SUPABASE_URL_PUBLICA}/rest/v1/rpc/get_public_profile_by_slug`, {
      method: "POST", signal: ctrl.signal,
      headers: { apikey: SUPABASE_ANON_PUBLICA, Authorization: `Bearer ${SUPABASE_ANON_PUBLICA}`, "Content-Type": "application/json" },
      body: JSON.stringify({ _slug: slug }),
    });
    if (!r.ok) return null;
    const linhas = (await r.json()) as DadosBio[];
    return Array.isArray(linhas) && linhas[0] ? linhas[0] : null;
  } catch { return null; } finally { clearTimeout(t); }
}

/** Prévia da bio. Slug que não é bio publicada: sem resposta, o app segue. */
async function previaDaBio(url: URL, slug: string): Promise<Response | undefined> {
  const dados = await buscarBio(slug);
  const p = montarPreviaBio(dados, slug);
  if (!p) return undefined;
  const params = new URLSearchParams({ t: "bio", k: slug, v: versao(JSON.stringify(p)) });
  const imagem = `${url.origin}/api/og?${params.toString()}`;
  const pagina = `${url.origin}${url.pathname}`;
  const e = escaparHtml;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${e(p.titulo)}</title>
<meta name="description" content="${e(p.descricao)}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="${e(p.endereco)}">
<meta property="og:locale" content="pt_BR">
<meta property="og:url" content="${e(pagina)}">
<meta property="og:title" content="${e(p.titulo)}">
<meta property="og:description" content="${e(p.descricao)}">
<meta property="og:image" content="${e(imagem)}">
<meta property="og:image:secure_url" content="${e(imagem)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${e(p.nome)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(p.titulo)}">
<meta name="twitter:description" content="${e(p.descricao)}">
<meta name="twitter:image" content="${e(imagem)}">
</head><body><a href="${e(pagina)}">${e(p.titulo)}</a></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=300", Vary: "User-Agent" },
  });
}

export default async function middleware(req: Request): Promise<Response | undefined> {
  if (!ehRoboDePrevia(req.headers.get("user-agent"))) return undefined; // gente: segue pro app
  const url = new URL(req.url);
  const rota = lerRota(url.pathname);
  if (!rota) {
    const slug = lerRotaBio(url.pathname);
    return slug ? previaDaBio(url, slug) : undefined;
  }

  const dados = await buscarDados(rota.tipo, rota.token);
  const p = montarPrevia(rota.tipo, dados);
  const params = new URLSearchParams({ t: rota.tipo });
  if (rota.token) params.set("k", rota.token);
  params.set("v", versao(JSON.stringify(dados ?? {})));
  const imagem = `${url.origin}/api/og?${params.toString()}`;
  const pagina = `${url.origin}${url.pathname}`;
  const e = escaparHtml;
  const ehDeCliente = rota.tipo !== "signup" && rota.tipo !== "indicacao";

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${e(p.titulo)}</title>
<meta name="description" content="${e(p.descricao)}">
${ehDeCliente ? '<meta name="robots" content="noindex, nofollow">' : ""}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Cria Social Club">
<meta property="og:locale" content="pt_BR">
<meta property="og:url" content="${e(pagina)}">
<meta property="og:title" content="${e(p.titulo)}">
<meta property="og:description" content="${e(p.descricao)}">
<meta property="og:image" content="${e(imagem)}">
<meta property="og:image:secure_url" content="${e(imagem)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${e(p.arte.frase)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(p.titulo)}">
<meta name="twitter:description" content="${e(p.descricao)}">
<meta name="twitter:image" content="${e(imagem)}">
</head><body><a href="${e(pagina)}">${e(p.titulo)}</a></body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300",
      // Robô e gente usam a mesma URL: o CDN separa por user-agent.
      Vary: "User-Agent",
    },
  });
}
