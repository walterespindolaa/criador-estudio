// Cache em memória dos vídeos subidos nesta sessão (confiável no Safari iOS).
// Guarda o File e um object URL pronto, criado uma única vez no upload.
// Some ao recarregar a página — aí o Bunny já terminou de processar.
type LocalVideo = { file: File; objectUrl: string };
const sessionVideos = new Map<string, LocalVideo>();

export function rememberLocalVideo(viewUrl: string, file: File): void {
  if (!viewUrl || sessionVideos.has(viewUrl)) return;
  sessionVideos.set(viewUrl, { file, objectUrl: URL.createObjectURL(file) });
}

export function getLocalVideoFile(viewUrl: string): File | null {
  return viewUrl ? sessionVideos.get(viewUrl)?.file ?? null : null;
}

export function getLocalVideoObjectUrl(viewUrl: string): string | null {
  return viewUrl ? sessionVideos.get(viewUrl)?.objectUrl ?? null : null;
}
