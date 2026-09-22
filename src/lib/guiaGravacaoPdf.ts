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
    /* FUNDO BRANCO ANTES DE DESENHAR: exportamos em JPEG (peso) e JPEG não tem
       transparência. Sem isto, PNG com fundo transparente (a maioria dos logos)
       saía com FUNDO PRETO no PDF, porque o canvas nasce com pixels zerados e o
       encoder lê alfa 0 como preto. */
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { data: cv.toDataURL("image/jpeg", 0.72), w, h };
  } catch { return null; }
}

/* Mesma regra do cabeçalho das páginas públicas (LogoMarca): arquivo quase
   quadrado é SELO, já foi desenhado pra viver dentro de um círculo, então
   preenche a moldura inteira. Logo horizontal cabe inteiro, sem corte. */
const ehSelo = (im: Img) => {
  const p = im.w / (im.h || 1);
  return p >= 0.8 && p <= 1.25;
};

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

  /* O LINK QUE NAO CLICAVA (Walter, 20/09/2026). O jsPDF grava o retangulo da
     anotacao com y1 > y2 (ele converte "topo" e "base" pro sistema do PDF, que
     cresce pra cima, e nao normaliza). Alguns leitores aceitam, outros (o
     Preview do Mac, e o Chrome em certos casos) tratam o retangulo invertido
     como area vazia. Passando a base como y e a altura negativa, os cantos
     saem na ordem que o padrao PDF espera. */
  const linkNormal = (x: number, y: number, w: number, h: number, url: string) =>
    pdf.link(x, y + h, w, -h, { url });
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
    /* Círculo branco com a logo do cliente dentro, mesma regra do cabeçalho
       público. SELO (quase quadrado) preenche o círculo inteiro: recortamos
       num clipe redondo pra que as quinas do arquivo não apareçam sobre a
       moldura, que era o "quadrado dentro de redondo" que a Gabi apontou.
       Logo horizontal continua cabendo inteiro, com respiro. */
    const D = 38;
    pdf.setFillColor(255, 255, 255);
    pdf.circle(L / 2, y + D / 2, D / 2, "F");
    if (ehSelo(logoCli)) {
      const esc = Math.max(D / logoCli.w, D / logoCli.h);
      const iw = logoCli.w * esc, ih = logoCli.h * esc;
      pdf.saveGraphicsState();
      /* O QUADRADO DENTRO DO REDONDO (Walter, 21/09/2026). O clipe estava
         escrito, mas `circle()` SEM o quarto argumento desenha o traço e
         consome o caminho: quando o clip() chegava, não tinha caminho nenhum
         pra recortar, e a foto saía inteira, quadrada. Com `null` o jsPDF
         deixa o caminho aberto só pro recorte. */
      pdf.circle(L / 2, y + D / 2, D / 2, null);
      pdf.clip();
      pdf.discardPath();
      pdf.addImage(logoCli.data, "JPEG", (L - iw) / 2, y + (D - ih) / 2, iw, ih);
      pdf.restoreGraphicsState();
    } else {
      const esc = Math.min((D - 8) / logoCli.w, (D - 8) / logoCli.h);
      const iw = logoCli.w * esc, ih = logoCli.h * esc;
      pdf.addImage(logoCli.data, "JPEG", (L - iw) / 2, y + (D - ih) / 2, iw, ih);
    }
    y += D + 14;
  } else {
    y += 18;
  }

  marca();
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
  pdf.text("GUIA DE GRAVAÇÃO", L / 2, y, { align: "center" });
  y += 13;
  tinta();
  /* NOME COMPRIDO NÃO PODE ATROPELAR A DATA (Gabriela, 21/09/2026: "cortando").
     Aqui era `maxWidth`, que quebra o texto em duas linhas mas NÃO devolve
     quantas foram: o y avançava 11mm fixos, como se sempre coubesse numa linha
     só, e a segunda linha caía em cima da data. Com splitTextToSize a gente
     sabe quantas linhas são antes de desenhar, e o resto da capa desce junto. */
  pdf.setFontSize(30);
  const ALT_LINHA_TITULO = 11.5;
  const linhasCliente = pdf.splitTextToSize(d.cliente, L - 40) as string[];
  linhasCliente.forEach((ln, i) => {
    pdf.text(ln, L / 2, y + i * ALT_LINHA_TITULO, { align: "center" });
  });
  y += (linhasCliente.length - 1) * ALT_LINHA_TITULO + 11;
  /* A DATA UMA VEZ SÓ (Walter, 21/09/2026: "não precisa ter todas as datas
     do lado, já sabemos que é dia 21"). Se todo roteiro do guia é do mesmo
     dia, a data completa substitui o "Setembro de 2026" e some da lista. Se
     há dias diferentes, volta o mês em cima e a data em cada linha. */
  const datasDistintas = Array.from(new Set(d.roteiros.map((r) => r.record_date ?? "")));
  const diaUnico = datasDistintas.length === 1 && datasDistintas[0] ? datasDistintas[0] : null;
  suave();
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(13);
  pdf.text(diaUnico ? `Gravação em ${dataBR(diaUnico)}` : d.mesLabel, L / 2, y, { align: "center" });
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
    // Sem a coluna de data, o título ganha a largura inteira (antes cortava
    // em "...melhorar o intestino" por causa dos 62mm reservados).
    const t = pdf.splitTextToSize(`${i + 1}. ${r.title?.trim() || `Vídeo ${i + 1}`}`, L - MARGEM * 2 - (diaUnico ? 32 : 62)) as string[];
    /* Até DUAS linhas por item, não uma. Desenhar só t[0] cortava o título
       calado, e na capa é justamente onde ela confere a lista do dia. */
    const t2 = t.slice(0, 2);
    pdf.text(t2, MARGEM + 16, y);
    if (!diaUnico) {
      suave(); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5);
      pdf.text(dataBR(r.record_date) ?? "data a combinar", L - MARGEM - 16, y, { align: "right" });
    }
    y += t2.length * 4.6 + 2.4;
  });
  if (d.roteiros.length > cabeNaCapa.length) {
    suave(); pdf.setFont("helvetica", "italic"); pdf.setFontSize(8.5);
    pdf.text(`e mais ${d.roteiros.length - cabeNaCapa.length} nas páginas seguintes`, MARGEM + 16, y);
  }

  if (logoAge) {
    if (ehSelo(logoAge)) {
      // Selo da agência também vai redondo, na mesma regra do cliente.
      const DA = 16;
      const esc = Math.max(DA / logoAge.w, DA / logoAge.h);
      const iw = logoAge.w * esc, ih = logoAge.h * esc;
      const cy = A - 46 + DA / 2;
      pdf.saveGraphicsState();
      pdf.circle(L / 2, cy, DA / 2, null);
      pdf.clip();
      pdf.discardPath();
      pdf.addImage(logoAge.data, "JPEG", (L - iw) / 2, cy - ih / 2, iw, ih);
      pdf.restoreGraphicsState();
    } else {
      /* Cabe dentro de uma caixa de 24x14, mantendo a proporção. Antes a largura
         era fixa em 24 e só a altura era limitada: logo alto era ACHATADO. */
      const escala = Math.min(24 / logoAge.w, 14 / logoAge.h);
      const lw = logoAge.w * escala, lh = logoAge.h * escala;
      pdf.addImage(logoAge.data, "JPEG", (L - lw) / 2, A - 46, lw, lh);
    }
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
    /* O NÚMERO NA FRENTE (Gabriela, 21/09/2026: "tem como inserir um número?").
       A capa lista "1., 2., 3." e o rodapé diz "Vídeo 2 de 6", mas a página do
       roteiro não dizia qual era, então no meio da gravação não dava pra casar
       a folha com a lista. Agora o número abre o título, igual ao sumário. */
    const titulo = `${idx + 1}. ${r.title?.trim() || `Vídeo ${idx + 1}`}`;

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
    /* O LOCAL SAIU (Gabriela, 21/09/2026: "esse local não tem necessidade no
       relatório"). Quase sempre era "a combinar" ocupando um campo inteiro em
       toda página, e quando tinha valor era o mesmo do dia todo, que ela já
       sabe. Continua existindo no cadastro do roteiro e na Folha do dia, que é
       onde a informação serve pra alguma coisa. */
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
          linkNormal(COL_ESQ_X, ye, iw, ih, p.url);
          ye += ih + 3;
        }
        // Com cara de link: sublinhado, e a area clicavel cobre o titulo E o
        // endereco embaixo dele, nao so uma faixa de 5mm.
        const yTopoLink = ye - 3;
        marca(); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8.5);
        const rotuloLink = `Abrir no ${p.nome}`;
        pdf.text(rotuloLink, COL_ESQ_X, ye);
        pdf.setDrawColor(...hexRgb(cor)); pdf.setLineWidth(0.25);
        pdf.line(COL_ESQ_X, ye + 0.8, COL_ESQ_X + pdf.getTextWidth(rotuloLink), ye + 0.8);
        ye += 4;
        suave(); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
        const ls = pdf.splitTextToSize(p.label, COL_ESQ_W);
        pdf.text(ls.slice(0, 2), COL_ESQ_X, ye);
        const alturaLabel = ls.slice(0, 2).length * 3.2;
        linkNormal(COL_ESQ_X, yTopoLink, COL_ESQ_W, (ye + alturaLabel) - yTopoLink, p.url);
        ye += alturaLabel + 6;
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
      /* TÍTULO DA CONTINUAÇÃO TAMBÉM QUEBRA (Gabriela, 21/09/2026: "tá
         cortando"). Este era o corte de verdade: na página 1 o título já ia
         partido na coluna estreita, mas aqui saía numa linha só e o que passava
         da margem direita simplesmente sumia. */
      tinta(); pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
      const lsCont = pdf.splitTextToSize(`${titulo} · continuação`, L - MARGEM * 2) as string[];
      pdf.text(lsCont, MARGEM, TOPO);
      yd = TOPO + lsCont.length * 5 + 3;
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
  /* O SELO DE REC, DESENHADO (Gabriela, 21/09/2026: "tem como colocar um emoji
     de gravação?"). Emoji não vai: a Helvetica embutida no PDF é Latin-1, e
     qualquer caractere fora disso sai como caixinha ou lixo em boa parte dos
     leitores. Então em vez de escrever um emoji, a gente DESENHA o símbolo: a
     bolinha vermelha do REC, que é a mesma coisa e sai nítida em qualquer
     zoom, em qualquer leitor, e ainda sai na impressão. */
  const cyRec = A / 2 - 24;
  pdf.setFillColor(214, 54, 54);
  pdf.circle(L / 2 - 8.5, cyRec, 2.2, "F");
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
  pdf.setTextColor(214, 54, 54);
  pdf.text("REC", L / 2 + 1.5, cyRec + 1.2, { align: "center" });

  tinta(); pdf.setFont("helvetica", "bold"); pdf.setFontSize(16);
  pdf.text("Bora gravar?", L / 2, A / 2 - 6, { align: "center" });
  suave(); pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
  /* Texto novo, da Gabriela. Em três linhas curtas porque é o que a pessoa lê
     de pé, com o celular na mão, um segundo antes de começar a gravar. */
  pdf.text("Agora é só seguir o roteiro e deixar acontecer.", L / 2, A / 2 + 3, { align: "center" });
  pdf.text("Se precisarem de alguma coisa, estou por aqui.", L / 2, A / 2 + 9.5, { align: "center" });

  /* A ASSINATURA DE QUEM PREPAROU (Gabriela: "podia ter o nome do social media
     também ao final"). O guia chega no cliente pelo WhatsApp, longe de quem
     escreveu: sem nome, "estou por aqui" não diz quem é. */
  const nomeDeQuemFez = d.elaboradoPor?.trim();
  if (nomeDeQuemFez) {
    pdf.setDrawColor(...hexRgb(LINHA)); pdf.setLineWidth(0.3);
    pdf.line(L / 2 - 18, A / 2 + 16, L / 2 + 18, A / 2 + 16);
    tinta(); pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
    pdf.text(nomeDeQuemFez, L / 2, A / 2 + 23, { align: "center" });
    suave(); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5);
    pdf.text(d.cliente, L / 2, A / 2 + 28.5, { align: "center" });
  }

  pdf.setFontSize(8);
  pdf.text("Feito no Cria Social Club", L / 2, A - 20, { align: "center" });

  return pdf;
}

export async function baixarGuiaGravacao(d: DadosGuia, nomeArquivo: string): Promise<void> {
  const pdf = await gerarGuiaGravacao(d);
  pdf.save(`${nomeArquivo}.pdf`);
}
