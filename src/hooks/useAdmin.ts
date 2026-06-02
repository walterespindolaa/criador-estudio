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
    premium: number;
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
  byPlan: { free: 0, pro: 0, premium: 0 },
};

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
          premium: Number(row.plan_premium ?? 0),
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

  return {
    users: usersQuery.data?.rows ?? [],
    totalCount: usersQuery.data?.count ?? 0,
    stats: statsQuery.data ?? EMPTY_STATS,
    isLoading: usersQuery.isLoading || statsQuery.isLoading,
    error: usersQuery.error ?? statsQuery.error,
    isAdmin,
    updateUserRole,
    updateUserPlan,
  };
}
