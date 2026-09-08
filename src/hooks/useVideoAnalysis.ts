import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════════════════
   ANÁLISE PROFUNDA DE VÍDEO (TwelveLabs)

   O Radar lê legenda, números e áudio. Isto aqui assiste ao vídeo: gancho
   visual, cortes, texto na tela, enquadramento, ritmo. A edge `video-analyze`
   cria a linha e responde na hora; o trabalho roda em segundo plano e a
   tela faz polling em `video_analyses` até virar done/error.

   Fase 1 (08/09): só admin vê o botão (a edge também barra). Sem cota.
   ═══════════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (t: string) => (supabase as any).from(t);

export type AnaliseVideo = {
  id: string;
  post_url: string;
  status: "queued" | "running" | "done" | "error";
  result: ResultadoAnalise | null;
  usage: { input_tokens?: number; output_tokens?: number; finish_reason?: string; truncado?: boolean } | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
};

export type ResultadoAnalise = {
  resumo: string;
  gancho: { texto: string; tecnica: string; segundos: number };
  estrutura: { inicio: number; fim: number; o_que_acontece: string; funcao: string }[];
  ritmo: { cortes_estimados: number; cadencia: string; onde_a_atencao_cai: string };
  texto_na_tela: string[];
  audio: { tipo: string; fala_resumida: string; musica: string };
  visual: { enquadramento: string; cenario: string; iluminacao_e_cores: string; edicao: string };
  cta: string;
  por_que_funciona: string[];
  como_adaptar: string[];
  notas: { gancho: number; ritmo: number; clareza: number; cta: number };
  formato_sugerido: string;
};

/** Quem pode rodar hoje: admin. Quando entrar cota, a regra muda aqui. */
export function usePodeAnalisarVideo() {
  const { profile } = useProfile();
  return profile?.role === "admin";
}

export function useAnaliseVideo(postUrl: string | null | undefined) {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<AnaliseVideo | null>({
    queryKey: ["video-analysis", agencyOwnerId, postUrl],
    enabled: !!agencyOwnerId && !!postUrl,
    // Enquanto processa, pergunta a cada 4s; parado, deixa quieto.
    refetchInterval: (q) => {
      const s = (q.state.data as AnaliseVideo | null | undefined)?.status;
      return s === "queued" || s === "running" ? 4000 : false;
    },
    queryFn: async () => {
      const { data, error } = await sbFrom("video_analyses")
        .select("id, post_url, status, result, usage, error, created_at, finished_at")
        .eq("manager_id", agencyOwnerId).eq("post_url", postUrl).maybeSingle();
      if (error) {
        // Migration ainda não rodou: sem análise, sem tela quebrada.
        if (/does not exist|schema cache/i.test(error.message)) return null;
        throw error;
      }
      return (data ?? null) as AnaliseVideo | null;
    },
  });
}

export function useRodarAnaliseVideo() {
  const qc = useQueryClient();
  const { agencyOwnerId } = useActiveAccount();
  return useMutation({
    mutationFn: async (v: { post_url: string; video_url?: string | null; thumbnail?: string | null; crm_client_id?: string | null; scrape_id?: string | null; origem?: "radar" | "studio" }) => {
      const { data, error } = await supabase.functions.invoke("video-analyze", {
        body: { ...v, manager_id: agencyOwnerId },
      });
      if (error) throw new Error(error.message);
      const d = data as { ok?: boolean; error?: string; message?: string };
      if (!d?.ok) throw new Error(d?.message || d?.error || "Não consegui iniciar a análise.");
      return d;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["video-analysis", agencyOwnerId, v.post_url] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
