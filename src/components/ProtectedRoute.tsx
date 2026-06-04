import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useActiveAccount } from "@/contexts/AccountContext";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { ReactNode } from "react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { status, canAccess, profile } = useSubscription();
  const { hasManagedAccounts, accountsLoading } = useActiveAccount();

  if (authLoading) return <LoadingScreen />;

  if (!user) return <Navigate to="/login" replace />;

  if (status === "loading") return <LoadingScreen />;

  if (!canAccess) {
    if (accountsLoading) return <LoadingScreen />;          // ainda não sabe se é gerente
    const isManager = profile?.account_type === "manager";
    if (!isManager && !hasManagedAccounts) return <Navigate to="/app/assinar" replace />;
  }

  return <>{children}</>;
}

export function AuthOnlyRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
