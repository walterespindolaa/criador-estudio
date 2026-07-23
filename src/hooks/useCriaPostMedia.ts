import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as tus from "tus-js-client";
import { BUNNY_CDN_HOSTNAME } from "@/lib/constants";
import { capFullImage, makeThumbnail } from "@/lib/image-compress";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";

// Nome de arquivo seguro pro caminho no Storage (sem acento/espaço/símbolo).
function sanitizeStoragePath(name: string): string {
  const lastDot = name.lastIndexOf(".");
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot) : "";
  const clean = base
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "file";
  return `${clean}${ext.toLowerCase()}`;
}

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;
const sbRpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string, args?: Record<string, unknown>
) => Promise<{ data: unknown; error: { message: string } | null }>;

export interface CriaMedia {
  id: string;
  provider: string;
  external_file_id: string;
  file_name: string;
  file_type: string | null;
  view_url: string | null;
  thumbnail_url: string | null;
  bunny_video_id: string | null;
  position: number | null;
}

const isHeic = (f: File) => /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);

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

export function useCriaPostMedia(postId: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { activeAccountId } = useActiveAccount();
  const key = ["criapost-media", postId];
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const list = useQuery({
    queryKey: key,
    enabled: !!postId,
    queryFn: async (): Promise<CriaMedia[]> => {
      const { data, error } = await sbFrom("external_media_refs")
        .select("id, provider, external_file_id, file_name, file_type, view_url, thumbnail_url, bunny_video_id, position")
        .eq("post_id", postId)
        .order("position", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CriaMedia[];
    },
  });

  const uploadImage = useMutation({
    // Prévia OTIMISTA: assim que a pessoa escolhe a foto, coloca uma miniatura
    // local (blob) na grade na hora. O upload de verdade roda em segundo plano;
    // quando termina, o invalidate troca pela mídia real (mesma imagem, então
    // sem "pisca"). Se falhar, remove a prévia e libera o objectURL.
    onMutate: async (file: File) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CriaMedia[]>(key) ?? [];
      const objectUrl = URL.createObjectURL(file);
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimistic: CriaMedia = {
        id: tempId, provider: "local-pending", external_file_id: tempId,
        file_name: file.name, file_type: file.type || "image/jpeg",
        view_url: objectUrl, thumbnail_url: objectUrl, bunny_video_id: null,
        position: prev.length,
      };
      qc.setQueryData<CriaMedia[]>(key, [...prev, optimistic]);
      return { prev, objectUrl };
    },
    mutationFn: async (file: File) => {
      let blob: Blob = file, name = file.name, type = file.type || "image/jpeg";
      if (isHeic(file)) {
        // Import dinâmico: o heic2any é pesado (~350 kB gzip). Só baixa quando
        // a pessoa realmente sobe um HEIC, em vez de pesar toda abertura de post.
        const heic2any = (await import("heic2any")).default;
        const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
        blob = Array.isArray(out) ? out[0] : out;
        name = name.replace(/\.(heic|heif)$/i, ".jpg"); type = "image/jpeg";
      }
      // Sobe DIRETO pro Storage (os bytes nunca tocam uma edge function; antes
      // viravam base64 e estouravam WORKER_RESOURCE_LIMIT em foto grande).
      // DECISÃO DE PRODUTO: guardar o ORIGINAL em QUALIDADE CHEIA (a social mídia
      // baixa e posta), + uma MINIATURA leve pra listar rápido. O custo é
      // controlado pela retenção configurável (storage_retention_days).
      const source = blob instanceof File ? blob : new File([blob], name, { type });
      // Original cheio: só um teto de segurança (>4096px vira 4096 q~0.92); senão sobe intacto.
      const full = await capFullImage(source);
      // Miniatura: máx 640px, q~0.7 (~30-80KB), placeholder do preview progressivo.
      const thumb = await makeThumbnail(source);
      const owner = activeAccountId || user?.id;
      if (!owner) throw new Error("Sessão expirada. Entre de novo.");
      const safe = sanitizeStoragePath(full.name || name);
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const fullPath = `${owner}/${stamp}-${safe}`;
      const { error: upErr } = await supabase.storage.from("media").upload(fullPath, full, {
        upsert: true, contentType: full.type,
      });
      if (upErr) throw new Error(upErr.message || "Não consegui subir a imagem.");
      const publicUrl = supabase.storage.from("media").getPublicUrl(fullPath).data.publicUrl;
      // Miniatura em caminho separado (sufixo -thumb). Se falhar, cai pra imagem cheia
      // como thumbnail (não trava o upload por causa da prévia).
      let thumbUrl = publicUrl;
      const thumbPath = `${owner}/${stamp}-thumb-${safe}`;
      const { error: thumbErr } = await supabase.storage.from("media").upload(thumbPath, thumb, {
        upsert: true, contentType: thumb.type,
      });
      if (!thumbErr) thumbUrl = supabase.storage.from("media").getPublicUrl(thumbPath).data.publicUrl;
      const { error: addErr } = await sbRpc("criapost_add_media", {
        // view_url + download_url = ORIGINAL cheio (download/post). thumbnail_url = MINIATURA.
        p_post_id: postId, p_provider: "device", p_external_file_id: fullPath,
        p_file_name: name, p_file_type: full.type, p_file_size: full.size,
        p_view_url: publicUrl, p_thumbnail_url: thumbUrl, p_download_url: publicUrl, p_bunny_video_id: null,
      });
      if (addErr) throw new Error(addErr.message);
    },
    onError: (_e, _f, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      if (ctx?.objectUrl) URL.revokeObjectURL(ctx.objectUrl);
    },
    onSuccess: (_d, _f, ctx) => { if (ctx?.objectUrl) URL.revokeObjectURL(ctx.objectUrl); },
    onSettled: invalidate,
  });

  const uploadVideo = useMutation({
    mutationFn: async (file: File) => {
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
      const { error: addErr } = await sbRpc("criapost_add_media", {
        p_post_id: postId, p_provider: "bunny_stream", p_external_file_id: videoGuid,
        p_file_name: file.name, p_file_type: file.type || "video/mp4", p_file_size: file.size,
        p_view_url: view_url, p_thumbnail_url: thumbnail_url, p_download_url: null, p_bunny_video_id: videoGuid,
      });
      if (addErr) throw new Error(addErr.message);
    },
    onSuccess: invalidate,
  });

  const addDriveLink = useMutation({
    mutationFn: async (url: string) => {
      const raw = url.trim();

      // Link de PASTA não serve. O código pegava o ID da pasta e montava
      // /file/d/<id-da-pasta>/preview, uma URL que não existe. A prévia
      // nunca aparecia e ninguém entendia por quê. Agora avisa na hora.
      if (/drive\.google\.com\/drive\/(u\/\d+\/)?folders\//i.test(raw)) {
        throw new Error(
          "Esse é o link da PASTA. Abra o arquivo dentro dela, clique em Compartilhar → Copiar link, e cole aqui.",
        );
      }

      // Aceita as formas de link de ARQUIVO do Drive:
      //   /file/d/<id>/view · open?id=<id> · uc?id=<id> · ?id=<id>
      const fileId =
        raw.match(/\/file\/d\/([-\w]{20,})/)?.[1] ??
        raw.match(/[?&]id=([-\w]{20,})/)?.[1] ??
        (/^[-\w]{20,}$/.test(raw) ? raw : null);

      if (!fileId) {
        throw new Error("Não reconheci esse link. Use o link de um arquivo do Drive (…/file/d/…).");
      }

      const { error } = await sbRpc("criapost_add_media", {
        p_post_id: postId, p_provider: "gdrive", p_external_file_id: fileId,
        p_file_name: "Google Drive", p_file_type: null, p_file_size: null,
        p_view_url: `https://drive.google.com/file/d/${fileId}/preview`,
        p_thumbnail_url: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
        p_download_url: raw, p_bunny_video_id: null,
      });
      if (error) {
        // Traduz o erro cru do banco pra algo que a pessoa entenda e resolva.
        const m = error.message || "";
        if (m.includes("post_nao_encontrado")) throw new Error("O post ainda não foi criado. Feche e abra de novo.");
        if (m.includes("modulo_inativo")) throw new Error("O Cria Post não está ativo nesta conta.");
        if (m.includes("sem_permissao")) throw new Error("Você não tem permissão pra editar este post.");
        throw new Error(m);
      }
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (mediaId: string) => {
      const { data, error } = await supabase.functions.invoke("criapost-media-delete", { body: { media_id: mediaId } });
      if (error) throw new Error(await edgeErrText(error, "Não consegui remover a mídia."));
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    },
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await sbRpc("criapost_reorder_media", { p_post_id: postId, p_ids: ids });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return { list, uploadImage, uploadVideo, addDriveLink, remove, reorder };
}
