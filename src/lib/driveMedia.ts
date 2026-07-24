// Helper único pra exibir mídia do Cria Post, com tratamento especial pro Google Drive.
// O view_url do Drive (drive.google.com/file/d/ID/view ou /preview) é uma PÁGINA,
// não serve como src de <img>. Aqui convertemos a referência numa URL exibível.

export type MediaLike = {
  provider?: string | null;
  external_file_id?: string | null;
  view_url?: string | null;
  thumbnail_url?: string | null;
  download_url?: string | null;
  file_type?: string | null;
  file_name?: string | null;
  bunny_video_id?: string | null;
};

// Valor real usado no banco é "gdrive" (useCriaPostMedia.addDriveLink).
// Aceitamos variações por segurança, sem afetar storage/bunny.
const DRIVE_PROVIDERS = new Set(["gdrive", "drive", "google_drive"]);

export function isDriveMedia(m: MediaLike): boolean {
  return DRIVE_PROVIDERS.has((m.provider ?? "").toLowerCase());
}

// Detecta se uma URL avulsa (ex.: campo Ideia/Referência do post) aponta pro
// Google Drive/Docs, pra oferecer o atalho "Abrir no Drive" sem depender de anexo.
export function isDriveUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /(?:^|\/\/|\.)(?:drive|docs)\.google\.com\//i.test(url.trim());
}

export function isVideoMedia(m: MediaLike): boolean {
  return !!m.file_type?.startsWith("video") || !!m.bunny_video_id || m.provider === "bunny_stream";
}

export function isDriveVideo(m: MediaLike): boolean {
  return isDriveMedia(m) && !!m.file_type?.startsWith("video");
}

/** Extrai o FILE_ID do Drive: primeiro do external_file_id, depois das URLs salvas. */
export function getDriveFileId(m: MediaLike): string | null {
  const direct = m.external_file_id?.trim();
  if (direct && /^[-\w]{20,}$/.test(direct)) return direct;
  for (const url of [m.view_url, m.download_url, m.thumbnail_url]) {
    if (!url) continue;
    const byPath = url.match(/\/(?:file\/)?d\/([-\w]{25,})/);
    if (byPath) return byPath[1];
    const byParam = url.match(/[?&]id=([-\w]{25,})/);
    if (byParam) return byParam[1];
  }
  return direct || null;
}

/**
 * URL de imagem exibível (src de <img>) pra qualquer mídia do Cria Post.
 * Drive: usa https://drive.google.com/thumbnail?id=ID&sz=wN (funciona pra arquivos
 * com "qualquer pessoa com o link", inclusive frame de vídeos), com fallback pro
 * thumbnail_url salvo. Outros providers seguem como antes.
 */
