import { useState } from "react";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Home, Lightbulb, Kanban, CalendarDays,
  BookOpen, Archive, GraduationCap, FolderOpen, ListTodo, BookMarked, Settings, ChevronUp, LogOut, Sparkles, Grid3X3, Link2, ClipboardCheck, Handshake, Maximize2, Minimize2, Instagram, BarChart3, ShieldCheck, PlayCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { useCriaAI } from "@/contexts/CriaAIContext";

const leftItems = [
  { title: "Início", url: "/app", icon: Home, exact: true },
  { title: "Ideias", url: "/app/ideias", icon: Lightbulb },
];

const rightItems = [
  { title: "Calendário", url: "/app/metas", icon: CalendarDays },
];

type MoreItem = { title: string; url: string; icon: typeof Home };
const MORE_SECTIONS: { title: string; items: MoreItem[] }[] = [
  { title: "Criar", items: [
    { title: "Ideias", url: "/app/ideias", icon: Lightbulb },
    { title: "Em produção", url: "/app/criando", icon: Kanban },
    { title: "Aprovações", url: "/app/aprovacao", icon: ClipboardCheck },
    { title: "Meu Feed", url: "/app/feed", icon: Grid3X3 },
  ]},
  { title: "Planejar", items: [
    { title: "Calendário & Metas", url: "/app/metas", icon: CalendarDays },
    { title: "Tarefas", url: "/app/tarefas", icon: ListTodo },
    { title: "Arquivos", url: "/app/arquivos", icon: FolderOpen },
  ]},
  { title: "Minha marca", items: [
    { title: "Brandbook", url: "/app/brandbook", icon: BookMarked },
    { title: "Link na bio", url: "/app/linkinbio", icon: Link2 },
    { title: "Biblioteca", url: "/app/biblioteca", icon: BookOpen },
  ]},
  { title: "Resultados", items: [
    { title: "Insights", url: "/app/insights", icon: Instagram },
    { title: "Relatórios", url: "/app/relatorios", icon: BarChart3 },
    { title: "Histórico", url: "/app/historico", icon: Archive },
  ]},
  { title: "Aprender", items: [
    { title: "Cursos", url: "/app/aprender", icon: GraduationCap },
    { title: "Tutoriais", url: "/app/aprender", icon: PlayCircle },
  ]},
  { title: "Mais", items: [
    { title: "Parcerias", url: "/app/collabs", icon: Handshake },
    { title: "Configurações", url: "/app/configuracoes", icon: Settings },
  ]},
];

export function BottomBar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { openCria } = useCriaAI();
  const { profile } = useProfile();
  const sections = profile?.role === "admin"
    ? MORE_SECTIONS.map((s) => s.title === "Mais"
        ? { ...s, items: [...s.items, { title: "Admin", url: "/app/cf-admin-panel", icon: ShieldCheck }] }
        : s)
    : MORE_SECTIONS;
  const allMoreItems = sections.flatMap((s) => s.items);
  const [searchParams, setSearchParams] = useSearchParams();
  const onCriando = location.pathname === "/app/criando";
  const overview = searchParams.get("view") === "overview";
  const toggleOverview = () => {
    const next = new URLSearchParams(searchParams);
    overview ? next.delete("view") : next.set("view", "overview");
    setSearchParams(next, { replace: true });
  };

  const handleSignOut = async () => {
    setMoreOpen(false);
    await signOut();
    navigate("/");
  };

  const isActive = (url: string, exact?: boolean) => {
    if (exact) return location.pathname === url;
    return location.pathname.startsWith(url);
  };

  const isMoreActive = allMoreItems.some(item => location.pathname.startsWith(item.url));

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
          className="fixed left-3 right-3 z-40 md:hidden bg-card/95 backdrop-blur-lg border border-border rounded-3xl shadow-warm-lg p-4 max-h-[68vh] overflow-y-auto"
          style={{ bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))' }}
        >
          {sections.map((sec) => (
            <div key={sec.title} className="mb-3.5 last:mb-0">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 px-1 mb-1.5">{sec.title}</p>
              <div className="grid grid-cols-4 gap-2.5">
                {sec.items.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <NavLink key={item.url + item.title} to={item.url} onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-colors",
                        active ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground hover:text-foreground"
                      )}>
                      <item.icon className="h-5 w-5" strokeWidth={1.5} />
                      <span className="text-[10px] font-body font-medium leading-tight text-center">{item.title}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
          <button type="button" onClick={handleSignOut}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive/15 transition-colors text-sm font-body font-medium">
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
          {onCriando && (
            <button type="button" onClick={toggleOverview} aria-label={overview ? "Sair da visão geral" : "Visão geral"}
              className={cn("h-[52px] w-[52px] rounded-full flex items-center justify-center active:scale-95 transition-transform",
                overview ? "bg-gradient-to-br from-primary to-purple-600 shadow-lg shadow-primary/30" : "dock-pill")}>
              {overview ? <Minimize2 className="h-5 w-5 text-white" strokeWidth={2} />
                        : <Maximize2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.9} />}
            </button>
          )}
          <button type="button" onClick={() => setMoreOpen(!moreOpen)} aria-label="Mais"
            className="dock-pill h-[52px] w-[52px] rounded-full flex items-center justify-center active:scale-95 transition-transform">
            <ChevronUp className={cn("h-6 w-6 transition-transform", moreOpen ? "rotate-180 text-primary" : isMoreActive ? "text-primary" : "text-muted-foreground")} strokeWidth={1.8}/>
          </button>
        </div>
      </div>
    </>
  );
}
