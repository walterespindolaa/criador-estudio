/* ═══════════════════════════════════════════════════════════════════════════
   PRÉVIA DO LINK NA BIO NO WHATSAPP

   21/10/2026: o robô do WhatsApp não roda a SPA, então o middleware
   (middleware.ts) responde a ele com título, descrição e uma arte 1200x630
   (api/og?t=bio).

   22/10/2026 (Fase 5, mockup aprovado): a arte segue o modelo da página.
   Especialista, Consultoria, Loja e Criadora ganham a arte delas; quando
   falta o essencial (foto, título de verdade), cai na arte NEUTRA: cor da
   marca, foto redonda ou inicial, nome e endereço. Nunca uma arte pela metade.

   As regras que impedem uma página de aparecer com coisa de outra:
   · os dados vêm de UMA RPC (get_bio_previa) que acha o dono pelo slug e só
     devolve o que a página pública já mostra (seções no ar);
   · o slug devolvido tem que ser o slug pedido, senão não há prévia;
   · foto só do nosso storage (bio-media ou avatars) NA PASTA DO DONO, ou o
     pôster do vídeo dele no Bunny, montado aqui a partir do id do vídeo.
     Endereço de fora, de outra pasta ou assinado (temporário) fica fora;
   · texto com cara de espaço reservado ("[00]", "[preço]") ou igual ao
     texto de exemplo do modelo não entra: a arte cai pra neutra;
   · a imagem é desenhada de novo pelo slug no api/og; a URL só leva o slug
     e um carimbo dos dados (cache), nunca texto ou endereço de imagem.

   Funções puras, cobertas por previa-bio.test.ts.
   ═══════════════════════════════════════════════════════════════════════════ */

import { TEXTOS_DE_EXEMPLO } from "./textosExemplo";

/* ── O que a RPC get_bio_previa devolve ── */
type Bloco = { kind?: unknown; data?: unknown };
export type DadosPreviaBio = {
  slug?: string | null;
  origem?: string | null;
  dono?: string | null;
  /** Pastas de quem pode editar a página e que já aparecem nas fotos dela
   *  (a gestora que montou a página do cliente sobe na pasta dela). */
  pastas?: unknown;
  nome?: string | null;
  bio?: string | null;
  avatar?: string | null;
  ajustes?: Record<string, unknown> | null;
  blocos?: Bloco[] | null;
  seguidores?: number | null;
} | null;
/** Nome antigo, mantido pra quem já importava. */
export type DadosBio = DadosPreviaBio;

export type ModeloArte = "classica" | "neutra" | "especialista" | "consultoria" | "loja" | "criadora";

type Base = {
  titulo: string;
  descricao: string;
  nome: string;
  /** Endereço curto mostrado na pílula da arte. */
  endereco: string;
  cor: string;
  corTexto: string;
};
export type PreviaBio =
  | (Base & { modelo: "classica"; bio: string | null; avatar: string | null; banner: string | null })
  | (Base & { modelo: "neutra"; frase: string | null; foto: string | null })
  | (Base & { modelo: "especialista"; profissao: string | null; foto: string; numeros: { valor: string; rotulo: string }[];
      assinatura: { modo: "fonte"; fonte: string } | { modo: "desenho"; d: string } })
  | (Base & { modelo: "consultoria"; manchete: string; destaque: string; apoio: string | null; foto: string | null })
  | (Base & { modelo: "loja"; apoio: string | null; foto: string; itens: { nome: string; preco: string | null; foto: string }[]; horario: string | null })
  | (Base & { modelo: "criadora"; frase: string | null; foto: string; selo: string | null; redes: { numero: string; rotulo: string }[] });

/* ── ROTA ── */

/** Primeiro trecho do caminho que nunca é bio (rotas do app e arquivos).
 *  A mesma lista está no banco (bio_slug_reservado), que recusa esses nomes
 *  como endereço de bio: sem isso, criaclub.bio/login abriria o login. */
