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
  avatar_url: string | null;
  instagram_handle: string | null;
};

type AdminUserStats = {
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

export function useAdmin() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin";

  const { data: users = [], isLoading, error } = useQuery<AdminProfile[]>({
    queryKey: ["admin-users"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (queryError) throw queryError;
      return (data ?? []) as unknown as AdminProfile[];
    },
  });

  const updateUserRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ role } as never)
        .eq("id", userId);
      if (updateError) throw updateError;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const updateUserPlan = useMutation({
    mutationFn: async ({ userId, plan }: { userId: string; plan: string }) => {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ plan } as never)
        .eq("id", userId);
      if (updateError) throw updateError;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const stats: AdminUserStats = {
    totalUsers: users.length,
    activeUsers: users.filter((u) => {
      if (!u.updated_at) return false;
      try {
        return new Date(u.updated_at) > sevenDaysAgo;
      } catch {
        return false;
      }
    }).length,
    admins: users.filter((u) => u.role === "admin").length,
    onboarded: users.filter((u) => u.onboarding_completed).length,
    byPlan: {
      free: users.filter((u) => !u.plan || u.plan === "free").length,
      pro: users.filter((u) => u.plan === "pro").length,
      premium: users.filter((u) => u.plan === "premium").length,
    },
  };

  return { users, isLoading, error, isAdmin, stats, updateUserRole, updateUserPlan };
}
