import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTrends, type TrendKind } from "@/hooks/useTrends";
import { useStoryTrends } from "@/hooks/useStoryTrends";

/* ═══════════════════════════════════════════════════════════════════════════
   TENDÊNCIAS NUM LUGAR SÓ (28/10/2026, mockup aprovado)

   Dois bancos curados: content_trends (formato, tema, gancho, data de posts) e
   story_trends (formatos de story com exemplo pronto). A página Tendências, o
   popup "Usar uma tendência" e o Cria Plano leem os dois daqui, e cada uso
   fica registrado (trend_usos) pra o destaque "Mais usada no Cria".
   ═══════════════════════════════════════════════════════════════════════════ */

export type FonteTendencia = "conteudo" | "story";
export type TipoTendencia = TrendKind | "story";

export type Tendencia = {
  /** chave única entre os dois bancos: "conteudo:<id>" ou "story:<id>" */
  chave: string;
  id: string;
  fonte: FonteTendencia;
  tipo: TipoTendencia;
  titulo: string;
  descricao: string | null;
  exemplo: string | null;
  porque: string | null;
  formatoStory: string | null;
  nicho: string | null;
  criadaEm: string;
};

export const NOME_TIPO_TENDENCIA: Record<TipoTendencia, string> = {
  formato: "Formato", tema: "Tema", gancho: "Gancho", data: "Data", story: "Story",
};

/** Classes do selo por tipo (tokens do app; funcionam no claro e no escuro). */
export const COR_TIPO_TENDENCIA: Record<TipoTendencia, string> = {
  formato: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  tema: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  gancho: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  data: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200",
  story: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
};

export function useTendencias() {
  const conteudo = useTrends();
  const stories = useStoryTrends();
  const lista = useMemo<Tendencia[]>(() => {
    const a: Tendencia[] = (conteudo.data ?? []).map((t) => ({
      chave: `conteudo:${t.id}`, id: t.id, fonte: "conteudo", tipo: t.kind, titulo: t.title,
      descricao: t.description, exemplo: null, porque: null, formatoStory: null, nicho: t.niche, criadaEm: t.created_at,
    }));
    const b: Tendencia[] = (stories.data ?? []).map((t) => ({
      chave: `story:${t.id}`, id: t.id, fonte: "story", tipo: "story", titulo: t.title,
      descricao: t.description, exemplo: t.example, porque: t.why_trending, formatoStory: t.format, nicho: null, criadaEm: t.created_at,
    }));
    return [...a, ...b];
  }, [conteudo.data, stories.data]);
  return { data: lista, isLoading: conteudo.isLoading || stories.isLoading };
}

/** Tendência "pro seu nicho": a do nicho da conta ou a geral (sem nicho). */
export function serveProNicho(t: Tendencia, nicho: string | null | undefined): boolean {
  if (!t.nicho) return true;
  if (!nicho) return true;
  const a = t.nicho.toLowerCase(), b = nicho.toLowerCase();
  return a.includes(b) || b.includes(a);
}

/** Texto curto pra mandar pra Cria IA. */
export function tendenciasParaIA(lista: Tendencia[], max = 10): string {
  return lista.slice(0, max).map((t) => {
    const extra = t.exemplo ? ` (exemplo: ${t.exemplo})` : t.descricao ? `, ${t.descricao}` : "";
    return `[${NOME_TIPO_TENDENCIA[t.tipo]}${t.formatoStory ? ` ${t.formatoStory}` : ""}] ${t.titulo}${extra}`;
  }).join("; ");
}

/** Registra que a pessoa usou estas tendências (fogo e esquece). */
export function registrarUsoTendencias(lista: Tendencia[], onde: string) {
  if (!lista.length) return;
  const sb = supabase.from.bind(supabase) as unknown as (t: string) => ReturnType<typeof supabase.from>;
  void sb("trend_usos").insert(lista.map((t) => ({ fonte: t.fonte, trend_id: t.id, onde })) as never)
    .then(({ error }) => { if (error) console.warn("trend_usos:", error.message); });
}

/** Ranking agregado dos últimos dias (sem dado de quem usou). */
export function useTendenciasMaisUsadas(dias = 7) {
  return useQuery<Array<{ fonte: FonteTendencia; trend_id: string; usos: number }>>({
    queryKey: ["trend-mais-usadas", dias],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await rpc("trend_mais_usadas", { _dias: dias });
      if (error) return []; // função ainda não aplicada: o destaque cai no plano B
      return ((data as Array<{ fonte: FonteTendencia; trend_id: string; usos: number }>) ?? []).map((r) => ({ ...r, usos: Number(r.usos) }));
    },
  });
}
