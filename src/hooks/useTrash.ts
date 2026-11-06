import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export type TrashKind = "post" | "client";
/** detalhe: a linha cinza do item (formato do post, "cliente da carteira"). */
export type TrashRow = { id: string; label: string; deleted_at: string; kind: TrashKind; detalhe?: string };

const FORMATO: Record<string, string> = {
  carrossel: "Carrossel", carousel: "Carrossel", reels: "Reels", reel: "Reels", story: "Story", stories: "Story",
  estatico: "Estático", static: "Estático", post: "Post", foto: "Foto", video: "Vídeo", youtube: "YouTube",
};

// Posts na lixeira (conta ativa).
export function useTrashedPosts() {
  const { activeAccountId } = useActiveAccount();
  const userId = activeAccountId;
  return useQuery<TrashRow[]>({
    queryKey: ["trash-posts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("posts")
        .select("id, title, deleted_at, format, platform")
        .eq("user_id", userId!).not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as { id: string; title: string | null; deleted_at: string; format: string | null; platform: string | null }[])
        .map((p) => ({
          id: p.id, label: p.title || "Post sem título", deleted_at: p.deleted_at, kind: "post" as const,
          detalhe: [p.format ? FORMATO[p.format.toLowerCase()] ?? p.format : null, p.platform].filter(Boolean).join(" · ") || "Post",
        }));
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
        .map((c) => ({ id: c.id, label: c.name || "Cliente", deleted_at: c.deleted_at, kind: "client" as const, detalhe: "cliente da carteira" }));
    },
  });
}

function table(kind: TrashKind) { return kind === "post" ? "posts" : "crm_clients"; }

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

/* EM LOTE (Walter, 07/11/2026, mockup aprovado). Um update por tipo, não um
   por item: dez itens viram no máximo duas chamadas e um aviso só. */
type Lote = { id: string; kind: TrashKind }[];
function porTipo(itens: Lote) {
  const m = new Map<TrashKind, string[]>();
  for (const i of itens) m.set(i.kind, [...(m.get(i.kind) ?? []), i.id]);
  return [...m.entries()];
}
function invalidar(qc: ReturnType<typeof useQueryClient>, itens: Lote, tambemListas: boolean) {
  const tipos = new Set(itens.map((i) => i.kind));
  if (tipos.has("post")) { qc.invalidateQueries({ queryKey: ["trash-posts"] }); if (tambemListas) qc.invalidateQueries({ queryKey: ["posts"] }); }
  if (tipos.has("client")) { qc.invalidateQueries({ queryKey: ["trash-clients"] }); if (tambemListas) qc.invalidateQueries({ queryKey: ["crm-clients"] }); }
}

export function useRestoreMany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itens: Lote) => {
      for (const [kind, ids] of porTipo(itens)) {
        const { error } = await sbFrom(table(kind)).update({ deleted_at: null } as never).in("id", ids);
        if (error) throw error;
      }
    },
    onSuccess: (_d, itens) => { invalidar(qc, itens, true); toast.success(itens.length === 1 ? "Restaurado!" : `${itens.length} itens restaurados.`); },
    onError: () => toast.error("Não consegui restaurar."),
  });
}

export function usePurgeMany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itens: Lote) => {
      for (const [kind, ids] of porTipo(itens)) {
        const { error } = await sbFrom(table(kind)).delete().in("id", ids);
        if (error) throw error;
      }
    },
    onSuccess: (_d, itens) => { invalidar(qc, itens, false); toast.success(itens.length === 1 ? "Excluído de vez." : `${itens.length} itens excluídos de vez.`); },
    onError: () => toast.error("Não consegui excluir."),
  });
}
