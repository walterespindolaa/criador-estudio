import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type BioLink = Database["public"]["Tables"]["bio_links"]["Row"];
type BioLinkInsert = Database["public"]["Tables"]["bio_links"]["Insert"];
type BioLinkUpdate = Database["public"]["Tables"]["bio_links"]["Update"];

export type CreateBioLinkInput = Omit<
  BioLinkInsert,
  "user_id" | "id" | "created_at" | "clicks"
>;
export type UpdateBioLinkInput = { id: string; updates: BioLinkUpdate };

export function useBioLinks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const queryKey = ["bio-links", userId] as const;

  const {
    data: links = [],
    isLoading,
    error,
  } = useQuery<BioLink[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bio_links")
        .select("*")
        .eq("user_id", userId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BioLink[];
    },
    enabled: !!userId,
  });

  const createLink = useMutation({
    mutationFn: async (input: CreateBioLinkInput): Promise<BioLink> => {
      if (!userId) throw new Error("Not authenticated");
      const nextPosition = links.length;
      const { data, error } = await supabase
        .from("bio_links")
        .insert({ position: nextPosition, ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as BioLink;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateLink = useMutation({
    mutationFn: async ({ id, updates }: UpdateBioLinkInput): Promise<BioLink> => {
      const { data, error } = await supabase
        .from("bio_links")
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
      const { error } = await supabase.from("bio_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const reorderLinks = useMutation({
    mutationFn: async (orderedIds: string[]): Promise<void> => {
      if (!userId) throw new Error("Not authenticated");
      // Persist new positions one by one. Volume here is small (a handful of
      // links per creator), so a sequence of updates beats taking on a CTE.
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase
            .from("bio_links")
            .update({ position: index })
            .eq("id", id)
            .eq("user_id", userId)
        )
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
