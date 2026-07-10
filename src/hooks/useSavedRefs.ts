import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type SavedRef = {
  id: string;
  user_id: string;
  url: string;
  platform: string;
  author: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  media_type: string | null;
  folder: string | null;
  note: string | null;
  status: "novo" | "usado";
  used_post_id: string | null;
  created_at: string;
};

export function useSavedRefs() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  return useQuery<SavedRef[]>({
    queryKey: ["saved-refs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await sbFrom("saved_refs")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SavedRef[];
    },
  });
}

export function useSavedFolders() {
  const { data: refs = [] } = useSavedRefs();
  return useMemo(() => {
    const set = new Set<string>();
    for (const r of refs) if (r.folder && r.folder.trim()) set.add(r.folder.trim());
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [refs]);
}

// Busca capa/legenda/@ do link via edge (Apify), best-effort.
async function fetchPreview(url: string): Promise<Partial<SavedRef>> {
  try {
    const { data, error } = await supabase.functions.invoke("saved-fetch", { body: { url } });
    if (error) return {};
    const d = data as { platform?: string; thumbnail?: string | null; caption?: string | null; author?: string | null; media_type?: string | null };
    return { platform: d.platform, thumbnail_url: d.thumbnail ?? null, caption: d.caption ?? null, author: d.author ?? null, media_type: d.media_type ?? null };
  } catch { return {}; }
}

export function useAddSavedRef() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { url: string; folder?: string | null; note?: string | null; withPreview?: boolean }) => {
      if (!userId) throw new Error("Not authenticated");
      const url = input.url.trim();
      if (!/^https?:\/\//i.test(url)) throw new Error("Cole um link válido (começa com http).");
      const preview = input.withPreview !== false ? await fetchPreview(url) : {};
      const { error } = await sbFrom("saved_refs").insert({
        user_id: userId,
        url,
        platform: preview.platform ?? (/tiktok\.com/i.test(url) ? "tiktok" : /instagram\.com/i.test(url) ? "instagram" : "outro"),
        author: preview.author ?? null,
        caption: preview.caption ?? null,
        thumbnail_url: preview.thumbnail_url ?? null,
        media_type: preview.media_type ?? null,
        folder: input.folder?.trim() || null,
        note: input.note?.trim() || null,
        status: "novo",
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["saved-refs"] }); toast.success("Salvo!"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não consegui salvar."),
  });
}

export function useUpdateSavedRef() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<SavedRef, "folder" | "note" | "status" | "used_post_id">> }) => {
      const { error } = await sbFrom("saved_refs").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-refs"] }),
    onError: () => toast.error("Não consegui atualizar."),
  });
}

export function useDeleteSavedRef() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("saved_refs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["saved-refs"] }); toast.success("Removido dos salvos."); },
    onError: () => toast.error("Não consegui remover."),
  });
}
