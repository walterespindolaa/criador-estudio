import { useMemo, useState } from "react";
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

// Detecta a plataforma pelo link, sem depender de rede (regex client-side).
function detectPlatform(url: string): string {
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  return "outro";
}

export function useAddSavedRef() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  const qc = useQueryClient();
  // Ids dos salvos que estão puxando capa/legenda em segundo plano (pra o card
  // mostrar o estado sutil de "carregando capa" sem travar nada).
  const [pendingPreviewIds, setPendingPreviewIds] = useState<Set<string>>(new Set());

  // Roda a captura da capa/legenda em SEGUNDO PLANO e regrava o registro pelo id.
  // Best-effort: se falhar, o card só fica sem capa (tem placeholder + "atualizar capa").
  const runPreviewInBackground = async (id: string, url: string) => {
    setPendingPreviewIds((prev) => new Set(prev).add(id));
    try {
      const preview = await fetchPreview(url);
      const patch: Partial<SavedRef> = {};
      if (preview.platform) patch.platform = preview.platform;
      if (preview.thumbnail_url) patch.thumbnail_url = preview.thumbnail_url;
      if (preview.caption) patch.caption = preview.caption;
      if (preview.author) patch.author = preview.author;
      if (preview.media_type) patch.media_type = preview.media_type;
      if (Object.keys(patch).length > 0) {
        await sbFrom("saved_refs").update(patch as never).eq("id", id);
      }
    } catch {
      // silencioso: o card usa o placeholder e o botão "atualizar capa"
    } finally {
      setPendingPreviewIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      qc.invalidateQueries({ queryKey: ["saved-refs"] });
    }
  };

  const mutation = useMutation({
    // Insert INSTANTÂNEO: grava só o que dá pra saber sem rede. A capa/legenda
    // vêm depois, em segundo plano (onSuccess), sem travar o botão nem a UI.
    mutationFn: async (input: { url: string; folder?: string | null; note?: string | null }) => {
      if (!userId) throw new Error("Not authenticated");
      const url = input.url.trim();
      if (!/^https?:\/\//i.test(url)) throw new Error("Cole um link válido (começa com http).");
      const { data, error } = await sbFrom("saved_refs").insert({
        user_id: userId,
        url,
        platform: detectPlatform(url),
        author: null,
        caption: null,
        thumbnail_url: null,
        media_type: null,
        folder: input.folder?.trim() || null,
        note: input.note?.trim() || null,
        status: "novo",
      } as never).select("id").single();
      if (error) throw error;
      return { id: (data as unknown as { id: string }).id, url };
    },
    onSuccess: ({ id, url }) => {
      qc.invalidateQueries({ queryKey: ["saved-refs"] });
      toast.success("Salvo! Puxando a capa…");
      void runPreviewInBackground(id, url);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não consegui salvar."),
  });

  // Anexa o set de ids "puxando capa" ao objeto da mutation (mesma referência).
  return Object.assign(mutation, { pendingPreviewIds });
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

// Recaptura a capa de um salvo antigo (capa morta): rechama a edge e
// regrava thumbnail_url (agora persistente no bucket 'saved-covers').
export function useRefreshSavedCover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: Pick<SavedRef, "id" | "url">) => {
      const preview = await fetchPreview(r.url);
      if (!preview.thumbnail_url) throw new Error("Não consegui recuperar a capa.");
      const patch: Partial<SavedRef> = { thumbnail_url: preview.thumbnail_url };
      if (preview.media_type) patch.media_type = preview.media_type;
      const { error } = await sbFrom("saved_refs").update(patch as never).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["saved-refs"] }); toast.success("Capa atualizada!"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não consegui atualizar a capa."),
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
