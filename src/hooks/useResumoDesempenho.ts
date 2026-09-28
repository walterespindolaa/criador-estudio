import { useMemo } from "react";
import { useMediaInsights } from "@/hooks/useSocialInsights";
import { usePillars } from "@/hooks/usePillars";
import { computeCrossAnalysis, crossHeadlines, interacoesDe, type CrossItem } from "@/components/insights/insightsUtils";
import { bestTimesFromMedia, type BestTimes } from "@/lib/bestTimes";

/* ═══════════════════════════════════════════════════════════════════════════
   O QUE PERFORMOU, EM TEXTO (ciclo 4 dos dados do Instagram, 28/09/2026)

   Antes o desempenho só aparecia nas telas de análise: o Autopilot tinha um
   campo "priorizar o que performou" que nunca recebia nada, e as ideias e o
   Cria Plano planejavam no escuro. Este hook resume os últimos 90 dias em
   frases curtas (as mesmas da análise honesta, com amostra mínima) e o
   melhor horário real, pra IA e pra sugestão de horários usarem.
   Sem base suficiente, devolve texto vazio: melhor não dizer nada do que
   inventar tendência.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ResumoDesempenho = {
  texto: string;             // pronto pra ir no prompt ("" quando não há base)
  frases: string[];
  horarios: BestTimes | null; // melhor dia/hora pelo desempenho real
  analisados: number;
};

export function useResumoDesempenho(): ResumoDesempenho {
  const { data: media = [] } = useMediaInsights();
  const { pillars } = usePillars();

  return useMemo(() => {
    const desde = Date.now() - 90 * 86400000;
    const recentes = media.filter((mi) => mi.posted_at && new Date(mi.posted_at).getTime() >= desde);
    const nomePilar: Record<string, string> = {};
    pillars.forEach((p) => { nomePilar[p.id] = p.name; });
    const itens: CrossItem[] = recentes.map((mi) => ({
      media_type: mi.media_type,
      posted_at: mi.posted_at,
      reach: Number((mi.metrics as Record<string, number> | null)?.reach ?? 0),
      interactions: interacoesDe(mi.metrics as Record<string, number> | null),
      pillar: mi.posts?.pillar_id ? nomePilar[mi.posts.pillar_id] ?? null : null,
      hook: mi.posts?.hook ?? null,
    }));
    const cross = computeCrossAnalysis(itens);
    const frases = cross.hasData ? crossHeadlines(cross) : [];
    const horarios = bestTimesFromMedia(recentes as unknown as Parameters<typeof bestTimesFromMedia>[0]);
    const partes = [...frases];
    if (horarios) partes.push(`Melhores dias: ${horarios.days}. Melhores horários: ${horarios.slots.join(", ")}.`);
    return {
      texto: partes.length ? `Últimos 90 dias (${cross.analisados} posts): ${partes.join(" ")}` : "",
      frases,
      horarios,
      analisados: cross.analisados,
    };
  }, [media, pillars]);
}
