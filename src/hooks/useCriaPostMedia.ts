import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as tus from "tus-js-client";
import heic2any from "heic2any";

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
}

const isHeic = (f: File) => /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);

async function fileToBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = ""; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

export function useCriaPostMedia(postId: string | null) {
  const qc = useQueryClient();
  const key = ["criapost-media", postId];
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const list = useQuery({
    queryKey: key,
    enabled: !!postId,
    queryFn: async (): Promise<CriaMedia[]> => {
      const { data, error } = await sbFrom("external_media_refs")
        .select("id, provider, external_file_id, file_name, file_type, view_url, thumbnail_url, bunny_video_id")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CriaMedia[];
    },
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      let blob: Blob = file, name = file.name, type = file.type;
      if (isHeic(file)) {
        const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
        blob = Array.isArray(out) ? out[0] : out;
        name = name.replace(/\.(heic|heif)$/i, ".jpg"); type = "image/jpeg";
      }
      const data_base64 = await fileToBase64(blob);
      const { data, error } = await supabase.functions.invoke("criapost-image-upload", {
        body: { post_id: postId, file_name: name, file_type: type, data_base64 },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data;
    },
    onSuccess: invalidate,
  });

  const uploadVideo = useMutation({
    mutationFn: async (file: File) => {
      const { data: uid } = await supabase.auth.getUser();
      const { data: sig, error: sigErr } = await supabase.functions.invoke("bunny-create-video", {
        body: { fileName: file.name, accountId: uid.user?.id, scope: "criapost" },
      });
      if (sigErr) throw sigErr;
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
      const { error: addErr } = await sbRpc("criapost_add_media", {
        p_post_id: postId, p_provider: "bunny_stream", p_external_file_id: videoGuid,
        p_file_name: file.name, p_file_type: file.type || "video/mp4", p_file_size: file.size,
        p_view_url: view_url, p_thumbnail_url: null, p_download_url: null, p_bunny_video_id: videoGuid,
      });
      if (addErr) throw new Error(addErr.message);
    },
    onSuccess: invalidate,
  });

  const addDriveLink = useMutation({
    mutationFn: async (url: string) => {
      const m = url.match(/[-\w]{25,}/);
      const fileId = m ? m[0] : url;
      const { error } = await sbRpc("criapost_add_media", {
        p_post_id: postId, p_provider: "gdrive", p_external_file_id: fileId,
        p_file_name: "Google Drive", p_file_type: null, p_file_size: null,
        p_view_url: `https://drive.google.com/file/d/${fileId}/preview`,
        p_thumbnail_url: `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`,
        p_download_url: url, p_bunny_video_id: null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (mediaId: string) => {
      const { data, error } = await supabase.functions.invoke("criapost-media-delete", { body: { media_id: mediaId } });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    },
    onSuccess: invalidate,
  });

  return { list, uploadImage, uploadVideo, addDriveLink, remove };
}
