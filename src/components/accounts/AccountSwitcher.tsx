import { useActiveAccount } from "@/contexts/AccountContext";
import { ChevronsUpDown, User, Users } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AccountSwitcher() {
  const { managedAccounts, hasManagedAccounts, activeAccountId, isManaging, setActiveAccount } = useActiveAccount();
  if (!hasManagedAccounts) return null;

  const current = managedAccounts.find((m) => m.owner_id === activeAccountId);
  const label = isManaging ? current?.name ?? "Cliente" : "Minha conta";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-body hover:bg-accent/50 transition-colors">
        {isManaging ? <Users className="h-4 w-4 text-primary shrink-0" /> : <User className="h-4 w-4 text-muted-foreground shrink-0" />}
        <span className="truncate flex-1 text-left">{label}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
