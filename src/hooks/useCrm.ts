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

// A paleta de cor do cliente saiu daqui: era uma de TRÊS listas diferentes pro mesmo
// campo (7 cores aqui, 16 no Cria Post, a por família no cockpit), e por isso a cor
// escolhida num lugar não aparecia no outro. Agora existe uma só:
// BRAND_COLOR_FAMILIES (src/lib/brand-palette.ts), pelo componente compartilhado
// ClientColorPicker (src/components/shared/ClientColorPicker.tsx).

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
  color: string | null;
  segment: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  monthly_value: number | null;
  contract_date: string | null;
  renewal_date: string | null;
  // Data de encerramento do contrato (opcional). Coluna nova, ver SQL.
  contract_end_date: string | null;
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
  // Links úteis do cliente (pastas do Drive, etc.). Coluna jsonb nova, ver SQL.
  useful_links: { label: string; url: string }[] | null;
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
      // Teto generoso pra não puxar histórico infinito; cobre bem a carteira.
      const { data, error } = await sbFrom("crm_clients").select("*").eq("manager_id", agencyOwnerId!).is("deleted_at", null).order("created_at", { ascending: false }).limit(500);
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-clients", agencyOwnerId] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao salvar cliente."),
  });
}

export function useUpdateCrmClient() {
  const { agencyOwnerId } = useActiveAccount();
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
    // Cache já está certo, revalida a lista em background, sem travar a UI.
    onSettled: () => qc.invalidateQueries({ queryKey: ["crm-clients", agencyOwnerId], refetchType: "none" }),
  });
}

// Puxa o Brandbook/nome do cliente que usa o Cria pro CRM da agência (via edge, service role).
export function useSyncCrmFromCria() {
  const { agencyOwnerId } = useActiveAccount();
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
      qc.invalidateQueries({ queryKey: ["crm-clients", agencyOwnerId] });
    },
    // Sem onError a sincronizacao falhava em silencio. Padrao dos vizinhos: toast.error.
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao sincronizar com o Cria."),
  });
}

export function useDeleteCrmClient() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft-delete: vai pra Lixeira (recuperável por 30 dias).
      const { error } = await sbFrom("crm_clients").update({ deleted_at: new Date().toISOString() } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-clients", agencyOwnerId] }); toast.success("Cliente movido pra Lixeira (recuperável por 30 dias)."); },
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
      qc.invalidateQueries({ queryKey: ["crm-clients", agencyOwnerId] });
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tags", agencyOwnerId] }),
    onError: (e: unknown) => toast.error((e as Error)?.message?.includes("duplicate") ? "Já existe uma etiqueta com esse nome." : "Erro ao criar etiqueta."),
  });
}

export function useDeleteCrmTag() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("crm_tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tags", agencyOwnerId] }),
    onError: () => toast.error("Erro ao excluir etiqueta."),
  });
}

// Renomear / trocar a cor de uma etiqueta existente.
export function useUpdateCrmTag() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const patch: Record<string, string> = {};
      if (name !== undefined) patch.name = name.trim();
      if (color !== undefined) patch.color = color;
      const { error } = await sbFrom("crm_tags").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tags", agencyOwnerId] }),
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

// Cria só as que ainda não existem (idempotente, clicar duas vezes não duplica).
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
      qc.invalidateQueries({ queryKey: ["crm-tags", agencyOwnerId] });
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
  color: string | null;
  created_at: string; updated_at: string;
};
export type CrmLeadInput = Partial<Omit<CrmLead, "id" | "manager_id" | "created_at" | "updated_at">> & { name: string };

