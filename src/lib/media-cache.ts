// Cache em memória dos vídeos subidos nesta sessão (confiável no Safari iOS,
// diferente da Cache API). Some ao recarregar a página — aí o Bunny já
// terminou de processar e o player dele assume.
const sessionVideos = new Map<string, File>();

export function rememberLocalVideo(viewUrl: string, file: File): void {
  if (viewUrl) sessionVideos.set(viewUrl, file);
}
export function getLocalVideoFile(viewUrl: string): File | null {
  return viewUrl ? sessionVideos.get(viewUrl) ?? null : null;
}
export function getLocalVideoObjectUrl(viewUrl: string): string | null {
  const f = getLocalVideoFile(viewUrl);
  return f ? URL.createObjectURL(f) : null;
}
