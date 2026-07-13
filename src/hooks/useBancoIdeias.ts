import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

// Banco de ideias do cliente: junta o que vem da conta CRIA dele com o que a
// social mídia guarda por conta própria. types.ts é travado, cast padrão do projeto.
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;
const sbRpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string, args?: Record<string, unknown>
) => Promise<{ data: unknown; error: { message: string } | null }>;

// ───────── Do cliente (conta CRIA dele) ─────────
export type CriaIdea = {
  id: string; title: string; notes: string | null;
  platform: string | null; objective: string | null;
  status: string | null; origin: string | null; created_at: string;
};
export type CriaSaved = {
  id: string; url: string; caption: string | null; author: string | null;
  media_type: string | null; thumbnail_url: string | null; note: string | null;
  folder: string | null; created_at: string;
};

export function useCriaClientIdeas(criaOwnerId: string | null | undefined) {
  return useQuery<{ ideas: CriaIdea[]; saved: CriaSaved[] }>({
    queryKey: ["cria-client-ideas", criaOwnerId],
    enabled: !!criaOwnerId,
    queryFn: async () => {
      const { data, error } = await sbRpc("manager_client_ideas", { client_owner_id: criaOwnerId! });
      if (error) throw new Error(error.message);
      const d = (data as { ideas?: CriaIdea[]; saved?: CriaSaved[] } | null) ?? {};
      return { ideas: d.ideas ?? [], saved: d.saved ?? [] };
    },
  });
}

// ───────── Salvos da própria social mídia (privados) ─────────
export type CrmSavedRef = {
  id: string; manager_id: string; crm_client_id: string;
  url: string; title: string | null; note: string | null;
  thumbnail_url: string | null; author: string | null; created_at: string;
};

export function useCrmSavedRefs(clientId: string | null | undefined) {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<CrmSavedRef[]>({
    queryKey: ["crm-saved-refs", agencyOwnerId, clientId],
    enabled: !!agencyOwnerId && !!clientId,
    queryFn: async () => {
      const { data, error } = await sbFrom("crm_saved_refs")
        .select("*").eq("crm_client_id", clientId!).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CrmSavedRef[];
    },
  });
}

export function useAddCrmSavedRef() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { crm_client_id: string; url: string; title?: string; note?: string }) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const url = input.url.trim();
      if (!/^https?:\/\//i.test(url)) throw new Error("Cole um link completo (https://…).");
      const { error } = await sbFrom("crm_saved_refs").insert({
        manager_id: agencyOwnerId, crm_client_id: input.crm_client_id, url,
        title: input.title?.trim() || null, note: input.note?.trim() || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-saved-refs"] }); toast.success("Referência salva."); },
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao salvar."),
  });
}

export function useDeleteCrmSavedRef() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("crm_saved_refs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-saved-refs"] }),
    onError: () => toast.error("Erro ao excluir."),
  });
}
