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
  teamLoading: boolean;             // carregando as contas de time (colaborador)
  setActiveAccount: (ownerId: string | null) => void; // null => volta pra própria conta
  // Colaboradores (acesso de equipe): contas de gestor onde o usuário atua como time.
  teamAccounts: ManagedAccount[];
  isCollaborator: boolean;          // o usuário é colaborador de alguma agência
  actingAsTeam: boolean;            // a conta ativa é uma conta de time (gestor)
  // Dono do tenant da AGÊNCIA para as queries: o próprio user, ou o gestor quando é colaborador atuando no time.
  agencyOwnerId: string | null;
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

  // Contas de gestor onde o usuário atua como COLABORADOR (acesso de equipe).
  const { data: teamAccounts = [], isLoading: teamLoading } = useQuery<ManagedAccount[]>({
    queryKey: ["team-accounts", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (fn: string) => Promise<{ data: unknown; error: unknown }>)("my_team_accounts");
      if (error) throw error;
      return (data ?? []) as ManagedAccount[];
    },
  });

  const selectable = useMemo(() => [...managedAccounts, ...teamAccounts], [managedAccounts, teamAccounts]);

  // Restaura seleção salva; se for colaborador sem conta própria de gestão, entra direto na agência.
  useEffect(() => {
    if (!user?.id) { setActive(null); return; }
    const saved = localStorage.getItem(LS_KEY);
    if (saved && selectable.some((m) => m.owner_id === saved)) { setActive(saved); return; }
    if (!saved && managedAccounts.length === 0 && teamAccounts.length > 0) {
      setActive(teamAccounts[0].owner_id); // colaborador cai na conta do gestor ao logar
    }
  }, [user?.id, selectable, managedAccounts.length, teamAccounts]);

  const setActiveAccount = (ownerId: string | null) => {
    const next = ownerId && selectable.some((m) => m.owner_id === ownerId) ? ownerId : null;
    if (next) localStorage.setItem(LS_KEY, next); else localStorage.removeItem(LS_KEY);
    setActive(next);
    queryClient.clear(); // evita vazamento de dados entre contas
  };

  const effectiveId = activeAccountId ?? user?.id ?? null;
  const actingAsTeam = !!activeAccountId && teamAccounts.some((m) => m.owner_id === activeAccountId);
  const value = useMemo<Ctx>(() => ({
    activeAccountId: effectiveId,
    isManaging: !!activeAccountId && activeAccountId !== user?.id,
    managedAccounts,
    hasManagedAccounts: managedAccounts.length > 0,
    accountsLoading,
    teamLoading,
    setActiveAccount,
    teamAccounts,
    isCollaborator: teamAccounts.length > 0,
    actingAsTeam,
    // Na agência: se atuo como time, o dono é o gestor (activeAccountId); senão, sou eu.
    agencyOwnerId: actingAsTeam ? activeAccountId : (user?.id ?? null),
  }), [effectiveId, activeAccountId, user?.id, managedAccounts, accountsLoading, teamLoading, teamAccounts, actingAsTeam]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useActiveAccount() {
  const c = useContext(AccountContext);
  if (!c) throw new Error("useActiveAccount must be used within AccountProvider");
  return c;
}

// ── IMPERSONAÇÃO ESCOPADA (só numa subárvore) ──
// Sobrepõe o activeAccountId APENAS nos componentes filhos, sem tocar no estado
// global nem limpar o cache do React Query (diferente do setActiveAccount, que
// troca a conta do app inteiro e dá queryClient.clear()). Serve pra social mídia
// operar o Cria do cliente de DENTRO do cockpit, reaproveitando os componentes que
// já leem activeAccountId (usePosts, PostEditor, usePillars, useTasks...). O acesso
// de verdade vem do RLS is_account_member: o gestor é membro ativo da conta Cria do
// cliente (mesma trava que faz o botão "Entrar no Cria dele" funcionar).
export function ScopedAccountProvider({ ownerId, children }: { ownerId: string; children: ReactNode }) {
  const base = useActiveAccount();
  const value = useMemo<Ctx>(() => ({
    ...base,
    activeAccountId: ownerId,
    isManaging: true,
  }), [base, ownerId]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
