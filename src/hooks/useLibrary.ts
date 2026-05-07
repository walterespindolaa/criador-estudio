import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type ReferenceHook = Database["public"]["Tables"]["reference_hooks"]["Row"];
export type ReferenceFormat = Database["public"]["Tables"]["reference_formats"]["Row"];
export type ReferencePrompt = Database["public"]["Tables"]["reference_prompts"]["Row"];

export type UserHook = Database["public"]["Tables"]["user_hooks"]["Row"];
type UserHookInsert = Database["public"]["Tables"]["user_hooks"]["Insert"];
type UserHookUpdate = Database["public"]["Tables"]["user_hooks"]["Update"];

export type UserFormat = Database["public"]["Tables"]["user_formats"]["Row"];
type UserFormatInsert = Database["public"]["Tables"]["user_formats"]["Insert"];
type UserFormatUpdate = Database["public"]["Tables"]["user_formats"]["Update"];

export type UserPrompt = Database["public"]["Tables"]["user_prompts"]["Row"];
type UserPromptInsert = Database["public"]["Tables"]["user_prompts"]["Insert"];
type UserPromptUpdate = Database["public"]["Tables"]["user_prompts"]["Update"];

export type LibraryUsage = Database["public"]["Tables"]["user_library_usage"]["Row"];

export type LibraryUserTable = "user_hooks" | "user_formats" | "user_prompts";
export type LibraryItemType = "hook" | "format" | "prompt";

export type SaveUserHookInput =
  | { mode: "create"; values: Omit<UserHookInsert, "user_id" | "id" | "created_at"> }
  | { mode: "update"; id: string; values: UserHookUpdate };

export type SaveUserFormatInput =
  | { mode: "create"; values: Omit<UserFormatInsert, "user_id" | "id" | "created_at"> }
  | { mode: "update"; id: string; values: UserFormatUpdate };

export type SaveUserPromptInput =
  | { mode: "create"; values: Omit<UserPromptInsert, "user_id" | "id" | "created_at"> }
  | { mode: "update"; id: string; values: UserPromptUpdate };

export type DeleteLibraryItemInput = { table: LibraryUserTable; id: string };
export type ToggleFavoriteInput = {
  table: "user_hooks" | "user_prompts";
  id: string;
  is_favorite: boolean;
};
export type ToggleUsageInput = {
  itemType: LibraryItemType;
  itemId: string;
  isUserItem: boolean;
};

export function useReferenceLibrary() {
  const refHooksKey = ["ref-hooks"] as const;
  const refFormatsKey = ["ref-formats"] as const;
  const refPromptsKey = ["ref-prompts"] as const;

  const referenceHooksQuery = useQuery<ReferenceHook[]>({
    queryKey: refHooksKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reference_hooks")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as ReferenceHook[];
    },
  });

  const referenceFormatsQuery = useQuery<ReferenceFormat[]>({
    queryKey: refFormatsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reference_formats")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as ReferenceFormat[];
    },
  });

  const referencePromptsQuery = useQuery<ReferencePrompt[]>({
    queryKey: refPromptsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reference_prompts")
        .select("*")
        .eq("is_active", true)
        .order("position");
      if (error) throw error;
      return (data ?? []) as ReferencePrompt[];
    },
  });

  return {
    referenceHooks: referenceHooksQuery.data ?? [],
    referenceFormats: referenceFormatsQuery.data ?? [],
    referencePrompts: referencePromptsQuery.data ?? [],
    isLoading:
      referenceHooksQuery.isLoading ||
      referenceFormatsQuery.isLoading ||
      referencePromptsQuery.isLoading,
    error:
      referenceHooksQuery.error ??
      referenceFormatsQuery.error ??
      referencePromptsQuery.error,
  };
}

