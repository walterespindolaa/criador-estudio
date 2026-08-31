import jsPDF from "jspdf";
import { parseRefLinks, isRefLink } from "@/lib/refLinks";
import { previaDeLink } from "@/lib/refPreview";
import { cenasDe, type CaptureScene, type CaptureScript } from "@/hooks/useCaptureScripts";

/* ═══════════════════════════════════════════════════════════════════════════
   GUIA DE GRAVAÇÃO EM PDF

   POR QUE ISTO NÃO É MAIS UMA TELA FOTOGRAFADA
   A primeira versão montava o guia em HTML e tirava um print de cada folha com
   html2canvas. Três problemas nasciam disso, todos visíveis no arquivo que a
   Gabriela gerou: 42 MB para 4 páginas, texto borrado que não dá pra
   selecionar nem buscar, e paginação por "orçamento de linhas" chutado, que ou
   deixava metade da folha vazia ou cortava cena.

   Aqui o PDF é escrito como PDF: texto de verdade, medido pelo próprio jsPDF
   (splitTextToSize sabe exatamente quantas linhas cabem). O arquivo cai pra
   algumas centenas de KB, a capa do reel entra comprimida, e o link continua
   clicável.

   O LAYOUT segue o guia que ela já usava no Canva: ficha do vídeo na coluna da
   esquerda (data, local, título, sobre, e a REFERÊNCIA como print grande) e o
   roteiro na direita, cena a cena. O que o Canva não tinha e a gravação pedia:
   a DIREÇÃO de cada cena, logo abaixo da fala.
   ═══════════════════════════════════════════════════════════════════════════ */

export type DadosGuia = {
  cliente: string;
  mesLabel: string;
  roteiros: CaptureScript[];
  logoCliente?: string | null;
  logoAgencia?: string | null;
  elaboradoPor?: string | null;
  /** Cor da marca do cliente (cai no laranja do Cria quando não houver). */
  cor?: string | null;
  /** Capas já resolvidas: { link -> url da imagem }. */
  capas?: Record<string, string | null>;
};

// Paleta do Cria (a mesma do relatório do cliente).
const LARANJA = "#EA4918";
const TINTA = "#1A1A2E";
const SUAVE = "#6B7280";
const LINHA = "#E5E7EB";
const CREME = "#F6F2E8";

// A4 em mm.
const L = 210, A = 297;
const MARGEM = 14;
const COL_ESQ_X = MARGEM, COL_ESQ_W = 66;
const COL_DIR_X = MARGEM + COL_ESQ_W + 10, COL_DIR_W = L - MARGEM - (MARGEM + COL_ESQ_W + 10);
const TOPO = 26;             // abaixo do cabeçalho
const RODAPE = A - 16;       // limite de escrita

type Img = { data: string; w: number; h: number };

/* Carrega a imagem, reduz e comprime. Duas razões: peso (uma capa de reel vem
   com 1080px e vira megabytes dentro do PDF) e CORS (o canvas só exporta se o
   servidor liberar; o nosso bucket libera, CDN de terceiro não). */
async function carregarImagem(url: string, larguraMax = 700): Promise<Img | null> {
  try {
    const img = await new Promise<HTMLImageElement>((ok, falhou) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => ok(el);
      el.onerror = falhou;
      el.src = url;
    });
    const escala = Math.min(1, larguraMax / (img.naturalWidth || larguraMax));
    const w = Math.max(1, Math.round((img.naturalWidth || larguraMax) * escala));
    const h = Math.max(1, Math.round((img.naturalHeight || larguraMax) * escala));
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return { data: cv.toDataURL("image/jpeg", 0.72), w, h };
  } catch { return null; }
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const dataBR = (iso?: string | null) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : null;

/* A referência nem sempre mora no campo Referência: a Gabriela colou o link
   do reel DENTRO do texto da cena ("tipo assim: https://instagram.com/...")
   e o guia saiu sem a seção, porque texto em PDF não vira link sozinho.
   Aqui a gente caça toda URL que aparecer no roteiro (cenas, sobre, conteúdo)
   e promove pra seção Referência, com prévia e clique. */
