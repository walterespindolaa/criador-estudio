import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { validateUpload } from "@/lib/upload-validation";
import type { Database } from "@/integrations/supabase/types";

export type FileRecord = Database["public"]["Tables"]["files"]["Row"] & {
  source?: string | null;
  expires_at?: string | null;
};

const STORAGE_BUCKET = "files";

export type UploadFileInput = {
  file: File;
  category?: string | null;
  postId?: string | null;
  tags?: string[] | null;
  source?: string;
  expiresAt?: string | null;
};

export function useFiles() {
  const { activeAccountId } = useActiveAccount();
  const queryClient = useQueryClient();
  const userId = activeAccountId;
  const queryKey = ["files", userId] as const;

  const {
    data: files = [],
    isLoading,
    error,
  } = useQuery<FileRecord[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FileRecord[];
    },
    enabled: !!userId,
  });

  const uploadFile = useMutation({
    mutationFn: async (input: UploadFileInput): Promise<FileRecord> => {
      if (!userId) throw new Error("Not authenticated");
      const { file, category = null, postId = null, tags = null, source = "upload", expiresAt = null } = input;

      const validation = validateUpload(file, "file");
      if (!validation.ok) throw new Error(validation.reason);

      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file);
      if (uploadError) throw uploadError;

      const insertPayload: Record<string, unknown> = {
        user_id: userId,
        name: file.name,
        storage_path: path,
        file_type: file.type || null,
        size_bytes: file.size,
        category,
        post_id: postId,
        tags,
        source,
        expires_at: expiresAt,
      };

      const { data, error } = await supabase
        .from("files")
        .insert(insertPayload as never)
        .select()
        .single();
      if (error) {
        await supabase.storage.from(STORAGE_BUCKET).remove([path]);
        throw error;
      }
      // Atualiza a cota (não bloqueia se falhar — log e segue).
      const { error: incErr } = await (supabase.rpc as unknown as (
        fn: string, args: unknown,
      ) => Promise<{ error: unknown }>)("increment_storage", { _user: userId, _delta: file.size });
      if (incErr) console.error("[useFiles] increment_storage failed (+)", incErr);
      return data as FileRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (file: Pick<FileRecord, "id" | "storage_path"> & { size_bytes?: number | null }): Promise<void> => {
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([file.storage_path]);
      if (storageError) throw storageError;
      const { error } = await supabase.from("files").delete().eq("id", file.id);
      if (error) throw error;
      // Decrementa a cota.
      if (userId && file.size_bytes && file.size_bytes > 0) {
        const { error: decErr } = await (supabase.rpc as unknown as (
          fn: string, args: unknown,
        ) => Promise<{ error: unknown }>)("increment_storage", { _user: userId, _delta: -file.size_bytes });
        if (decErr) console.error("[useFiles] increment_storage failed (-)", decErr);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const getPublicUrl = async (path: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (error || !data) return "";
    return data.signedUrl;
  };

  return { files, isLoading, error, uploadFile, deleteFile, getPublicUrl };
}