export const RESERVADOS = new Set([
  "app", "api", "auth", "login", "signup", "cadastrar", "entrar", "onboarding", "obrigado", "termos",
  "privacidade", "excluir-dados", "reset-password", "socialmidia", "parceiro", "parceiros", "admin",
  "aprovar", "materiais", "roteiros", "cronograma", "proposta", "agendar", "cadastro", "acessos",
  "conectar", "p", "assets", "fonts", "icons", "favicon.ico", "manifest.webmanifest", "sw.js",
  "robots.txt", "sitemap.xml", "bio", "ativar", "comecar-agencia",
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

/* ── TRAVAS ── */

const ehMarcador = (t: string) => /\[[^\]]*\]/.test(t) || /^\s*0{2,}\s*[a-z%]*\s*$/i.test(t);

/** Texto limpo e curto. Marcador ou texto de exemplo do modelo: null. */
export function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  if (TEXTOS_DE_EXEMPLO.has(v.trim())) return null;
  const t = v.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  if (!t || ehMarcador(t) || TEXTOS_DE_EXEMPLO.has(t)) return null;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export const STORAGE_PUBLICO = "https://ecbzfjzoqidowrsfsfih.supabase.co/storage/v1/object/public/";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUNNY_CAPA = "vz-86788381-03e.b-cdn.net";

/** Foto que pode ir pra arte: do nosso storage, na pasta do dono da página
 *  ou de quem pode editá-la (lista que vem do banco). Qualquer outra (de
 *  fora, de outra pasta, link assinado) volta null. */
export function imagemDoDono(u: unknown, donos: string | string[]): string | null {
  const lista = (Array.isArray(donos) ? donos : [donos]).filter((x) => typeof x === "string" && UUID.test(x)).map((x) => x.toLowerCase());
  if (typeof u !== "string" || !lista.length) return null;
  const t = u.trim();
  if (t.length > 500 || /[\s"'<>\\]/.test(t) || t.includes("..") || t.includes("?") || t.includes("#")) return null;
  if (!t.startsWith(STORAGE_PUBLICO)) return null;
  const resto = t.slice(STORAGE_PUBLICO.length).split("/");
  if (resto.length < 3 || !["bio-media", "avatars"].includes(resto[0])) return null;
  if (!lista.includes(resto[1].toLowerCase())) return null;
  return resto.slice(2).every((p) => /^[A-Za-z0-9._-]+$/.test(p)) ? t : null;
}

/** Pôster do vídeo da capa, montado aqui. Do bloco só sai o id do vídeo. */
function posterDoVideo(guid: unknown): string | null {
  return typeof guid === "string" && UUID.test(guid) ? `https://${BUNNY_CAPA}/${guid.toLowerCase()}/thumbnail.jpg` : null;
}

function cor(v: unknown, padrao: string): string {
  return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toUpperCase() : padrao;
}

/** Luminância (0 a 1). Fundo claro demais não segura texto branco. */
function luz(hex: string): number {
  const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2];
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const real = (n: number) => "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
function preco(v: unknown): string | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim()
    ? Number(v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) : NaN;
  return Number.isFinite(n) && n > 0 && n < 100000 ? real(n) : null;
}

function numeroCurto(n: number): string {
  const c = (v: number) => (v >= 100 ? String(Math.floor(v)) : (Math.floor(v * 10) / 10).toFixed(1).replace(/\.0$/, "")).replace(".", ",");
  if (n >= 1_000_000) return `${c(n / 1_000_000)} mi`;
  if (n >= 1_000) return `${c(n / 1_000)} mil`;
  return String(Math.round(n));
}

const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const hBonita = (h: string) => (h.endsWith(":00") ? `${Number(h.slice(0, 2))}h` : `${Number(h.slice(0, 2))}h${h.slice(3)}`);

/** "Seg a Sáb · 7h às 19h". Só quando os dias abertos têm o mesmo horário.
 *  Nada de "aberto agora": a prévia fica guardada no WhatsApp por dias. */
export function resumoDaSemana(d: Record<string, unknown>): string | null {
  const dias = arr(d.dias).slice(0, 7).map(obj);
  if (dias.length !== 7) return null;
  const hora = (v: unknown) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null);
  const abertos = dias.map((x, i) => ({ i, ok: x.aberto === true, abre: hora(x.abre), fecha: hora(x.fecha) })).filter((x) => x.ok);
  if (!abertos.length || abertos.some((x) => !x.abre || !x.fecha)) return null;
  if (abertos.some((x) => x.abre !== abertos[0].abre || x.fecha !== abertos[0].fecha)) return null;
  // Segunda primeiro, domingo no fim.
  const ordem = abertos.map((x) => (x.i + 6) % 7).sort((a, b) => a - b);
  const nome = (k: number) => DIAS_CURTOS[(k + 1) % 7];
  const seguidos = ordem.every((k, n) => n === 0 || k === ordem[n - 1] + 1);
  const quando = ordem.length === 7 ? "Todos os dias"
    : seguidos && ordem.length > 2 ? `${nome(ordem[0])} a ${nome(ordem[ordem.length - 1])}`
    : ordem.map(nome).join(", ");
  return `${quando} · ${hBonita(abertos[0].abre!)} às ${hBonita(abertos[0].fecha!)}`;
}

/* ── MONTAGEM ── */

/** null = não é uma bio publicada (o middleware deixa o app responder). */
export function montarPreviaBio(d: DadosPreviaBio, slug: string): PreviaBio | null {
  if (!d || typeof d.slug !== "string" || d.slug.toLowerCase() !== slug.toLowerCase()) return null;
  const dono = typeof d.dono === "string" && UUID.test(d.dono) ? d.dono : "";
  if (!dono) return null;
  const aj = obj(d.ajustes);
  const topo = obj(aj.header);
  const blocos = arr(d.blocos).map(obj).map((b) => ({ kind: String(b.kind ?? ""), data: obj(b.data) }));
  const achar = (k: string) => blocos.find((b) => b.kind === k)?.data;
  const pastas = [dono, ...arr(d.pastas).filter((x): x is string => typeof x === "string" && UUID.test(x))];
  const foto = (u: unknown) => imagemDoDono(u, pastas);

  const corMarca = cor(aj.buttonColor, "#17140F");
  const corTexto = cor(aj.buttonTextColor, "#FFF6EA");
  const endereco = `criaclub.bio/${slug}`;

  // O nome: o que estiver no topo; senão o "Seu negócio"; senão o título
  // curto da capa; senão o perfil; senão @slug.
  const capa = achar("capa");
  const tituloCapa = texto(capa?.titulo, 60);
  const nome = texto(topo.name, 40) ?? texto(achar("contato")?.titulo, 40)
    ?? (tituloCapa && tituloCapa.length <= 28 ? tituloCapa : null) ?? texto(d.nome, 40) ?? `@${slug}`;
  const base = { titulo: nome, nome, endereco, cor: corMarca, corTexto };

  if (aj.layout !== "vitrine") {
    const bio = texto(topo.bio, 110) ?? texto(d.bio, 110);
    return {
      ...base, modelo: "classica", descricao: bio ?? `Os links de ${nome} num lugar só.`, bio,
      avatar: foto(topo.avatar) ?? foto(d.avatar), banner: foto(aj.bannerImage),
    };
  }

  const neutra = (frase: string | null): PreviaBio => ({
    ...base, modelo: "neutra", descricao: frase ?? `O site de ${nome}.`, frase,
    foto: foto(topo.avatar) ?? foto(d.avatar) ?? foto(capa?.imagem) ?? foto(achar("perfil_criadora")?.foto),
  });
  // O botão fixo não ocupa lugar na página: não é ele que define o topo.
  const topoDaPagina = blocos.find((b) => b.kind !== "acao_fixa");
  const primeiro = topoDaPagina?.kind;

  /* Especialista: capa com vídeo ou foto e o nome em assinatura. */
  if (primeiro === "apresentacao" && topoDaPagina) {
    const a = topoDaPagina.data;
    const imagem = (a.midia === "imagem" ? foto(a.imagem) : null) ?? posterDoVideo(a.video_guid) ?? foto(a.imagem);
    const nomeAss = texto(a.nome, 30) ?? nome;
    const profissao = texto(a.profissao, 40);
    if (!imagem) return neutra(profissao);
    const ass = obj(a.assinatura);
    const traco = typeof ass.d === "string" && ass.d.length <= 40000 && /^[ML0-9.\s-]+$/.test(ass.d) ? ass.d.trim() : "";
    const fontes = ["delafield", "muellerhoff", "great-vibes", "allura", "la-doulaise"];
    const numeros = arr(achar("numeros")?.itens).map(obj)
      .map((n) => ({ valor: texto(n.valor, 10), rotulo: texto(n.rotulo, 28) }))
      .filter((n): n is { valor: string; rotulo: string } => !!n.valor && !!n.rotulo).slice(0, 2);
    return {
      ...base, nome: nomeAss, titulo: nomeAss, modelo: "especialista", descricao: profissao ?? `Agende com ${nomeAss}.`,
      profissao, foto: imagem, numeros,
      assinatura: ass.modo === "desenho" && traco ? { modo: "desenho", d: traco }
        : { modo: "fonte", fonte: fontes.includes(String(ass.fonte)) ? String(ass.fonte) : "delafield" },
    };
  }

  /* Criadora: foto grande, frase e o número das redes. */
  if (primeiro === "perfil_criadora" && topoDaPagina) {
    const c = topoDaPagina.data;
    const imagem = foto(c.foto);
    const nomeC = texto(c.nome, 30) ?? nome;
    const frase = texto(c.frase, 90);
    if (!imagem) return neutra(frase);
    const rotulos: Record<string, string> = { instagram: "no Instagram", tiktok: "no TikTok", youtube: "no YouTube" };
    const redes = arr(c.redes).map(obj).slice(0, 3).map((r) => {
      const rede = String(r.rede ?? "");
      const auto = rede === "instagram" && r.auto === true && typeof d.seguidores === "number" && d.seguidores >= 0;
      return { numero: auto ? numeroCurto(d.seguidores as number) : texto(r.numero, 10), rotulo: rotulos[rede] ?? "" };
    }).filter((r): r is { numero: string; rotulo: string } => !!r.numero && !!r.rotulo);
    return {
      ...base, nome: nomeC, titulo: nomeC, modelo: "criadora", descricao: frase ?? `${nomeC} no link da bio.`,
      frase, foto: imagem, selo: texto(c.selo, 24), redes,
    };
  }

  /* Loja: foto cheia, o nome e até três itens do cardápio com foto. */
  if (capa && capa.layout === "foto_cheia") {
    const imagem = foto(capa.imagem);
    const apoio = texto(capa.frase, 70);
    if (!imagem) return neutra(apoio);
    const card = achar("cardapio");
    const itens = arr(card?.itens).map(obj)
      .filter((i) => i.ativo !== false)
      .map((i) => ({ nome: texto(i.nome, 18), preco: preco(i.preco), foto: foto(i.foto) }))
      .filter((i): i is { nome: string; preco: string | null; foto: string } => !!i.nome && !!i.foto)
      .slice(0, 3);
    const horarios = achar("horarios");
    return {
      ...base, modelo: "loja", descricao: apoio ?? `Cardápio e pedidos de ${nome}.`, apoio, foto: imagem, itens,
      horario: horarios ? resumoDaSemana(horarios) : null,
    };
  }

  /* Consultoria: a promessa em letra grande, com a palavra em destaque. */
  if (capa && (capa.layout === "editorial" || blocos.some((b) => b.kind === "servicos"))) {
    const manchete = texto(capa.titulo, 90);
    const apoio = texto(capa.etiqueta, 60) ?? texto(capa.frase, 80);
    if (!manchete) return neutra(apoio);
    const destaque = texto(capa.destaque, 30) ?? "";
    return {
      ...base, modelo: "consultoria", descricao: texto(capa.frase, 110) ?? apoio ?? manchete,
      manchete, destaque: destaque && manchete.toLowerCase().includes(destaque.toLowerCase()) ? destaque : "",
      apoio, foto: foto(capa.imagem),
    };
  }

  return neutra(texto(capa?.frase, 90) ?? texto(topo.bio, 90) ?? texto(d.bio, 90));
}

/* ═══ AS ARTES (1200x630), em árvore de elementos pro satori (@vercel/og) ═══ */

type El = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): El =>
  ({ type, props: { style, ...extra, ...(children !== undefined ? { children } : {}) } });
