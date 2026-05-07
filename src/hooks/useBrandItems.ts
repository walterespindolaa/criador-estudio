import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type BrandItem = Database["public"]["Tables"]["brand_items"]["Row"];
type BrandItemInsert = Database["public"]["Tables"]["brand_items"]["Insert"];

export type CreateBrandItemInput = Pick<BrandItemInsert, "type" | "name" | "value"> & {
  position?: number;
};

export function useBrandItems() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const queryKey = ["brand-items", userId] as const;

  const {
    data: brandItems = [],
    isLoading,
    error,
  } = useQuery<BrandItem[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_items")
        .select("*")
        .eq("user_id", userId!)
        .order("position");
      if (error) throw error;
      return (data ?? []) as BrandItem[];
    },
    enabled: !!userId,
  });

  const createBrandItem = useMutation({
    mutationFn: async (input: CreateBrandItemInput): Promise<BrandItem> => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("brand_items")
        .insert({
          type: input.type,
          name: input.name,
          value: input.value ?? null,
          position: input.position ?? brandItems.length,
          user_id: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as BrandItem;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteBrandItem = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("brand_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { brandItems, isLoading, error, createBrandItem, deleteBrandItem };
}
