import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";

export type AdminProfile = {
  id: string;
  name: string;
  email?: string | null;
  niche: string | null;
  role: string | null;
  plan: string | null;
  platforms: string[] | null;
  weekly_goal: number | null;
  onboarding_completed: boolean | null;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
  avatar_url: string | null;
  instagram_handle: string | null;
  subscription_status: string | null;
  access_expires_at: string | null;
};

export type AdminStats = {
  totalUsers: number;
  activeUsers: number;
  admins: number;
  onboarded: number;
  byPlan: {
    free: number;
    pro: number;
    studio: number;
  };
};

export type AdminFilters = {
  page: number;
  pageSize: number;
  search?: string;
  planFilter?: string;
  roleFilter?: string;
};

const EMPTY_STATS: AdminStats = {
  totalUsers: 0,
  activeUsers: 0,
  admins: 0,
  onboarded: 0,
  byPlan: { free: 0, pro: 0, studio: 0 },
};

/* ═══════════════════════════════════════════════════════════════════════════
   OS NÚMEROS DA HOME DO ADMIN (Walter, 22/09/2026)

   Três RPCs novas (ver 20260922000001_painel_admin_metricas.sql). Leitura
   defensiva em todas: migration não rodada devolve null em vez de derrubar o
   painel inteiro, que é o padrão do resto do app.

   O que NÃO está aqui de propósito: MRR e churn em dinheiro. Isso continua
   vindo da edge admin-billing, que lê o Stripe direto. Calcular dinheiro a
   partir do espelho local seria inventar número.
   ═══════════════════════════════════════════════════════════════════════════ */
export type AdminResumo = {
  contas: { total: number; social_midia: number; criadoras: number; parceiros: number; clientes_de_agencia: number };
  novos: { d7: number; d30: number; mes_atual: number; mes_passado_ate_hoje: number };
  ativos: { d1: number; d7: number; d30: number };
  ativacao: { entraram: number; onboarding: number; voltaram: number; produziram: number };
  planos: { free: number; pro: number; studio: number; agency: number };
  trial: { em_trial: number; vence_7d: number };
  assinatura: { ativas: number; suspensas: number };
  producao: { posts_30d: number; publicados_30d: number; clientes_crm: number };
};

export type ContaEmAtencao = {
  id: string; nome: string | null; plano?: string | null; tipo?: string | null;
  dias?: number; usados?: number; teto?: number; erros?: number; ultimo?: string | null;
};
export type AdminAtencao = {
  travados: ContaEmAtencao[];
  sumidos: ContaEmAtencao[];
  trial_vencendo: ContaEmAtencao[];
  no_teto: ContaEmAtencao[];
  com_erro: ContaEmAtencao[];
};

export type AdminCustoIa = {
  dias: number;
  radar: { scrapes: number; custo_usd: number };
  imagens_estudio: number;
  chamadas_ia: number;
  top_contas: { id: string; nome: string | null; plano: string | null; scrapes: number; custo_usd: number }[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpcAny = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as any)(fn, args);
const faltaNoBanco = (m: string) => /does not exist|schema cache|could not find/i.test(m ?? "");

function usePainelRpc<T>(chave: string, fn: string, args?: Record<string, unknown>) {
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";
  return useQuery<T | null>({
    queryKey: [chave, args ?? {}],
    enabled: isAdmin,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await rpcAny(fn, args);
      if (error) {
        if (faltaNoBanco(error.message)) return null;
        throw error;
      }
      return (data ?? null) as T | null;
    },
  });
}

export const useAdminResumo = () => usePainelRpc<AdminResumo>("admin-resumo", "painel_admin_resumo");
export const useAdminAtencao = () => usePainelRpc<AdminAtencao>("admin-atencao", "painel_admin_atencao");
export const useAdminCustoIa = (dias = 30) =>
  usePainelRpc<AdminCustoIa>("admin-custo-ia", "painel_admin_custo_ia", { _dias: dias });

export function useAdmin(filters: AdminFilters) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin";

  const statsQuery = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_stats");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return EMPTY_STATS;
      return {
        totalUsers: Number(row.total_users ?? 0),
        activeUsers: Number(row.active_users_7d ?? 0),
        admins: Number(row.admins ?? 0),
        onboarded: Number(row.onboarded ?? 0),
        byPlan: {
          free: Number(row.plan_free ?? 0),
          pro: Number(row.plan_pro ?? 0),
          studio: Number(row.plan_studio ?? 0),
        },
      };
    },
  });

  const usersQuery = useQuery<{ rows: AdminProfile[]; count: number }>({
    queryKey: ["admin-users", filters],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const from = filters.page * filters.pageSize;
      const to = from + filters.pageSize - 1;

      let q = supabase
        .from("profiles")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (filters.search && filters.search.trim().length > 0) {
        q = q.ilike("name", `%${filters.search.trim()}%`);
      }
      if (filters.planFilter && filters.planFilter !== "todos") {
        q = q.eq("plan", filters.planFilter);
      }
      if (filters.roleFilter && filters.roleFilter !== "todos") {
        q = q.eq("role", filters.roleFilter);
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return {
        rows: (data ?? []) as unknown as AdminProfile[],
        count: count ?? 0,
      };
    },
  });

  const updateUserRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role } as never)
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  const updateUserPlan = useMutation({
    mutationFn: async ({ userId, plan }: { userId: string; plan: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ plan } as never)
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  // Emails (vêm do auth, não do profiles), busca em lote via edge function
  const userIds = (usersQuery.data?.rows ?? []).map((r) => r.id);
  const emailsQuery = useQuery<Record<string, string>>({
    queryKey: ["admin-emails", userIds],
    enabled: !!user && isAdmin && userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-user-actions", {
        body: { action: "get_emails", user_ids: userIds },
      });
      if (error) throw error;
      return ((data as { emails?: Record<string, string> })?.emails) ?? {};
    },
  });

  // Ações de admin (excluir, suspender, reativar, validade, reenviar acesso)
  const runAction = useMutation({
    mutationFn: async (input: { user_id: string; action: string; validity?: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-user-actions", { body: input });
      if (error) throw error;
      const err = (data as { error?: string })?.error;
      if (err) throw new Error(err);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-emails"] });
    },
  });

  return {
    users: usersQuery.data?.rows ?? [],
    totalCount: usersQuery.data?.count ?? 0,
    stats: statsQuery.data ?? EMPTY_STATS,
    emails: emailsQuery.data ?? {},
    isLoading: usersQuery.isLoading || statsQuery.isLoading,
    error: usersQuery.error ?? statsQuery.error,
    isAdmin,
    updateUserRole,
    updateUserPlan,
    runAction,
  };
}