const img = (src: string, style: Record<string, unknown>, w: number, hh: number) =>
  h("img", { ...style, width: w, height: hh, objectFit: "cover" }, undefined, { src, width: w, height: hh });

export type FonteDaArte = { arquivo: string; nome: string; peso: 400 | 500 | 600 | 700 | 800; italico?: boolean };

/** As fontes que cada arte usa (arquivos em /public/fonts). */
export function fontesDaArte(p: PreviaBio): FonteDaArte[] {
  const nunito: FonteDaArte[] = ([600, 700, 800] as const).map((w) => ({ arquivo: `nunito-${w}.woff`, nome: "Nunito", peso: w }));
  switch (p.modelo) {
    case "consultoria": return [...nunito, { arquivo: "dmserif-400.woff", nome: "Serif", peso: 400 }, { arquivo: "dmserif-italic.woff", nome: "Serif", peso: 400, italico: true }];
    case "loja": return [...nunito, { arquivo: "fraunces-800.woff", nome: "Fraunces", peso: 800 }];
    case "criadora": return [...nunito, { arquivo: "bricolage-800.woff", nome: "Bricolage", peso: 800 }];
    case "especialista": return [...nunito, { arquivo: "sora-500.woff", nome: "Sora", peso: 500 }, { arquivo: "sora-700.woff", nome: "Sora", peso: 700 },
      ...(p.assinatura.modo === "fonte" ? [{ arquivo: `assin-${p.assinatura.fonte}.woff`, nome: "Assinatura", peso: 400 as const }] : [])];
    default: return nunito;
  }
}

