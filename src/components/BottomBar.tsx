import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home, Lightbulb, Kanban, CalendarDays,
  BookOpen, Archive, GraduationCap, FolderOpen, ListTodo, BookMarked, Settings, ChevronUp, LogOut, Sparkles, Grid3X3, Link2, ClipboardCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useCriaAI } from "@/contexts/CriaAIContext";

const leftItems = [
  { title: "Início", url: "/app", icon: Home, exact: true },
  { title: "Ideias", url: "/app/ideias", icon: Lightbulb },
];

const rightItems = [
  { title: "Criando", url: "/app/criando", icon: Kanban },
  { title: "Plano", url: "/app/plano", icon: CalendarDays },
];

const moreItems = [
  { title: "Aprovações", url: "/app/aprovacao", icon: ClipboardCheck },
  { title: "Meu Feed", url: "/app/feed", icon: Grid3X3 },
  { title: "Biblioteca", url: "/app/biblioteca", icon: BookOpen },
  { title: "Tarefas", url: "/app/tarefas", icon: ListTodo },
  { title: "Brandbook", url: "/app/brandbook", icon: BookMarked },
  { title: "Link in Bio", url: "/app/linkinbio", icon: Link2 },
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
  const { openCria } = useCriaAI();

  const handleSignOut = async () => {
    setMoreOpen(false);
    await signOut();
    navigate("/");
  };

  const isActive = (url: string, exact?: boolean) => {
    if (exact) return location.pathname === url;
    return location.pathname.startsWith(url);
  };

  const isMoreActive = moreItems.some(item => location.pathname.startsWith(item.url));

  const renderNavItem = (item: { title: string; url: string; icon: typeof Home; exact?: boolean }) => {
    const active = isActive(item.url, item.exact);
    return (
      <NavLink
        key={item.url}
        to={item.url}
        className="flex flex-col items-center justify-center gap-1 px-2 flex-1"
      >
        <item.icon
          className={cn("h-5 w-5 transition-colors", active ? "text-primary" : "text-muted-foreground")}
          strokeWidth={active ? 2 : 1.5}
        />
        <span
          className={cn(
            "text-[10px] font-body transition-colors",
            active ? "text-primary font-semibold" : "text-muted-foreground font-medium"
          )}
        >
          {item.title}
        </span>
      </NavLink>
    );
  };

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden bg-foreground/20 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
      )}

      {moreOpen && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border rounded-t-2xl shadow-warm-lg p-4 bottom-bar-safe"
          style={{ paddingBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))' }}
        >
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
                  <item.icon className="h-5 w-5" strokeWidth={1.5} />
                  <span className="text-[10px] font-body font-medium leading-tight text-center">{item.title}</span>
                </NavLink>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/15 transition-colors text-sm font-body font-medium"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} /> Sair
          </button>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pointer-events-none"
           style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom,0px))' }}>
        <div className="flex items-center justify-center gap-2.5 px-3 pointer-events-auto">
          <div className="dock-pill flex items-center gap-0.5 rounded-[30px] p-1.5">
            {leftItems.map(renderNavItem)}
            <button type="button" onClick={() => openCria()} aria-label="cria"
              className="mx-0.5 h-11 w-11 rounded-full bg-gradient-to-br from-primary to-purple-600 text-white flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform">
              <Sparkles className="h-5 w-5" strokeWidth={2} />
            </button>
            {rightItems.map(renderNavItem)}
          </div>
          <button type="button" onClick={() => setMoreOpen(!moreOpen)} aria-label="Mais"
            className="dock-pill h-[52px] w-[52px] rounded-full flex items-center justify-center active:scale-95 transition-transform">
            <ChevronUp className={cn("h-6 w-6 transition-transform", moreOpen ? "rotate-180 text-primary" : isMoreActive ? "text-primary" : "text-muted-foreground")} strokeWidth={1.8}/>
          </button>
        </div>
      </div>
    </>
  );
}
