import { useNavigate } from "react-router-dom";
import { LogOut, Sparkles, Users, ArrowRight } from "lucide-react";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/Logo";

function initial(name: string | null | undefined) {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}

export function ManagerHome() {
  const { profile } = useProfile();
  const { managedAccounts, accountsLoading, setActiveAccount } = useActiveAccount();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-border">
        <Logo className="h-8 w-auto" />
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-sm font-body font-medium text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 flex flex-col items-center px-6 py-10 sm:py-16">
        <div className="w-full max-w-3xl">
          <div className="mb-10">
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">
              Olá, {profile?.name || "social media"}!
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground font-body mt-1">
              Selecione qual cliente você quer gerenciar agora.
            </p>
          </div>

          {accountsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : managedAccounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-body text-foreground font-medium">
                Você ainda não gerencia nenhuma conta
              </p>
              <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">
                Quando uma criadora te convidar pra gerenciar a conta dela, ela aparece aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {managedAccounts.map((account) => (
                <div
                  key={account.owner_id}
                  className="group rounded-2xl border border-border bg-card p-5 flex items-center gap-4 hover:shadow-md hover:border-primary/40 transition-all"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[2px] shrink-0 overflow-hidden">
                    <div className="w-full h-full rounded-2xl bg-card overflow-hidden flex items-center justify-center">
                      {account.avatar_url ? (
                        <img src={account.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <span className="text-base font-display font-extrabold text-primary">
                          {initial(account.name)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-display font-bold text-foreground truncate">
                      {account.name || "Sem nome"}
                    </p>
                    {account.instagram_handle && (
                      <p className="text-xs text-muted-foreground font-body truncate">
                        @{account.instagram_handle.replace(/^@/, "")}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setActiveAccount(account.owner_id)}
                    className="shrink-0"
                  >
                    Gerenciar <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Upsell */}
          <div className="mt-12 rounded-2xl border border-border bg-card/50 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display font-semibold text-foreground">
                Quer usar o cria pro seu conteúdo também?
              </p>
              <p className="text-xs text-muted-foreground font-body mt-0.5">
                Crie sua conta de criadora e ganhe ideias, calendário e IA pra você.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/app/assinar")}
              className="shrink-0"
            >
              Ver planos
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
