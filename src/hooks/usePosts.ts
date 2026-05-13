import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type Post = Database["public"]["Tables"]["posts"]["Row"];
type PostInsert = Database["public"]["Tables"]["posts"]["Insert"];
type PostUpdate = Database["public"]["Tables"]["posts"]["Update"];

export type CreatePostInput = Omit<PostInsert, "user_id" | "id" | "created_at" | "updated_at">;
export type UpdatePostInput = { id: string; updates: PostUpdate };

export function usePosts(options?: { limit?: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const limit = options?.limit;
  const queryKey = ["posts", userId, limit ?? null] as const;

  const {
    data: posts = [],
    isLoading,
    error,
  } = useQuery<Post[]>({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId!);
      if (limit) query = query.limit(limit);
      const { data, error } = await query.order("created_at");
      if (error) throw error;
      return (data ?? []) as Post[];
    },
    enabled: !!userId,
  });

  const createPost = useMutation({
    mutationFn: async (input: CreatePostInput): Promise<Post> => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("posts")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as Post;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts", userId] }),
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, updates }: UpdatePostInput): Promise<Post> => {
      const { data, error } = await supabase
        .from("posts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Post;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts", userId] }),
  });

  const deletePost = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts", userId] }),
  });

  return { posts, isLoading, error, createPost, updatePost, deletePost };
}
