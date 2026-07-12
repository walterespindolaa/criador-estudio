import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

export const CLIENT_STATUSES = ["ativo", "pausado", "inativo"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export const CLIENT_STATUS_META: Record<ClientStatus, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "bg-emerald-500/12 text-emerald-600 border-emerald-500/25" },
  pausado: { label: "Pausado", cls: "bg-amber-500/12 text-amber-700 border-amber-500/25" },
  inativo: { label: "Inativo", cls: "bg-muted text-muted-foreground border-border" },
};

export const TAG_COLORS = ["slate", "emerald", "amber", "rose", "violet", "sky", "orange", "green"] as const;
export type TagColor = (typeof TAG_COLORS)[number];
export const TAG_COLOR_CLS: Record<string, string> = {
  slate: "bg-slate-500/15 text-slate-700 border-slate-500/25",
  emerald: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25",
  amber: "bg-amber-500/15 text-amber-700 border-amber-500/25",
  rose: "bg-rose-500/15 text-rose-700 border-rose-500/25",
  violet: "bg-violet-500/15 text-violet-700 border-violet-500/25",
  sky: "bg-sky-500/15 text-sky-700 border-sky-500/25",
  orange: "bg-orange-500/15 text-orange-700 border-orange-500/25",
  green: "bg-green-600/15 text-green-700 border-green-600/25",
};
export type CrmTag = { id: string; manager_id: string; name: string; color: string; created_at: string };

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
  // Informações gerais (empresa)
  company_name: string | null;
  cnpj: string | null;
  owner_name: string | null;
  whatsapp: string | null;
  address: string | null;
  // Contrato
  plan_name: string | null;
  payment_day: number | null;
  payment_method: string | null;
  birthday: string | null;
  // Organização
  status: ClientStatus;
  tags: string[];
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

// types.ts não tem as tabelas crm_*, cast (igual useModules/usePartner)
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export function useCrmClients() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<CrmClient[]>({
    queryKey: ["crm-clients", agencyOwnerId],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("crm_clients").select("*").eq("manager_id", agencyOwnerId!).is("deleted_at", null).order("created_at", { ascending: false });
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
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrmClientInput): Promise<CrmClient> => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const { data, error } = await sbFrom("crm_clients").insert({ ...input, manager_id: agencyOwnerId } as never).select().single();
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
    // Update OTIMISTA: a tela reflete na hora e o cache do cliente fica correto.
    // Sem isso, o cache de ["crm-client", id] ficava velho → parecia "não salvou".
    onMutate: async ({ id, ...updates }: { id: string } & Partial<CrmClientInput>) => {
      await qc.cancelQueries({ queryKey: ["crm-client", id] });
      const prev = qc.getQueryData<CrmClient>(["crm-client", id]);
      qc.setQueryData<CrmClient | null>(["crm-client", id], (old) => (old ? { ...old, ...updates } as CrmClient : old));
      qc.setQueriesData<CrmClient[]>({ queryKey: ["crm-clients"] }, (old) =>
        Array.isArray(old) ? old.map((c) => (c.id === id ? { ...c, ...updates } as CrmClient : c)) : old);
      return { prev, id };
    },
    onError: (e: unknown, _v, ctx) => {
      const c = ctx as { prev?: CrmClient; id?: string } | undefined;
      if (c?.prev && c.id) qc.setQueryData(["crm-client", c.id], c.prev);
      toast.error((e as Error)?.message ?? "Erro ao atualizar.");
    },
    // Cache já está certo — revalida a lista em background, sem travar a UI.
    onSettled: () => qc.invalidateQueries({ queryKey: ["crm-clients"], refetchType: "none" }),
  });
}

// Puxa o Brandbook/nome do cliente que usa o Cria pro CRM da agência (via edge, service role).
export function useSyncCrmFromCria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (crmClientId: string) => {
      const { data, error } = await supabase.functions.invoke("crm-sync-from-cria", { body: { crm_client_id: crmClientId } });
      if (error) throw new Error(error.message);
      const err = (data as { error?: string })?.error;
      if (err) throw new Error((data as { message?: string })?.message || err);
      return data as { name: string; brand_core: Record<string, string>; synced_keys: string[] };
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["crm-client", id] });
      qc.invalidateQueries({ queryKey: ["crm-clients"] });
    },
  });
}

export function useDeleteCrmClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft-delete: vai pra Lixeira (recuperável por 30 dias).
      const { error } = await sbFrom("crm_clients").update({ deleted_at: new Date().toISOString() } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-clients"] }); toast.success("Cliente movido pra Lixeira (recuperável por 30 dias)."); },
    onError: () => toast.error("Erro ao excluir."),
  });
}

