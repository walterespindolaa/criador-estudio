import { useActiveAccount } from "@/contexts/AccountContext";
import { useNavigate } from "react-router-dom";
import { Briefcase, ChevronsUpDown, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* hero: pílula com texto na barra colorida do desktop (HeroBand). No desktop
   o seletor não existia e a colaboradora não achava onde trocar (28/09). */
export function AccountSwitcher({ compact = false, hero = false }: { compact?: boolean; hero?: boolean }) {
  const { teamAccounts, actingAsTeam, activeAccountId, isManaging, setActiveAccount } = useActiveAccount();
  const navigate = useNavigate();
  // Quem é colaborador de uma agência E tem conta própria com clientes não era
  // levado pra conta da agência no login (só cai lá quem não tem clientes) e
  // este menu só listava clientes: não havia caminho nenhum pra entrar na
  // agência que convidou (bug de 28/09). Agora as equipes aparecem aqui.
  // 28/09: os clientes com Cria saíram daqui (o clique não levava pra conta
  // deles e confundia). Este menu agora é só: minha conta x equipes que atendo.
  if (teamAccounts.length === 0) return null;

  const current = teamAccounts.find((m) => m.owner_id === activeAccountId);
  const label = actingAsTeam ? `Equipe: ${current?.name ?? "Agência"}` : "Minha conta";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={compact ? `Trocar de conta (${label})` : undefined}
        className={
          hero
            ? "inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-body font-semibold text-white backdrop-blur transition-colors hover:bg-white/25"
            : compact
            // Botão discreto (igual sino/ajustes): SÓ o boneco fica preto pra chamar
            // atenção, sem pintar o botão inteiro de preto.
            ? "h-9 w-9 flex items-center justify-center rounded-xl hover:bg-accent/60 transition-colors"
            : "w-full flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-body hover:bg-accent/50 transition-colors"
        }
      >
        {hero ? (
          <>
            {actingAsTeam ? <Users className="h-3.5 w-3.5 shrink-0" /> : <User className="h-3.5 w-3.5 shrink-0" />}
            <span className="max-w-[180px] truncate">{actingAsTeam ? label : "Trocar de conta"}</span>
            <ChevronsUpDown className="h-3 w-3 opacity-70 shrink-0" />
          </>
        ) : isManaging
          ? <Users className={cn("h-4 w-4 shrink-0", compact ? "text-neutral-900 dark:text-neutral-100" : "text-primary")} />
          : <User className={cn("h-4 w-4 shrink-0", compact ? "text-neutral-900 dark:text-neutral-100" : "text-muted-foreground")} />}
        {!compact && !hero && (
          <>
            <span className="truncate flex-1 text-left">{label}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact || hero ? "end" : "start"} className="w-56">
        <DropdownMenuLabel className="text-xs">Trocar de conta</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setActiveAccount(null)}>
          <User className="h-4 w-4 mr-2" /> Minha conta
        </DropdownMenuItem>
        <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Equipes que eu atendo</DropdownMenuLabel>
            {teamAccounts.map((m) => (
              <DropdownMenuItem key={`time-${m.owner_id}`} onClick={() => { setActiveAccount(m.owner_id); navigate("/socialmidia/dashboard"); }}>
                <Briefcase className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">{m.name}</span>
              </DropdownMenuItem>
            ))}
        </>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
