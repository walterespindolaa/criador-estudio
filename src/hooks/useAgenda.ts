import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type Creation = {
  id: string;
  manager_id: string;
  day: string;
  crm_client_id: string | null;
  client_name: string | null;
  team: string | null;
  note: string | null;
  created_at: string;
};

export type Capture = {
  id: string;
  manager_id: string;
  capture_date: string;
  capture_time: string | null;
  location: string | null;
  crm_client_id: string | null;
  client_name: string | null;
  team: string | null;
  status: "agendada" | "concluida" | "cancelada";
  note: string | null;
  created_at: string;
};

// Nomes dos colaboradores ativos da agência (pra sugerir no campo Equipe). Vazio até ter colaborador.
export function useCollaboratorNames() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<string[]>({
    queryKey: ["collab-names", agencyOwnerId],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("manager_members")
        .select("name").eq("manager_id", agencyOwnerId!).eq("status", "ativo");
      if (error) return [];
      return ((data ?? []) as { name: string | null }[]).map((m) => m.name).filter((n): n is string => !!n && n.trim().length > 0);
    },
  });
}

export function useCreations(fromDate: string, toDate: string) {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<Creation[]>({
    queryKey: ["agenda-creations", agencyOwnerId, fromDate, toDate],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("agenda_creations")
        .select("*").eq("manager_id", agencyOwnerId!)
        .gte("day", fromDate).lte("day", toDate)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Creation[];
    },
  });
}

export function useAddCreation() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { day: string; crm_client_id?: string | null; client_name?: string | null; team?: string | null; note?: string | null }) => {
      if (!agencyOwnerId) throw new Error("Not authenticated");
      const { error } = await sbFrom("agenda_creations").insert({
        manager_id: agencyOwnerId, day: input.day,
        crm_client_id: input.crm_client_id ?? null, client_name: input.client_name ?? null, team: input.team ?? null, note: input.note ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda-creations"] }),
    onError: () => toast.error("Não consegui adicionar."),
  });
}

export function useUpdateCreation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<Creation, "day" | "team" | "note" | "crm_client_id" | "client_name">> }) => {
      const { error } = await sbFrom("agenda_creations").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda-creations"] }),
  });
}

export function useDeleteCreation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("agenda_creations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda-creations"] }),
    onError: () => toast.error("Não consegui remover."),
  });
}

// Ordem manual por DIA da grade da agenda (Tarefa: reordenar dentro do dia). Guarda um
// array de chaves "<kind>:<id>" que sobrepõe a ordem por horário. Chaveado por (manager_id, day).
export function useDayOrders(fromDate: string, toDate: string) {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<Record<string, string[]>>({
    queryKey: ["agenda-day-order", agencyOwnerId, fromDate, toDate],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("agenda_day_order")
        .select("day, item_order").eq("manager_id", agencyOwnerId!)
        .gte("day", fromDate).lte("day", toDate);
      if (error) throw error;
      const m: Record<string, string[]> = {};
      for (const row of (data ?? []) as unknown as { day: string; item_order: string[] | null }[]) {
        m[row.day] = Array.isArray(row.item_order) ? row.item_order : [];
      }
      return m;
    },
  });
}

// Persiste (upsert) a ordem manual de um dia. Otimista fica a cargo de quem chama (a grade
// atualiza o cache no drop pra o card não "voltar" pro lugar).
export function useSaveDayOrder() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ day, order }: { day: string; order: string[] }) => {
      if (!agencyOwnerId) throw new Error("Not authenticated");
      const { error } = await sbFrom("agenda_day_order").upsert({
        manager_id: agencyOwnerId, day, item_order: order, updated_at: new Date().toISOString(),
      } as never, { onConflict: "manager_id,day" });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["agenda-day-order"] }),
    onError: () => toast.error("Não consegui salvar a ordem."),
  });
}

export function useCaptures() {
  const { agencyOwnerId } = useActiveAccount();
  return useQuery<Capture[]>({
    queryKey: ["agenda-captures", agencyOwnerId],
    enabled: !!agencyOwnerId,
    queryFn: async () => {
      const { data, error } = await sbFrom("agenda_captures")
        .select("*").eq("manager_id", agencyOwnerId!)
        .order("capture_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Capture[];
    },
  });
}

export function useAddCapture() {
  const { agencyOwnerId } = useActiveAccount();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { capture_date: string; capture_time?: string | null; location?: string | null; crm_client_id?: string | null; client_name?: string | null; team?: string | null; note?: string | null }) => {
      if (!agencyOwnerId) throw new Error("Not authenticated");
      const { error } = await sbFrom("agenda_captures").insert({
        manager_id: agencyOwnerId, status: "agendada", ...input,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agenda-captures"] }); toast.success("Captação agendada."); },
    onError: () => toast.error("Não consegui agendar."),
  });
}

export function useUpdateCapture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<Capture, "status" | "capture_date" | "capture_time" | "location" | "team" | "note" | "crm_client_id" | "client_name">> }) => {
      const { error } = await sbFrom("agenda_captures").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda-captures"] }),
  });
}

export function useDeleteCapture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("agenda_captures").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda-captures"] }),
    onError: () => toast.error("Não consegui excluir."),
  });
}