// Importa as contas que a gestora já gerencia no cria (dedup por cria_owner_id)
export function useImportCriaClients() {
  const { managedAccounts, agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ imported: number }> => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      if (managedAccounts.length === 0) return { imported: 0 };
      const { data: existing, error: exErr } = await sbFrom("crm_clients")
        .select("cria_owner_id").eq("manager_id", agencyOwnerId).not("cria_owner_id", "is", null);
      if (exErr) throw exErr;
      const have = new Set((existing ?? []).map((r: { cria_owner_id: string }) => r.cria_owner_id));
      const toInsert = managedAccounts
        .filter((a) => !have.has(a.owner_id))
        .map((a) => ({
          manager_id: agencyOwnerId,
          cria_owner_id: a.owner_id,
          name: a.name || "Sem nome",
          instagram: a.instagram_handle ?? null,
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
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ crmClientId, file }: { crmClientId: string; file: File }) => {
      if (!user?.id || !agencyOwnerId) throw new Error("Sem sessão");
      if (!file.type.startsWith("image/")) throw new Error("Selecione uma imagem.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Imagem máx. 5MB.");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crmClientId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("crm").upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("crm").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr) throw sErr;
      const { error } = await sbFrom("crm_client_refs").insert({ manager_id: agencyOwnerId, crm_client_id: crmClientId, image_url: signed.signedUrl } as never);
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

// ===================== ETIQUETAS (catálogo da agência) =====================
export function useCrmTags() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<CrmTag[]>({
    queryKey: ["crm-tags", agencyOwnerId],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("crm_tags").select("*").eq("manager_id", agencyOwnerId!).order("name");
      if (error) throw error;
      return (data ?? []) as unknown as CrmTag[];
    },
  });
}

export function useCreateCrmTag() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const { error } = await sbFrom("crm_tags").insert({ manager_id: agencyOwnerId, name: name.trim(), color } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tags"] }),
    onError: (e: unknown) => toast.error((e as Error)?.message?.includes("duplicate") ? "Já existe uma etiqueta com esse nome." : "Erro ao criar etiqueta."),
  });
}

export function useDeleteCrmTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("crm_tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tags"] }),
    onError: () => toast.error("Erro ao excluir etiqueta."),
  });
}

// Renomear / trocar a cor de uma etiqueta existente.
export function useUpdateCrmTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const patch: Record<string, string> = {};
      if (name !== undefined) patch.name = name.trim();
      if (color !== undefined) patch.color = color;
      const { error } = await sbFrom("crm_tags").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tags"] }),
    onError: (e: unknown) => toast.error((e as Error)?.message?.includes("duplicate") ? "Já existe uma etiqueta com esse nome." : "Erro ao salvar etiqueta."),
  });
}

// ── ETIQUETAS PADRÃO ──
// Um ponto de partida, não uma regra: a agência pode renomear, trocar a cor,
// excluir qualquer uma e criar as suas. Só evita a tela em branco.
export const DEFAULT_CRM_TAGS: { name: string; color: TagColor }[] = [
  { name: "VIP", color: "amber" },
  { name: "Recorrente", color: "emerald" },
  { name: "Projeto pontual", color: "sky" },
  { name: "Paga em dia", color: "green" },
  { name: "Inadimplente", color: "rose" },
  { name: "Renovação próxima", color: "orange" },
  { name: "Precisa de atenção", color: "violet" },
  { name: "Indicação", color: "slate" },
];

