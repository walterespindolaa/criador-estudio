import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

// Quadro de materiais (demandas fora do fluxo de posts). A tabela client_materials
// é nova e ainda não está no types.ts gerado, então usamos o cast sbFrom, igual
// ao resto do CRM (useCrm/useModules).
export type MaterialStatus = "solicitado" | "a_fazer" | "em_aprovacao" | "ajuste" | "finalizado";
export type MaterialKind = "apresentacao" | "flyer" | "arte_avulsa" | "logo" | "outro";
export type MaterialOrigin = "gestor" | "cliente";

export type ClientMaterial = {
  id: string;
  manager_id: string;
  crm_client_id: string | null;
  external_client_id: string | null;
  title: string;
  description: string | null;
  kind: MaterialKind;
  status: MaterialStatus;
  requested_by: MaterialOrigin;
  due_date: string | null;
  attachments: { label?: string; url?: string }[] | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type MaterialInput = {
  title: string;
  description?: string | null;
  kind?: MaterialKind;
  status?: MaterialStatus;
  due_date?: string | null;
};

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export function useClientMaterials(crmClientId: string | undefined) {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  const key = ["client-materials", crmClientId] as const;

  const query = useQuery<ClientMaterial[]>({
    queryKey: key,
    enabled: !!crmClientId,
    queryFn: async () => {
      const { data, error } = await sbFrom("client_materials")
        .select("*")
        .eq("crm_client_id", crmClientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClientMaterial[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const createMaterial = useMutation({
    mutationFn: async (input: MaterialInput): Promise<ClientMaterial> => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      if (!crmClientId) throw new Error("Cliente inválido");
      const { data, error } = await sbFrom("client_materials")
        .insert({
          ...input,
          status: input.status ?? "a_fazer",
          kind: input.kind ?? "arte_avulsa",
          requested_by: "gestor",
          manager_id: agencyOwnerId,
          crm_client_id: crmClientId,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ClientMaterial;
    },
    onSuccess: invalidate,
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao criar material."),
  });

  const updateMaterial = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<MaterialInput> & { status?: MaterialStatus }) => {
      const { error } = await sbFrom("client_materials").update(updates as never).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...updates }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ClientMaterial[]>(key);
      qc.setQueryData<ClientMaterial[]>(key, (old) =>
        Array.isArray(old) ? old.map((m) => (m.id === id ? { ...m, ...updates } as ClientMaterial : m)) : old);
      return { prev };
    },
    onError: (e: unknown, _v, ctx) => {
      const c = ctx as { prev?: ClientMaterial[] } | undefined;
      if (c?.prev) qc.setQueryData(key, c.prev);
      toast.error((e as Error)?.message ?? "Erro ao atualizar.");
    },
    onSettled: invalidate,
  });

  const deleteMaterial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("client_materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao excluir."),
  });

  return {
    materials: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    createMaterial,
    updateMaterial,
    deleteMaterial,
  };
}

// Materiais PEDIDOS pelo cliente e ainda parados em "solicitado" (fila do gestor),
// de TODOS os clientes de uma vez. Alimenta a Central de Aprovações.
export type PendingMaterial = Pick<ClientMaterial, "id" | "crm_client_id" | "title" | "created_at">;
export function useManagerPendingMaterials() {
  const { agencyOwnerId } = useActiveAccount();
  const query = useQuery<PendingMaterial[]>({
    queryKey: ["manager-pending-materials", agencyOwnerId],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("client_materials")
        .select("id, crm_client_id, title, created_at")
        .eq("manager_id", agencyOwnerId!)
        .eq("requested_by", "cliente")
        .eq("status", "solicitado")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PendingMaterial[];
    },
  });
  return { pending: query.data ?? [], isLoading: query.isLoading };
}
