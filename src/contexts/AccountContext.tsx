import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ManagedAccount = {
  owner_id: string; name: string; avatar_url: string | null;
  niche: string | null; instagram_handle: string | null;
};

type Ctx = {
  activeAccountId: string | null;
  isManaging: boolean;
  managedAccounts: ManagedAccount[];
  hasManagedAccounts: boolean;
  accountsLoading: boolean;
  setActiveAccount: (ownerId: string | null) => void; // null => volta pra própria conta
};

const AccountContext = createContext<Ctx | undefined>(undefined);
const LS_KEY = "cf_active_account";

export function AccountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeAccountId, setActive] = useState<string | null>(null);

  // Reivindica convites pendentes após login (gerentes que já tinham conta)
  useEffect(() => {
    if (user?.id) {
      supabase.rpc("claim_account_invites").then(() => {
        queryClient.invalidateQueries({ queryKey: ["managed-accounts"] });
      });
    }
  }, [user?.id, queryClient]);

  const { data: managedAccounts = [], isLoading: accountsLoading } = useQuery<ManagedAccount[]>({
    queryKey: ["managed-accounts", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_managed_accounts");
      if (error) throw error;
      return (data ?? []) as ManagedAccount[];
    },
  });

  // Restaura seleção salva (só se ainda for um cliente válido)
  useEffect(() => {
    if (!user?.id) { setActive(null); return; }
    const saved = localStorage.getItem(LS_KEY);
    if (saved && managedAccounts.some((m) => m.owner_id === saved)) setActive(saved);
  }, [user?.id, managedAccounts]);

  const setActiveAccount = (ownerId: string | null) => {
    const next = ownerId && managedAccounts.some((m) => m.owner_id === ownerId) ? ownerId : null;
    if (next) localStorage.setItem(LS_KEY, next); else localStorage.removeItem(LS_KEY);
    setActive(next);
    queryClient.clear(); // evita vazamento de dados entre contas
  };

  const effectiveId = activeAccountId ?? user?.id ?? null;
  const value = useMemo<Ctx>(() => ({
    activeAccountId: effectiveId,
    isManaging: !!activeAccountId && activeAccountId !== user?.id,
    managedAccounts,
    hasManagedAccounts: managedAccounts.length > 0,
    accountsLoading,
    setActiveAccount,
  }), [effectiveId, activeAccountId, user?.id, managedAccounts, accountsLoading]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useActiveAccount() {
  const c = useContext(AccountContext);
  if (!c) throw new Error("useActiveAccount must be used within AccountProvider");
  return c;
}
