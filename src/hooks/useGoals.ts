import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type StructuredGoal = Database["public"]["Tables"]["structured_goals"]["Row"];
type GoalInsert = Database["public"]["Tables"]["structured_goals"]["Insert"];
type GoalUpdate = Database["public"]["Tables"]["structured_goals"]["Update"];

export type Milestone = Database["public"]["Tables"]["milestones"]["Row"];
type MilestoneInsert = Database["public"]["Tables"]["milestones"]["Insert"];
type MilestoneUpdate = Database["public"]["Tables"]["milestones"]["Update"];

export type CreateGoalInput = Omit<GoalInsert, "user_id" | "id" | "created_at" | "updated_at">;
export type UpdateGoalProgressInput = { id: string; current_value: number };
export type UpdateGoalStatusInput = { id: string; status: string };
export type UpdateGoalInput = { id: string; updates: GoalUpdate };

export type CreateMilestoneInput = Omit<MilestoneInsert, "user_id" | "id" | "created_at">;
export type UpdateMilestoneInput = { id: string; updates: MilestoneUpdate };

export function useGoals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const goalsKey = ["goals", userId] as const;
  const milestonesKey = ["milestones", userId] as const;

  const {
    data: structuredGoals = [],
    isLoading: isLoadingGoals,
    error: goalsError,
  } = useQuery<StructuredGoal[]>({
    queryKey: goalsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("structured_goals")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StructuredGoal[];
    },
    enabled: !!userId,
  });

  const {
    data: milestones = [],
    isLoading: isLoadingMilestones,
    error: milestonesError,
  } = useQuery<Milestone[]>({
    queryKey: milestonesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestones")
        .select("*")
        .eq("user_id", userId!)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Milestone[];
    },
    enabled: !!userId,
  });

  const createGoal = useMutation({
    mutationFn: async (input: CreateGoalInput): Promise<StructuredGoal> => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("structured_goals")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as StructuredGoal;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalsKey }),
  });

  const updateGoalProgress = useMutation({
    mutationFn: async ({ id, current_value }: UpdateGoalProgressInput): Promise<StructuredGoal> => {
      const { data, error } = await supabase
        .from("structured_goals")
        .update({ current_value })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as StructuredGoal;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalsKey }),
  });

  const updateGoalStatus = useMutation({
    mutationFn: async ({ id, status }: UpdateGoalStatusInput): Promise<StructuredGoal> => {
      const { data, error } = await supabase
        .from("structured_goals")
        .update({ status })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as StructuredGoal;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalsKey }),
  });

  const updateGoal = useMutation({
    mutationFn: async ({ id, updates }: UpdateGoalInput): Promise<StructuredGoal> => {
      const { data, error } = await supabase
        .from("structured_goals")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as StructuredGoal;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalsKey }),
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error: msErr } = await supabase.from("milestones").delete().eq("goal_id", id);
      if (msErr) throw msErr;
      const { error } = await supabase.from("structured_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalsKey });
      queryClient.invalidateQueries({ queryKey: milestonesKey });
    },
  });

  const createMilestone = useMutation({
    mutationFn: async (input: CreateMilestoneInput): Promise<Milestone> => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("milestones")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as Milestone;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: milestonesKey }),
  });

  const updateMilestone = useMutation({
    mutationFn: async ({ id, updates }: UpdateMilestoneInput): Promise<Milestone> => {
      const { data, error } = await supabase
        .from("milestones")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Milestone;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: milestonesKey }),
  });

  const deleteMilestone = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: milestonesKey }),
  });

  return {
    structuredGoals,
    milestones,
    isLoading: isLoadingGoals || isLoadingMilestones,
    error: goalsError ?? milestonesError,
    createGoal,
    updateGoal,
    updateGoalProgress,
    updateGoalStatus,
    deleteGoal,
    createMilestone,
    updateMilestone,
    deleteMilestone,
  };
}
