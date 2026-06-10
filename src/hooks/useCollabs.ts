import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type CollabStatus = "lead" | "negociando" | "fechado" | "entregue" | "pago";
export const COLLAB_STATUSES: CollabStatus[] = ["lead", "negociando", "fechado", "entregue", "pago"];
export const COLLAB_STATUS_LABEL: Record<CollabStatus, string> = {
  lead: "Lead", negociando: "Negociando", fechado: "Fechado", entregue: "Entregue", pago: "Pago",
};

export type Collab = {
  id: string;
  user_id: string;
  brand: string;
  contact: string | null;
  value: number | null;
  status: CollabStatus;
  deadline: string | null;
  objective: string | null;
  briefing_url: string | null;
  notes: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type CollabDeliverable = {
  id: string;
  collab_id: string;
  user_id: string;
  label: string;
  format: string | null;
  published: boolean;
  published_at: string | null;
  post_id: string | null;
  sort_order: number;
  created_at: string;
};

export type CollabWithDeliverables = Collab & {
  deliverables: CollabDeliverable[];
  total: number;
  done: number;
};

export type CollabInput = {
  brand: string;
  contact?: string | null;
  value?: number | null;
  status?: CollabStatus;
  deadline?: string | null;
  objective?: string | null;
  briefing_url?: string | null;
  notes?: string | null;
};

export type DeliverableInput = {
  collab_id: string;
  label: string;
  format?: string | null;
  sort_order?: number;
};

// types.ts não tem collabs/collab_deliverables — cast (padrão useBioLeads/usePartner).
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export function useCollabs() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["collabs"] });

  const query = useQuery({
    queryKey: ["collabs", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<CollabWithDeliverables[]> => {
      const [c, d] = await Promise.all([
        sbFrom("collabs").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
        sbFrom("collab_deliverables").select("*").eq("user_id", user!.id).order("sort_order", { ascending: true }),
      ]);
      if (c.error) throw c.error;
      if (d.error) throw d.error;
      const collabs = (c.data ?? []) as Collab[];
      const delivs = (d.data ?? []) as CollabDeliverable[];
      return collabs.map((col) => {
        const ds = delivs.filter((x) => x.collab_id === col.id);
        return { ...col, deliverables: ds, total: ds.length, done: ds.filter((x) => x.published).length };
      });
    },
  });

  const createCollab = useMutation({
    mutationFn: async (input: CollabInput) => {
      if (!user) throw new Error("no user");
      const { data, error } = await sbFrom("collabs")
        .insert({ ...input, user_id: user.id } as never)
        .select().single();
      if (error) throw error;
      return data as Collab;
    },
    onSuccess: () => { invalidate(); toast.success("Collab criada."); },
    onError: () => toast.error("Erro ao criar collab."),
  });

  const updateCollab = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Collab> & { id: string }) => {
      const { error } = await sbFrom("collabs")
        .update({ ...updates, updated_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Collab atualizada."); },
    onError: () => toast.error("Erro ao atualizar."),
  });

  const deleteCollab = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("collabs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Collab excluída."); },
    onError: () => toast.error("Erro ao excluir."),
  });

  const createDeliverable = useMutation({
    mutationFn: async (input: DeliverableInput) => {
      if (!user) throw new Error("no user");
      const { error } = await sbFrom("collab_deliverables").insert({ ...input, user_id: user.id } as never);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error("Erro ao adicionar entregável."),
  });

  const updateDeliverable = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CollabDeliverable> & { id: string }) => {
      const { error } = await sbFrom("collab_deliverables").update(updates as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error("Erro ao atualizar entregável."),
  });

  const togglePublished = useMutation({
    mutationFn: async ({ id, published }: { id: string; published: boolean }) => {
      const { error } = await sbFrom("collab_deliverables")
        .update({ published, published_at: published ? new Date().toISOString() : null } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error("Erro ao marcar entregável."),
  });

  const deleteDeliverable = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("collab_deliverables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error("Erro ao remover entregável."),
  });

  return {
    collabs: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createCollab, updateCollab, deleteCollab,
    createDeliverable, updateDeliverable, togglePublished, deleteDeliverable,
  };
}

// ---------- Lembretes (derivados) ----------
export type CollabReminder = {
  id: string;
  kind: "atrasado" | "pendente" | "objetivo";
  collab: CollabWithDeliverables;
  title: string;
  meta: string;
};

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function formatBR(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function collabReminders(list: CollabWithDeliverables[]): CollabReminder[] {
  const out: CollabReminder[] = [];
  for (const c of list) {
    if (c.archived) continue;
    const pending = c.total - c.done;

    if (c.total > 0 && pending === 0 && c.status !== "pago") {
      out.push({ id: c.id + "-obj", kind: "objetivo", collab: c,
        title: `${c.brand} — objetivo atingido`,
        meta: `${c.done}/${c.total} publicações feitas · hora de enviar o relatório e cobrar` });
      continue;
    }
    if (pending > 0 && c.deadline) {
      const dd = daysUntil(c.deadline);
      if (dd < 0) {
        out.push({ id: c.id + "-late", kind: "atrasado", collab: c,
          title: `${c.brand} — ${pending} ${pending === 1 ? "entrega atrasada" : "entregas atrasadas"}`,
          meta: `Venceu em ${formatBR(c.deadline)} · ${c.done}/${c.total} feitas` });
      } else if (dd <= 5) {
        out.push({ id: c.id + "-soon", kind: "pendente", collab: c,
          title: `${c.brand} — faltam ${pending} ${pending === 1 ? "publicação" : "publicações"}`,
          meta: `Prazo ${dd === 0 ? "hoje" : `em ${dd} ${dd === 1 ? "dia" : "dias"}`} (${formatBR(c.deadline)}) · ${c.done}/${c.total} feitas` });
      }
    }
  }
  const rank = { atrasado: 0, pendente: 1, objetivo: 2 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
}
