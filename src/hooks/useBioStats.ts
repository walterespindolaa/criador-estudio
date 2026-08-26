import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useBioAlvo } from "@/contexts/BioAlvoContext";

/* ═══════════════════════════════════════════════════════════════════════════
   OS NÚMEROS DA PÁGINA

   Lê o agregado por dia, bloco e origem. Puxa o período pedido E o período
   anterior de igual tamanho, porque um número sozinho não diz nada: "1.284
   visitas" só vira conversa quando vem com "18% a mais que no mês passado".
   ═══════════════════════════════════════════════════════════════════════════ */

export type LinhaStat = {
  block_id: string | null;
  dia: string;
  origem: string;
  views: number;
  clicks: number;
};

export type ResumoBio = {
  visitas: number;
  cliques: number;
  visitasAntes: number;
  cliquesAntes: number;
  /** Uma entrada por dia do período, já preenchendo os dias sem movimento. */
  porDia: { dia: string; visitas: number; cliques: number }[];
  porBloco: Record<string, number>;
  porOrigem: Record<string, number>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbFrom = (table: string) => (supabase as any).from(table);
const tabelaFaltando = (m: string) => /does not exist|schema cache|could not find/i.test(m ?? "");

const diaBR = (d: Date) => {
  // Data no fuso de São Paulo, igual ao que o servidor grava. Sem isso, tudo
  // que acontece depois das 21h cai no dia seguinte e o gráfico fica torto.
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  return f.format(d);
};

const VAZIO: ResumoBio = { visitas: 0, cliques: 0, visitasAntes: 0, cliquesAntes: 0, porDia: [], porBloco: {}, porOrigem: {} };

export function useBioStats(dias: number) {
  const alvo = useBioAlvo();
  const { activeAccountId } = useActiveAccount();
  const pageId = alvo?.tipo === "ficha" ? alvo.pageId : null;
  const userId = alvo ? (alvo.tipo === "conta" ? alvo.ownerId : alvo.managerId) : activeAccountId;

  return useQuery<ResumoBio>({
    queryKey: ["bio-stats", pageId ?? userId, dias],
    enabled: !!(pageId || userId),
    staleTime: 60_000,
    queryFn: async () => {
      const hoje = new Date();
      const inicio = new Date(hoje); inicio.setDate(inicio.getDate() - (dias - 1));
      const inicioAntes = new Date(hoje); inicioAntes.setDate(inicioAntes.getDate() - (dias * 2 - 1));

      let s = sbFrom("bio_stats_daily").select("block_id, dia, origem, views, clicks").gte("dia", diaBR(inicioAntes));
      // Página da agência x conta: são chaves diferentes, e sem esse filtro a
      // gestora veria os números de todas as páginas dela somados numa só.
      s = pageId ? s.eq("page_id", pageId) : s.eq("user_id", userId!).is("page_id", null);
      const { data, error } = await s;
      if (error) {
        if (tabelaFaltando(error.message)) return VAZIO;
        throw error;
      }

      const linhas = (data ?? []) as LinhaStat[];
      const corte = diaBR(inicio);
      const r: ResumoBio = { ...VAZIO, porDia: [], porBloco: {}, porOrigem: {} };
      const mapaDia = new Map<string, { visitas: number; cliques: number }>();

      for (const l of linhas) {
        const noPeriodo = l.dia >= corte;
        if (noPeriodo) {
          r.visitas += l.views; r.cliques += l.clicks;
          const d = mapaDia.get(l.dia) ?? { visitas: 0, cliques: 0 };
          d.visitas += l.views; d.cliques += l.clicks;
          mapaDia.set(l.dia, d);
          if (l.block_id && l.clicks) r.porBloco[l.block_id] = (r.porBloco[l.block_id] ?? 0) + l.clicks;
          if (l.views) r.porOrigem[l.origem] = (r.porOrigem[l.origem] ?? 0) + l.views;
        } else {
          r.visitasAntes += l.views; r.cliquesAntes += l.clicks;
        }
      }

      // Preenche os dias parados: sem isso o gráfico "pula" e engana quem olha.
      for (let i = 0; i < dias; i++) {
        const d = new Date(inicio); d.setDate(d.getDate() + i);
        const k = diaBR(d);
        r.porDia.push({ dia: k, ...(mapaDia.get(k) ?? { visitas: 0, cliques: 0 }) });
      }
      return r;
    },
  });
}
