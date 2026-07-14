/* ═══════════════════════════════════════════════════════════════════════════
   PDF → IMAGENS (no navegador)

   Um moodboard é IMAGEM, não texto. A paleta e a tipografia moram no desenho
   da página — extrair só o texto do PDF pegaria metade, e a metade menos
   importante. Por isso a gente renderiza as páginas e manda pra um modelo que
   ENXERGA.

   A renderização acontece AQUI, no navegador da pessoa:
   · o PDF nunca sobe inteiro pro servidor (é mais rápido e mais barato);
   · a gente controla o tamanho do que sai (limite de payload da edge function);
   · o pdfjs entra por import dinâmico — quem nunca sobe brandbook não paga
     nem 1 byte por essa biblioteca no bundle.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Páginas que a gente lê. Brandbook útil está sempre nas primeiras. */
export const MAX_PAGINAS = 8;
/** 10 MB. 5 MB era apertado: moodboard bonito é imagem e estoura fácil — e
 *  bater na trava logo na primeira tentativa é a pior hora de frustrar. */
export const MAX_BYTES = 10 * 1024 * 1024;
/** Largura de render. Suficiente pra ler hex e nome de fonte, leve pra trafegar. */
const LARGURA = 1100;

export type PaginaLida = { dataUrl: string; n: number };

function canvasParaJpeg(canvas: HTMLCanvasElement): string {
  // JPEG a 0.72: uma página de moodboard fica em ~120-180 KB. 8 páginas ≈ 1 MB,
  // que passa folgado no limite de corpo da edge function. PNG estouraria.
  return canvas.toDataURL("image/jpeg", 0.72);
}

async function imagemParaDataUrl(file: File): Promise<PaginaLida[]> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, LARGURA / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não consegui processar a imagem.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return [{ dataUrl: canvasParaJpeg(canvas), n: 1 }];
}

async function pdfParaDataUrls(
  file: File,
  onProgresso?: (lidas: number, total: number) => void,
): Promise<PaginaLida[]> {
  const pdfjs = await import("pdfjs-dist");
  // O worker precisa vir do mesmo pacote; o Vite resolve a URL no build.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const total = Math.min(doc.numPages, MAX_PAGINAS);
  const paginas: PaginaLida[] = [];

  for (let n = 1; n <= total; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: LARGURA / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não consegui renderizar o PDF.");
    await page.render({ canvasContext: ctx, viewport }).promise;
    paginas.push({ dataUrl: canvasParaJpeg(canvas), n });
    onProgresso?.(n, total);
  }
  await doc.destroy();
  return paginas;
}

export type ArquivoInvalido = { erro: string };

export function validarArquivo(file: File): ArquivoInvalido | null {
  if (file.size > MAX_BYTES) {
    return { erro: `O arquivo tem ${(file.size / 1048576).toFixed(1)} MB. O limite é 10 MB.` };
  }
  const nome = file.name.toLowerCase();
  const ehPdf = file.type === "application/pdf" || nome.endsWith(".pdf");
  const ehImg = file.type.startsWith("image/");
  if (nome.endsWith(".docx") || nome.endsWith(".doc")) {
    // Honestidade > falsa compatibilidade: ler .docx exigiria outra biblioteca
    // e o resultado seria pior (o Word perde o layout, que é o que interessa).
    // Exportar como PDF leva 5 segundos e a leitura fica muito melhor.
    return { erro: "Word não dá pra ler direito (o layout se perde). Exporte como PDF — fica bem melhor." };
  }
  if (!ehPdf && !ehImg) return { erro: "Mande um PDF ou uma imagem do moodboard." };
  return null;
}

export async function lerPaginas(
  file: File,
  onProgresso?: (lidas: number, total: number) => void,
): Promise<PaginaLida[]> {
  const nome = file.name.toLowerCase();
  const ehPdf = file.type === "application/pdf" || nome.endsWith(".pdf");
  return ehPdf ? pdfParaDataUrls(file, onProgresso) : imagemParaDataUrl(file);
}
