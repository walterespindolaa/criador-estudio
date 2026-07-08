import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type TrashRow = { id: string; label: string; deleted_at: string; kind: "post" | "client" };

// Posts na lixeira (conta ativa).
export function useTrashedPosts() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  return useQuery<TrashRow[]>({
    queryKey: ["trash-posts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("posts")
        .select("id, title, deleted_at")
        .eq("user_id", userId!).not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as { id: string; title: string | null; deleted_at: string }[])
        .map((p) => ({ id: p.id, label: p.title || "Post sem título", deleted_at: p.deleted_at, kind: "post" as const }));
    },
  });
}

// Clientes na lixeira (do gestor).
export function useTrashedClients() {
  const { user } = useAuth();
  return useQuery<TrashRow[]>({
    queryKey: ["trash-clients", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await sbFrom("crm_clients")
        .select("id, name, deleted_at")
        .eq("manager_id", user!.id).not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as { id: string; name: string | null; deleted_at: string }[])
        .map((c) => ({ id: c.id, label: c.name || "Cliente", deleted_at: c.deleted_at, kind: "client" as const }));
    },
  });
}

function table(kind: "post" | "client") { return kind === "post" ? "posts" : "crm_clients"; }

export function useRestoreTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: "post" | "client" }) => {
      const { error } = await sbFrom(table(kind)).update({ deleted_at: null } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: [v.kind === "post" ? "trash-posts" : "trash-clients"] });
      qc.invalidateQueries({ queryKey: [v.kind === "post" ? "posts" : "crm-clients"] });
      toast.success("Restaurado!");
    },
    onError: () => toast.error("Não consegui restaurar."),
  });
}

export function usePurgeTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: "post" | "client" }) => {
      const { error } = await sbFrom(table(kind)).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: [v.kind === "post" ? "trash-posts" : "trash-clients"] }); toast.success("Excluído de vez."); },
    onError: () => toast.error("Não consegui excluir."),
  });
}