const rodape = (endereco: string, fundo: string, letra: string, marca: string, tamanho = 21) =>
  h("div", { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }, [
    h("div", { display: "flex", fontSize: tamanho, fontWeight: 800, color: letra, background: fundo, padding: "12px 22px", borderRadius: 999 }, endereco),
    h("div", { display: "flex", fontSize: 18, color: marca }, "feito com Cria"),
  ]);

/** Palavra por palavra, pra a palavra em destaque sair em itálico na cor. */
function manchete(t: string, destaque: string, corDestaque: string, tamanho: number): El {
  const partes: { t: string; d: boolean }[] = [];
  const i = destaque ? t.toLowerCase().indexOf(destaque.toLowerCase()) : -1;
  if (i >= 0) partes.push({ t: t.slice(0, i), d: false }, { t: t.slice(i, i + destaque.length), d: true }, { t: t.slice(i + destaque.length), d: false });
  else partes.push({ t, d: false });
  const palavras: El[] = [];
  for (const p of partes) {
    for (const w of p.t.split(" ").filter(Boolean)) {
      palavras.push(h("span", { marginRight: Math.round(tamanho * 0.24), fontStyle: p.d ? "italic" : "normal", color: p.d ? corDestaque : "#1E2A24" }, w));
    }
  }
  return h("div", { display: "flex", flexWrap: "wrap", fontFamily: "Serif", fontSize: tamanho, lineHeight: 1.04 }, palavras);
}

