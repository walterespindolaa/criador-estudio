import { useState } from "react";
import { Home, Boxes, Users, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/shared/Logo";
import { ManagerHome } from "@/components/accounts/ManagerHome";
import { ManagerModules } from "@/components/accounts/ManagerModules";

type Section = "inicio" | "modulos" | "clientes";
const NAV: { key: Section; label: string; icon: typeof Home }[] = [
  { key: "inicio", label: "Início", icon: Home },
  { key: "modulos", label: "Módulos", icon: Boxes },
  { key: "clientes", label: "Clientes", icon: Users },
];

export function ManagerHub() {
  const [section, setSection] = useState<Section>("inicio");
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card/40 px-3 py-5">
        <div className="px-2 mb-6"><Logo className="h-8 w-auto" /></div>
        <nav className="flex-1 space-y-1">
          {NAV.map((n) => {
            const Icon = n.icon; const on = section === n.key;
            return (
              <button key={n.key} onClick={() => setSection(n.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-body transition-colors ${on ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`}>
                <Icon className="h-4 w-4" /> {n.label}
              </button>
            );
          })}
        </nav>
        <button onClick={() => signOut()} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-body text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="md:hidden flex items-center gap-1 border-b border-border px-3 py-2 overflow-x-auto">
          {NAV.map((n) => {
            const on = section === n.key;
            return (
              <button key={n.key} onClick={() => setSection(n.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-body whitespace-nowrap ${on ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"}`}>{n.label}</button>
            );
          })}
        </div>
        {section === "inicio" ? (
          <ManagerHome embedded />
        ) : (
          <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
            <div className="w-full max-w-4xl mx-auto">
              {section === "modulos" && <ManagerModules />}
              {section === "clientes" && (
                <div className="text-center py-16 text-muted-foreground font-body">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Clientes externos</p>
                  <p className="text-sm mt-1">Em breve: gerencie clientes que não usam o Cria e envie posts pra aprovação por link (módulo Cria Post).</p>
                </div>
              )}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
