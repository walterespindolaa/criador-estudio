import { useMemo, useRef, useState } from "react";
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

// Resultado de uma tentativa de recuperar a capa de UM salvo.
// "rate-limited" = a edge devolveu 429 (estourou o limite de 20/min).
export type RefreshCoverResult = "ok" | "no-cover" | "rate-limited";

// Igual ao fetchPreview, mas sinaliza quando a edge devolve 429 (rate limit),
// pra o lote conseguir parar gracioso em vez de engolir o erro em silêncio.
async function fetchPreviewWithStatus(url: string): Promise<{ preview: Partial<SavedRef>; rateLimited: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke("saved-fetch", { body: { url } });
    if (error) {
      // O supabase-js expõe a Response da edge em error.context; 429 = rate limit.
      const status = (error as { context?: { status?: number } })?.context?.status;
      return { preview: {}, rateLimited: status === 429 };
    }
    const d = data as { platform?: string; thumbnail?: string | null; caption?: string | null; author?: string | null; media_type?: string | null };
    return { preview: { platform: d.platform, thumbnail_url: d.thumbnail ?? null, caption: d.caption ?? null, author: d.author ?? null, media_type: d.media_type ?? null }, rateLimited: false };
  } catch {
    return { preview: {}, rateLimited: false };
  }
}

// Recaptura a capa de UM salvo (por id+url): rechama a edge e regrava
// thumbnail_url (agora persistente no bucket 'saved-covers'). Reutilizado
// tanto pelo botão por card quanto pelo lote de "capas faltantes".
export async function refreshCoverOnce(r: Pick<SavedRef, "id" | "url">): Promise<RefreshCoverResult> {
  const { preview, rateLimited } = await fetchPreviewWithStatus(r.url);
  if (rateLimited) return "rate-limited";
  if (!preview.thumbnail_url) return "no-cover";
  const patch: Partial<SavedRef> = { thumbnail_url: preview.thumbnail_url };
  if (preview.media_type) patch.media_type = preview.media_type;
  const { error } = await sbFrom("saved_refs").update(patch as never).eq("id", r.id);
  if (error) throw error;
  return "ok";
}

// Recaptura a capa de um salvo antigo (capa morta) via botão por card.
export function useRefreshSavedCover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: Pick<SavedRef, "id" | "url">) => {
      const res = await refreshCoverOnce(r);
      if (res === "rate-limited") throw new Error("Limite atingido, tenta de novo em 1 minuto.");
      if (res === "no-cover") throw new Error("Não consegui recuperar a capa.");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["saved-refs"] }); toast.success("Capa atualizada!"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não consegui atualizar a capa."),
  });
}

// Recupera EM LOTE as capas faltantes: processa uma a uma, em sequência, com um
// pequeno delay entre cada pra ficar abaixo de 20/min. Para gracioso no 429.
const RECOVER_DELAY_MS = 3200;

export function useRecoverMissingCovers() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const cancelRef = useRef(false);

  // Cancelamento simples: marca a flag e o loop para na próxima volta.
  const cancel = () => { cancelRef.current = true; };

  const recover = async (missing: Pick<SavedRef, "id" | "url">[]) => {
    if (running || missing.length === 0) return;
    cancelRef.current = false;
    setRunning(true);
    setProgress({ done: 0, total: missing.length });
    let hitLimit = false;
    try {
      for (let i = 0; i < missing.length; i++) {
        if (cancelRef.current) break;
        setProgress({ done: i + 1, total: missing.length }); // "X de N" (o que está processando)
        const res = await refreshCoverOnce(missing[i]);
        if (res === "rate-limited") { hitLimit = true; break; }
        // Delay só se ainda houver próximo e ninguém cancelou.
        if (i < missing.length - 1 && !cancelRef.current) {
          await new Promise((resolve) => setTimeout(resolve, RECOVER_DELAY_MS));
        }
      }
    } finally {
      setRunning(false);
      // As que deram certo já foram persistidas; recarrega pra as capas aparecerem.
      qc.invalidateQueries({ queryKey: ["saved-refs"] });
    }
    if (hitLimit) toast.error("Limite atingido, tenta de novo em 1 minuto.");
    else if (!cancelRef.current) toast.success("Capas atualizadas!");
  };

  return { running, progress, recover, cancel };
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
