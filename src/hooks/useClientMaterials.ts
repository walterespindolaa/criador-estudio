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

// Anexo de um material: arquivo subido pro Storage ("file") ou link colado do
// Drive ("drive"). Fica guardado na coluna jsonb attachments (já existente).
export type MaterialAttachment = {
  kind: "file" | "drive";
  name: string;
  url: string;
  path?: string | null; // caminho no bucket (só pra "file")
  type?: string | null; // mime (só pra "file")
  size?: number | null; // bytes (só pra "file")
};

export type ClientMaterial = {
  id: string;
  manager_id: string;
  crm_client_id: string | null;
  external_client_id: string | null;
  title: string;
  // Reaproveitado como BRIEFING do material (especificações, medidas, instruções).
  description: string | null;
  kind: MaterialKind;
  status: MaterialStatus;
  requested_by: MaterialOrigin;
  due_date: string | null;
  attachments: MaterialAttachment[] | null;
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
  attachments?: MaterialAttachment[] | null;
};

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

// Nome de arquivo seguro pro caminho no Storage (sem acento/espaço/símbolo).
// Mesmo padrão do useCriaPostMedia.
function sanitizeStoragePath(name: string): string {
  const lastDot = name.lastIndexOf(".");
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot) : "";
  const clean = base
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "file";
  return `${clean}${ext.toLowerCase()}`;
}

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

  // Criar/editar material mexe no PRAZO, e prazo agora aparece na Agenda: invalida também
  // a query dos materiais da agenda pra o card nascer/sumir de lá na hora.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["manager-materials-agenda", agencyOwnerId] });
  };
  // Alem do quadro do cliente, atuar num material (mudar status / excluir) precisa
  // baixar o contador da Central de Aprovacoes do gestor. Sem isto, aprovar/mexer num
  // material que o cliente pediu nao atualizava a fila ["manager-pending-materials"].
  const invalidateWithPending = () => {
    invalidate();
    qc.invalidateQueries({ queryKey: ["manager-pending-materials", agencyOwnerId] });
  };

  const createMaterial = useMutation({
    mutationFn: async (input: MaterialInput): Promise<ClientMaterial> => {
      if (!agencyOwnerId) throw new Error("Sem sessão");
      if (!crmClientId) throw new Error("Cliente inválido");
      const { data, error } = await sbFrom("client_materials")
        .insert({
          title: input.title,
          description: input.description ?? null,
          // O tipo saiu da UI do gestor; mantemos o default do banco pra não quebrar
          // o portal do cliente, que ainda usa kind.
          kind: input.kind ?? "arte_avulsa",
          status: input.status ?? "a_fazer",
          due_date: input.due_date ?? null,
          attachments: input.attachments ?? [],
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

  // Sobe um arquivo (pdf, imagem, vídeo…) DIRETO pro Storage e devolve o anexo
  // pronto pra guardar no material. Mesmo bucket "media" do Cria Post; caminho
  // separado por dono/cliente. Sem compressão: material pode ser qualquer formato.
  const uploadAttachment = async (file: File): Promise<MaterialAttachment> => {
    if (!agencyOwnerId) throw new Error("Sessão expirada. Entre de novo.");
    const safe = sanitizeStoragePath(file.name);
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const path = `${agencyOwnerId}/materials/${crmClientId ?? "geral"}/${stamp}-${safe}`;
    const { error } = await supabase.storage.from("media").upload(path, file, {
      upsert: true, contentType: file.type || "application/octet-stream",
    });
    if (error) throw new Error(error.message || "Não consegui subir o arquivo.");
    const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    return { kind: "file", name: file.name, url, path, type: file.type || null, size: file.size ?? null };
  };

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
    onSettled: invalidateWithPending,
  });

  const deleteMaterial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("client_materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateWithPending,
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao excluir."),
  });

  return {
    materials: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    uploadAttachment,
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

// ── MATERIAIS NA AGENDA ──────────────────────────────────────────────────────
// A Agenda precisa dos materiais COM PRAZO (due_date) de TODOS os clientes do gestor.
// Nenhum dos hooks acima servia: useClientMaterials é de UM cliente só (e nem roda sem
// crmClientId), e useManagerPendingMaterials só traz o que o CLIENTE pediu e ainda está
// em "solicitado" (a fila de aprovação), sem due_date. Então aqui vai um terceiro,
// no mesmo padrão: react-query, chave com agencyOwnerId, RLS cuidando do resto.
export type AgendaMaterial = Pick<ClientMaterial, "id" | "crm_client_id" | "title" | "description" | "status" | "requested_by" | "due_date">;
const AGENDA_MATERIALS_KEY = "manager-materials-agenda";

export function useManagerMaterialsWithDue() {
  const { agencyOwnerId } = useActiveAccount();
  const query = useQuery<AgendaMaterial[]>({
    queryKey: [AGENDA_MATERIALS_KEY, agencyOwnerId],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("client_materials")
        .select("id, crm_client_id, title, description, status, requested_by, due_date")
        .eq("manager_id", agencyOwnerId!)
        .not("due_date", "is", null)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AgendaMaterial[];
    },
  });
  return { materials: query.data ?? [], isLoading: query.isLoading, isError: query.isError };
}

// Mexer num material DIRETO da agenda: arrastar pra outro dia (due_date) ou dar o check
// (status finalizado / a fazer). Otimista no cache da agenda; ao final invalida também o
// quadro do cliente e a fila de aprovações, que leem a mesma tabela.
export function useUpdateAgendaMaterial() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<ClientMaterial, "due_date" | "status">> }) => {
      const { error } = await sbFrom("client_materials").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      const key = [AGENDA_MATERIALS_KEY, agencyOwnerId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<AgendaMaterial[]>(key);
      qc.setQueryData<AgendaMaterial[]>(key, (old) =>
        Array.isArray(old) ? old.map((m) => (m.id === id ? { ...m, ...patch } : m)) : old);
      return { prev };
    },
    onError: (e: unknown, _v, ctx) => {
      const c = ctx as { prev?: AgendaMaterial[] } | undefined;
      if (c?.prev) qc.setQueryData([AGENDA_MATERIALS_KEY, agencyOwnerId], c.prev);
      toast.error((e as Error)?.message ?? "Não consegui mover o material.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [AGENDA_MATERIALS_KEY, agencyOwnerId] });
      qc.invalidateQueries({ queryKey: ["client-materials"] });
      qc.invalidateQueries({ queryKey: ["manager-pending-materials", agencyOwnerId] });
    },
  });
}
