import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useActiveAccount } from "@/contexts/AccountContext";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { ReactNode } from "react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { status, canAccess, profile } = useSubscription();
  const { hasManagedAccounts, accountsLoading } = useActiveAccount();
  const { pathname } = useLocation();

  if (authLoading) return <LoadingScreen />;

  if (!user) return <Navigate to="/login" replace />;

  if (status === "loading") return <LoadingScreen />;

  if (!canAccess) {
    if (accountsLoading) return <LoadingScreen />;          // ainda não sabe se é gerente
    const isManager = profile?.account_type === "manager";
    // A tela de Planos passou a viver DENTRO do app (com menu, como todas as
    // outras). Então ela precisa ser a exceção da trava: sem isto, quem está
    // bloqueado é mandado pra cá, e daqui é mandado pra cá de novo, pra sempre.
    // Trancar a porta de quem está tentando te pagar é o pior loop possível.
    const ehPlanos = pathname === "/app/assinar";
    if (!isManager && !hasManagedAccounts && !ehPlanos) return <Navigate to="/app/assinar" replace />;
  }

  return <>{children}</>;
}

export function AuthOnlyRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