export function useCrmLeads() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<CrmLead[]>({
    queryKey: ["crm-leads", agencyOwnerId], enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("crm_leads").select("*").eq("manager_id", agencyOwnerId!).order("created_at", { ascending: false }).limit(500);
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-leads", agencyOwnerId] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao criar lead."),
  });
}
export function useUpdateCrmLead() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CrmLeadInput>) => {
      const { error } = await sbFrom("crm_leads").update(updates as never).eq("id", id);
      if (error) throw error;
    },
    // Update OTIMISTA, é o que deixa o kanban fluido. Sem isso o card voltava
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
    onSettled: () => qc.invalidateQueries({ queryKey: ["crm-leads", agencyOwnerId], refetchType: "none" }),
  });
}
export function useDeleteCrmLead() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await sbFrom("crm_leads").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-leads", agencyOwnerId] }),
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
      const { data, error } = await sbFrom("crm_contracts").select("*").eq("manager_id", agencyOwnerId!).order("created_at", { ascending: false }).limit(500);
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-contracts", agencyOwnerId] }),
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
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CrmContractInput>) => {
      const { error } = await sbFrom("crm_contracts").update(updates as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-contracts", agencyOwnerId] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao atualizar contrato."),
  });
}
export function useDeleteCrmContract() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("crm_contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-contracts", agencyOwnerId] }),
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
  // due_time: horário opcional (HH:MM) da tarefa. Coluna nova em crm_tasks (ver SQL).
  due_date: string | null; due_time: string | null; created_at: string; updated_at: string;
  // color: cor opcional (hex) da tarefa na agenda. Null = cor padrão. Coluna nova (ver SQL).
  color: string | null;
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
        .order("created_at", { ascending: false })
        .limit(500);
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tasks", agencyOwnerId] }),
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao criar tarefa."),
  });
}
export function useUpdateCrmTask() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CrmTaskInput>) => {
      const { error } = await sbFrom("crm_tasks").update(updates as never).eq("id", id);
      if (error) throw error;
    },
    // Update OTIMISTA: kanban/tarefas fluidos (o card fica onde soltou na hora,
    // sem voltar e pular depois do refetch).
    onMutate: async ({ id, ...updates }: { id: string } & Partial<CrmTaskInput>) => {
      await qc.cancelQueries({ queryKey: ["crm-tasks"] });
      const snapshot = qc.getQueriesData<CrmTask[]>({ queryKey: ["crm-tasks"] });
      qc.setQueriesData<CrmTask[]>({ queryKey: ["crm-tasks"] }, (old) =>
        Array.isArray(old) ? old.map((t) => (t.id === id ? { ...t, ...updates } as CrmTask : t)) : old);
      return { snapshot };
    },
    onError: (e: unknown, _v, ctx) => {
      const c = ctx as { snapshot?: [readonly unknown[], CrmTask[] | undefined][] } | undefined;
      c?.snapshot?.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error((e as Error)?.message ?? "Erro ao atualizar tarefa.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["crm-tasks", agencyOwnerId], refetchType: "none" }),
  });
}
export function useDeleteCrmTask() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("crm_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tasks", agencyOwnerId] }),
    onError: () => toast.error("Erro ao excluir tarefa."),
  });
}

// ===================== BLOCO DE NOTAS DO CLIENTE (crm_client_notes) =====================
// Várias notas por cliente (modelo Notas do iPhone), no lugar da nota única antiga.
// A nota pode estar presa ao cliente do CRM (crm_client_id) e/ou à conta CRIA
// gerenciada (account_owner_id). Quando o cliente do CRM tem conta CRIA vinculada,
// grava as duas pontas: a mesma nota aparece na ficha e na lista de contas.
export type CrmClientNote = {
  id: string;
  manager_id: string;
  crm_client_id: string | null;
  account_owner_id: string | null;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

/** De quem são as notas: cliente do CRM, conta CRIA gerenciada, ou os dois. */
export type ClientNotesScope = { crmClientId?: string | null; accountOwnerId?: string | null };

/** Chave estável da query. Cliente do CRM manda; sem ele, cai na conta CRIA. */
function notesScopeKey(scope: ClientNotesScope): string | null {
  if (scope.crmClientId) return `crm:${scope.crmClientId}`;
  if (scope.accountOwnerId) return `cria:${scope.accountOwnerId}`;
  return null;
}

/** Descobre o cliente do CRM de uma conta CRIA gerenciada (pra unificar as notas). */
export function useCrmClientIdByCriaOwner(criaOwnerId: string | null | undefined) {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<string | null>({
    queryKey: ["crm-client-by-cria-owner", agencyOwnerId, criaOwnerId ?? null],
    enabled: !!agencyOwnerId && !!criaOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("crm_clients")
        .select("id")
        .eq("manager_id", agencyOwnerId!)
        .eq("cria_owner_id", criaOwnerId!)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as { id: string } | null)?.id ?? null;
    },
  });
}

