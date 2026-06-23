import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, PenLine, Lightbulb, ClipboardCheck, Grid3X3, ListTodo,
  CalendarRange, Kanban, Target, FolderOpen, Palette, BookOpen, BookMarked,
  Link2, Sparkles, BadgeDollarSign, BarChart3, Archive, GraduationCap,
  PlayCircle, Settings, LogOut, Instagram, ShieldCheck, ChevronDown, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCriaAI } from "@/contexts/CriaAIContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

type NavChild = { label: string; icon: LucideIcon; to: string };
type NavNode = {
  id: string; label: string; icon: LucideIcon;
  to?: string; end?: boolean; children?: NavChild[];
  action?: "cria" | "logout"; featured?: boolean;
};

const TOP: NavNode[] = [
  { id: "dash", label: "Início", icon: LayoutDashboard, to: "/app", end: true },
  { id: "ia", label: "Cria IA", icon: Sparkles, action: "cria", featured: true },
  { id: "criar", label: "Criar", icon: PenLine, children: [
    { label: "Ideias", icon: Lightbulb, to: "/app/ideias" },
    { label: "Em produção", icon: Kanban, to: "/app/criando" },
    { label: "Aprovações", icon: ClipboardCheck, to: "/app/aprovacao" },
    { label: "Meu Feed", icon: Grid3X3, to: "/app/feed" },
  ]},
  { id: "planejar", label: "Planejar", icon: CalendarRange, children: [
    { label: "Calendário & Metas", icon: Target, to: "/app/metas" },
    { label: "Tarefas", icon: ListTodo, to: "/app/tarefas" },
    { label: "Arquivos", icon: FolderOpen, to: "/app/arquivos" },
  ]},
  { id: "marca", label: "Minha marca", icon: Palette, children: [
    { label: "Brandbook", icon: BookMarked, to: "/app/brandbook" },
    { label: "Link na bio", icon: Link2, to: "/app/linkinbio" },
    { label: "Biblioteca", icon: BookOpen, to: "/app/biblioteca" },
  ]},
  { id: "result", label: "Resultados", icon: BarChart3, children: [
    { label: "Insights", icon: Instagram, to: "/app/insights" },
    { label: "Relatórios", icon: BarChart3, to: "/app/relatorios" },
    { label: "Histórico", icon: Archive, to: "/app/historico" },
  ]},
  { id: "aprender", label: "Aprender", icon: GraduationCap, children: [
    { label: "Cursos", icon: BookMarked, to: "/app/aprender" },
    { label: "Tutoriais", icon: PlayCircle, to: "/app/aprender" },
  ]},
  { id: "parcerias", label: "Parcerias", icon: BadgeDollarSign, to: "/app/collabs" },
];

const BOTTOM: NavNode[] = [
  { id: "cfg", label: "Configurações", icon: Settings, to: "/app/configuracoes" },
  { id: "out", label: "Sair", icon: LogOut, action: "logout" },
];

export function AppRail() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { openCria } = useCriaAI();
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";
  const [openId, setOpenId] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const railRef = useRef<HTMLElement>(null);
  const expanded = hovered;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (railRef.current && !railRef.current.contains(e.target as Node)) setOpenId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const matchTo = (to?: string, end?: boolean) =>
    !!to && (end ? pathname === to : pathname === to || pathname.startsWith(to + "/"));
  const nodeActive = (n: NavNode) =>
    matchTo(n.to, n.end) || (n.children?.some((c) => matchTo(c.to)) ?? false);

  const handleClick = (n: NavNode) => {
    if (n.children) { setOpenId(openId === n.id ? null : n.id); return; }
    setOpenId(null);
    if (n.action === "cria") { openCria(); return; }
    if (n.action === "logout") { void supabase.auth.signOut().then(() => navigate("/login")); return; }
    if (n.to) navigate(n.to);
  };

  const renderNode = (n: NavNode) => {
    const Icon = n.icon;
    const active = nodeActive(n);
    const isOpen = openId === n.id;
    return (
      <div key={n.id} className="w-full">
        <button
          onClick={() => handleClick(n)}
          title={!expanded ? n.label : undefined}
          aria-label={n.label}
          className={cn(
            "relative flex items-center transition-colors",
            expanded ? "h-10 w-full gap-3 rounded-xl px-3" : "mx-auto h-10 w-10 justify-center rounded-2xl",
            n.featured
              ? "bg-primary text-primary-foreground shadow-lg hover:brightness-105"
              : active
              ? "bg-primary/15 text-primary"
              : "text-[hsl(var(--sidebar-foreground))] hover:bg-primary/10 hover:text-primary",
          )}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          {expanded && <span className="flex-1 truncate text-left text-sm font-medium">{n.label}</span>}
          {expanded && n.children && (
            <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
          )}
          {!expanded && active && !n.featured && (
            <span className="absolute -left-2 top-1/2 h-4 w-1 -translate-y-1/2 rounded bg-primary" />
          )}
        </button>

        {expanded && n.children && isOpen && (
          <div className="mt-0.5 flex flex-col gap-0.5 pb-1">
            {n.children.map((c) => {
              const CIcon = c.icon;
              const cActive = matchTo(c.to);
              return (
                <button
                  key={c.to + c.label}
                  onClick={() => navigate(c.to)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl py-2 pl-11 pr-3 text-left text-sm font-medium transition-colors",
                    cActive ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-primary/10 hover:text-primary",
                  )}
                >
                  <CIcon className="h-4 w-4 shrink-0" /> {c.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav
      ref={railRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "cria-rail-capsule fixed left-5 top-[calc(50%+0.75rem)] z-40 hidden max-h-[92vh] -translate-y-1/2 flex-col items-stretch overflow-y-auto overflow-x-hidden rounded-[24px] border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))] py-2.5 shadow-[0_22px_60px_-22px_rgba(35,25,70,0.3)] backdrop-blur-xl transition-[width] duration-200 md:flex",
        expanded ? "w-[248px] px-2.5" : "w-[64px] px-0",
      )}
    >
      <div className={cn("mb-2 flex items-center", expanded ? "gap-2 px-2" : "justify-center")}>
        <div className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px] bg-primary font-display text-[17px] font-extrabold text-primary-foreground">
          c
        </div>
        {expanded && <span className="font-display text-lg font-extrabold text-foreground">Cria</span>}
      </div>
      <div className="flex w-full flex-col items-stretch gap-1">{TOP.map(renderNode)}</div>
      <div className="my-2 h-px w-8 self-center bg-border" />
      <div className="flex w-full flex-col items-stretch gap-1">
        {isAdmin && renderNode({ id: "admin", label: "Admin", icon: ShieldCheck, to: "/app/cf-admin-panel" })}
        {BOTTOM.map(renderNode)}
      </div>
    </nav>
  );
}

export default AppRail;
