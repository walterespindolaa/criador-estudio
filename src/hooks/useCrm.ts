import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

export type CrmClient = {
  id: string;
  manager_id: string;
  cria_owner_id: string | null;
  crm_lead_id: string | null;
  name: string;
  logo: string | null;
  segment: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  monthly_value: number | null;
  contract_date: string | null;
  renewal_date: string | null;
  services: string[] | null;
  brand_core: Record<string, string>;
  persona: Record<string, string>;
  diagnosis: Record<string, string>;
  competitors: { name?: string; instagram?: string; followers?: string; frequency?: string; contentType?: string }[];
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
export type CrmClientInput = Partial<Omit<CrmClient, "id" | "manager_id" | "created_at" | "updated_at">> & { name: string };
export type CrmClientRef = {
  id: string; crm_client_id: string; manager_id: string;
  image_url: string; note: string | null; sort_order: number; created_at: string;
};

// types.ts não tem as tabelas crm_* — cast (igual useModules/usePartner)
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export function useCrmClients() {
  const { user } = useAuth();
  return useQuery<CrmClient[]>({
    queryKey: ["crm-clients", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await sbFrom("crm_clients").select("*").eq("manager_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CrmClient[];
    },
  });
}

export function useCrmClient(id: string | undefined) {
  const { user } = useAuth();
  return useQuery<CrmClient | null>({
    queryKey: ["crm-client", id],
    enabled: !!user?.id && !!id,
    queryFn: async () => {
      const { data, error } = await sbFrom("crm_clients").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return (data as unknown as CrmClient) ?? null;
    },
  });
}

export function useCreateCrmClient() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrmClientInput): Promise<CrmClient> => {
      if (!user?.id) throw new Error("Sem sessão");
      const { data, error } = await sbFrom("crm_clients").insert({ ...input, manager_id: user.id } as never).select().single();
      if (error) throw error;
      return data as unknown as CrmClient;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-clients"] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao salvar cliente."),
  });
}

export function useUpdateCrmClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CrmClientInput>) => {
      const { error } = await sbFrom("crm_clients").update(updates as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-clients"] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao atualizar."),
  });
}

export function useDeleteCrmClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("crm_clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-clients"] }),
    onError: () => toast.error("Erro ao excluir."),
  });
}

// Importa as contas que a gestora já gerencia no cria (dedup por cria_owner_id)
export function useImportCriaClients() {
  const { user } = useAuth();
  const { managedAccounts } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ imported: number }> => {
      if (!user?.id) throw new Error("Sem sessão");
      if (managedAccounts.length === 0) return { imported: 0 };
      const { data: existing, error: exErr } = await sbFrom("crm_clients")
        .select("cria_owner_id").eq("manager_id", user.id).not("cria_owner_id", "is", null);
      if (exErr) throw exErr;
      const have = new Set((existing ?? []).map((r: { cria_owner_id: string }) => r.cria_owner_id));
      const toInsert = managedAccounts
        .filter((a) => !have.has(a.owner_id))
        .map((a) => ({
          manager_id: user.id,
          cria_owner_id: a.owner_id,
          name: a.name || "Sem nome",
          instagram: a.instagram_handle ?? null,
          segment: a.niche ?? null,
        }));
      if (toInsert.length === 0) return { imported: 0 };
      const { error } = await sbFrom("crm_clients").insert(toInsert as never);
      if (error) throw error;
      return { imported: toInsert.length };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["crm-clients"] });
      toast.success(r.imported > 0 ? `${r.imported} cliente(s) importado(s) do cria.` : "Nenhum cliente novo pra importar.");
    },
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao importar do cria."),
  });
}

// Moodboard
export function useCrmClientRefs(crmClientId: string | null) {
  return useQuery<CrmClientRef[]>({
    queryKey: ["crm-refs", crmClientId],
    enabled: !!crmClientId,
    queryFn: async () => {
      const { data, error } = await sbFrom("crm_client_refs").select("*").eq("crm_client_id", crmClientId!).order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as CrmClientRef[];
    },
  });
}

