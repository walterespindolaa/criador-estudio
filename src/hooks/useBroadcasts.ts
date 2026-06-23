import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// tabela nova — types.ts travado → cast (padrão do projeto).
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type Broadcast = {
  id: string;
  title: string | null;
  message: string;
  level: "info" | "aviso" | "novidade";
  active: boolean;
  created_at: string;
};

// Admin: gerencia os recados.
export function useBroadcastsAdmin() {
  const qc = useQueryClient();
  const list = useQuery<Broadcast[]>({
    queryKey: ["broadcasts-admin"],
    queryFn: async () => {
      const { data, error } = await sbFrom("broadcasts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Broadcast[];
    },
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["broadcasts-admin"] });
    qc.invalidateQueries({ queryKey: ["broadcasts-active"] });
  };

  const create = useMutation({
    mutationFn: async (input: { title?: string | null; message: string; level?: string }) => {
      const { error } = await sbFrom("broadcasts").insert({ ...input, active: true } as never);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Recado enviado!"); },
    onError: () => toast.error("Erro ao enviar o recado."),
  });
  const setActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await sbFrom("broadcasts").update({ active } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao atualizar."),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await sbFrom("broadcasts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidate(); toast.success("Recado excluído."); },
    onError: () => toast.error("Erro ao excluir."),
  });

  return { broadcasts: list.data ?? [], isLoading: list.isLoading, create, setActive, remove };
}

// Usuário: lê só os ativos.
export function useActiveBroadcasts() {
  const list = useQuery<Broadcast[]>({
    queryKey: ["broadcasts-active"],
    queryFn: async () => {
      const { data, error } = await sbFrom("broadcasts").select("*").eq("active", true).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Broadcast[];
    },
    staleTime: 60_000,
  });
  return { broadcasts: list.data ?? [] };
}
