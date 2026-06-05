import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, StickyNote, Users } from "lucide-react";
import { useActiveAccount, type ManagedAccount } from "@/contexts/AccountContext";
import { Button } from "@/components/ui/button";
import { ClientNotesDrawer } from "@/components/accounts/ClientNotesDrawer";
import { cn } from "@/lib/utils";

const CLIENT_STEPS = [5, 10, 15, 20];
function initial(name?: string | null) { return name ? name.trim().charAt(0).toUpperCase() : "?"; }

export function ClientsGrid({ defaultLimit = 5 }: { defaultLimit?: number }) {
  const navigate = useNavigate();
  const { managedAccounts, accountsLoading, setActiveAccount } = useActiveAccount();
  const [limit, setLimit] = useState(defaultLimit);
  const [notesAccount, setNotesAccount] = useState<ManagedAccount | null>(null);

  const manage = (ownerId: string) => { setActiveAccount(ownerId); navigate("/app"); };

  if (accountsLoading) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[1, 2].map((i) => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)}</div>;
  }
  if (managedAccounts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><Users className="h-5 w-5 text-muted-foreground" /></div>
        <p className="text-sm font-body text-foreground font-medium">Você ainda não gerencia nenhuma conta</p>
        <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">Quando uma criadora te convidar pra gerenciar a conta dela, ela aparece aqui.</p>
      </div>
    );
  }

  return (
    <>
      {managedAccounts.length > 5 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-muted-foreground font-body mr-1">Mostrar:</span>
          {CLIENT_STEPS.map((n) => (
            <button key={n} onClick={() => setLimit(n)}
              className={cn("px-3.5 py-1.5 rounded-full text-xs font-body font-bold border transition-colors",
                limit === n ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground")}>{n}</button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {managedAccounts.slice(0, limit).map((account) => (
          <div key={account.owner_id} className="group rounded-2xl border border-border bg-card p-5 flex flex-col gap-4 hover:shadow-md hover:border-primary/40 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[2px] shrink-0 overflow-hidden">
                <div className="w-full h-full rounded-2xl bg-card overflow-hidden flex items-center justify-center">
                  {account.avatar_url ? <img src={account.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    : <span className="text-lg font-display font-extrabold text-primary">{initial(account.name)}</span>}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-display font-bold text-foreground truncate">{account.name || "Sem nome"}</p>
                {account.instagram_handle && <p className="text-xs text-muted-foreground font-body truncate">@{account.instagram_handle.replace(/^@/, "")}</p>}
                {account.niche && <p className="text-[11px] text-muted-foreground font-body truncate mt-0.5">{account.niche}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => manage(account.owner_id)} className="flex-1">Gerenciar <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
              <Button variant="outline" onClick={() => setNotesAccount(account)} aria-label="Notas do cliente" className="shrink-0"><StickyNote className="h-4 w-4 mr-1.5" /> Notas</Button>
            </div>
          </div>
        ))}
      </div>
      <ClientNotesDrawer open={!!notesAccount} onOpenChange={(o) => { if (!o) setNotesAccount(null); }} ownerId={notesAccount?.owner_id ?? null} clientName={notesAccount?.name ?? null} />
    </>
  );
}
