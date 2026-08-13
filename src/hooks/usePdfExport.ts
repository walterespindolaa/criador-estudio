import React from "react";

// Pontos onde o corte de página é seguro (em pixels do canvas, relativos ao topo
// do elemento). Lemos os filhos marcados com data-pdf-block: cada bloco declara
// "não me corte no meio". Elemento sem marcação nenhuma volta pro comportamento
// antigo (corte cego a cada altura de página).
function blockBoundaries(element: HTMLElement, scale: number): number[] {
  const blocks = Array.from(element.querySelectorAll<HTMLElement>("[data-pdf-block]"));
  if (blocks.length === 0) return [];
  const top = element.getBoundingClientRect().top;
  const out = new Set<number>();
  for (const b of blocks) {
    const r = b.getBoundingClientRect();
    // Fim do bloco + uma folga curta, pra não encostar a borda no texto.
    out.add(Math.round((r.bottom - top + 8) * scale));
  }
  return Array.from(out).sort((a, b) => a - b);
}

// Quebras de página OBRIGATÓRIAS: elementos marcados com data-pdf-break forçam o
// fim da página no TOPO deles (o que vem depois começa numa folha nova). É o que
// deixa a capa do relatório ser uma página inteira só dela.
function forcedBreaks(element: HTMLElement, scale: number): number[] {
  const marks = Array.from(element.querySelectorAll<HTMLElement>("[data-pdf-break]"));
  if (marks.length === 0) return [];
  const top = element.getBoundingClientRect().top;
  return marks
    .map((m) => Math.round((m.getBoundingClientRect().top - top) * scale))
    .filter((p) => p > 1)
    .sort((a, b) => a - b);
}

// Escolhe onde termina cada página respeitando os limites de bloco. Se um bloco
// for maior que a página inteira, aí não tem jeito e cortamos na altura cheia.
function pageCuts(boundaries: number[], forced: number[], totalPx: number, pagePx: number): number[] {
  const cuts: number[] = [];
  let start = 0;
  let guard = 0;
  while (totalPx - start > pagePx + 1 && guard++ < 200) {
    const limit = start + pagePx;
    // Quebra obrigatória dentro da página: corta nela, sem discussão (a capa
    // ocupa a folha inteira e o conteúdo desce pra próxima).
    const hardCut = forced.find((f) => f > start + 1 && f <= limit);
    if (hardCut) { cuts.push(hardCut); start = hardCut; continue; }
    // Preferência: um corte que preencha ao menos 35% da página, senão o PDF vira
    // um monte de folha quase vazia.
    const min = start + pagePx * 0.35;
    let cut = 0;
    for (const b of boundaries) if (b > min && b <= limit) cut = Math.max(cut, b);
    if (cut <= start) {
      // Não há limite de bloco na zona boa. Antes de cortar no meio, tenta QUALQUER
      // limite antes do fim da página: assim um bloco grande que começou no meio da
      // página é empurrado INTEIRO pra próxima em vez de sair partido (era o que
      // cortava cards ao meio). Só se não houver limite nenhum entre o começo e o
      // fim da página é que cortamos na altura cheia (bloco maior que uma página).
      let fallback = 0;
      for (const b of boundaries) if (b > start && b <= limit) fallback = Math.max(fallback, b);
      cut = fallback > start ? fallback : limit;
    }
    cuts.push(cut);
    start = cut;
  }
  cuts.push(totalPx);
  return cuts;
}

// O html2canvas fotografa o que já está pintado: imagem que ainda não terminou
// de carregar vira buraco branco no PDF. Antes de capturar, esperamos todas as
// <img> do bloco (logo do Cria, logo do cliente, thumbs do Instagram). O tempo
// limite existe pra uma imagem quebrada não travar o download pra sempre: nesse
// caso o PDF sai sem ela, que é melhor do que não sair.
async function waitForImages(element: HTMLElement, timeoutMs = 6000) {
  const imgs = Array.from(element.querySelectorAll("img"));
  if (imgs.length === 0) return;
  const pendentes = imgs.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    });
  });
  await Promise.race([
    Promise.all(pendentes),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

// Renderiza o elemento num jsPDF (html2canvas + paginação A4, agora fatiando o
// canvas por página em vez de deslocar a imagem inteira: assim cada página é só
// o pedaço dela e o corte cai entre blocos).
async function buildPdf(element: HTMLDivElement) {
  const { default: html2canvas } = await import("html2canvas");
  const { default: jsPDF } = await import("jspdf");

  await waitForImages(element);

  const fullHeight = Math.max(
    element.scrollHeight,
    element.offsetHeight,
    element.getBoundingClientRect().height,
  );
  // Largura de captura = a largura REAL do elemento (clientWidth), NÃO o scrollWidth.
  // scrollWidth incluía qualquer estouro horizontal (ex.: a capa full-bleed) e
  // deixava uma faixa branca à direita em todas as páginas (margem torta). Com
  // clientWidth o canvas tem a largura da página e as margens ficam simétricas.
  const fullWidth = element.clientWidth || element.offsetWidth;
  const scale = 2;
  const boundaries = blockBoundaries(element, scale);
  const forced = forcedBreaks(element, scale);

  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    width: fullWidth,
    height: fullHeight,
    windowWidth: fullWidth,
    windowHeight: fullHeight,
    scrollX: 0,
    scrollY: 0,
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfPageHeight = pdf.internal.pageSize.getHeight();
  // Quantos pixels do canvas cabem numa página A4 mantendo a proporção.
  const pxPerMm = canvas.width / pdfWidth;
  const pagePx = Math.floor(pdfPageHeight * pxPerMm);

  if (canvas.height <= pagePx + 1) {
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pdfWidth, canvas.height / pxPerMm);
    return pdf;
  }

  const cuts = pageCuts(boundaries, forced, canvas.height, pagePx);
  const slice = document.createElement("canvas");
  const ctx = slice.getContext("2d");
  let from = 0;
  cuts.forEach((to, i) => {
    const h = to - from;
    if (h <= 0) return;
    if (i > 0) pdf.addPage();
    if (!ctx) return;
    slice.width = canvas.width;
    slice.height = h;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, from, canvas.width, h, 0, 0, canvas.width, h);
    pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, pdfWidth, h / pxPerMm);
    // Cobre a emenda no topo da página nova (o "risco preto" que aparecia entre
    // páginas era o antialias da fatia). O corte cai sempre em área branca, então
    // essa faixa fininha não come conteúdo.
    if (i > 0) { pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, pdfWidth, 0.7, "F"); }
    from = to;
  });
  return pdf;
}

export function usePdfExport() {
  const exportPdf = async (elementRef: React.RefObject<HTMLDivElement | null>, filename: string) => {
    const element = elementRef.current;
    if (!element) return;
    const pdf = await buildPdf(element);
    pdf.save(`${filename}.pdf`);
  };

  // Mesmo PDF, mas como Blob (pra publicar no Storage e compartilhar por link).
  const exportPdfBlob = async (elementRef: React.RefObject<HTMLDivElement | null>): Promise<Blob | null> => {
    const element = elementRef.current;
    if (!element) return null;
    const pdf = await buildPdf(element);
    return pdf.output("blob");
  };

  return { exportPdf, exportPdfBlob };
}