// Cria só as que ainda não existem (idempotente — clicar duas vezes não duplica).
export function useSeedDefaultCrmTags() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (existing: CrmTag[]) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const have = new Set(existing.map((t) => t.name.toLowerCase()));
      const rows = DEFAULT_CRM_TAGS
        .filter((t) => !have.has(t.name.toLowerCase()))
        .map((t) => ({ manager_id: agencyOwnerId, name: t.name, color: t.color }));
      if (!rows.length) return 0;
      const { error } = await sbFrom("crm_tags").insert(rows as never);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["crm-tags"] });
      if (n) toast.success(`${n} etiqueta(s) padrão criada(s). Edite ou exclua à vontade.`);
      else toast.info("As etiquetas padrão já estão todas aí.");
    },
    onError: () => toast.error("Erro ao criar as etiquetas padrão."),
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
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<CrmLead[]>({
    queryKey: ["crm-leads", agencyOwnerId], enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("crm_leads").select("*").eq("manager_id", agencyOwnerId!).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CrmLead[];
    },
  });
}
export function useCreateCrmLead() {
  const { agencyOwnerId } = useActiveAccount(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrmLeadInput): Promise<CrmLead> => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const { data, error } = await sbFrom("crm_leads").insert({ ...input, manager_id: agencyOwnerId } as never).select().single();
      if (error) throw error;
      return data as unknown as CrmLead;
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
    // Update OTIMISTA — é o que deixa o kanban fluido. Sem isso o card voltava
    // pra coluna original e só pulava depois do refetch (~2s de delay).
    onMutate: async ({ id, ...updates }: { id: string } & Partial<CrmLeadInput>) => {
      await qc.cancelQueries({ queryKey: ["crm-leads"] });
      const snapshot = qc.getQueriesData<CrmLead[]>({ queryKey: ["crm-leads"] });
      qc.setQueriesData<CrmLead[]>({ queryKey: ["crm-leads"] }, (old) =>
        Array.isArray(old) ? old.map((l) => (l.id === id ? { ...l, ...updates } as CrmLead : l)) : old);
      return { snapshot };
    },
    onError: (e: unknown, _v, ctx) => {
      const c = ctx as { snapshot?: [readonly unknown[], CrmLead[] | undefined][] } | undefined;
      c?.snapshot?.forEach(([key, data]) => qc.setQueryData(key, data)); // desfaz
      toast.error((e as Error)?.message ?? "Erro ao atualizar lead.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["crm-leads"], refetchType: "none" }),
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
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<CrmContract[]>({
    queryKey: ["crm-contracts", agencyOwnerId], enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("crm_contracts").select("*").eq("manager_id", agencyOwnerId!).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CrmContract[];
    },
  });
}
export function useCreateCrmContract() {
  const { agencyOwnerId } = useActiveAccount(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrmContractInput) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const { error } = await sbFrom("crm_contracts").insert({ ...input, manager_id: agencyOwnerId } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-contracts"] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao criar contrato."),
  });
}

export function useUploadCrmAsset() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ clientId, file, kind }: { clientId: string; file: File; kind: "avatar" | "font" }): Promise<string> => {
      if (!user?.id) throw new Error("Sem sessão");
      if (file.size > 5 * 1024 * 1024) throw new Error("Arquivo máx. 5MB.");
      if (kind === "avatar" && !file.type.startsWith("image/")) throw new Error("Selecione uma imagem.");
      if (kind === "font" && !/\.(ttf|otf|woff2?)$/i.test(file.name)) throw new Error("Use .ttf, .otf ou .woff.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${user.id}/${clientId}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("crm").upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("crm").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr) throw sErr;
      return signed.signedUrl;
    },
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao enviar arquivo."),
  });
}

// ===================== CONTRATOS: editar + apagar =====================
export function useUpdateCrmContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CrmContractInput>) => {
      const { error } = await sbFrom("crm_contracts").update(updates as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-contracts"] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao atualizar contrato."),
  });
}
export function useDeleteCrmContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("crm_contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-contracts"] }),
    onError: () => toast.error("Erro ao excluir contrato."),
  });
}

// ===================== TAREFAS DO CRM (crm_tasks) =====================
export const CRM_TASK_STATUSES = ["pendente", "em_andamento", "concluida"] as const;
export type CrmTaskStatus = typeof CRM_TASK_STATUSES[number];
export const CRM_TASK_PRIORITIES = ["baixa", "media", "alta", "urgente"] as const;
export type CrmTaskPriority = typeof CRM_TASK_PRIORITIES[number];
export const CRM_TASK_STATUS_LABELS: Record<CrmTaskStatus, string> = {
  pendente: "Pendentes", em_andamento: "Em andamento", concluida: "Concluídas",
};
export const CRM_TASK_PRIORITY_LABELS: Record<CrmTaskPriority, string> = {
  baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente",
};

export type CrmTask = {
  id: string; manager_id: string;
  crm_client_id: string | null; crm_lead_id: string | null;
  title: string; description: string | null;
  status: CrmTaskStatus; priority: CrmTaskPriority;
  due_date: string | null; created_at: string; updated_at: string;
};
export type CrmTaskInput = Partial<Omit<CrmTask, "id" | "manager_id" | "created_at" | "updated_at">> & { title: string };

export function useCrmTasks() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<CrmTask[]>({
    queryKey: ["crm-tasks", agencyOwnerId],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("crm_tasks")
        .select("*").eq("manager_id", agencyOwnerId!)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CrmTask[];
    },
  });
}
export function useCreateCrmTask() {
  const { agencyOwnerId } = useActiveAccount(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrmTaskInput) => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      const { error } = await sbFrom("crm_tasks").insert({ ...input, manager_id: agencyOwnerId } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tasks"] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao criar tarefa."),
  });
}
export function useUpdateCrmTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CrmTaskInput>) => {
      const { error } = await sbFrom("crm_tasks").update(updates as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tasks"] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao atualizar tarefa."),
  });
}
export function useDeleteCrmTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("crm_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tasks"] }),
    onError: () => toast.error("Erro ao excluir tarefa."),
  });
}
