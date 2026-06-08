import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type FinType = "entrada" | "despesa";
export type FinStatus = "pago" | "pendente" | "atrasado";
export type FinContext = "pj" | "pf";
export type FinRecord = {
  id: string; manager_id: string; crm_client_id: string | null; context: FinContext;
  type: FinType; description: string; category: string | null; amount: number;
  status: FinStatus; payment_method: string | null; date: string; recurring: boolean;
  created_at: string; updated_at: string;
};
export type FinRecordInput = Partial<Omit<FinRecord, "id" | "manager_id" | "created_at" | "updated_at">> & { type: FinType; description: string; amount: number };

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export function useFinRecords() {
  const { user } = useAuth();
  return useQuery<FinRecord[]>({
    queryKey: ["fin-records", user?.id], enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await sbFrom("fin_records").select("*").eq("manager_id", user!.id).order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FinRecord[];
    },
  });
}
export function useCreateFinRecord() {
  const { user } = useAuth(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FinRecordInput) => {
      if (!user?.id) throw new Error("Sem sessão");
      const { error } = await sbFrom("fin_records").insert({ ...input, manager_id: user.id } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fin-records"] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao salvar lançamento."),
  });
}
export function useUpdateFinRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<FinRecordInput>) => {
      const { error } = await sbFrom("fin_records").update(updates as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fin-records"] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao atualizar."),
  });
}
export function useDeleteFinRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await sbFrom("fin_records").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fin-records"] }),
    onError: () => toast.error("Erro ao excluir."),
  });
}
