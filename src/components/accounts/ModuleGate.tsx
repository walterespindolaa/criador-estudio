import type { ReactNode } from "react";
import { Boxes, Eye, Lock } from "lucide-react";
import { useModules } from "@/hooks/useModules";
import { useManagerOutlet } from "@/components/accounts/managerOutlet";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useMyTeamPermissions } from "@/hooks/useTeam";
import { usePermissaoModulo } from "@/hooks/usePermissaoModulo";
import { Button } from "@/components/ui/button";

export function ModuleGate({ code, teamCode, nivelCode, children }: {
  code: string; teamCode?: string;
  /** Só pro aviso de "só ver" (não bloqueia a entrada como o teamCode). */
  nivelCode?: string;
  children: ReactNode;
}) {
  const { modules, isLoading } = useModules();
  const { actingAsTeam, agencyOwnerId } = useActiveAccount();
  const { data: teamPerms } = useMyTeamPermissions(actingAsTeam ? agencyOwnerId : null);
  const { openModule } = useManagerOutlet();
  const perm = usePermissaoModulo(nivelCode ?? teamCode ?? code);
  const mod = modules.find((m) => m.code === code);

  if (isLoading) return <div className="h-40 rounded-2xl bg-muted animate-pulse" />;
  if (!mod) return null;

  // Colaborador: além do módulo estar ativo na agência, precisa da permissão de time.
  // Sem isso, o Cria Caixa (e afins) fica bloqueado mesmo acessando a rota direto pela URL.
  if (actingAsTeam && teamCode) {
    if (teamPerms === undefined) return <div className="h-40 rounded-2xl bg-muted animate-pulse" />;
    if (!teamPerms.has(teamCode)) {
      return (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3"><Lock className="h-5 w-5 text-primary" /></div>
          <p className="text-sm font-body text-foreground font-medium">Sem acesso a este módulo</p>
          <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">Peça ao gestor da agência pra liberar este módulo pra você.</p>
        </div>
      );
    }
  }

  const active = mod.status === "active" || mod.status === "past_due";
  if (active) {
    // Acesso só de ver (19/10/2026): avisa no topo. Os botões que gravam
    // falham no banco com a mensagem certa; os principais já somem na tela.
    if (actingAsTeam && (teamCode || nivelCode) && perm.nivel === "ver") {
      return (
        <>
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2">
            <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-[12.5px] font-body text-muted-foreground">
              Seu acesso aqui é <strong className="text-foreground">só pra ver</strong>. Pra criar ou editar, peça pra dona liberar em Equipe &gt; Pessoas.
            </p>
          </div>
          {children}
        </>
      );
    }
    return <>{children}</>;
  }

  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3"><Boxes className="h-5 w-5 text-primary" /></div>
      <p className="text-sm font-body text-foreground font-medium">{mod.name} não está ativo</p>
      <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto mb-4">{mod.coming_soon ? "Esse módulo está em desenvolvimento." : "Ative o módulo pra usar essa área."}</p>
      {!mod.coming_soon && <Button onClick={() => openModule(mod)}>Conhecer módulo</Button>}
    </div>
  );
}

/** Aviso de acesso só de ver pra páginas sem ModuleGate (Agenda, Radar). */
export function AvisoSoVer({ code }: { code: string }) {
  const { actingAsTeam } = useActiveAccount();
  const perm = usePermissaoModulo(code);
  if (!actingAsTeam || perm.nivel !== "ver") return null;
  return (
    <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2">
      <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
      <p className="text-[12.5px] font-body text-muted-foreground">
        Seu acesso aqui é <strong className="text-foreground">só pra ver</strong>. Pra criar ou editar, peça pra dona liberar em Equipe &gt; Pessoas.
      </p>
    </div>
  );
}
