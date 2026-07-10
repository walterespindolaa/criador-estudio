/**
 * Persistência do progresso do tour: localStorage (resposta instantânea)
 * + Supabase user_tour_progress (multi-dispositivo). Falha de rede não quebra o tour.
 */
import { supabase } from "@/integrations/supabase/client";

// Tabela nova não está no types.ts (que é travado), cast padrão do projeto:
const sbFrom = supabase.from.bind(supabase) as unknown as (t: string) => ReturnType<typeof supabase.from>;

const lsKey = (userId: string) => `cria_tour_${userId}`;

function readLocal(userId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(lsKey(userId)) || "[]");
  } catch {
    return [];
  }
}

function writeLocal(userId: string, ids: string[]) {
  try {
    localStorage.setItem(lsKey(userId), JSON.stringify(Array.from(new Set(ids))));
  } catch {
    /* quota/priv mode, segue o jogo */
  }
}

/** Carrega os tours já vistos (uma query no login; merge com o cache local). */
export async function loadSeenTours(userId: string): Promise<Set<string>> {
  const local = readLocal(userId);
  try {
    const { data, error } = await sbFrom("user_tour_progress")
      .select("tour_id")
      .eq("user_id", userId);
    if (error) throw error;
    const remote = (data as { tour_id: string }[] | null)?.map(r => r.tour_id) ?? [];
    const merged = Array.from(new Set([...local, ...remote]));
    writeLocal(userId, merged);
    return new Set(merged);
  } catch {
    return new Set(local);
  }
}

/** Marca um tour como visto/concluído (local na hora, remoto em background). */
export function markTourSeen(userId: string, tourId: string, completed: boolean, lastStep: number) {
  writeLocal(userId, [...readLocal(userId), tourId]);
  void sbFrom("user_tour_progress")
    .upsert(
      {
        user_id: userId,
        tour_id: tourId,
        completed,
        last_step: lastStep,
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,tour_id" },
    )
    .then(({ error }) => {
      if (error) console.warn("[tour] progresso não sincronizado:", error.message);
    });
}