function arteNeutra(p: Extract<PreviaBio, { modelo: "neutra" }>, semImagens: boolean): El {
  // Fundo na cor da marca; se a cor é clara demais pra texto branco, escurece.
  const fundo = luz(p.cor) > 0.55 ? "#17140F" : p.cor;
  const inicial = p.nome.replace(/^@/, "").charAt(0).toUpperCase() || "C";
  const tam = p.nome.length > 28 ? 50 : p.nome.length > 18 ? 58 : 66;
  return h("div", { width: 1200, height: 630, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
    background: fundo, color: "#FFFFFF", fontFamily: "Nunito", position: "relative" }, [
    p.foto && !semImagens
      ? img(p.foto, { borderRadius: 999, border: "6px solid rgba(255,255,255,0.9)" }, 170, 170)
      : h("div", { width: 170, height: 170, borderRadius: 999, background: "rgba(255,255,255,0.14)", border: "6px solid rgba(255,255,255,0.9)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 84, fontWeight: 800 }, inicial),
    h("div", { display: "flex", fontSize: tam, fontWeight: 800, lineHeight: 1, marginTop: 24, maxWidth: 1040, textAlign: "center" }, p.nome),
    ...(p.frase ? [h("div", { display: "flex", fontSize: 26, fontWeight: 600, opacity: 0.85, marginTop: 18, maxWidth: 860, textAlign: "center", justifyContent: "center" }, p.frase)] : []),
    h("div", { display: "flex", marginTop: 26, fontSize: 24, fontWeight: 800, background: "#FFFFFF", color: fundo, padding: "12px 26px", borderRadius: 999 }, p.endereco),
    h("div", { position: "absolute", right: 40, bottom: 30, display: "flex", fontSize: 18, opacity: 0.7 }, "feito com Cria"),
  ]);
}

function arteConsultoria(p: Extract<PreviaBio, { modelo: "consultoria" }>, semImagens: boolean): El {
  const tam = p.manchete.length <= 40 ? 68 : p.manchete.length <= 64 ? 58 : 48;
  const temFoto = !!p.foto && !semImagens;
  const inicial = p.nome.replace(/^@/, "").charAt(0).toUpperCase() || "C";
  return h("div", { width: 1200, height: 630, display: "flex", background: "#F6F3EE", color: "#1E2A24", fontFamily: "Nunito" }, [
    h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "60px 56px 52px 72px" }, [
      h("div", { display: "flex", alignItems: "center" }, [
        h("div", { width: 52, height: 52, borderRadius: 999, background: p.cor, color: p.corTexto, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Serif", fontSize: 26 }, inicial),
        h("div", { display: "flex", marginLeft: 14, fontSize: 24, fontWeight: 700 }, p.nome),
      ]),
      h("div", { display: "flex", flexDirection: "column" }, [
        manchete(p.manchete, p.destaque, p.cor, tam),
        ...(p.apoio ? [h("div", { display: "flex", fontSize: 22, color: "#45524B", marginTop: 18 }, p.apoio)] : []),
      ]),
      rodape(p.endereco, p.cor, p.corTexto, "#6B756F"),
    ]),
    ...(temFoto ? [h("div", { display: "flex", width: 380, padding: "40px 40px 40px 0" }, [img(p.foto!, { borderRadius: "6px 6px 170px 6px" }, 340, 550)])] : []),
  ]);
}

function arteLoja(p: Extract<PreviaBio, { modelo: "loja" }>, semImagens: boolean): El {
  const tam = p.nome.length > 22 ? 60 : 76;
  return h("div", { width: 1200, height: 630, display: "flex", position: "relative", color: "#FFF8EF", fontFamily: "Nunito", background: "#2A1A10" }, [
    ...(semImagens ? [] : [img(p.foto, { position: "absolute", left: 0, top: 0 }, 1200, 630)]),
    h("div", { position: "absolute", left: 0, top: 0, width: 1200, height: 630, display: "flex",
      backgroundImage: "linear-gradient(to right, rgba(30,16,8,0.94) 0%, rgba(30,16,8,0.78) 52%, rgba(30,16,8,0.25) 100%)" }),
    h("div", { position: "absolute", left: 0, top: 0, width: 1200, height: 630, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 64px 50px" }, [
      h("div", { display: "flex", flexDirection: "column" }, [
        ...(p.horario ? [h("div", { display: "flex", alignSelf: "flex-start", alignItems: "center", background: "#FFF8EF", color: "#3B2416",
          fontSize: 22, fontWeight: 800, padding: "10px 18px", borderRadius: 999, marginBottom: 16 }, p.horario)] : []),
        h("div", { display: "flex", fontFamily: "Fraunces", fontWeight: 800, fontSize: tam, lineHeight: 1, maxWidth: 900 }, p.nome),
        ...(p.apoio ? [h("div", { display: "flex", fontSize: 26, opacity: 0.9, marginTop: 14, maxWidth: 820 }, p.apoio)] : []),
      ]),
      p.itens.length && !semImagens
        ? h("div", { display: "flex" }, p.itens.map((i, n) =>
            h("div", { display: "flex", flexDirection: "column", width: 200, background: "#FFF8EF", color: "#3B2416", borderRadius: 18, overflow: "hidden", marginRight: n < 2 ? 14 : 0 }, [
              img(i.foto, {}, 200, 96),
              h("div", { display: "flex", justifyContent: "space-between", padding: "10px 14px 12px", fontSize: 17, fontWeight: 800 }, [
                h("span", { display: "flex", maxWidth: 110 }, i.nome),
                ...(i.preco ? [h("span", { display: "flex", color: "#A8481A" }, i.preco.replace(/,00$/, ""))] : []),
              ]),
            ])))
        : h("div", { display: "flex" }),
      rodape(p.endereco, p.cor, p.corTexto, "rgba(255,248,239,0.8)"),
    ]),
  ]);
}

function arteCriadora(p: Extract<PreviaBio, { modelo: "criadora" }>, semImagens: boolean): El {
  const tam = p.nome.length > 16 ? 72 : 96;
  return h("div", { width: 1200, height: 630, display: "flex", background: "#FFF4EF", color: "#1A1A1A", fontFamily: "Nunito", padding: 36 }, [
    semImagens
      ? h("div", { display: "flex", width: 400, height: 558, borderRadius: 36, background: p.cor })
      : img(p.foto, { borderRadius: 36 }, 400, 558),
    h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "12px 8px 4px 36px" }, [
      h("div", { display: "flex", flexDirection: "column" }, [
        ...(p.selo ? [h("div", { display: "flex", alignSelf: "flex-start", background: "#D9CCFF", fontSize: 20, fontWeight: 700, padding: "9px 16px", borderRadius: 999, marginBottom: 14 }, p.selo)] : []),
        h("div", { display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: tam, lineHeight: 0.95, letterSpacing: -2 }, p.nome),
        ...(p.frase ? [h("div", { display: "flex", fontSize: 26, color: "#4A423E", marginTop: 14 }, p.frase)] : []),
      ]),
      p.redes.length
        ? h("div", { display: "flex" }, p.redes.map((r, n) =>
            h("div", { display: "flex", flexDirection: "column", flex: 1, background: "#FFFFFF", borderRadius: 22, padding: "16px 20px", marginRight: n < p.redes.length - 1 ? 14 : 0 }, [
              h("div", { display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: 42 }, r.numero),
              h("div", { display: "flex", fontSize: 18, color: "#6B625E" }, r.rotulo),
            ])))
        : h("div", { display: "flex" }),
      rodape(p.endereco, p.cor, p.corTexto, "#6B625E"),
    ]),
  ]);
}

