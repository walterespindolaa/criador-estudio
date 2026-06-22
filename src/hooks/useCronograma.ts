import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// types.ts travado — tabelas novas via cast (padrão useModules/useFinance).
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type CronogramaStatus = "rascunho" | "enviado" | "aprovado" | "arquivado";
export type ItemStatus = "pendente" | "aprovado" | "recusado" | "ajuste";
export const CRONOGRAMA_TYPES = ["Reels", "Carrossel", "Feed", "Stories", "Carrossel/Stories", "Feed/Stories"] as const;

export type Cronograma = {
  id: string;
  manager_id: string;
  title: string;
  client_label: string | null;
  crm_client_id: string | null;
  cria_owner_id: string | null;
  status: CronogramaStatus;
  token: string;
  created_at: string;
};

export type CronogramaItem = {
  id: string;
  cronograma_id: string;
  sort_order: number;
  copy: string | null;
  description: string | null;
  date: string | null;
  type: string | null;
  approval_status: ItemStatus;
  client_comment: string | null;
  converted_post_id: string | null;
};

export function useCronogramas() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery<Cronograma[]>({
    queryKey: ["cronogramas", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await sbFrom("cronogramas")
        .select("*").eq("manager_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Cronograma[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: { title: string; client_label?: string | null; crm_client_id?: string | null; cria_owner_id?: string | null }) => {
      if (!user?.id) throw new Error("Sem sessão");
      const { data, error } = await sbFrom("cronogramas")
        .insert({ ...input, manager_id: user.id } as never).select("*").single();
      if (error) throw error;
      return data as unknown as Cronograma;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cronogramas"] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao criar cronograma."),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Cronograma>) => {
      const { error } = await sbFrom("cronogramas").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cronogramas"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await sbFrom("cronogramas").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cronogramas"] }); toast.success("Cronograma excluído."); },
    onError: () => toast.error("Erro ao excluir."),
  });

  return { cronogramas: list.data ?? [], isLoading: list.isLoading, create, update, remove };
}

export function useCronogramaItems(cronogramaId: string | null) {
  const qc = useQueryClient();

  const list = useQuery<CronogramaItem[]>({
    queryKey: ["cronograma-items", cronogramaId],
    enabled: !!cronogramaId,
    queryFn: async () => {
      const { data, error } = await sbFrom("cronograma_items")
        .select("*").eq("cronograma_id", cronogramaId!).order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CronogramaItem[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["cronograma-items", cronogramaId] });

  const addItem = useMutation({
    mutationFn: async (input: Partial<CronogramaItem>) => {
      const { error } = await sbFrom("cronograma_items")
        .insert({ cronograma_id: cronogramaId, sort_order: (list.data?.length ?? 0), ...input } as never);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao adicionar item."),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<CronogramaItem>) => {
      const { error } = await sbFrom("cronograma_items").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao salvar item."),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => { const { error } = await sbFrom("cronograma_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: invalidate,
    onError: () => toast.error("Erro ao excluir item."),
  });

  return { items: list.data ?? [], isLoading: list.isLoading, addItem, updateItem, deleteItem };
}
