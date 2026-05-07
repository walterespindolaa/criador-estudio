import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type Idea = Database["public"]["Tables"]["ideas"]["Row"];
type IdeaInsert = Database["public"]["Tables"]["ideas"]["Insert"];
type IdeaUpdate = Database["public"]["Tables"]["ideas"]["Update"];
type PostInsert = Database["public"]["Tables"]["posts"]["Insert"];
type Post = Database["public"]["Tables"]["posts"]["Row"];

export type CreateIdeaInput = Omit<IdeaInsert, "user_id" | "id" | "created_at">;
export type UpdateIdeaInput = { id: string; updates: IdeaUpdate };
export type PromoteIdeaInput = {
  ideaId: string;
  post: Omit<PostInsert, "user_id" | "id" | "created_at" | "updated_at">;
};

export function useIdeas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const queryKey = ["ideas", userId] as const;

  const {
    data: ideas = [],
    isLoading,
    error,
  } = useQuery<Idea[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ideas")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Idea[];
    },
    enabled: !!userId,
  });

  const createIdea = useMutation({
    mutationFn: async (input: CreateIdeaInput): Promise<Idea> => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("ideas")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as Idea;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateIdea = useMutation({
    mutationFn: async ({ id, updates }: UpdateIdeaInput): Promise<Idea> => {
      const { data, error } = await supabase
        .from("ideas")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Idea;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteIdea = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("ideas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const promoteToPost = useMutation({
    mutationFn: async ({ ideaId, post }: PromoteIdeaInput): Promise<Post> => {
      if (!userId) throw new Error("Not authenticated");

      const { data: createdPost, error: postError } = await supabase
        .from("posts")
        .insert({ ...post, user_id: userId, idea_id: ideaId })
        .select()
        .single();
      if (postError) throw postError;

      const { error: ideaError } = await supabase
        .from("ideas")
        .update({ promoted_to_post_id: createdPost.id })
        .eq("id", ideaId);
      if (ideaError) throw ideaError;

      const { error: auditError } = await supabase.from("audit_log").insert({
        user_id: userId,
        action: "promote_idea_to_post",
        entity_type: "idea",
        entity_id: ideaId,
        metadata: { post_id: createdPost.id },
      });
      if (auditError) throw auditError;

      return createdPost as Post;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["posts", userId] });
    },
  });

  return { ideas, isLoading, error, createIdea, updateIdea, deleteIdea, promoteToPost };
}
