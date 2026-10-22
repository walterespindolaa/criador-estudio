/* ═══════════════════════════════════════════════════════════════════════════
   MODELO CRIADORA DE CONTEÚDO (22/10/2026)

   Bio + mídia kit na mesma página: o seguidor acha os links e os cupons, a
   marca acha quem assiste, os formatos e o botão de fechar parceria.

   Os números podem vir do Instagram conectado (RPC get_public_bio_social) ou
   ser digitados. O que vem do Instagram passa por uma segunda checagem aqui:
   miniatura só do nosso storage e link só do instagram.com, mesmo que o banco
   já filtre. Duas travas, porque é dado de terceiro indo pra página pública.
   ═══════════════════════════════════════════════════════════════════════════ */

import { lista, linkSeguro, txt, type DadosBloco } from "@/lib/bioBlocks";
import { ehMarcador, numeroCurto } from "@/lib/bioMovimento";
import { linhas } from "@/lib/bioConsultoria";

export const ORIGEM_STORAGE = "https://ecbzfjzoqidowrsfsfih.supabase.co/storage/v1/object/public/";

const corta = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

/* ── O que chega do Instagram ── */
export type VideoSocial = { foto: string; link: string; video: boolean; views: number | null };
export type SocialPublico = {
  conectado: boolean;
  usuario: string | null;
  atualizado_em: string | null;
  seguidores: number | null;
  videos: VideoSocial[];
  publico: { rotulo: string; pct: number }[];
  engajamento: number | null;
  alcance_30d: number | null;
};

