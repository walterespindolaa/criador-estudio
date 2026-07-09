import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Tabelas de time não estão no types.ts — cast (igual useCrm/useHubCria).
type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

export const TEAM_MODULES = [
  { code: "cria_gestao", label: "Gestão de clientes (CRM)" },
  { code: "cria_post", label: "Cria Post (posts + aprovação)" },
  { code: "hub_cria", label: "HUB Criativo (análises)" },
  { code: "agenda", label: "Agenda de criação" },
] as const;
export type TeamModuleCode = (typeof TEAM_MODULES)[number]["code"];

export type MemberPermission = {
  id: string; member_row_id: string; module_code: string; all_clients: boolean; client_ids: string[];
};
export type TeamMember = {
  id: string; manager_id: string; member_id: string; name: string | null; email: string | null;
  status: "ativo" | "pausado"; created_at: string;
  permissions: MemberPermission[];
};

// Assentos: 1 grátis + paid_collab_seats.
export function useCollabSeats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["collab-seats", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("paid_collab_seats").eq("id", user!.id).maybeSingle();
      const paid = Math.max(0, Number((data as { paid_collab_seats?: number } | null)?.paid_collab_seats) || 0);
      return { paid, total: 1 + paid };
    },
  });
}

// Permissões do colaborador logado sob o gestor ativo (p/ gate de módulo na UI).
// Retorna o conjunto de module_codes liberados. null = ainda carregando / não é colaborador.
export function useMyTeamPermissions(managerId: string | null | undefined) {
  return useQuery<Set<string>>({
    queryKey: ["my-team-perms", managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
        "my_member_permissions", { target: managerId },
      );
      if (error) throw error;
      const rows = (data ?? []) as { module_code: string }[];
      return new Set(rows.map((r) => r.module_code));
    },
  });
}

export function useTeamMembers() {
  const { user } = useAuth();
  return useQuery<TeamMember[]>({
    queryKey: ["team-members", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: members, error } = await sbFrom("manager_members")
        .select("*").eq("manager_id", user!.id).order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (members ?? []) as unknown as TeamMember[];
      if (rows.length === 0) return [];
      const ids = rows.map((r) => r.id);
      const { data: perms } = await sbFrom("manager_member_permissions").select("*").in("member_row_id", ids);
      const byRow = new Map<string, MemberPermission[]>();
      for (const p of (perms ?? []) as unknown as MemberPermission[]) {
        const arr = byRow.get(p.member_row_id) ?? []; arr.push(p); byRow.set(p.member_row_id, arr);
      }
      return rows.map((r) => ({ ...r, permissions: byRow.get(r.id) ?? [] }));
    },
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; name?: string; modules?: string[] }) => {
      const { data, error } = await supabase.functions.invoke("manager-member-invite", { body: input });
      if (error) throw new Error(error.message);
      const err = (data as { error?: string })?.error;
      if (err === "no_seats") throw new Error("Você atingiu o limite de assentos. Adicione um assento pra convidar mais colaboradores.");
      if (err) throw new Error(err);
      return data as { ok: boolean; member_id: string; existed: boolean };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team-members"] }); toast.success("Convite enviado."); },
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao convidar."),
  });
}

export function useUpdateMemberStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "ativo" | "pausado" }) => {
      const { error } = await sbFrom("manager_members").update({ status } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-members"] }),
    onError: () => toast.error("Erro ao atualizar colaborador."),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbFrom("manager_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team-members"] }); toast.success("Colaborador removido."); },
    onError: () => toast.error("Erro ao remover."),
  });
}

// Liga/desliga um módulo para um membro (all_clients por padrão nesta fase).
export function useSetMemberModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberRowId, moduleCode, enabled }: { memberRowId: string; moduleCode: string; enabled: boolean }) => {
      if (enabled) {
        const { error } = await sbFrom("manager_member_permissions").upsert(
          { member_row_id: memberRowId, module_code: moduleCode, all_clients: true, client_ids: [] } as never,
          { onConflict: "member_row_id,module_code" } as never,
        );
        if (error) throw error;
      } else {
        const { error } = await sbFrom("manager_member_permissions")
          .delete().eq("member_row_id", memberRowId).eq("module_code", moduleCode);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-members"] }),
    onError: () => toast.error("Erro ao salvar permissão."),
  });
}

export function useBuySeats() {
  return useMutation({
    mutationFn: async (seats: number) => {
      const { data, error } = await supabase.functions.invoke("collab-seats-checkout", { body: { seats } });
      if (error) throw new Error(error.message);
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error("checkout_failed");
      window.location.href = url;
    },
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao abrir o checkout."),
  });
}
