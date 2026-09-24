import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useActiveAccount } from "@/contexts/AccountContext";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { ReactNode, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSouParceiro } from "@/hooks/useParceiro";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { status, canAccess, profile } = useSubscription();
  const { hasManagedAccounts, accountsLoading } = useActiveAccount();
  const { pathname } = useLocation();
  // Parceiro de produção (designer/editor) entra pela porta da agência que o
  // convidou, sem plano próprio. Quem já tinha conta de criador com trial
  // vencido ficava preso em /app/assinar pra sempre (auditoria 04/09).
  const { data: souParceiro, isLoading: parceiroLoading } = useSouParceiro();

  /* ACEITE DE TERMOS PENDENTE (LGPD, 23/09/2026). Quem se cadastrou com
     confirmação de e-mail não tinha sessão na hora de aceitar; a marca ficou no
     localStorage e o registro acontece no primeiro acesso autenticado. */
  useEffect(() => {
    if (!user) return;
    let pendente = false;
    try { pendente = localStorage.getItem("cria.termos_pendentes") === "1"; } catch { pendente = false; }
    if (!pendente) return;
    void supabase.functions.invoke("accept-terms", { body: {} })
      .then(() => { try { localStorage.removeItem("cria.termos_pendentes"); } catch { /* ok */ } })
      .catch(() => { /* tenta na próxima navegação */ });
  }, [user]);

  if (authLoading) return <LoadingScreen />;

  if (!user) return <Navigate to="/login" replace />;

  if (status === "loading") return <LoadingScreen />;

  /* CONTA SUSPENSA DE VERDADE (pente fino 23/09/2026). O admin marcava
     `subscription_status = 'suspended'` e nada acontecia: a pessoa continuava
     usando tudo. Agora a suspensão fecha o app; o próprio admin nunca é
     travado por aqui (o painel dele mora fora desta rota de qualquer jeito). */
  if (profile?.subscription_status === "suspended" && profile?.role !== "admin") {
    return <ContaSuspensa />;
  }

  if (!canAccess) {
    if (accountsLoading || parceiroLoading) return <LoadingScreen />;          // ainda não sabe se é gerente/parceiro
    const isManager = profile?.account_type === "manager";
    // A tela de Planos passou a viver DENTRO do app (com menu, como todas as
    // outras). Então ela precisa ser a exceção da trava: sem isto, quem está
    // bloqueado é mandado pra cá, e daqui é mandado pra cá de novo, pra sempre.
    // Trancar a porta de quem está tentando te pagar é o pior loop possível.
    const ehPlanos = pathname === "/app/assinar";
    if (souParceiro && !pathname.startsWith("/socialmidia")) return <Navigate to="/socialmidia/demandas" replace />;
    if (!isManager && !hasManagedAccounts && !ehPlanos && !souParceiro) return <Navigate to="/app/assinar" replace />;
  }

  return <>{children}</>;
}

export function AuthOnlyRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function ContaSuspensa() {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen grid place-items-center bg-background px-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 text-center space-y-3">
        <h1 className="text-xl font-display font-extrabold text-foreground">Conta suspensa</h1>
        <p className="text-sm font-body text-muted-foreground leading-relaxed">
          O acesso a esta conta foi suspenso. Se você acha que foi um engano, fala com a gente em{" "}
          <a href="mailto:contato@criasocialclub.com.br" className="text-primary underline underline-offset-2">contato@criasocialclub.com.br</a>.
          Os seus dados continuam guardados.
        </p>
        <button type="button" onClick={() => void signOut()}
          className="mt-2 h-11 px-5 rounded-xl border border-border text-sm font-body font-semibold text-foreground hover:bg-muted">
          Sair da conta
        </button>
      </div>
    </div>
  );
}
