/**
 * Utilitários de imagem client-side (canvas). Rodam no browser, sem tocar em
 * nenhuma edge function: os bytes nunca viram base64 nem sobem pra memória do
 * servidor (isso estourava WORKER_RESOURCE_LIMIT em foto grande/carrossel).
 */

// Desenha o arquivo num canvas redimensionado e devolve um JPEG.
// - maxPx: teto do maior lado (redimensiona só se passar disso).
// - quality: qualidade do JPEG (0..1).
// Devolve null se não for imagem ou se o decode falhar (o chamador decide o fallback).
function encodeJpeg(file: File, maxPx: number, quality: number): Promise<File | null> {
  if (!file.type.startsWith("image/")) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round((height * maxPx) / width); width = maxPx; }
        else { width = Math.round((width * maxPx) / height); height = maxPx; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); resolve(null); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob) { resolve(null); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
      }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/**
 * Comprime/redimensiona uma imagem client-side via canvas.
 * Aplica resize até max 1920px no lado maior e re-encode pra JPEG q~0.82.
 * Se o resultado ficar maior que o original (ex: foto pequena), devolve o file original.
 * MANTIDO como está: usado pelo import do Drive (useGoogleDrive) e pelo PostEditor.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const out = await encodeJpeg(file, 1920, 0.82);
  if (!out || out.size >= file.size) return file;
  return out;
}

/**
 * Prepara a imagem ORIGINAL pra subir em QUALIDADE CHEIA (foto de post que a
 * social mídia baixa e posta). Só aplica um teto de SEGURANÇA: se o maior lado
 * passar de maxPx (4096 por padrão), redimensiona mantendo qualidade alta
 * (q~0.92). Caso contrário devolve o arquivo original intacto, sem re-encode.
 * Diferente do compressImage, aqui NÃO comprimimos agressivo de propósito.
 */
export async function capFullImage(file: File, maxPx = 4096, quality = 0.92): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // GIF animado: nunca re-encoda (perderia a animação). Sobe como está.
  if (file.type === "image/gif") return file;
  const out = await encodeJpeg(file, maxPx, quality);
  if (!out) return file;
  // Se o teto não mudou nada (foto já pequena) e o re-encode ficou MAIOR, mantém o original.
  if (out.size >= file.size) return file;
  return out;
}

/**
 * Gera uma MINIATURA leve pra listagem/preview progressivo (grade, carrossel,
 * portal de aprovação). Máx 640px no maior lado, q~0.7 → ~30-80KB. Serve só
 * como placeholder rápido; a imagem cheia (view_url) carrega sob demanda.
 * Se o decode falhar, devolve o próprio arquivo (o upload segue mesmo assim).
 */
export async function makeThumbnail(file: File, maxPx = 640, quality = 0.7): Promise<File> {
  const out = await encodeJpeg(file, maxPx, quality);
  if (!out) return file;
  const base = file.name.replace(/\.[^.]+$/, "");
  return new File([out], `${base}-thumb.jpg`, { type: "image/jpeg" });
}
