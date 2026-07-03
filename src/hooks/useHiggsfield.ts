import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type HfPage = {
  role: string;
  screen_text: string;
  prompt: string;
  request_id?: string;
  image_url?: string;
  status?: string;
};

export type HfJob = {
  id: string;
  title: string;
  format: string;
  aspect_ratio: string;
  resolution: string;
  status: "running" | "done" | "partial" | "error";
  pages: HfPage[];
  error: string | null;
  created_at: string;
};

export function useHiggsfieldJobs() {
  return useQuery<HfJob[]>({
    queryKey: ["higgsfield-jobs"],
    queryFn: async () => {
      const { data, error } = await sbFrom("higgsfield_jobs")
        .select("id,title,format,aspect_ratio,resolution,status,pages,error,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as HfJob[];
    },
  });
}

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("higgsfield-generate", { body });
  if (error) {
    let detail = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx?.text) { const raw = await ctx.clone().text(); const b = JSON.parse(raw); detail = b?.message || b?.error || detail; }
    } catch { /* ignore */ }
    throw new Error(detail || "higgsfield_failed");
  }
  const err = (data as { error?: string })?.error;
  if (err) throw new Error((data as { message?: string })?.message || err);
  return data as { job_id: string; status: string; pages: HfPage[] };
}

// Passo 1: só monta os textos dos slides + prompts (sem gastar crédito do Higgsfield).
export function useDraftArt() {
  return useMutation({
    mutationFn: (input: { title: string; format: "estatico" | "carrossel"; slides?: number; source_content?: string; post_id?: string }) =>
      invoke({ action: "draft", ...input }) as Promise<{ pages: HfPage[]; format: string; slides: number }>,
    onError: (e) => toast.error(e instanceof Error ? `Falha ao montar: ${e.message}` : "Não consegui montar os textos."),
  });
}

// Passo 2: dispara as imagens no Higgsfield com as páginas já revisadas.
export function useGenerateArt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; format: "estatico" | "carrossel"; slides?: number; aspect_ratio?: string; resolution?: string; pages?: HfPage[]; post_id?: string; source_content?: string }) =>
      invoke({ action: "generate", ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["higgsfield-jobs"] });
      toast.success("Gerando no Higgsfield… as imagens aparecem em instantes.");
    },
    onError: (e) => toast.error(e instanceof Error ? `Falha: ${e.message}` : "Não consegui gerar."),
  });
}

export function usePollJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => invoke({ action: "poll", job_id: jobId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["higgsfield-jobs"] }),
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("higgsfield_jobs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["higgsfield-jobs"] }),
  });
}
