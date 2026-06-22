import { useActiveAccount } from "@/contexts/AccountContext";
import { Eye, Home } from "lucide-react";

export function ManagingBanner() {
  const { isManaging, managedAccounts, activeAccountId, setActiveAccount } = useActiveAccount();
  if (!isManaging) return null;
  const current = managedAccounts.find((m) => m.owner_id === activeAccountId);
  const name = current?.name;

  return (
    <div className="w-full md:-ml-[104px] md:w-[calc(100%+104px)] bg-primary text-primary-foreground px-4 py-2.5 flex items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="h-4 w-4 shrink-0" strokeWidth={2} />
        <p className="text-sm sm:text-base font-body font-semibold truncate">
          Você está gerenciando a conta de{" "}
          {name ? (
            <span className="font-bold">{name}</span>
          ) : (
            <span className="opacity-70 italic">carregando…</span>
          )}
        </p>
      </div>
      <button
        onClick={() => setActiveAccount(null)}
        className="flex items-center gap-1.5 text-sm font-body font-semibold bg-white/15 hover:bg-white/25 transition-colors rounded-lg px-3 py-1.5 shrink-0 whitespace-nowrap"
        aria-label="Voltar para minha conta"
      >
        <Home className="h-4 w-4" /> Voltar pra minha conta
      </button>
    </div>
  );
}
