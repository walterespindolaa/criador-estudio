import { useActiveAccount } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { ChevronsUpDown, Settings, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AccountSwitcher({ compact = false }: { compact?: boolean }) {
  const { managedAccounts, hasManagedAccounts, activeAccountId, isManaging, setActiveAccount } = useActiveAccount();
  const { profile } = useProfile();
  const isManager = profile?.account_type === "manager";
  const navigate = useNavigate();
  if (!hasManagedAccounts) return null;

  const current = managedAccounts.find((m) => m.owner_id === activeAccountId);
  const label = isManaging ? current?.name ?? "Cliente" : "Minha conta";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={compact ? `Trocar de conta (${label})` : undefined}
        className={
          compact
            // Botão discreto (igual sino/ajustes): SÓ o boneco fica preto pra chamar
            // atenção, sem pintar o botão inteiro de preto.
            ? "h-9 w-9 flex items-center justify-center rounded-xl hover:bg-accent/60 transition-colors"
            : "w-full flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-body hover:bg-accent/50 transition-colors"
        }
      >
        {isManaging
          ? <Users className={cn("h-4 w-4 shrink-0", compact ? "text-neutral-900 dark:text-neutral-100" : "text-primary")} />
          : <User className={cn("h-4 w-4 shrink-0", compact ? "text-neutral-900 dark:text-neutral-100" : "text-muted-foreground")} />}
        {!compact && (
          <>
            <span className="truncate flex-1 text-left">{label}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} className="w-56">
        <DropdownMenuLabel className="text-xs">Trocar de conta</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setActiveAccount(null)}>
          <User className="h-4 w-4 mr-2" /> Minha conta
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {managedAccounts.map((m) => (
          <DropdownMenuItem key={m.owner_id} onClick={() => setActiveAccount(m.owner_id)}>
            <span className="truncate">{m.name}</span>
            {m.instagram_handle && (
              <span className="ml-auto text-xs text-muted-foreground">@{m.instagram_handle.replace(/^@/, "")}</span>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { setActiveAccount(null); navigate(isManager ? "/socialmidia/dashboard" : "/app/configuracoes"); }}>
          <Settings className="h-4 w-4 mr-2" /> Minha conta (configurações)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
