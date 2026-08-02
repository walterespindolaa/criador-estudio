// Helper único pra exibir mídia do Cria Post, com tratamento especial pro Google Drive.
// O view_url do Drive (drive.google.com/file/d/ID/view ou /preview) é uma PÁGINA,
// não serve como src de <img>. Aqui convertemos a referência numa URL exibível.

import { supabase } from "@/integrations/supabase/client";

export type MediaLike = {
  id?: string | null;
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

// Extensão de vídeo no nome/URL (cobre arquivos sem mime salvo, ex.: ref antiga).
function hasVideoExt(s: string | null | undefined): boolean {
  return /\.(mp4|mov|webm|m4v|mkv|avi)(?:$|[?#])/i.test((s ?? "").trim());
}

export function isVideoMedia(m: MediaLike): boolean {
  // Mime explícito manda: imagem nunca é vídeo, vídeo sempre é.
  if (m.file_type?.startsWith("image")) return false;
  if (m.file_type?.startsWith("video")) return true;
  // Bunny Stream (upload de vídeo do app / ingestão do Drive) é sempre vídeo.
  if (!!m.bunny_video_id || m.provider === "bunny_stream") return true;
  // ATENÇÃO: aqui NÃO se chuta que link do Drive sem mime é vídeo. Quem descobre o
  // tipo de verdade é o addDriveLink (edge drive-file-meta) na hora de colar o link,
  // e o backfill preguiçoso do useCriaPostMedia pros links antigos. Quando mesmo
  // assim o tipo continua desconhecido (arquivo não público), a mídia entra no
  // ESTADO NEUTRO: ver isUnknownDriveMedia.
  // Fallback por extensão do nome/URL pra refs sem mime.
  return hasVideoExt(m.file_name) || hasVideoExt(m.view_url) || hasVideoExt(m.download_url);
}

/**
 * Mídia do Google Drive cujo tipo REAL não foi possível descobrir (file_type nulo
 * e sem extensão no nome/URL). Acontece quando o arquivo não está como "qualquer
 * pessoa com o link" ou está em outra conta, e a Drive API não responde.
 *
 * Nesses casos NÃO se chuta nada: a interface mostra a miniatura do Drive (que
 * existe tanto pra imagem quanto pra vídeo) SEM o play gigante, e oferece um
 * atalho discreto "Abrir no Drive", que serve tanto pra assistir vídeo quanto pra
 * ver a arte. Assim ninguém vê "Assistir" numa arte estática e o vídeo continua
 * acessível em um clique (não volta o bug do frame borrado sem ação nenhuma).
 */
export function isUnknownDriveMedia(m: MediaLike): boolean {
  if (!isDriveMedia(m)) return false;
  if (m.file_type) return false;
  return !hasVideoExt(m.file_name) && !hasVideoExt(m.view_url) && !hasVideoExt(m.download_url);
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
  // Qualquer mídia do Drive (com ou sem mime) toca pelo /preview do próprio arquivo.
  if (isDriveMedia(m)) {
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
  // Qualquer mídia do Drive (mesmo sem mime) usa o player /preview, não a tag <video>.
  if (isDriveMedia(m)) return "drive";
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

// Dispara o download de um blob com nome coerente. O blob: é same-origin, então o
// atributo download é respeitado (inclusive no iOS Safari: cai em Arquivos).
function triggerBlobDownload(blob: Blob, fileName: string) {
  const obj = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = obj; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(obj);
}

// Baixa a mídia pelo edge proxy (criapost-download-file): o servidor busca no Bunny
// (sem CORS) e devolve os bytes com CORS liberado, então o navegador recebe um blob
// de verdade e força o download. Devolve false se não deu (pra tentar outra rota).
async function downloadViaProxy(mediaId: string, fileName: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("criapost-download-file", { body: { media_id: mediaId } });
  if (error || !(data instanceof Blob)) return false;
  triggerBlobDownload(data, fileName);
  return true;
}

// Abre uma URL numa nova aba/força download nativo sem passar pelo fetch-blob.
// É o fallback final do mobile: no Safari/webview o fetch de uma imagem de outra origem
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
//  - Drive: manda pro link de download do Drive (uc?export=download). Isso vale pra
//    imagem do Drive E pro link do Drive de tipo desconhecido (arte estática precisa
//    BAIXAR de verdade; antes todo link do Drive caía no caminho "vídeo: só abre o
//    player" por causa do chute do isVideoMedia).
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
  // Imagem no Bunny Storage/CDN: o CDN não manda CORS, então o fetch-blob direto
  // quebra no mobile. Baixa pelo edge proxy (bytes com CORS liberado) e força o
  // download nomeado. É a rota que funciona no iOS.
  const url = m.view_url || m.thumbnail_url;
  if (!url) throw new Error("Arquivo indisponível.");
  if (m.id) {
    try {
      if (await downloadViaProxy(m.id, fileName)) return "file";
    } catch { /* tenta as rotas abaixo */ }
  }
  // Sem id (ou proxy indisponível): tenta o fetch-blob direto (funciona quando o
  // arquivo é same-origin ou o CDN manda CORS, ex.: desktop).
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Não consegui baixar o arquivo.");
    triggerBlobDownload(await res.blob(), fileName);
    return "file";
  } catch {
    // Última cartada: abre a imagem pra pessoa segurar e salvar.
    openForSave(url, fileName);
    return "opened";
  }
}
