import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import type { Database } from "@/integrations/supabase/types";

export type Habit = Database["public"]["Tables"]["habits"]["Row"];
export type HabitLog = Database["public"]["Tables"]["habit_logs"]["Row"];

export type DateRange = { start: string; end: string };
export type HabitsLogsParams = { date?: string; dateRange?: DateRange; limit?: number };

export type CreateHabitInput = { name: string; position?: number };
export type UpdateHabitInput = { id: string; name: string };
export type ToggleHabitLogInput = { habitId: string; date: string };

function logsKey(userId: string | undefined, params: HabitsLogsParams) {
  if (params.dateRange) {
    return ["habit-logs", userId, "range", params.dateRange.start, params.dateRange.end] as const;
  }
  return ["habit-logs", userId, "date", params.date ?? null] as const;
}

export function useHabits(params: HabitsLogsParams = {}) {
  const { activeAccountId } = useActiveAccount();
  const queryClient = useQueryClient();
  const userId = activeAccountId;
  const limit = params.limit;
  const habitsKey = ["habits", userId, limit ?? null] as const;
  const habitLogsKey = logsKey(userId, params);

  const {
    data: habits = [],
    isLoading: isLoadingHabits,
    error: habitsError,
  } = useQuery<Habit[]>({
    queryKey: habitsKey,
    queryFn: async () => {
      let query = supabase
        .from("habits")
        .select("*")
        .eq("user_id", userId!);
      if (limit) query = query.limit(limit);
      const { data, error } = await query.order("position");
      if (error) throw error;
      return (data ?? []) as Habit[];
    },
    enabled: !!userId,
  });

  const {
    data: habitLogs = [],
    isLoading: isLoadingLogs,
    error: logsError,
  } = useQuery<HabitLog[]>({
    queryKey: habitLogsKey,
    queryFn: async () => {
      let query = supabase.from("habit_logs").select("*").eq("user_id", userId!);
      if (params.dateRange) {
        query = query.gte("date", params.dateRange.start).lte("date", params.dateRange.end);
      } else if (params.date) {
        query = query.eq("date", params.date);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as HabitLog[];
    },
    enabled: !!userId && (!!params.date || !!params.dateRange),
  });

  const invalidateLogs = () => {
    queryClient.invalidateQueries({ queryKey: ["habit-logs", userId] });
  };

  const createHabit = useMutation({
    mutationFn: async (input: CreateHabitInput): Promise<Habit> => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("habits")
        .insert({
          name: input.name,
          position: input.position ?? habits.length,
          user_id: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Habit;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["habits", userId] }),
  });

  const updateHabit = useMutation({
    mutationFn: async ({ id, name }: UpdateHabitInput): Promise<Habit> => {
      const { data, error } = await supabase
        .from("habits")
        .update({ name })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Habit;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["habits", userId] }),
  });

  const deleteHabit = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error: logsErr } = await supabase
        .from("habit_logs")
        .delete()
        .eq("habit_id", id);
      if (logsErr) throw logsErr;
      const { error } = await supabase.from("habits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits", userId] });
      invalidateLogs();
    },
  });

  const toggleHabitLog = useMutation({
    mutationFn: async ({ habitId, date }: ToggleHabitLogInput): Promise<HabitLog> => {
      if (!userId) throw new Error("Not authenticated");
      const { data: existing, error: selectErr } = await supabase
        .from("habit_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("habit_id", habitId)
        .eq("date", date)
        .maybeSingle();
      if (selectErr) throw selectErr;

      if (existing) {
        const { data, error } = await supabase
          .from("habit_logs")
          .update({ done: !existing.done })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data as HabitLog;
      }

      const { data, error } = await supabase
        .from("habit_logs")
        .insert({ user_id: userId, habit_id: habitId, date, done: true })
        .select()
        .single();
      if (error) throw error;
      return data as HabitLog;
    },
    onSuccess: () => invalidateLogs(),
  });

  return {
    habits,
    habitLogs,
    isLoading: isLoadingHabits || isLoadingLogs,
    error: habitsError ?? logsError,
    createHabit,
    updateHabit,
    deleteHabit,
    toggleHabitLog,
  };
}
