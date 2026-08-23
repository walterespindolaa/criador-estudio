import { refLinkHref, refLinkLabel } from "@/lib/refLinks";

/* ═══════════════════════════════════════════════════════════════════════════
   PRÉVIA DE UM LINK DE REFERÊNCIA

   A referência do roteiro é sempre "aquele reel que eu te mandei". Um link cru
   não diz nada: quem abre o guia não sabe se é Instagram, TikTok ou YouTube,
   e no celular a URL ainda quebra o layout.

   Aqui o link vira: plataforma reconhecida, rótulo curto e, quando sai de
   graça, a capa. Só o YouTube entrega capa por URL pública. Instagram e TikTok
   exigem ir buscar (é o que useLinkPreviews faz, uma vez por link), então aqui
   eles saem sem thumb e quem exibe cai no ícone até a capa chegar.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Plataforma = "instagram" | "tiktok" | "youtube" | "drive" | "web";

export type PreviaLink = {
  url: string;        // href seguro (com https://)
  plataforma: Plataforma;
  nome: string;       // "Instagram", "TikTok"…
  label: string;      // rótulo curto pra caber na tela
  thumb: string | null; // capa, quando existe uma URL pública
};

const NOMES: Record<Plataforma, string> = {
  instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", drive: "Google Drive", web: "Link",
};

function idDoYoutube(u: URL): string | null {
  if (/youtu\.be$/i.test(u.hostname)) return u.pathname.slice(1).split("/")[0] || null;
  if (/youtube\.com$/i.test(u.hostname.replace(/^www\./, ""))) {
    const v = u.searchParams.get("v");
    if (v) return v;
    const m = u.pathname.match(/\/(shorts|embed)\/([^/?#]+)/);
    if (m) return m[2];
  }
  return null;
}

/** Shortcode do post/reel do Instagram (o que vem depois de /p/, /reel/ ou /tv/). */
export function shortcodeInstagram(link: string): string | null {
  try {
    const u = new URL(refLinkHref(link));
    if (!/instagram\.com$/i.test(u.hostname.replace(/^www\./, ""))) return null;
    const m = u.pathname.match(/\/(p|reel|reels|tv)\/([^/?#]+)/);
    return m ? m[2] : null;
  } catch { return null; }
}

export function previaDeLink(link: string): PreviaLink {
  const url = refLinkHref(link);
  const label = refLinkLabel(link, 42);
  let plataforma: Plataforma = "web";
  let thumb: string | null = null;

  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();

    if (host.endsWith("instagram.com")) {
      plataforma = "instagram";
      // Sem capa por URL: o endpoint público /p/CODIGO/media/ foi desligado e o
      // CDN bloqueia hotlink. A capa do Instagram vem do cache (useLinkPreviews),
      // que busca uma vez pela edge e guarda a imagem num bucket nosso.
    } else if (host.endsWith("tiktok.com")) {
      plataforma = "tiktok";
    } else if (host.endsWith("youtube.com") || host.endsWith("youtu.be")) {
      plataforma = "youtube";
      const id = idDoYoutube(u);
      if (id) thumb = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    } else if (host.endsWith("drive.google.com") || host.endsWith("docs.google.com")) {
      plataforma = "drive";
    }
  } catch { /* link torto: fica como "web" */ }

  return { url, plataforma, nome: NOMES[plataforma], label, thumb };
}

/** Várias referências de uma vez (o campo guarda um link por linha). */
export function previasDeLinks(links: string[]): PreviaLink[] {
  return links.map(previaDeLink);
}
