import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import type { Database } from "@/integrations/supabase/types";

type MoodboardEntryRow = Database["public"]["Tables"]["moodboard_entries"]["Row"];

export type MoodboardEntry = Pick<MoodboardEntryRow, "section" | "question_key" | "answer">;

export type SaveMoodboardAnswerInput = {
  section: string;
  question_key: string;
  answer: string | null;
};

export function useMoodboard() {
  const { activeAccountId } = useActiveAccount();
  const queryClient = useQueryClient();
  const userId = activeAccountId;
  const queryKey = ["moodboard", userId] as const;

  const {
    data: entries = [],
    isLoading,
    error,
  } = useQuery<MoodboardEntry[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moodboard_entries")
        .select("section, question_key, answer, updated_at")
        .eq("user_id", userId!)
        .order("updated_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MoodboardEntry[];
    },
    enabled: !!userId,
  });

  const saveAnswer = useMutation({
    mutationFn: async (input: SaveMoodboardAnswerInput): Promise<void> => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("moodboard_entries")
        .upsert(
          {
            user_id: userId,
            section: input.section,
            question_key: input.question_key,
            answer: input.answer,
          },
          { onConflict: "user_id,section,question_key" },
        );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { entries, isLoading, error, saveAnswer };
}