function linksDoRoteiro(r: CaptureScript): string[] {
  const doCampo = parseRefLinks(r.reference_url).filter(isRefLink);
  const textos = [
    r.about ?? "", r.content ?? "",
    ...cenasDe(r).flatMap((c: CaptureScene) => [c.fala, c.direcao]),
  ].join("\n");
  const achados = textos.match(/https?:\/\/[^\s)\]}>",;]+/g) ?? [];
  const todos = [...doCampo, ...achados.map((u) => u.replace(/[.,;:!?]+$/, ""))];
  // Dedup pela URL sem query/barra final (mesma chave usada nas capas).
  const vistos = new Set<string>();
  return todos.filter((u) => {
    const chave = u.split("?")[0].replace(/\/$/, "");
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

export async function gerarGuiaGravacao(d: DadosGuia): Promise<jsPDF> {
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const cor = (d.cor && /^#[0-9a-f]{6}$/i.test(d.cor)) ? d.cor : LARANJA;
  const assina = d.elaboradoPor?.trim() || "sua social mídia";

  const tinta = () => pdf.setTextColor(...hexRgb(TINTA));
  const suave = () => pdf.setTextColor(...hexRgb(SUAVE));
  const marca = () => pdf.setTextColor(...hexRgb(cor));

  // Baixa as logos e as capas ANTES de desenhar: jsPDF não espera promessa.
  const [logoCli, logoAge] = await Promise.all([
    d.logoCliente ? carregarImagem(d.logoCliente, 300) : Promise.resolve(null),
    d.logoAgencia ? carregarImagem(d.logoAgencia, 300) : Promise.resolve(null),
  ]);
  const capas = new Map<string, Img | null>();
  for (const r of d.roteiros) {
    for (const link of linksDoRoteiro(r)) {
      const p = previaDeLink(link);
      const chave = p.url.split("?")[0].replace(/\/$/, "");
      if (capas.has(chave)) continue;
      const src = d.capas?.[chave] ?? p.thumb ?? null;
      capas.set(chave, src ? await carregarImagem(src, 700) : null);
    }
  }

  // ── CAPA ──────────────────────────────────────────────────────────────────
  pdf.setFillColor(...hexRgb(CREME));
  pdf.rect(0, 0, L, A, "F");
  // Blobs da paleta, como no relatório do cliente: é o que faz o documento
  // parecer do Cria e não uma folha em branco.
  const blob = (hex: string, x: number, yy: number, r: number) => {
    const [rr, gg, bb] = hexRgb(hex);
    pdf.setFillColor(rr, gg, bb);
    pdf.setGState(pdf.GState({ opacity: 0.14 }));
    pdf.circle(x, yy, r, "F");
    pdf.setGState(pdf.GState({ opacity: 1 }));
  };
  blob(cor, 178, 32, 40);
  blob("#7C90F0", 22, 250, 34);
  blob("#FFCF03", 168, 268, 24);
  pdf.setFillColor(...hexRgb(cor));
  pdf.rect(0, 0, L, 6, "F");

  let y = 52;
  if (logoCli) {
    // Círculo branco com a logo do cliente dentro (igual à capa do relatório).
    const D = 38;
    pdf.setFillColor(255, 255, 255);
    pdf.circle(L / 2, y + D / 2, D / 2, "F");
    const esc = Math.min((D - 8) / logoCli.w, (D - 8) / logoCli.h);
    const iw = logoCli.w * esc, ih = logoCli.h * esc;
    pdf.addImage(logoCli.data, "JPEG", (L - iw) / 2, y + (D - ih) / 2, iw, ih);
    y += D + 14;
  } else {
    y += 18;
  }

  marca();
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
  pdf.text("GUIA DE GRAVAÇÃO", L / 2, y, { align: "center" });
  y += 13;
  tinta();
  pdf.setFontSize(30);
  pdf.text(d.cliente, L / 2, y, { align: "center", maxWidth: L - 40 });
  y += 11;
  suave();
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(13);
  pdf.text(d.mesLabel, L / 2, y, { align: "center" });
  y += 18;

  // SUMÁRIO: a primeira página já responde "o que a gente grava neste dia".
  // Sem isso a capa era uma folha vazia com um nome no meio.
  pdf.setDrawColor(...hexRgb(LINHA)); pdf.setLineWidth(0.3);
  pdf.line(MARGEM + 16, y - 8, L - MARGEM - 16, y - 8);
  marca(); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8);
  pdf.text(`O QUE VAMOS GRAVAR · ${d.roteiros.length} ${d.roteiros.length === 1 ? "VÍDEO" : "VÍDEOS"}`, MARGEM + 16, y);
  y += 7;
  const cabeNaCapa = d.roteiros.slice(0, 12);
  cabeNaCapa.forEach((r, i) => {
    tinta(); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9.5);
    const t = pdf.splitTextToSize(`${i + 1}. ${r.title?.trim() || `Vídeo ${i + 1}`}`, L - MARGEM * 2 - 62);
    pdf.text(t[0], MARGEM + 16, y);
    suave(); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5);
    pdf.text(dataBR(r.record_date) ?? "data a combinar", L - MARGEM - 16, y, { align: "right" });
    y += 7;
  });
  if (d.roteiros.length > cabeNaCapa.length) {
    suave(); pdf.setFont("helvetica", "italic"); pdf.setFontSize(8.5);
    pdf.text(`e mais ${d.roteiros.length - cabeNaCapa.length} nas páginas seguintes`, MARGEM + 16, y);
  }

  if (logoAge) {
    const lw = 24;
    const lh = Math.min((logoAge.h / logoAge.w) * lw, 14);
    pdf.addImage(logoAge.data, "JPEG", (L - lw) / 2, A - 46, lw, lh);
  }
  suave(); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
  pdf.text(`Preparado por ${assina}`, L / 2, A - 26, { align: "center" });

  // ── PÁGINAS DOS VÍDEOS ────────────────────────────────────────────────────
  const cabecalho = (titulo: string, sub: string) => {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, L, A, "F");
    pdf.setFillColor(...hexRgb(CREME));
    pdf.rect(0, 0, L, 16, "F");
    pdf.setDrawColor(...hexRgb(cor));
    pdf.setLineWidth(0.8);
    pdf.line(0, 16, L, 16);
    tinta(); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9.5);
    pdf.text(titulo, MARGEM, 8.5);
    suave(); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5);
    pdf.text(sub, MARGEM, 12.6);
  };
  const rodape = (texto: string) => {
    pdf.setDrawColor(...hexRgb(LINHA)); pdf.setLineWidth(0.2);
    pdf.line(MARGEM, A - 12, L - MARGEM, A - 12);
    suave(); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5);
    pdf.text(`Preparado por ${assina}`, MARGEM, A - 7);
    pdf.text(texto, L - MARGEM, A - 7, { align: "right" });
  };
  const rotulo = (txt: string, x: number, yy: number) => {
    marca(); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5);
    pdf.text(txt.toUpperCase(), x, yy);
  };

  d.roteiros.forEach((r, idx) => {
    const cenas = cenasDe(r);
    const refs = linksDoRoteiro(r).map(previaDeLink);
    const titulo = r.title?.trim() || `Vídeo ${idx + 1}`;

    pdf.addPage();
    cabecalho(d.cliente, `Guia de gravação · ${d.mesLabel}`);

    // ── COLUNA ESQUERDA: a ficha do vídeo ──
    let ye = TOPO;
    tinta(); pdf.setFont("helvetica", "bold"); pdf.setFontSize(15);
    const linhasTitulo = pdf.splitTextToSize(titulo, COL_ESQ_W);
    pdf.text(linhasTitulo, COL_ESQ_X, ye);
    ye += linhasTitulo.length * 6.4 + 6;

    const campo = (nome: string, valor: string) => {
      rotulo(nome, COL_ESQ_X, ye); ye += 4.6;
      tinta(); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5);
      const ls = pdf.splitTextToSize(valor, COL_ESQ_W);
      pdf.text(ls, COL_ESQ_X, ye);
      ye += ls.length * 4.6 + 5;
    };
    campo("Data da gravação", dataBR(r.record_date) ?? "a combinar");
    campo("Local", r.location?.trim() || "a combinar");
    if (r.about?.trim()) campo("Sobre o vídeo", r.about.trim());

    if (refs.length > 0) {
      rotulo(refs.length === 1 ? "Referência" : "Referências", COL_ESQ_X, ye);
      ye += 5;
      for (const p of refs) {
        if (ye > RODAPE - 20) break;
        const chave = p.url.split("?")[0].replace(/\/$/, "");
        const img = capas.get(chave) ?? null;
        if (img) {
          // Print grande, como no guia do Canva: é ele que explica o vídeo.
          const iw = COL_ESQ_W;
          const ih = Math.min((img.h / img.w) * iw, RODAPE - ye - 14);
          pdf.addImage(img.data, "JPEG", COL_ESQ_X, ye, iw, ih);
          pdf.setDrawColor(...hexRgb(LINHA)); pdf.setLineWidth(0.2);
          pdf.rect(COL_ESQ_X, ye, iw, ih);
          pdf.link(COL_ESQ_X, ye, iw, ih, { url: p.url });
          ye += ih + 3;
        }
        marca(); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8.5);
        pdf.text(`Abrir no ${p.nome}`, COL_ESQ_X, ye);
        pdf.link(COL_ESQ_X, ye - 3, COL_ESQ_W, 5, { url: p.url });
        ye += 4;
        suave(); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
        const ls = pdf.splitTextToSize(p.label, COL_ESQ_W);
        pdf.text(ls.slice(0, 2), COL_ESQ_X, ye);
        ye += ls.slice(0, 2).length * 3.2 + 6;
      }
    }

    // ── COLUNA DIREITA: o roteiro ──
    let yd = TOPO;
    let paginaDoVideo = 1;
    const novaPagina = () => {
      rodape(`Vídeo ${idx + 1} de ${d.roteiros.length}`);
      pdf.addPage();
      paginaDoVideo += 1;
      cabecalho(d.cliente, `Guia de gravação · ${d.mesLabel}`);
      tinta(); pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
      pdf.text(`${titulo} · continuação`, MARGEM, TOPO);
      yd = TOPO + 8;
    };
    // Nas páginas de continuação o roteiro usa a folha inteira.
    const largura = () => (paginaDoVideo === 1 ? COL_DIR_W : L - MARGEM * 2);
    const xTexto = () => (paginaDoVideo === 1 ? COL_DIR_X : MARGEM);

    rotulo("Roteiro", COL_DIR_X, yd); yd += 6;

    const escreverBloco = (
      texto: string, tamanho: number, estilo: "normal" | "bold" | "italic",
      corTxt: () => void, alturaLinha: number, recuo = 0,
    ) => {
      pdf.setFont("helvetica", estilo); pdf.setFontSize(tamanho); corTxt();
      const linhas = pdf.splitTextToSize(texto, largura() - recuo);
      for (const linha of linhas) {
        if (yd + alturaLinha > RODAPE) {
          novaPagina();
          pdf.setFont("helvetica", estilo); pdf.setFontSize(tamanho); corTxt();
        }
        pdf.text(linha, xTexto() + recuo, yd);
        yd += alturaLinha;
      }
    };

    if (cenas.length > 0) {
      cenas.forEach((c: CaptureScene, i) => {
        if (yd + 12 > RODAPE) novaPagina();
        escreverBloco(`Cena ${i + 1}`, 9.5, "bold", marca, 4.8);
        if (c.fala.trim()) escreverBloco(c.fala.trim(), 9.5, "normal", tinta, 4.6);
        if (c.direcao.trim()) {
          yd += 1.5;
          escreverBloco(`Direção: ${c.direcao.trim()}`, 8.5, "italic", suave, 4.2, 3);
        }
        yd += 4;
      });
    } else if (r.content?.trim()) {
      escreverBloco(r.content.trim(), 9.5, "normal", tinta, 4.6);
    } else {
      escreverBloco("(roteiro em branco)", 9.5, "italic", suave, 4.6);
    }

    rodape(`Vídeo ${idx + 1} de ${d.roteiros.length}`);
  });

  // ── CONTRACAPA ────────────────────────────────────────────────────────────
  pdf.addPage();
  pdf.setFillColor(...hexRgb(CREME));
  pdf.rect(0, 0, L, A, "F");
  pdf.setFillColor(...hexRgb(cor));
  pdf.rect(0, A - 6, L, 6, "F");
  tinta(); pdf.setFont("helvetica", "bold"); pdf.setFontSize(16);
  pdf.text("Bora gravar.", L / 2, A / 2 - 6, { align: "center" });
  suave(); pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
  pdf.text("Qualquer dúvida na hora da gravação, chama a gente.", L / 2, A / 2 + 3, { align: "center" });
  pdf.setFontSize(8);
  pdf.text("Feito no Cria Social Club", L / 2, A - 20, { align: "center" });

  return pdf;
}

export async function baixarGuiaGravacao(d: DadosGuia, nomeArquivo: string): Promise<void> {
  const pdf = await gerarGuiaGravacao(d);
  pdf.save(`${nomeArquivo}.pdf`);
}
