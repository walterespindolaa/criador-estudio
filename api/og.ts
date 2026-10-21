/* IMAGEM DA PRÉVIA (1200x630) · /api/og?t=<tipo>&k=<token>
   Função edge da Vercel. NÃO confia em texto vindo da URL: só lê o tipo e o
   token, pergunta ao banco (RPC link_previa) e desenha. Link inválido, banco
   fora ou logo quebrado: cai na arte genérica do CRIA, nunca em erro. */
import { ImageResponse } from "@vercel/og";
import { montarPrevia, previaGenerica, type TipoLink, type DadosPrevia } from "../src/lib/previa-link";
import { arteDaPrevia, LARGURA, ALTURA } from "../src/lib/previa-arte";
import { SUPABASE_URL_PUBLICA, SUPABASE_ANON_PUBLICA } from "../src/lib/supabase-publico";
import { lerRotaBio, montarPreviaBio, arteDaBio, type DadosBio } from "../src/lib/previa-bio";

export const config = { runtime: "edge" };

const TIPOS: TipoLink[] = ["aprovar", "materiais", "roteiros", "cronograma", "proposta", "agendar",
  "cadastro", "acessos", "conectar", "signup", "indicacao"];

async function buscarDados(tipo: TipoLink, token: string | null): Promise<DadosPrevia> {
  if (!token || tipo === "signup") return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3000);
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

async function buscarBio(slug: string): Promise<DadosBio> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3000);
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

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const tipoCru = url.searchParams.get("t") ?? "signup";
  const tipo = (TIPOS as string[]).includes(tipoCru) ? (tipoCru as TipoLink) : "signup";
  const token = url.searchParams.get("k");
  const dados = await buscarDados(tipo, token && token.length <= 200 ? token : null);
  const previa = montarPrevia(tipo, dados);

  const fonte = async (peso: number) =>
    fetch(new URL(`/fonts/nunito-${peso}.woff`, url.origin)).then((r) => r.arrayBuffer());
  const [f600, f700, f800] = await Promise.all([fonte(600), fonte(700), fonte(800)]);
  const fonts = [
    { name: "Nunito", data: f600, weight: 600 as const, style: "normal" as const },
    { name: "Nunito", data: f700, weight: 700 as const, style: "normal" as const },
    { name: "Nunito", data: f800, weight: 800 as const, style: "normal" as const },
  ];
  const headers = { "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=86400" };

  /* Link na bio: banner, foto e nome da página. Banner ou foto quebrados:
     desenha sem as imagens; bio que não existe: cai na arte genérica. */
  if (tipoCru === "bio") {
    const slug = lerRotaBio(`/bio/${url.searchParams.get("k") ?? ""}`);
    const pb = slug ? montarPreviaBio(await buscarBio(slug), slug) : null;
    if (pb) {
      const desenharBio = async (semImagens: boolean) => {
        const resp = new ImageResponse(arteDaBio(pb, { semImagens }) as never, { width: LARGURA, height: ALTURA, fonts, headers });
        const buf = await resp.arrayBuffer();
        return new Response(buf, { status: 200, headers: { "Content-Type": "image/png", ...headers } });
      };
      try { return await desenharBio(false); } catch { try { return await desenharBio(true); } catch { /* genérica abaixo */ } }
    }
  }

  const desenhar = async (p: typeof previa) => {
    const resp = new ImageResponse(arteDaPrevia(p) as never, { width: LARGURA, height: ALTURA, fonts, headers });
    // Força a renderização aqui dentro: se o logo da conta não carregar, o erro
    // aparece agora e dá pra tentar de novo sem ele.
    const buf = await resp.arrayBuffer();
    return new Response(buf, { status: 200, headers: { "Content-Type": "image/png", ...headers } });
  };

  try {
    return await desenhar(previa);
  } catch {
    try {
      return await desenhar({ ...previa, arte: { ...previa.arte, logo: null } });
    } catch {
      return await desenhar(previaGenerica(tipo));
    }
  }
}
