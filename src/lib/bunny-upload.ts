import { supabase } from "@/integrations/supabase/client";
import * as tus from "tus-js-client";
import { BUNNY_CDN_HOSTNAME } from "@/lib/constants";

// RPC sem tipos gerados (criapost_add_media não está no schema tipado do client).
const sbRpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string, args?: Record<string, unknown>
) => Promise<{ data: unknown; error: { message: string } | null }>;

// O invoke retorna "Edge Function returned a non-2xx status code" e esconde a
// causa real. Aqui lemos o corpo da resposta pra mostrar o erro de verdade.
async function edgeErrText(err: unknown, fallback: string): Promise<string> {
  const ctx = (err as { context?: Response })?.context;
  try {
    const body = await ctx?.clone().json();
    if (body?.error) return String(body.error);
  } catch { /* corpo não era JSON */ }
  try {
    const txt = await ctx?.clone().text();
    if (txt) return txt.slice(0, 300);
  } catch { /* ignora */ }
  return (err as { message?: string })?.message || fallback;
}

export interface BunnyStreamResult {
  videoGuid: string;
  view_url: string;
  thumbnail_url: string;
}

/**
 * Sobe um File de vídeo pro Bunny Stream (create-video + upload TUS) e devolve
 * o guid + URLs de embed/thumbnail. NÃO registra a mídia no banco: use isso
 * quando o post ainda não existe (post_id null) e a ref é inserida direto/
 * reconciliada depois.
 */
export async function uploadFileToBunnyStream(file: File): Promise<BunnyStreamResult> {
  const { data: uid } = await supabase.auth.getUser();
  const { data: sig, error: sigErr } = await supabase.functions.invoke("bunny-create-video", {
    body: { fileName: file.name, accountId: uid.user?.id, scope: "criapost" },
  });
  if (sigErr) throw new Error(await edgeErrText(sigErr, "Não consegui preparar o envio do vídeo."));
  const { videoGuid, libraryId, signature, expiration } = sig as {
    videoGuid: string; libraryId: string | number; signature: string; expiration: number;
  };
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: "https://video.bunnycdn.com/tusupload",
      retryDelays: [0, 1000, 3000, 5000],
      headers: {
        AuthorizationSignature: signature,
        AuthorizationExpire: String(expiration),
        VideoId: videoGuid,
        LibraryId: String(libraryId),
      },
      metadata: { filetype: file.type, title: file.name },
      onError: reject,
      onSuccess: () => resolve(),
    });
    upload.start();
  });
  const view_url = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}`;
  // Miniatura tem que vir do CDN da MESMA library onde o vídeo foi criado (Stream),
  // senão dá 404. Antes usava o CDN da library criapost (vazia).
  const thumbnail_url = `https://${BUNNY_CDN_HOSTNAME}/${videoGuid}/thumbnail.jpg`;
  return { videoGuid, view_url, thumbnail_url };
}

/**
 * Sobe um File de vídeo pro Bunny Stream e registra a mídia no post.
 * Fluxo: bunny-create-video (assinatura) -> upload TUS -> criapost_add_media.
 * Reaproveitado tanto pelo upload de vídeo do aparelho quanto pela ingestão
 * de vídeo vindo do Google Drive (Drive -> browser -> Bunny).
 */
export async function uploadVideoFileToBunny(file: File, postId: string): Promise<void> {
  const { videoGuid, view_url, thumbnail_url } = await uploadFileToBunnyStream(file);
  const { error: addErr } = await sbRpc("criapost_add_media", {
    p_post_id: postId, p_provider: "bunny_stream", p_external_file_id: videoGuid,
    p_file_name: file.name, p_file_type: file.type || "video/mp4", p_file_size: file.size,
    p_view_url: view_url, p_thumbnail_url: thumbnail_url, p_download_url: null, p_bunny_video_id: videoGuid,
  });
  if (addErr) throw new Error(addErr.message);
}
