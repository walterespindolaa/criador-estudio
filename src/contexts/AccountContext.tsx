import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { definirContaAtiva } from "@/lib/conta-ativa";

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
  /** "Meu perfil": o Cria de criadora da própria sessão (profiles.perfil_de). Não é cliente. */
  meuPerfil: MeuPerfil | null;
  meuPerfilLoading: boolean;
  /** A conta aberta agora é o Meu perfil. */
  ehMeuPerfil: boolean;
};

export type MeuPerfil = ManagedAccount & {
  plan: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
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

  // Meu perfil (decisão 18/10/2026): ligado por profiles.perfil_de, SEM linha em
  // account_members. Por isso não aparece em my_managed_accounts (não é cliente
  // da carteira) e vem por um RPC próprio.
  const { data: meuPerfil = null, isLoading: meuPerfilLoading } = useQuery<MeuPerfil | null>({
    queryKey: ["meu-perfil", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (fn: string) => Promise<{ data: unknown; error: unknown }>)("meu_perfil");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as MeuPerfil | undefined) ?? null;
    },
  });

  const selectable = useMemo(
    () => [...managedAccounts, ...teamAccounts, ...(meuPerfil ? [meuPerfil] : [])],
    [managedAccounts, teamAccounts, meuPerfil],
  );

  // Ao logar, o padrão é a PRÓPRIA conta. Entrar no "Cria dele" de um cliente
  // (managedAccounts) é temporário e NÃO deve sobreviver ao logout: senão o gestor
  // relogava e caía dentro da conta de um cliente (ex.: "gerenciando a conta de
  // Gabi", ou o Atlas no celular). Só restauramos conta de EQUIPE (colaborador),
  // que é o lar natural de quem entra como membro de uma agência.
  useEffect(() => {
    if (!user?.id) { setActive(null); return; }
    const saved = localStorage.getItem(LS_KEY);
    if (saved && teamAccounts.some((m) => m.owner_id === saved)) { setActive(saved); return; }
    // O Meu perfil sobrevive ao recarregar (é da própria pessoa, como a conta de
    // equipe). Espera o RPC responder antes de decidir, senão a escolha some.
    if (saved && meuPerfilLoading) return;
    if (saved && meuPerfil?.owner_id === saved) { setActive(saved); return; }
    // Seleção salva que é de CLIENTE (não é conta de equipe): ignora e limpa, pra
    // não reabrir num cliente no próximo login.
    if (saved && !teamAccounts.some((m) => m.owner_id === saved)) { localStorage.removeItem(LS_KEY); }
    if (!saved && managedAccounts.length === 0 && teamAccounts.length > 0) {
      setActive(teamAccounts[0].owner_id); // colaborador cai na conta do gestor ao logar
    }
  }, [user?.id, selectable, managedAccounts.length, teamAccounts, meuPerfil, meuPerfilLoading]);

  const setActiveAccount = (ownerId: string | null) => {
    // O Meu perfil recém-criado ainda não está no `selectable` desta renderização:
    // confere também o cache do RPC (useCriarMeuPerfil busca antes de abrir).
    const perfilNoCache = queryClient.getQueryData<MeuPerfil | null>(["meu-perfil", user?.id]);
    const next = ownerId && (selectable.some((m) => m.owner_id === ownerId) || perfilNoCache?.owner_id === ownerId) ? ownerId : null;
    if (next) localStorage.setItem(LS_KEY, next); else localStorage.removeItem(LS_KEY);
    setActive(next);
    queryClient.clear(); // evita vazamento de dados entre contas
  };

  const effectiveId = activeAccountId ?? user?.id ?? null;
  // Espelha a conta aberta pra quem chama o servidor fora do React (IA).
  // Atribuição direta no render: precisa valer já na primeira chamada.
  definirContaAtiva(effectiveId);
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
    meuPerfil,
    meuPerfilLoading,
    ehMeuPerfil: !!activeAccountId && !!meuPerfil && activeAccountId === meuPerfil.owner_id,
  }), [effectiveId, activeAccountId, user?.id, managedAccounts, accountsLoading, teamLoading, teamAccounts, actingAsTeam, meuPerfil, meuPerfilLoading]);

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
