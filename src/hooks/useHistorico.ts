import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import type { Post } from "@/hooks/usePosts";
import type { MetricasIg } from "@/lib/historico";

/* Dados do Histórico: TODOS os posts publicados da conta (as contas do
   período e do ranking precisam do conjunto inteiro, não da página de 40) e a
   leitura mais recente do Instagram de cada um. */

// social_insights e a RPC nova não estão no types.ts gerado pelo Lovable.
const sb = supabase as unknown as {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

export type LeituraIg = { post_id: string; metrics: MetricasIg; captured_at: string; permalink: string | null; thumbnail_url: string | null; media_type: string | null };

export function useHistoricoPosts() {
  const { activeAccountId: userId } = useActiveAccount();
  return useQuery<Post[]>({
    queryKey: ["historico-posts", userId],
    enabled: !!userId,
    refetchOnMount: "always",
    queryFn: async () => {
      const todos: Post[] = [];
      for (let de = 0; de < 5000; de += 1000) {
        const { data, error } = await supabase
          .from("posts").select("*")
          .eq("user_id", userId!).eq("status", "publicado").is("deleted_at", null)
          .order("published_at", { ascending: false })
          .range(de, de + 999);
        if (error) throw error;
        todos.push(...((data ?? []) as Post[]));
        if (!data || data.length < 1000) break;
      }
      return todos;
    },
  });
}

export function useLeiturasIg(ids: string[]) {
  return useQuery<Map<string, LeituraIg>>({
    queryKey: ["historico-ig", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const m = new Map<string, LeituraIg>();
      for (let i = 0; i < ids.length; i += 150) {
        const { data, error } = await sb.from("social_insights")
          .select("post_id,metrics,captured_at,permalink,thumbnail_url,media_type")
          .in("post_id", ids.slice(i, i + 150));
        if (error) throw error;
        for (const r of (data ?? []) as LeituraIg[]) {
          const atual = m.get(r.post_id);
          if (!atual || (r.captured_at ?? "") > (atual.captured_at ?? "")) m.set(r.post_id, r);
        }
      }
      return m;
    },
  });
}

/* JUNTAR PILARES REPETIDOS. A RPC (migração 20261107093000_juntar_pilares.sql)
   move posts e ideias pro pilar que fica e apaga o outro. Chamada com _ficar
   nulo ela não faz nada e só responde se existe: o botão some sem ela. */
export function useJuntarPilaresDisponivel() {
  const { activeAccountId: userId } = useActiveAccount();
  return useQuery<boolean>({
    queryKey: ["juntar-pilares-existe", userId],
    enabled: !!userId,
    staleTime: 30 * 60_000,
    retry: false,
    queryFn: async () => {
      const { error } = await sb.rpc("juntar_pilares", { _ficar: null, _sair: [] });
      return !error;
    },
  });
}

export function useJuntarPilares() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (grupos: { fica: string; saem: string[] }[]) => {
      let movidos = 0;
      for (const g of grupos) {
        const { data, error } = await sb.rpc("juntar_pilares", { _ficar: g.fica, _sair: g.saem });
        if (error) throw new Error(error.message ?? "erro");
        movidos += Number(data ?? 0);
      }
      return movidos;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pillars"] });
      void qc.invalidateQueries({ queryKey: ["historico-posts"] });
      void qc.invalidateQueries({ queryKey: ["ideas"] });
    },
  });
}
