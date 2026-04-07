import { NavLink } from "react-router-dom";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";

const navItems = [
  { title: "Ideias", url: "/app/ideias" },
  { title: "Criando", url: "/app/criando" },
  { title: "Plano", url: "/app/plano" },
  { title: "Biblioteca", url: "/app/biblioteca" },
  { title: "Tarefas", url: "/app/tarefas" },
  { title: "Arquivos", url: "/app/arquivos" },
  { title: "Histórico", url: "/app/historico" },
  { title: "Aprender", url: "/app/aprender" },
];

export function TopBar() {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 z-50 bg-[hsl(var(--background))] border-b border-border hidden md:block">
      <div className="max-w-screen-2xl mx-auto h-full px-8 flex items-center justify-between">
        <NavLink to="/app" className="flex items-center">
          <h1 
            className="text-xl font-display font-semibold text-foreground tracking-tight"
            style={{ fontVariationSettings: "'opsz' 9" }}
          >
            Criadores
          </h1>
        </NavLink>

        <nav className="flex items-center gap-8">
          {navItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              className={({ isActive }) =>
                cn(
                  "text-sm font-body font-medium transition-all relative py-1",
                  isActive 
                    ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              {item.title}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <NotificationsBell />
          <NavLink to="/app/configuracoes" className="p-2 hover:bg-accent/60 rounded-xl transition-colors">
            <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          </NavLink>
        </div>
      </div>
    </header>
  );
}