export function useAddCrmRef() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ crmClientId, file }: { crmClientId: string; file: File }) => {
      if (!user?.id) throw new Error("Sem sessão");
      if (!file.type.startsWith("image/")) throw new Error("Selecione uma imagem.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Imagem máx. 5MB.");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crmClientId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("crm").upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("crm").getPublicUrl(path);
      const { error } = await sbFrom("crm_client_refs").insert({ manager_id: user.id, crm_client_id: crmClientId, image_url: urlData.publicUrl } as never);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["crm-refs", v.crmClientId] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao enviar imagem."),
  });
}

export function useDeleteCrmRef() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ref: CrmClientRef) => {
      const { error } = await sbFrom("crm_client_refs").delete().eq("id", ref.id);
      if (error) throw error;
    },
    onSuccess: (_d, ref) => qc.invalidateQueries({ queryKey: ["crm-refs", ref.crm_client_id] }),
    onError: () => toast.error("Erro ao remover imagem."),
  });
}

// ===================== LEADS =====================
export const CRM_STAGES = ["lead","contato","reuniao","proposta","negociacao","fechado","perdido"] as const;
export type CrmStage = typeof CRM_STAGES[number];
export const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  lead: "Lead", contato: "Contato", reuniao: "Reunião", proposta: "Proposta",
  negociacao: "Negociação", fechado: "Fechado", perdido: "Perdido",
};

export type CrmLead = {
  id: string; manager_id: string; name: string; company: string | null; email: string | null;
  phone: string | null; instagram: string | null; segment: string | null; stage: CrmStage;
  monthly_value: number | null; notes: string | null; lead_origin: string | null; is_referral: boolean | null;
  referred_by: string | null; main_pain: string | null; main_objection: string | null; next_steps: string | null;
  next_interaction_date: string | null; closing_potential: "alto" | "medio" | "baixo" | null;
  created_at: string; updated_at: string;
};
export type CrmLeadInput = Partial<Omit<CrmLead, "id" | "manager_id" | "created_at" | "updated_at">> & { name: string };

export function useCrmLeads() {
  const { user } = useAuth();
  return useQuery<CrmLead[]>({
    queryKey: ["crm-leads", user?.id], enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await sbFrom("crm_leads").select("*").eq("manager_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CrmLead[];
    },
  });
}
export function useCreateCrmLead() {
  const { user } = useAuth(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrmLeadInput) => {
      if (!user?.id) throw new Error("Sem sessão");
      const { error } = await sbFrom("crm_leads").insert({ ...input, manager_id: user.id } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-leads"] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao criar lead."),
  });
}
export function useUpdateCrmLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CrmLeadInput>) => {
      const { error } = await sbFrom("crm_leads").update(updates as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-leads"] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao atualizar lead."),
  });
}
export function useDeleteCrmLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await sbFrom("crm_leads").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-leads"] }),
    onError: () => toast.error("Erro ao excluir lead."),
  });
}

// ===================== CONTRATOS =====================
export type CrmContract = {
  id: string; manager_id: string; crm_lead_id: string | null; crm_client_id: string | null;
  title: string; status: "enviado" | "fechado" | "encerrado"; monthly_value: number | null; contract_value: number | null;
  sent_date: string | null; closed_date: string | null; ended_date: string | null; notes: string | null; created_at: string;
};
export type CrmContractInput = Partial<Omit<CrmContract, "id" | "manager_id" | "created_at">> & { title: string };

export function useCrmContracts() {
  const { user } = useAuth();
  return useQuery<CrmContract[]>({
    queryKey: ["crm-contracts", user?.id], enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await sbFrom("crm_contracts").select("*").eq("manager_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CrmContract[];
    },
  });
}
export function useCreateCrmContract() {
  const { user } = useAuth(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrmContractInput) => {
      if (!user?.id) throw new Error("Sem sessão");
      const { error } = await sbFrom("crm_contracts").insert({ ...input, manager_id: user.id } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-contracts"] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao criar contrato."),
  });
}
