import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home, Lightbulb, Kanban, CalendarDays, MoreHorizontal,
  BookOpen, Archive, GraduationCap, FolderOpen, ListTodo, BookMarked, Settings, ChevronUp, LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const primaryItems = [
  { title: "Início", url: "/app", icon: Home, exact: true },
  { title: "Ideias", url: "/app/ideias", icon: Lightbulb },
  { title: "Criando", url: "/app/criando", icon: Kanban },
  { title: "Plano", url: "/app/plano", icon: CalendarDays },
];

const moreItems = [
  { title: "Biblioteca", url: "/app/biblioteca", icon: BookOpen },
  { title: "Tarefas", url: "/app/tarefas", icon: ListTodo },
  { title: "Brandbook", url: "/app/brandbook", icon: BookMarked },
  { title: "Arquivos", url: "/app/arquivos", icon: FolderOpen },
  { title: "Histórico", url: "/app/historico", icon: Archive },
  { title: "Aprender", url: "/app/aprender", icon: GraduationCap },
  { title: "Config.", url: "/app/configuracoes", icon: Settings },
];

export function BottomBar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const isActive = (url: string, exact?: boolean) => {
    if (exact) return location.pathname === url;
    return location.pathname.startsWith(url);
  };

  const isMoreActive = moreItems.some(item => location.pathname.startsWith(item.url));

  return (
    <>
      {/* Backdrop */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden bg-foreground/20 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
      )}

      {/* More drawer */}
      {moreOpen && (
        <div className="fixed bottom-[64px] left-0 right-0 z-50 md:hidden bg-card border-t border-border rounded-t-2xl shadow-2xl p-4 bottom-bar-safe"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="w-8 h-1 bg-border rounded-full mx-auto mb-4" />
          <div className="grid grid-cols-4 gap-3">
            {moreItems.map((item) => {
              const active = isActive(item.url);
              return (
                <NavLink
                  key={item.url}
                  to={item.url}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors",
                    active ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px] font-body font-medium leading-tight text-center">{item.title}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around h-16 px-1">
          {primaryItems.map((item) => {
            const active = isActive(item.url, item.exact);
            return (
              <NavLink
                key={item.url}
                to={item.url}
                className="flex flex-col items-center justify-center gap-1 px-1"
              >
                <div className={cn(
                  "p-1.5 rounded-xl transition-colors",
                  active ? "bg-primary/10" : ""
                )}>
                  <item.icon className={cn("h-5 w-5 transition-colors", active ? "text-primary" : "text-muted-foreground")} />
                </div>
                <span className={cn("text-[10px] font-body font-medium", active ? "text-primary" : "text-muted-foreground")}>{item.title}</span>
              </NavLink>
            );
          })}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="flex flex-col items-center justify-center gap-1 px-1"
          >
            <div className={cn(
              "p-1.5 rounded-xl transition-colors",
              moreOpen || isMoreActive ? "bg-primary/10" : ""
            )}>
              <ChevronUp className={cn(
                "h-5 w-5 transition-all",
                moreOpen ? "text-primary rotate-180" : isMoreActive ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <span className={cn("text-[10px] font-body font-medium", moreOpen || isMoreActive ? "text-primary" : "text-muted-foreground")}>Mais</span>
          </button>
          <button
            onClick={handleSignOut}
            className="flex flex-col items-center justify-center gap-1 px-1"
          >
            <div className="p-1.5 rounded-xl transition-colors">
              <LogOut className="h-5 w-5 text-muted-foreground transition-colors" />
            </div>
            <span className="text-[10px] font-body font-medium text-muted-foreground">Sair</span>
          </button>
        </div>
      </nav>
    </>
  );
}
