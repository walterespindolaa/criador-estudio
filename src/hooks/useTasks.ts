import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];

export type CreateTaskInput = Pick<
  TaskInsert,
  "title" | "priority" | "status" | "due_date" | "post_id" | "description"
>;
export type UpdateTaskStatusInput = { id: string; status: string };

export function useTasks(options?: { limit?: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const limit = options?.limit;
  const queryKey = ["tasks", userId, limit ?? null] as const;

  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery<Task[]>({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId!);
      if (limit) query = query.limit(limit);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
    enabled: !!userId,
  });

  const createTask = useMutation({
    mutationFn: async (input: CreateTaskInput): Promise<Task> => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", userId] }),
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status }: UpdateTaskStatusInput): Promise<Task> => {
      const { data, error } = await supabase
        .from("tasks")
        .update({ status })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", userId] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", userId] }),
  });

  return { tasks, isLoading, error, createTask, updateTaskStatus, deleteTask };
}
