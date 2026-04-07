import { NavLink } from "react-router-dom";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";

const groupProducao = [
  { title: "Ideias", url: "/app/ideias" },
  { title: "Criando", url: "/app/criando" },
  { title: "Plano", url: "/app/plano" },
  { title: "Tarefas", url: "/app/tarefas" },
];

const groupInsights = [
  { title: "Biblioteca", url: "/app/biblioteca" },
  { title: "Arquivos", url: "/app/arquivos" },
];

const groupHistorico = [
  { title: "Histórico", url: "/app/historico" },
  { title: "Aprender", url: "/app/aprender" },
];

function NavGroup({ items }: { items: { title: string; url: string }[] }) {
  return (
    <div className="flex items-center gap-1">
      {items.map((item) => (
        <NavLink
          key={item.url}
          to={item.url}
          className={({ isActive }) =>
            cn(
              "text-sm font-body font-medium transition-all relative px-2.5 py-1.5 rounded-lg",
              isActive
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            )
          }
        >
          {item.title}
        </NavLink>
      ))}
    </div>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-border/60 mx-1.5 shrink-0" />;
}

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

        <nav className="flex items-center">
          <NavGroup items={groupProducao} />
          <Divider />
          <NavGroup items={groupInsights} />
          <Divider />
          <NavGroup items={groupHistorico} />
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
