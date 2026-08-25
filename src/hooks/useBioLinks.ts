import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useBioAlvo } from "@/contexts/BioAlvoContext";
import type { Database } from "@/integrations/supabase/types";

export type BioLink = Database["public"]["Tables"]["bio_links"]["Row"] & { page_id?: string | null };
type BioLinkInsert = Database["public"]["Tables"]["bio_links"]["Insert"];
type BioLinkUpdate = Database["public"]["Tables"]["bio_links"]["Update"];

export type CreateBioLinkInput = Omit<
  BioLinkInsert,
  "user_id" | "id" | "created_at" | "clicks"
>;
export type UpdateBioLinkInput = { id: string; updates: BioLinkUpdate };

// page_id é coluna nova e ainda não está nos tipos gerados, cast (mesmo padrão
// de useClientIntakes/useCrm).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (table: string) => (supabase as any).from(table);

export function useBioLinks() {
  const alvo = useBioAlvo();
  const { activeAccountId } = useActiveAccount();
  const queryClient = useQueryClient();

  // Página de cliente sem conta Cria: os botões vivem na mesma tabela, mas
  // chaveados pela página. O user_id continua sendo o da GESTORA, que é quem
  // responde por eles (e é o que faz as policies antigas continuarem valendo).
  const pageId = alvo?.tipo === "ficha" ? alvo.pageId : null;
  const userId = alvo
    ? (alvo.tipo === "conta" ? alvo.ownerId : alvo.managerId)
    : activeAccountId;

  const queryKey = ["bio-links", pageId ?? userId] as const;

  const {
    data: links = [],
    isLoading,
    error,
  } = useQuery<BioLink[]>({
    queryKey,
    queryFn: async () => {
      let q = sbFrom("bio_links").select("*");
      // Sem o `page_id is null` a página do criador listaria os botões que a
      // gestora criou pras páginas dos clientes dela.
      q = pageId ? q.eq("page_id", pageId) : q.eq("user_id", userId!).is("page_id", null);
      const { data, error } = await q.order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BioLink[];
    },
    enabled: !!(pageId || userId),
  });

  const createLink = useMutation({
    mutationFn: async (input: CreateBioLinkInput): Promise<BioLink> => {
      if (!userId) throw new Error("Not authenticated");
      const nextPosition = links.length;
      const { data, error } = await sbFrom("bio_links")
        .insert({ position: nextPosition, ...input, user_id: userId, page_id: pageId })
        .select()
        .single();
      if (error) throw error;
      return data as BioLink;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateLink = useMutation({
    mutationFn: async ({ id, updates }: UpdateBioLinkInput): Promise<BioLink> => {
      const { data, error } = await sbFrom("bio_links")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as BioLink;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await sbFrom("bio_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const reorderLinks = useMutation({
    mutationFn: async (orderedIds: string[]): Promise<void> => {
      if (!pageId && !userId) throw new Error("Not authenticated");
      // Persist new positions one by one. Volume here is small (a handful of
      // links per creator), so a sequence of updates beats taking on a CTE.
      await Promise.all(
        orderedIds.map((id, index) => {
          const q = sbFrom("bio_links").update({ position: index }).eq("id", id);
          return pageId ? q.eq("page_id", pageId) : q.eq("user_id", userId!);
        })
      );
    },
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<BioLink[]>(queryKey) ?? [];
      const byId = new Map(previous.map((l) => [l.id, l] as const));
      const optimistic = orderedIds
        .map((id, index) => {
          const link = byId.get(id);
          return link ? { ...link, position: index } : null;
        })
        .filter((l): l is BioLink => l !== null);
      queryClient.setQueryData<BioLink[]>(queryKey, optimistic);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { links, isLoading, error, createLink, updateLink, deleteLink, reorderLinks };
}
