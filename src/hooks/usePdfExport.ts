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

// Escolhe onde termina cada página respeitando os limites de bloco. Se um bloco
// for maior que a página inteira, aí não tem jeito e cortamos na altura cheia.
function pageCuts(boundaries: number[], totalPx: number, pagePx: number): number[] {
  const cuts: number[] = [];
  let start = 0;
  let guard = 0;
  while (totalPx - start > pagePx + 1 && guard++ < 200) {
    const limit = start + pagePx;
    // Só aceita um corte que preencha ao menos 35% da página, senão o PDF vira
    // um monte de folha quase vazia.
    const min = start + pagePx * 0.35;
    let cut = 0;
    for (const b of boundaries) if (b > min && b <= limit) cut = Math.max(cut, b);
    if (cut <= start) cut = limit;
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
  const fullWidth = Math.max(element.scrollWidth, element.offsetWidth);
  const scale = 2;
  const boundaries = blockBoundaries(element, scale);

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

  const cuts = pageCuts(boundaries, canvas.height, pagePx);
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
