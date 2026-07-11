import React from "react";

// Renderiza o elemento num jsPDF (mesma lógica usada desde o início: html2canvas + paginação A4).
async function buildPdf(element: HTMLDivElement) {
  const { default: html2canvas } = await import("html2canvas");
  const { default: jsPDF } = await import("jspdf");

  const fullHeight = Math.max(
    element.scrollHeight,
    element.offsetHeight,
    element.getBoundingClientRect().height,
  );
  const fullWidth = Math.max(element.scrollWidth, element.offsetWidth);

  const canvas = await html2canvas(element, {
    scale: 2,
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

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfPageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pdfPageHeight;
  while (heightLeft > 0) {
    position -= pdfPageHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdfPageHeight;
  }
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