export function useClientNotes(scope: ClientNotesScope, enabled = true) {
  const key = notesScopeKey(scope);
  return useQuery<CrmClientNote[]>({
    queryKey: ["crm-client-notes", key],
    enabled: enabled && !!key,
    queryFn: async () => {
      const base = sbFrom("crm_client_notes").select("*");
      const q = scope.crmClientId
        ? base.eq("crm_client_id", scope.crmClientId)
        : base.eq("account_owner_id", scope.accountOwnerId!);
      const { data, error } = await q
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as CrmClientNote[];
    },
  });
}

export function useCreateClientNote(scope: ClientNotesScope) {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  const key = notesScopeKey(scope);
  return useMutation({
    mutationFn: async (input: { title?: string; body?: string } = {}): Promise<CrmClientNote> => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      if (!scope.crmClientId && !scope.accountOwnerId) throw new Error("Cliente não identificado");
      const { data, error } = await sbFrom("crm_client_notes")
        .insert({
          manager_id: agencyOwnerId,
          crm_client_id: scope.crmClientId ?? null,
          account_owner_id: scope.accountOwnerId ?? null,
          title: input.title ?? "",
          body: input.body ?? "",
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmClientNote;
    },
    // Coloca a nota nova no cache NA HORA: o editor abre em cima dela sem esperar
    // o refetch (senão a tela volta pra lista por uma fração de segundo).
    onSuccess: (nova) => {
      qc.setQueryData<CrmClientNote[]>(["crm-client-notes", key], (old) =>
        Array.isArray(old) ? [nova, ...old] : [nova]);
      qc.invalidateQueries({ queryKey: ["crm-client-notes", key] });
    },
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao criar a nota."),
  });
}

export function useUpdateClientNote(scope: ClientNotesScope) {
  const qc = useQueryClient();
  const key = notesScopeKey(scope);
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; body?: string; pinned?: boolean }) => {
      const { error } = await sbFrom("crm_client_notes").update(updates as never).eq("id", id);
      if (error) throw error;
    },
    // Update OTIMISTA: o autosave não pode fazer a lista piscar nem o texto voltar
    // enquanto a resposta não chega (mesmo padrão de crm_tasks/crm_leads).
    onMutate: async ({ id, ...updates }) => {
      await qc.cancelQueries({ queryKey: ["crm-client-notes", key] });
      const snapshot = qc.getQueriesData<CrmClientNote[]>({ queryKey: ["crm-client-notes", key] });
      // updated_at só muda quando o CONTEÚDO muda (igual ao trigger no banco):
      // fixar/desafixar não pode jogar a nota pro grupo "Hoje".
      const patch: Partial<CrmClientNote> = { ...updates };
      if (updates.title !== undefined || updates.body !== undefined) patch.updated_at = new Date().toISOString();
      qc.setQueriesData<CrmClientNote[]>({ queryKey: ["crm-client-notes", key] }, (old) =>
        Array.isArray(old) ? old.map((n) => (n.id === id ? ({ ...n, ...patch } as CrmClientNote) : n)) : old);
      return { snapshot };
    },
    onError: (e: unknown, _v, ctx) => {
      const c = ctx as { snapshot?: [readonly unknown[], CrmClientNote[] | undefined][] } | undefined;
      c?.snapshot?.forEach(([k, data]) => qc.setQueryData(k, data)); // desfaz
      toast.error((e as Error)?.message ?? "Erro ao salvar a nota.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["crm-client-notes", key], refetchType: "none" }),
  });
}

export function useDeleteClientNote(scope: ClientNotesScope) {
  const qc = useQueryClient();
  const key = notesScopeKey(scope);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("crm_client_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-client-notes", key] }),
    onError: () => toast.error("Erro ao excluir a nota."),
  });
}
