import type { ReactNode } from "react";
import { Boxes } from "lucide-react";
import { useModules } from "@/hooks/useModules";
import { useManagerOutlet } from "@/components/accounts/ManagerLayout";
import { Button } from "@/components/ui/button";

export function ModuleGate({ code, children }: { code: string; children: ReactNode }) {
  const { modules, isLoading } = useModules();
  const { openModule } = useManagerOutlet();
  const mod = modules.find((m) => m.code === code);

  if (isLoading) return <div className="h-40 rounded-2xl bg-muted animate-pulse" />;
  if (!mod) return null;

  const active = mod.status === "active" || mod.status === "past_due";
  if (active) return <>{children}</>;

  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3"><Boxes className="h-5 w-5 text-primary" /></div>
      <p className="text-sm font-body text-foreground font-medium">{mod.name} não está ativo</p>
      <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto mb-4">{mod.coming_soon ? "Esse módulo está em desenvolvimento." : "Ative o módulo pra usar essa área."}</p>
      {!mod.coming_soon && <Button onClick={() => openModule(mod)}>Conhecer módulo</Button>}
    </div>
  );
}
