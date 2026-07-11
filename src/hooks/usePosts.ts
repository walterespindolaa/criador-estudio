import { useMutation, useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import type { Database } from "@/integrations/supabase/types";

export type Post = Database["public"]["Tables"]["posts"]["Row"];
type PostInsert = Database["public"]["Tables"]["posts"]["Insert"];
type PostUpdate = Database["public"]["Tables"]["posts"]["Update"];

export type CreatePostInput = Omit<PostInsert, "user_id" | "id" | "created_at" | "updated_at">;
export type UpdatePostInput = { id: string; updates: PostUpdate };

// Teto padrão pra não puxar histórico infinito (perf). Páginas que pedem menos passam um limit menor.
const DEFAULT_POSTS_CAP = 1000;

export function usePosts(options?: { limit?: number }) {
  const { activeAccountId } = useActiveAccount();
  const queryClient = useQueryClient();
  const userId = activeAccountId;
  const limit = options?.limit ?? DEFAULT_POSTS_CAP;
  const queryKey = ["posts", userId, limit] as const;

  const {
    data: posts = [],
    isLoading,
    error,
  } = useQuery<Post[]>({
    queryKey,
    queryFn: async () => {
      // Pega os N mais recentes (desc + limit) e reverte pra ascendente,
      // preservando a ordem que as telas já esperavam.
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId!)
        .is("deleted_at", null)
        .not("is_draft", "is", true)   // rascunhos do Cria Post não poluem o kanban pessoal
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as Post[]).reverse();
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
      // Soft-delete: vai pra Lixeira (recuperável por 30 dias).
      const { error } = await supabase.from("posts").update({ deleted_at: new Date().toISOString() } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts", userId] }),
  });

  return { posts, isLoading, error, createPost, updatePost, deletePost };
}

// Lista paginada de posts publicados (Histórico), carrega em lotes com "Carregar mais".
export function usePublishedPostsInfinite(pageSize = 40) {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  return useInfiniteQuery({
    queryKey: ["posts-published-infinite", userId, pageSize] as const,
    enabled: !!userId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId!)
        .eq("status", "publicado")
        .order("published_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as Post[];
    },
    getNextPageParam: (lastPage, allPages) => (lastPage.length === pageSize ? allPages.length : undefined),
  });
}

// Contagem total de posts publicados (pro cabeçalho do Histórico ficar exato).
export function usePublishedPostsCount() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  return useQuery<number>({
    queryKey: ["posts-published-count", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("status", "publicado");
      if (error) throw error;
      return count ?? 0;
    },
  });
}
