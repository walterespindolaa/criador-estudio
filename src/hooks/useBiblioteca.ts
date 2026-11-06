import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";

/* ═══════════════════════════════════════════════════════════════════════════
   BIBLIOTECA EM FICHÁRIO (Walter, 07/11/2026; mockup aprovado)

   Duas coisas que a tela nova precisa e o useLibrary não tinha:
     · FAVORITAR QUALQUER ITEM, curado ou meu, inclusive formato e template.
       Mora em `user_library_favorites` (item_id é texto porque template é
       "howto-1", não uuid). Se a migração ainda não rodou, a consulta falha,
       `disponivel` fica falso e a estrela some só nos itens que dependem dela.
     · CONTAR QUANTAS VEZES USOU. `user_library_usage` tinha uma linha por item
       (liga/desliga). Agora "Usar no post" e "Copiar" registram uso e somam em
       `vezes`. Sem a coluna, o update cai pro jeito antigo (só a data).
   ═══════════════════════════════════════════════════════════════════════════ */

const sbFrom = supabase.from.bind(supabase) as unknown as (t: string) => ReturnType<typeof supabase.from>;

export type FavTipo = "hook" | "format" | "prompt" | "template";
export type UsoTipo = "hook" | "format" | "prompt";

export type UsoDaBiblioteca = {
  id: string;
  item_type: string;
  item_id: string;
  is_user_item: boolean | null;
  used_at: string | null;
  vezes?: number | null;
};

export function useBibliotecaExtra() {
  const { activeAccountId: userId } = useActiveAccount();
  const qc = useQueryClient();
  const favKey = ["biblioteca-favoritos", userId] as const;
  const usoKey = ["library-usage", userId] as const;

  const favQ = useQuery<{ item_type: string; item_id: string }[]>({
    queryKey: favKey,
    enabled: !!userId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await sbFrom("user_library_favorites")
        .select("item_type, item_id")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as unknown as { item_type: string; item_id: string }[];
    },
  });

  const usoQ = useQuery<UsoDaBiblioteca[]>({
    queryKey: usoKey,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await sbFrom("user_library_usage").select("*").eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as unknown as UsoDaBiblioteca[];
    },
  });

  const favoritos = new Set((favQ.data ?? []).map((f) => `${f.item_type}:${f.item_id}`));

  const alternarFavorito = useMutation({
    mutationFn: async ({ tipo, id, ligado }: { tipo: FavTipo; id: string; ligado: boolean }) => {
      if (!userId) throw new Error("sem conta");
      if (ligado) {
        const { error } = await sbFrom("user_library_favorites").delete()
          .eq("user_id", userId).eq("item_type", tipo).eq("item_id", id);
        if (error) throw error;
      } else {
        const { error } = await sbFrom("user_library_favorites")
          .insert({ user_id: userId, item_type: tipo, item_id: id } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: favKey }),
  });

  /** Soma um uso. Nunca derruba a ação principal (copiar, mandar pro post). */
  const registrarUso = useMutation({
    mutationFn: async ({ tipo, id, meu }: { tipo: UsoTipo; id: string; meu: boolean }) => {
      if (!userId) return;
      const atual = (usoQ.data ?? []).find((u) => u.item_type === tipo && u.item_id === id);
      const agora = new Date().toISOString();
      if (atual) {
        const comVezes = await sbFrom("user_library_usage")
          .update({ used_at: agora, vezes: (atual.vezes ?? 1) + 1 } as never).eq("id", atual.id);
        if (comVezes.error) {
          await sbFrom("user_library_usage").update({ used_at: agora } as never).eq("id", atual.id);
        }
        return;
      }
      await sbFrom("user_library_usage")
        .insert({ user_id: userId, item_type: tipo, item_id: id, is_user_item: meu } as never);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: usoKey }),
  });

  return {
    favoritos,
    favDisponivel: favQ.isSuccess,
    usos: usoQ.data ?? [],
    alternarFavorito,
    registrarUso,
  };
}
