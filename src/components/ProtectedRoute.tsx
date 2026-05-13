import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { ReactNode } from "react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { status, canAccess } = useSubscription();

  // Aguarda auth carregar
  if (authLoading || status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-body animate-pulse">Carregando...</p>
      </div>
    );
  }

  // Não autenticado
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Trial expirado ou bloqueado → redireciona para paywall
  if (!canAccess) {
    return <Navigate to="/app/assinar" replace />;
  }

  return <>{children}</>;
}

export function AuthOnlyRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-body animate-pulse">Carregando...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