const fotoDoInstagramOk = (u: unknown) =>
  typeof u === "string" && u.startsWith(`${ORIGEM_STORAGE}ig-thumbs/`) && !/[\s"'<>]/.test(u) && u.length < 400;
const linkDoInstagramOk = (u: unknown) =>
  typeof u === "string" && /^https:\/\/www\.instagram\.com\/(reel|p|tv)\/[A-Za-z0-9_-]{5,40}\/?$/.test(u);
const numeroOk = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

/** Lê e confere a resposta do banco. Qualquer coisa fora do formato cai fora. */
export function lerSocial(cru: unknown): SocialPublico | null {
  if (!cru || typeof cru !== "object") return null;
  const r = cru as Record<string, unknown>;
  if (r.conectado !== true) return { conectado: false, usuario: null, atualizado_em: null, seguidores: null, videos: [], publico: [], engajamento: null, alcance_30d: null };
  const usuario = typeof r.usuario === "string" && /^[A-Za-z0-9._]{1,30}$/.test(r.usuario) ? r.usuario : null;
  const videos = (Array.isArray(r.videos) ? r.videos : [])
    .filter((v) => v && fotoDoInstagramOk(v.foto) && linkDoInstagramOk(v.link))
    .slice(0, 9)
    .map((v) => ({ foto: v.foto as string, link: v.link as string, video: v.video === true, views: numeroOk(v.views) }));
  const publico = (Array.isArray(r.publico) ? r.publico : [])
    .filter((p) => p && typeof p.rotulo === "string" && p.rotulo.trim() && typeof p.pct === "number")
    .slice(0, 5)
    .map((p) => ({ rotulo: String(p.rotulo).slice(0, 40), pct: Math.max(0, Math.min(100, Math.round(p.pct))) }));
  return {
    conectado: true,
    usuario,
    atualizado_em: typeof r.atualizado_em === "string" ? r.atualizado_em : null,
    seguidores: numeroOk(r.seguidores),
    videos,
    publico,
    engajamento: numeroOk(r.engajamento),
    alcance_30d: numeroOk(r.alcance_30d),
  };
}

/* ── Redes da capa ── */
export const REDES = {
  instagram: { nome: "Instagram", rotulo: "no Instagram", base: "https://www.instagram.com/" },
  tiktok: { nome: "TikTok", rotulo: "no TikTok", base: "https://www.tiktok.com/@" },
  youtube: { nome: "YouTube", rotulo: "no YouTube", base: "https://www.youtube.com/@" },
} as const;
export type Rede = keyof typeof REDES;

export type RedeNaCapa = { rede: Rede; numero: string; rotulo: string; href: string };

/** Até 3 redes. Instagram com "puxar do Instagram" usa o número conectado;
 *  sem conexão, cai pro número digitado. Rede sem número não aparece. */
export function redesDaCapa(d: DadosBloco, social: SocialPublico | null): RedeNaCapa[] {
  return lista<Record<string, unknown>>(d, "redes").slice(0, 3).map((r) => {
    const rede = (typeof r?.rede === "string" && r.rede in REDES ? r.rede : "instagram") as Rede;
    const auto = rede === "instagram" && r?.auto === true && social?.conectado && social.seguidores !== null;
    const manual = corta(r?.numero, 14);
    const numero = auto ? numeroCurto(social!.seguidores) : (ehMarcador(manual) ? "" : manual);
    const usuarioAuto = rede === "instagram" && social?.usuario ? `${REDES.instagram.base}${social.usuario}/` : "";
    const href = linkSeguro(r?.url) || usuarioAuto;
    return { rede, numero, rotulo: REDES[rede].rotulo, href };
  }).filter((r) => r.numero);
}

/* ── Botões em destaque ── */
export const CORES_BOTAO = {
  marca: { nome: "Cor da marca" },
  lilas: { nome: "Lilás", fundo: "#D9CCFF", texto: "#1A1A1A" },
  branco: { nome: "Branco", fundo: "#FFFFFF", texto: "#1A1A1A" },
  escuro: { nome: "Escuro", fundo: "#1A1A1A", texto: "#FFFFFF" },
} as const;
export type CorBotao = keyof typeof CORES_BOTAO;

export function lerBotoes(d: DadosBloco) {
  return lista<Record<string, unknown>>(d, "itens").slice(0, 8).map((b) => ({
    titulo: corta(b?.titulo, 60),
    sub: corta(b?.sub, 80),
    href: linkSeguro(b?.url),
    cor: (typeof b?.cor === "string" && b.cor in CORES_BOTAO ? b.cor : "marca") as CorBotao,
    icone: typeof b?.icone === "string" ? b.icone : "",
  })).filter((b) => b.titulo && b.href);
}

/* ── Vídeos ── */
export type VideoNaPagina = { foto: string; href: string; views: string; video: boolean };

export function videosDaPagina(d: DadosBloco, social: SocialPublico | null): VideoNaPagina[] {
  const quantos = [3, 6, 9].includes(Number(d.quantos)) ? Number(d.quantos) : 6;
  if (txt(d, "fonte", "manual") === "instagram") {
    return (social?.videos ?? []).slice(0, quantos).map((v) => ({
      foto: v.foto, href: v.link, views: v.views ? numeroCurto(v.views) : "", video: v.video,
    }));
  }
  return lista<Record<string, unknown>>(d, "itens").slice(0, 9).map((v) => ({
    foto: fotoNossa(v?.foto), href: linkSeguro(v?.url), views: ehMarcador(corta(v?.views, 12)) ? "" : corta(v?.views, 12), video: true,
  })).filter((v) => v.foto && v.href).slice(0, quantos);
}

/** Foto subida pela própria pessoa no bucket da bio. Endereço de fora não entra:
 *  imagem de terceiro pode sumir, trocar de conteúdo ou rastrear o visitante. */
export function fotoNossa(u: unknown): string {
  return typeof u === "string" && u.startsWith(`${ORIGEM_STORAGE}bio-media/`) && !/[\s"'<>]/.test(u) && u.length < 400 ? u : "";
}

/** Link "Ver no Instagram" do bloco de vídeos. */
export function perfilDosVideos(d: DadosBloco, social: SocialPublico | null): { href: string; rotulo: string } | null {
  const manual = linkSeguro(txt(d, "perfil"));
  if (manual) return { href: manual, rotulo: txt(d, "perfilRotulo", "Ver todos") };
  if (txt(d, "fonte") === "instagram" && social?.usuario) return { href: `${REDES.instagram.base}${social.usuario}/`, rotulo: "Ver no Instagram" };
  return null;
}

/* ── Cupons ── */
export function lerCupons(d: DadosBloco) {
  return lista<Record<string, unknown>>(d, "itens").slice(0, 8).map((c) => ({
    marca: corta(c?.marca, 40),
    desconto: corta(c?.desconto, 40),
    codigo: corta(c?.codigo, 30).replace(/\s+/g, "").toUpperCase(),
    href: linkSeguro(c?.url),
  })).filter((c) => c.codigo && !ehMarcador(c.codigo));
}

/* ── Mídia kit ── */
export type BarraPublico = { rotulo: string; pct: number };

export function publicoDoKit(d: DadosBloco, social: SocialPublico | null): { barras: BarraPublico[]; doInstagram: boolean } {
  if (d.auto === true && social?.conectado && social.publico.length) return { barras: social.publico, doInstagram: true };
  const barras = lista<{ rotulo?: string; pct?: unknown }>(d, "publico")
    .map((p) => ({ rotulo: corta(p?.rotulo, 40), pct: Math.round(Number(String(p?.pct ?? "").replace(",", "."))) }))
    .filter((p) => p.rotulo && Number.isFinite(p.pct) && p.pct > 0 && p.pct <= 100)
    .slice(0, 5);
  return { barras, doInstagram: false };
}

export function numerosDoKit(d: DadosBloco, social: SocialPublico | null): { valor: string; rotulo: string }[] {
  const auto = d.auto === true && !!social?.conectado;
  const eng = auto && social!.engajamento !== null
    ? `${social!.engajamento!.toFixed(1).replace(".", ",")}%` : corta(d.engajamento, 14);
  const alc = auto && social!.alcance_30d !== null ? numeroCurto(social!.alcance_30d) : corta(d.alcance, 14);
  const r: { valor: string; rotulo: string }[] = [];
  if (eng && !ehMarcador(eng)) r.push({ valor: eng, rotulo: "engajamento médio" });
  if (alc && !ehMarcador(alc)) r.push({ valor: alc, rotulo: auto && social!.alcance_30d !== null ? "alcance em 30 dias" : "alcance por mês" });
  return r;
}

export function lerFormatos(d: DadosBloco) {
  return lista<Record<string, unknown>>(d, "formatos").slice(0, 4).map((f) => ({
    nome: corta(f?.nome, 24),
    inclui: linhas(f?.inclui, 6, 100),
    preco: (() => { const p = corta(f?.preco, 20).replace(/^r\$\s*/i, ""); return ehMarcador(p) ? "" : p; })(),
  })).filter((f) => f.nome);
}

export function lerMarcas(d: DadosBloco) {
  return lista<Record<string, unknown>>(d, "marcas").slice(0, 9).map((m) => ({
    nome: corta(m?.nome, 30), logo: fotoNossa(m?.logo),
  })).filter((m) => (m.nome && !ehMarcador(m.nome)) || m.logo);
}

/** PDF do mídia kit: só o que a pessoa subiu no nosso storage. */
export function pdfDoKit(u: unknown): string {
  return typeof u === "string" && u.startsWith(`${ORIGEM_STORAGE}bio-media/`) && /\.pdf$/i.test(u) && !/[\s"'<>]/.test(u) && u.length < 400 ? u : "";
}

/** "outubro de 2026", no fuso de Brasília. */
export function mesAno(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(d);
}