function arteEspecialista(p: Extract<PreviaBio, { modelo: "especialista" }>, semImagens: boolean): El {
  // O traço só tem M, L, números, ponto, sinal e espaço (conferido em
  // montarPreviaBio): não tem como fechar o atributo e enfiar outra coisa.
  const nomeAss = p.assinatura.modo === "fonte"
    ? h("div", { display: "flex", fontFamily: "Assinatura", fontSize: p.nome.length > 16 ? 110 : 150, lineHeight: 1.05, color: "#F5F1EA" }, p.nome)
    : img(`data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 200"><path d="${p.assinatura.d}" fill="none" stroke="#F5F1EA" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`)}`,
        {}, 520, 236);
  return h("div", { width: 1200, height: 630, display: "flex", background: "#121212", color: "#F5F1EA", fontFamily: "Sora" }, [
    h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "64px 60px 52px 72px" }, [
      h("div", { display: "flex", flexDirection: "column" }, [
        ...(p.profissao ? [h("div", { display: "flex", fontSize: 22, letterSpacing: 4, color: "#C9A27A", textTransform: "uppercase" }, p.profissao)] : []),
        nomeAss,
      ]),
      p.numeros.length
        ? h("div", { display: "flex" }, p.numeros.map((n, i) =>
            h("div", { display: "flex", flexDirection: "column", marginRight: i === 0 ? 48 : 0 }, [
              h("div", { display: "flex", fontSize: 44, fontWeight: 700 }, n.valor),
              h("div", { display: "flex", fontSize: 20, color: "#A9A39B" }, n.rotulo),
            ])))
        : h("div", { display: "flex" }),
      rodape(p.endereco, "#2A2723", "#F5F1EA", "#8E877E", 22),
    ]),
    ...(semImagens ? [] : [h("div", { display: "flex", width: 430, height: 630, position: "relative" }, [
      img(p.foto, {}, 430, 630),
      h("div", { position: "absolute", left: 0, top: 0, width: 430, height: 630, display: "flex",
        backgroundImage: "linear-gradient(to right, #121212 0%, rgba(18,18,18,0) 35%)" }),
    ])]),
  ]);
}

/* A arte do formato Clássico (21/10/2026), com a trava de imagem nova. */
const CREME = "#F4EFE3";
const TINTA = "#17140F";
function arteClassica(p: Extract<PreviaBio, { modelo: "classica" }>, semImagens: boolean): El {
  const banner = semImagens ? null : p.banner;
  const avatar = semImagens ? null : p.avatar;
  const inicial = p.nome.replace(/^@/, "").charAt(0).toUpperCase() || "C";
  const tamNome = p.nome.length > 26 ? 52 : p.nome.length > 18 ? 60 : 68;
  const faixa = banner
    ? img(banner, { position: "absolute", left: 0, top: 0 }, 1200, 300)
    : h("div", { position: "absolute", left: 0, top: 0, width: 1200, height: 300, display: "flex", background: "#2A4BDF", overflow: "hidden" }, [
        h("div", { position: "absolute", left: -80, top: 120, width: 420, height: 300, borderRadius: 999, background: "#CE4A1D" }),
        h("div", { position: "absolute", right: -60, top: -120, width: 380, height: 320, borderRadius: 999, background: "#F27EB5" }),
        h("div", { position: "absolute", right: 260, top: 200, width: 200, height: 180, borderRadius: 999, background: "#F2C21E" }),
      ]);
  const foto = avatar
    ? img(avatar, { borderRadius: 999, border: `8px solid ${CREME}` }, 196, 196)
    : h("div", { width: 196, height: 196, borderRadius: 999, border: `8px solid ${CREME}`, background: p.cor, color: p.corTexto,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 90, fontWeight: 800 }, inicial);
  return h("div", { width: 1200, height: 630, display: "flex", position: "relative", overflow: "hidden", background: CREME, fontFamily: "Nunito" }, [
    faixa,
    h("div", { position: "absolute", right: -90, bottom: -140, width: 330, height: 330, borderRadius: 999, background: "#F2C21E" }),
    h("div", { position: "absolute", left: 64, top: 200, display: "flex" }, [foto]),
    h("div", { position: "absolute", left: 290, top: 318, width: 820, display: "flex", flexDirection: "column" }, [
      h("div", { fontSize: tamNome, fontWeight: 800, color: TINTA, lineHeight: 1.05, letterSpacing: -1 }, p.nome),
      ...(p.bio ? [h("div", { fontSize: 30, fontWeight: 600, color: "#4A4339", lineHeight: 1.3, marginTop: 10, maxWidth: 800 }, p.bio)] : []),
    ]),
    h("div", { position: "absolute", left: 64, bottom: 44, display: "flex", background: p.cor, color: p.corTexto,
      borderRadius: 999, padding: "12px 28px", fontSize: 26, fontWeight: 800 }, `${p.endereco} · toque pra abrir`),
  ]);
}

export function arteDaBio(p: PreviaBio, opcoes: { semImagens?: boolean } = {}): El {
  const s = !!opcoes.semImagens;
  switch (p.modelo) {
    case "classica": return arteClassica(p, s);
    case "especialista": return arteEspecialista(p, s);
    case "consultoria": return arteConsultoria(p, s);
    case "loja": return arteLoja(p, s);
    case "criadora": return arteCriadora(p, s);
    default: return arteNeutra(p, s);
  }
}

/** Plano B: a mesma página na arte neutra, sem foto, pra quando a arte do
 *  modelo não desenha (foto que não carrega, fonte que não veio). */
export function previaNeutra(p: PreviaBio): PreviaBio {
  return { titulo: p.titulo, descricao: p.descricao, nome: p.nome, endereco: p.endereco, cor: p.cor, corTexto: p.corTexto,
    modelo: "neutra", frase: null, foto: null };
}
