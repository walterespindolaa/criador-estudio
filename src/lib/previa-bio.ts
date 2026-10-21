/* ═══════════════════════════════════════════════════════════════════════════
   PRÉVIA DO LINK NA BIO NO WHATSAPP (Walter, 21/10/2026)

   criaclub.bio/nome e app.criasocialclub.com.br/bio/nome mostravam a prévia
   genérica do app ("Cria Social Club | Seu Estúdio Criativo" + logo preto),
   porque o robô do WhatsApp não roda a SPA. O middleware (middleware.ts)
   agora reconhece o caminho da bio, lê a RPC pública get_public_profile_by_slug
   (a mesma que a BioPage usa) e devolve título = nome da página, descrição =
   bio e uma arte 1200x630 com o banner, a foto e o nome (api/og?t=bio).

   Slug que não é bio (rota do app, página que não existe): o middleware não
   responde e o app segue normal. Funções puras, cobertas por previa-bio.test.ts.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Linha que a RPC get_public_profile_by_slug devolve (o que a prévia usa). */
export type DadosBio = {
  name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  bio_slug?: string | null;
  bio_settings?: Record<string, unknown> | null;
} | null;

export type PreviaBio = {
  titulo: string;
  descricao: string;
  nome: string;
  bio: string | null;
  avatar: string | null;
  banner: string | null;
  /** Endereço curto mostrado na pílula da arte. */
  endereco: string;
  corBotao: string;
  corTextoBotao: string;
};

/** Primeiro trecho do caminho que nunca é bio (rotas do app e arquivos). */
const RESERVADOS = new Set([
  "app", "api", "auth", "login", "signup", "cadastrar", "entrar", "onboarding", "obrigado", "termos",
  "privacidade", "excluir-dados", "reset-password", "socialmidia", "parceiro", "parceiros", "admin",
  "aprovar", "materiais", "roteiros", "cronograma", "proposta", "agendar", "cadastro", "acessos",
  "conectar", "p", "assets", "fonts", "icons", "favicon.ico", "manifest.webmanifest", "sw.js",
  "robots.txt", "sitemap.xml",
]);

const SLUG = /^[a-z0-9][a-z0-9._-]{1,59}$/i;

/** "/nome" ou "/bio/nome" → "nome". Qualquer outra coisa → null. */
export function lerRotaBio(pathname: string): string | null {
  const p = (pathname || "/").replace(/\/+$/, "");
  const m = /^\/(?:bio\/)?([^/?#]+)$/.exec(p);
  if (!m) return null;
  let slug = m[1];
  try { slug = decodeURIComponent(slug); } catch { return null; }
  if (!SLUG.test(slug)) return null;
  if (!p.startsWith("/bio/") && RESERVADOS.has(slug.toLowerCase())) return null;
  if (/\.(png|jpe?g|gif|svg|webp|ico|js|mjs|css|map|json|txt|xml|webmanifest|woff2?|ttf|html?|pdf|mp4)$/i.test(slug)) return null; // arquivo
  return slug.toLowerCase();
}

function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function https(v: unknown): string | null {
  return typeof v === "string" && /^https:\/\/[^\s"'<>]+$/.test(v.trim()) ? v.trim() : null;
}

function cor(v: unknown, padrao: string): string {
  return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : padrao;
}

/** null = não é uma bio publicada (o middleware deixa o app responder). */
export function montarPreviaBio(d: DadosBio, slug: string): PreviaBio | null {
  if (!d || !d.bio_slug) return null;
  const s = (d.bio_settings && typeof d.bio_settings === "object" ? d.bio_settings : {}) as Record<string, unknown>;
  const topo = (s.header && typeof s.header === "object" ? s.header : {}) as Record<string, unknown>;
  // Mesma regra do editor: o que estiver no topo da bio vale; vazio usa o perfil.
  const nome = texto(topo.name, 40) ?? texto(d.name, 40) ?? `@${slug}`;
  const bio = texto(topo.bio, 110) ?? texto(d.bio, 110);
  return {
    titulo: nome,
    descricao: bio ?? `Os links de ${nome} num lugar só.`,
    nome,
    bio,
    avatar: https(topo.avatar) ?? https(d.avatar_url),
    banner: https(s.bannerImage),
    endereco: `criaclub.bio/${slug}`,
    corBotao: cor(s.buttonColor, "#17140F"),
    corTextoBotao: cor(s.buttonTextColor, "#FFF6EA"),
  };
}

/* ── A ARTE (1200x630), em árvore de elementos pro satori (@vercel/og) ── */
type El = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): El =>
  ({ type, props: { style, ...extra, ...(children !== undefined ? { children } : {}) } });

const CREME = "#F4EFE3";
const TINTA = "#17140F";

export function arteDaBio(p: PreviaBio, opcoes: { semImagens?: boolean } = {}): El {
  const banner = opcoes.semImagens ? null : p.banner;
  const avatar = opcoes.semImagens ? null : p.avatar;
  const inicial = p.nome.replace(/^@/, "").charAt(0).toUpperCase() || "C";
  const tamNome = p.nome.length > 26 ? 52 : p.nome.length > 18 ? 60 : 68;

  const faixa = banner
    ? h("img", { position: "absolute", left: 0, top: 0, width: 1200, height: 300, objectFit: "cover" }, undefined,
        { src: banner, width: 1200, height: 300 })
    : h("div", { position: "absolute", left: 0, top: 0, width: 1200, height: 300, display: "flex", background: "#2A4BDF", overflow: "hidden" }, [
        h("div", { position: "absolute", left: -80, top: 120, width: 420, height: 300, borderRadius: 999, background: "#CE4A1D" }),
        h("div", { position: "absolute", right: -60, top: -120, width: 380, height: 320, borderRadius: 999, background: "#F27EB5" }),
        h("div", { position: "absolute", right: 260, top: 200, width: 200, height: 180, borderRadius: 999, background: "#F2C21E" }),
      ]);

  const foto = avatar
    ? h("img", { width: 196, height: 196, borderRadius: 999, objectFit: "cover", border: `8px solid ${CREME}` }, undefined,
        { src: avatar, width: 196, height: 196 })
    : h("div", { width: 196, height: 196, borderRadius: 999, border: `8px solid ${CREME}`, background: p.corBotao, color: p.corTextoBotao,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 90, fontWeight: 800 }, inicial);

  return h("div", { width: 1200, height: 630, display: "flex", position: "relative", overflow: "hidden", background: CREME, fontFamily: "Nunito" }, [
    faixa,
    h("div", { position: "absolute", right: -90, bottom: -140, width: 330, height: 330, borderRadius: 999, background: "#F2C21E" }),
    h("div", { position: "absolute", left: 64, top: 200, display: "flex" }, [foto]),
    h("div", { position: "absolute", left: 290, top: 318, width: 820, display: "flex", flexDirection: "column" }, [
      h("div", { fontSize: tamNome, fontWeight: 800, color: TINTA, lineHeight: 1.05, letterSpacing: -1 }, p.nome),
      ...(p.bio ? [h("div", { fontSize: 30, fontWeight: 600, color: "#4A4339", lineHeight: 1.3, marginTop: 10, maxWidth: 800 }, p.bio)] : []),
    ]),
    h("div", { position: "absolute", left: 64, bottom: 44, display: "flex", background: p.corBotao, color: p.corTextoBotao,
      borderRadius: 999, padding: "12px 28px", fontSize: 26, fontWeight: 800 }, `${p.endereco} · toque pra abrir`),
  ]);
}