export function getDisplayImageUrl(m: MediaLike, size = 1600): string | null {
  if (isDriveMedia(m)) {
    const id = getDriveFileId(m);
    if (id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${size}`;
    return m.thumbnail_url || null;
  }
  if (isVideoMedia(m)) return m.thumbnail_url || null;
  return m.view_url || m.thumbnail_url || m.download_url || null;
}

/**
 * URL LEVE pra listagem/placeholder do preview progressivo (grade, carrossel,
 * portal de aprovação). Prioriza a MINIATURA salva (thumbnail_url) pra não puxar
 * a imagem cheia de todo mundo de uma vez. Drive: usa o thumbnail pequeno.
 * Vídeo: o thumbnail já é o frame. Devolve null quando não há nada exibível.
 */
export function getThumbnailUrl(m: MediaLike, size = 480): string | null {
  if (isDriveMedia(m)) {
    const id = getDriveFileId(m);
    if (id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${size}`;
    return m.thumbnail_url || null;
  }
  if (isVideoMedia(m)) return m.thumbnail_url || null;
  return m.thumbnail_url || m.view_url || m.download_url || null;
}

/** Fallback (lh3.googleusercontent.com) pra quando o thumbnail do Drive falhar. */
export function getDriveImageFallbackUrl(m: MediaLike, size = 1600): string | null {
  if (!isDriveMedia(m)) return null;
  const id = getDriveFileId(m);
  if (!id) return null;
  return `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w${size}`;
}

/** URL de embed (iframe) pra vídeo: Drive usa /preview, Bunny já vem pronto no view_url. */
export function getVideoEmbedUrl(m: MediaLike): string | null {
  if (isDriveVideo(m)) {
    const id = getDriveFileId(m);
    if (id) return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
  }
  return m.view_url || null;
}

/**
 * Tipo de player pra um vídeo:
 *  - "bunny": embed do Bunny Stream (iframe.mediadelivery.net) → iframe.
 *  - "drive": vídeo do Google Drive → iframe /preview.
 *  - "file":  arquivo de vídeo no storage (device) → tag <video controls>.
 * Devolve null quando a mídia não é vídeo.
 */
export function getVideoKind(m: MediaLike): "bunny" | "drive" | "file" | null {
  if (!isVideoMedia(m)) return null;
  if (!!m.bunny_video_id || m.provider === "bunny_stream" || /iframe\.mediadelivery\.net/i.test(m.view_url ?? "")) return "bunny";
  if (isDriveVideo(m)) return "drive";
  return "file";
}

/** src direto pra <video> (vídeo de storage/device): o próprio arquivo público. */
export function getVideoFileUrl(m: MediaLike): string | null {
  return m.view_url || m.download_url || null;
}

/**
 * URL da PÁGINA do Drive pra abrir em nova aba (fallback quando o embed /preview
 * é bloqueado pela conta do cliente). Deriva /file/d/ID/view a partir do file id;
 * cai no view_url salvo se não achar id.
 */
export function getDriveViewPageUrl(m: MediaLike): string | null {
  if (!isDriveMedia(m)) return null;
  const id = getDriveFileId(m);
  if (id) return `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
  return m.view_url || null;
}

// Nome de arquivo seguro pro download individual: <titulo>-<n>.<ext> sem acento/espaço.
// Extraído do CriaPostMedia pra ser reaproveitado no popup da agenda.
export function mediaDownloadName(title: string | undefined, index: number, m: MediaLike, mimeType?: string): string {
  const base = (title || "post")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 60) || "post";
  // Extensão: tenta pelo nome do arquivo salvo, depois pelo mime, senão jpg.
  const fromName = (m.file_name || "").match(/\.([a-z0-9]{2,5})$/i)?.[1];
  const fromMime = (mimeType || m.file_type || "").split("/")[1]?.split(";")[0];
  const ext = (fromName || fromMime || "jpg").toLowerCase().replace("jpeg", "jpg");
  return `${base}-${index + 1}.${ext}`;
}

// Abre uma URL numa nova aba/força download nativo sem passar pelo fetch-blob.
// É o fallback do mobile: no Safari/webview o fetch de uma imagem de outra origem
// falha ("Load failed"), então a gente entrega a imagem pra pessoa segurar e salvar.
function openForSave(url: string, fileName: string) {
  try {
    const a = document.createElement("a");
    a.href = url;
    // download só é respeitado em same-origin; cross-origin o navegador ignora e
    // abre numa aba (target _blank), que é justamente o que queremos no mobile.
    a.download = fileName;
    a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

// Download INDIVIDUAL de uma mídia, na melhor qualidade disponível:
//  - Storage (device): tenta baixar o arquivo como blob e força o download nomeado.
//    Se o fetch-blob falhar (mobile: "Load failed"), abre a imagem pra segurar e salvar.
//  - Drive: manda pro link de download do Drive (uc?export=download).
//  - Vídeo (Bunny/Drive): não dá pra forçar o MP4, abre o player em nova aba.
// Devolve "video" quando só abriu o player e "opened" quando caiu no fallback do
// mobile (abriu a imagem pra salvar), pra quem chama avisar por toast.
// Extraído do CriaPostMedia pra ser reaproveitado no popup da agenda.
export async function downloadMediaFile(m: MediaLike, fileName: string): Promise<"file" | "video" | "opened"> {
  if (isVideoMedia(m)) {
    const embed = m.view_url;
    if (!embed) throw new Error("Vídeo indisponível.");
    window.open(embed, "_blank", "noopener");
    return "video";
  }
  if (isDriveMedia(m)) {
    const id = getDriveFileId(m);
    if (!id) throw new Error("Link do Drive inválido.");
    const a = document.createElement("a");
    a.href = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
    a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    return "file";
  }
  // Imagem no Storage: baixa os bytes e força o download com nome coerente.
  const url = m.view_url || m.thumbnail_url;
  if (!url) throw new Error("Arquivo indisponível.");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Não consegui baixar o arquivo.");
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = obj; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(obj);
    return "file";
  } catch {
    // Mobile (Safari/webview): o fetch-blob de uma imagem de outra origem quebra com
    // "Load failed". Em vez de mostrar o erro, abre a imagem pra pessoa salvar de lá.
    openForSave(url, fileName);
    return "opened";
  }
}
