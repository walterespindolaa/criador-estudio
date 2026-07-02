import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type StorySlot = {
  id: string;
  user_id: string;
  slot_date: string; // YYYY-MM-DD
  slot_time: string | null;
  title: string;
  script: string | null;
  format: string | null;
  status: "pendente" | "feito";
  sort_order: number;
  source: string;
  created_at: string;
};

export type ScheduledPostLite = {
  id: string;
  title: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string | null;
  platform: string | null;
};

function isoAddDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Slots do plano no intervalo [fromDate, toDate].
export function useStorySlots(fromDate: string, toDate: string) {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  return useQuery<StorySlot[]>({
    queryKey: ["story-slots", userId, fromDate, toDate],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await sbFrom("story_slots")
        .select("*")
        .eq("user_id", userId!)
        .gte("slot_date", fromDate)
        .lte("slot_date", toDate)
        .order("slot_date", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as StorySlot[];
    },
  });
}

// Posts já agendados no mesmo intervalo (pra aparecer junto na aba semanal).
export function useScheduledPostsInRange(fromDate: string, toDate: string) {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  return useQuery<ScheduledPostLite[]>({
    queryKey: ["scheduled-posts-range", userId, fromDate, toDate],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id,title,scheduled_date,scheduled_time,status,platform")
        .eq("user_id", userId!)
        .gte("scheduled_date", fromDate)
        .lte("scheduled_date", toDate)
        .order("scheduled_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ScheduledPostLite[];
    },
  });
}

// Gera o plano com IA e grava os slots. replaceRange limpa o período antes.
export function useGenerateStoryPlan() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      perDia: number;
      dias: number;
      startDate: string;
      nicho?: string;
      tendencias?: string;
      replaceRange?: boolean;
    }): Promise<number> => {
      if (!userId) throw new Error("Not authenticated");
      const res = await callAIContextBuilder({
        userId,
        operation: "story-plan-generate",
        data: { perDia: params.perDia, dias: params.dias, nicho: params.nicho, tendencias: params.tendencias },
      });
      const stories: Array<Record<string, unknown>> = Array.isArray(res?.stories) ? res.stories : [];
      if (stories.length === 0) throw new Error("A IA não retornou stories. Tente de novo.");

      const rows = stories.map((s, i) => {
        const dayOffset = Math.max(0, Math.min(params.dias - 1, Number(s.dia) || 0));
        const horario = typeof s.horario === "string" && /^\d{1,2}:\d{2}/.test(s.horario) ? s.horario : null;
        return {
          user_id: userId,
          slot_date: isoAddDays(params.startDate, dayOffset),
          slot_time: horario,
          title: String(s.titulo || "Story").slice(0, 200),
          script: s.roteiro ? String(s.roteiro).slice(0, 2000) : null,
          format: s.formato ? String(s.formato).slice(0, 40) : null,
          status: "pendente",
          sort_order: i,
          source: "ia",
        };
      });

      if (params.replaceRange) {
        const end = isoAddDays(params.startDate, params.dias - 1);
        const { error: delErr } = await sbFrom("story_slots")
          .delete()
          .eq("user_id", userId)
          .gte("slot_date", params.startDate)
          .lte("slot_date", end);
        if (delErr) throw delErr;
      }

      const { error } = await sbFrom("story_slots").insert(rows as never);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["story-slots"] });
      toast.success(`Plano criado — ${n} stories.`);
    },
    onError: (e) => {
      const m = e instanceof Error ? e.message : "";
      console.error("story plan generate failed:", e);
      toast.error(m && !/non-2xx/i.test(m) ? m : "Não consegui gerar o plano agora. Tente de novo.");
    },
  });
}

export function useUpdateStorySlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: {
      id: string;
      patch: Partial<Pick<StorySlot, "title" | "script" | "format" | "slot_time" | "slot_date" | "status">>;
    }) => {
      const { error } = await sbFrom("story_slots")
        .update({ ...patch, updated_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["story-slots"] }),
    onError: () => toast.error("Não consegui salvar."),
  });
}

export function useDeleteStorySlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("story_slots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["story-slots"] }),
    onError: () => toast.error("Não consegui excluir."),
  });
}

export function useAddStorySlot() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      slot_date: string;
      title: string;
      slot_time?: string | null;
      script?: string | null;
      format?: string | null;
    }) => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await sbFrom("story_slots").insert({
        user_id: userId,
        slot_date: input.slot_date,
        title: input.title.slice(0, 200),
        slot_time: input.slot_time ?? null,
        script: input.script ?? null,
        format: input.format ?? null,
        status: "pendente",
        source: "manual",
        sort_order: 99,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["story-slots"] });
      toast.success("Story adicionado.");
    },
    onError: () => toast.error("Não consegui adicionar."),
  });
}
