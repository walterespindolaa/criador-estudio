import { useActiveAccount } from "@/contexts/AccountContext";
import { Eye, X } from "lucide-react";

export function ManagingBanner() {
  const { isManaging, managedAccounts, activeAccountId, setActiveAccount } = useActiveAccount();
  if (!isManaging) return null;
  const current = managedAccounts.find((m) => m.owner_id === activeAccountId);

  return (
    <div className="w-full bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={2} />
        <p className="text-xs sm:text-sm font-body text-foreground truncate">
          Gerenciando a conta de <b className="font-semibold">{current?.name ?? "cliente"}</b>
        </p>
      </div>
      <button
        onClick={() => setActiveAccount(null)}
        className="flex items-center gap-1 text-xs font-body font-semibold text-primary hover:underline shrink-0"
      >
        <X className="h-3.5 w-3.5" /> Sair
      </button>
    </div>
  );
}
