import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, addMonths, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { hojeBR, parseDateOnly } from "@/lib/date-br";
import type { Task } from "@/hooks/useTasks";

/* ═══════════════════════════════════════════════════════════════════════════
   TAREFAS: REPETIÇÃO E PASSOS (Walter, 06/11/2026, mockup aprovado)

   Colunas novas em tasks (migração 20261107090000_tarefas_repeticao_passos):
     repeticao        'dia' | 'semana' | 'mes' | null
     passos           jsonb [{ texto, feito }]
     concluida_em     quando foi marcada como feita
     repeticao_gerada a próxima da série já foi criada (não duplica se a
                      pessoa desmarcar e marcar de novo)

   A tela funciona ANTES da migração rodar: o probe abaixo pergunta ao banco se
   a coluna `passos` existe. Se não existe, repetição e passos ficam escondidos
   e concluir é só trocar o status, como era antes.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Repeticao = "dia" | "semana" | "mes";
export type Passo = { texto: string; feito: boolean };
export type TarefaExtra = Task & {
  repeticao?: Repeticao | null;
  passos?: Passo[] | null;
  concluida_em?: string | null;
  repeticao_gerada?: boolean | null;
};

const sbFrom = supabase.from.bind(supabase) as unknown as (t: string) => ReturnType<typeof supabase.from>;

export const ROTULO_REPETICAO: Record<Repeticao, string> = { dia: "todo dia", semana: "toda semana", mes: "todo mês" };

/** Próxima data da série, a partir do prazo da tarefa (ou de hoje, se não tinha prazo). */
export function proximaData(base: string | null | undefined, rep: Repeticao, hoje = hojeBR()): string {
  const d = parseDateOnly(base || hoje);
  const prox = rep === "dia" ? addDays(d, 1) : rep === "semana" ? addDays(d, 7) : addMonths(d, 1);
  let iso = format(prox, "yyyy-MM-dd");
  // Série atrasada não nasce atrasada: a próxima nunca fica antes de hoje.
  if (iso < hoje) iso = hoje;
  return iso;
}

export function passosDe(t: TarefaExtra): Passo[] {
  return Array.isArray(t.passos) ? t.passos.filter((p) => p && typeof p.texto === "string") : [];
}

export function useTarefasExtras() {
  const { activeAccountId: userId } = useActiveAccount();
  const qc = useQueryClient();

  // A coluna existe? Um select de 1 linha responde sem trazer dado nenhum.
  const { data: temExtras = false } = useQuery({
    queryKey: ["tasks-extras-probe"],
    queryFn: async () => {
      const { error } = await sbFrom("tasks").select("passos, repeticao").limit(1);
      return !error;
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["tasks", userId] });

  const salvarExtras = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; repeticao?: Repeticao | null; passos?: Passo[] }) => {
      if (!temExtras) return;
      const { error } = await sbFrom("tasks").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  /** Marca ou desmarca. Ao concluir uma tarefa que se repete, cria a próxima da série. */
  const alternar = useMutation({
    mutationFn: async (t: TarefaExtra): Promise<{ proxima: string | null }> => {
      const concluir = t.status !== "concluida";
      const patch: Record<string, unknown> = { status: concluir ? "concluida" : "pendente" };
      if (temExtras) patch.concluida_em = concluir ? new Date().toISOString() : null;
      const { error } = await sbFrom("tasks").update(patch as never).eq("id", t.id);
      if (error) throw error;

      if (!concluir || !temExtras || !t.repeticao || t.repeticao_gerada || !userId) return { proxima: null };
      const due = proximaData(t.due_date, t.repeticao);
      const nova = {
        user_id: userId,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: "pendente",
        due_date: due,
        repeticao: t.repeticao,
        passos: passosDe(t).map((p) => ({ texto: p.texto, feito: false })),
      };
      const { error: e2 } = await sbFrom("tasks").insert(nova as never);
      if (e2) throw e2;
      await sbFrom("tasks").update({ repeticao_gerada: true } as never).eq("id", t.id);
      return { proxima: due };
    },
    onSuccess: invalidar,
  });

  /** Muda o prazo de várias de uma vez ("passar tudo pra hoje"). */
  const moverPrazo = useMutation({
    mutationFn: async ({ ids, due }: { ids: string[]; due: string }) => {
      if (!ids.length) return;
      const { error } = await sbFrom("tasks").update({ due_date: due } as never).in("id", ids);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  return { temExtras, salvarExtras, alternar, moverPrazo };
}
