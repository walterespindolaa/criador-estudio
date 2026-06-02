import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useProfile, type Profile } from "@/hooks/useProfile";

/**
 * Subset PÚBLICO do profile usado em telas de conteúdo (Dashboard, Tarefas,
 * Brandbook, Relatorios, Arquivos). NÃO inclui billing/gate
 * (subscription_status, plan, access_expires_at, role) — esses são da SESSÃO
 * e continuam vindo de useProfile() onde a tela faz gate.
 */
export type ActiveProfile = Pick<
  Profile,
  "id" | "name" | "avatar_url" | "niche" | "instagram_handle" | "bio" | "weekly_goal" | "role"
>;

export type UseActiveProfileResult = {
  profile: ActiveProfile | null;
  isLoading: boolean;
};

/**
 * Retorna o profile da CONTA ATIVA (quando manager gerencia outra conta) ou
 * o profile da sessão (caso normal). Mesma forma do useProfile, drop-in pra
 * substituir em telas de exibição/derivação de conteúdo.
 *
 * NÃO usar pra:
 *   - auth/gate/tema da sessão (use useProfile direto)
 *   - billing/plan/role-de-admin (use useProfile — esses são da sessão)
 */
export function useActiveProfile(): UseActiveProfileResult {
  const { user } = useAuth();
  const { activeAccountId } = useActiveAccount();
  const { profile: selfProfile, isLoading: selfLoading } = useProfile();

  const isOwnAccount = !activeAccountId || activeAccountId === user?.id;
  const ownerId = activeAccountId || user?.id || "";

  const { data: managedProfile, isLoading: managedLoading } = useQuery<ActiveProfile | null>({
    queryKey: ["active-profile", ownerId],
    enabled: !!ownerId && !isOwnAccount,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, niche, instagram_handle, bio, weekly_goal, role")
        .eq("id", ownerId)
        .maybeSingle();
      if (error) throw error;
      return data as ActiveProfile | null;
    },
  });

  if (isOwnAccount) {
    return { profile: (selfProfile as ActiveProfile | null) ?? null, isLoading: selfLoading };
  }
  return { profile: managedProfile ?? null, isLoading: managedLoading };
}