export function useUserLibrary() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const userHooksKey = ["user-hooks", userId] as const;
  const userFormatsKey = ["user-formats", userId] as const;
  const userPromptsKey = ["user-prompts", userId] as const;
  const usageKey = ["library-usage", userId] as const;

  const userHooksQuery = useQuery<UserHook[]>({
    queryKey: userHooksKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_hooks")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as UserHook[];
    },
    enabled: !!userId,
  });

  const userFormatsQuery = useQuery<UserFormat[]>({
    queryKey: userFormatsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_formats")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as UserFormat[];
    },
    enabled: !!userId,
  });

  const userPromptsQuery = useQuery<UserPrompt[]>({
    queryKey: userPromptsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_prompts")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as UserPrompt[];
    },
    enabled: !!userId,
  });

  const libraryUsageQuery = useQuery<LibraryUsage[]>({
    queryKey: usageKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_library_usage")
        .select("*")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as LibraryUsage[];
    },
    enabled: !!userId,
  });

  const saveUserHook = useMutation({
    mutationFn: async (input: SaveUserHookInput): Promise<UserHook> => {
      if (!userId) throw new Error("Not authenticated");
      if (input.mode === "create") {
        const { data, error } = await supabase
          .from("user_hooks")
          .insert({ ...input.values, user_id: userId })
          .select()
          .single();
        if (error) throw error;
        return data as UserHook;
      }
      const { data, error } = await supabase
        .from("user_hooks")
        .update(input.values)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as UserHook;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userHooksKey }),
  });

  const saveUserFormat = useMutation({
    mutationFn: async (input: SaveUserFormatInput): Promise<UserFormat> => {
      if (!userId) throw new Error("Not authenticated");
      if (input.mode === "create") {
        const { data, error } = await supabase
          .from("user_formats")
          .insert({ ...input.values, user_id: userId })
          .select()
          .single();
        if (error) throw error;
        return data as UserFormat;
      }
      const { data, error } = await supabase
        .from("user_formats")
        .update(input.values)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as UserFormat;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userFormatsKey }),
  });

  const saveUserPrompt = useMutation({
    mutationFn: async (input: SaveUserPromptInput): Promise<UserPrompt> => {
      if (!userId) throw new Error("Not authenticated");
      if (input.mode === "create") {
        const { data, error } = await supabase
          .from("user_prompts")
          .insert({ ...input.values, user_id: userId })
          .select()
          .single();
        if (error) throw error;
        return data as UserPrompt;
      }
      const { data, error } = await supabase
        .from("user_prompts")
        .update(input.values)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as UserPrompt;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userPromptsKey }),
  });

  const deleteLibraryItem = useMutation({
    mutationFn: async ({ table, id }: DeleteLibraryItemInput): Promise<void> => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      if (variables.table === "user_hooks") queryClient.invalidateQueries({ queryKey: userHooksKey });
      if (variables.table === "user_formats") queryClient.invalidateQueries({ queryKey: userFormatsKey });
      if (variables.table === "user_prompts") queryClient.invalidateQueries({ queryKey: userPromptsKey });
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ table, id, is_favorite }: ToggleFavoriteInput): Promise<void> => {
      const { error } = await supabase
        .from(table)
        .update({ is_favorite })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      if (variables.table === "user_hooks") queryClient.invalidateQueries({ queryKey: userHooksKey });
      if (variables.table === "user_prompts") queryClient.invalidateQueries({ queryKey: userPromptsKey });
    },
  });

  const toggleUsage = useMutation({
    mutationFn: async ({ itemType, itemId, isUserItem }: ToggleUsageInput): Promise<boolean> => {
      if (!userId) throw new Error("Not authenticated");
      const { data: existing, error: selectErr } = await supabase
        .from("user_library_usage")
        .select("id")
        .eq("user_id", userId)
        .eq("item_type", itemType)
        .eq("item_id", itemId)
        .eq("is_user_item", isUserItem)
        .maybeSingle();
      if (selectErr) throw selectErr;

      if (existing) {
        const { error } = await supabase
          .from("user_library_usage")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
        return false;
      }

      const { error } = await supabase.from("user_library_usage").insert({
        user_id: userId,
        item_type: itemType,
        item_id: itemId,
        is_user_item: isUserItem,
      });
      if (error) throw error;
      return true;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usageKey }),
  });

  return {
    userHooks: userHooksQuery.data ?? [],
    userFormats: userFormatsQuery.data ?? [],
    userPrompts: userPromptsQuery.data ?? [],
    libraryUsage: libraryUsageQuery.data ?? [],
    isLoading:
      userHooksQuery.isLoading ||
      userFormatsQuery.isLoading ||
      userPromptsQuery.isLoading ||
      libraryUsageQuery.isLoading,
    error:
      userHooksQuery.error ??
      userFormatsQuery.error ??
      userPromptsQuery.error ??
      libraryUsageQuery.error,
    saveUserHook,
    saveUserFormat,
    saveUserPrompt,
    deleteLibraryItem,
    toggleFavorite,
    toggleUsage,
  };
}

export function useLibrary() {
  const reference = useReferenceLibrary();
  const userLib = useUserLibrary();

  return {
    ...reference,
    ...userLib,
    isLoading: reference.isLoading || userLib.isLoading,
    error: reference.error ?? userLib.error,
  };
}
