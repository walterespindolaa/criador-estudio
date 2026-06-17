import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Layers, Lightbulb, ClipboardCheck, Grid3X3, ListTodo,
  CalendarRange, Kanban, Target, FolderOpen, Compass, BookOpen, BookMarked,
  Link2, Sparkles, BadgeDollarSign, BarChart3, Archive, GraduationCap,
  PlayCircle, Settings, LogOut, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCriaAI } from "@/contexts/CriaAIContext";
import { supabase } from "@/integrations/supabase/client";

type NavChild = { label: string; icon: LucideIcon; to: string };
type NavNode = {
  id: string; label: string; icon: LucideIcon;
  to?: string; end?: boolean; children?: NavChild[];
  action?: "cria" | "logout"; featured?: boolean;
};

const TOP: NavNode[] = [
  { id: "dash", label: "Dashboard", icon: LayoutDashboard, to: "/app", end: true },
  { id: "op", label: "Operação", icon: Layers, children: [
    { label: "Ideias", icon: Lightbulb, to: "/app/ideias" },
    { label: "Aprovações", icon: ClipboardCheck, to: "/app/aprovacao" },
    { label: "Meu Feed", icon: Grid3X3, to: "/app/feed" },
    { label: "Tarefas", icon: ListTodo, to: "/app/tarefas" },
  ]},
  { id: "plan", label: "Planejamento", icon: CalendarRange, children: [
    { label: "Criando", icon: Kanban, to: "/app/criando" },
    { label: "Metas", icon: Target, to: "/app/metas" },
    { label: "Arquivos", icon: FolderOpen, to: "/app/arquivos" },
  ]},
  { id: "estr", label: "Estratégia", icon: Compass, children: [
    { label: "Biblioteca", icon: BookOpen, to: "/app/biblioteca" },
    { label: "Brandbook", icon: BookMarked, to: "/app/brandbook" },
    { label: "Link in Bio", icon: Link2, to: "/app/linkinbio" },
  ]},
  { id: "ia", label: "Cria IA", icon: Sparkles, action: "cria", featured: true },
  { id: "mon", label: "Monetização", icon: BadgeDollarSign, to: "/app/collabs" },
  { id: "ana", label: "Análise", icon: BarChart3, children: [
    { label: "Relatórios", icon: BarChart3, to: "/app/relatorios" },
    { label: "Histórico", icon: Archive, to: "/app/historico" },
  ]},
  { id: "edu", label: "Educacional", icon: GraduationCap, children: [
    { label: "Cursos", icon: BookMarked, to: "/app/aprender" },
    { label: "Tutorial", icon: PlayCircle, to: "/app/aprender" },
  ]},
];

const BOTTOM: NavNode[] = [
  { id: "cfg", label: "Configurações", icon: Settings, to: "/app/configuracoes" },
  { id: "out", label: "Sair", icon: LogOut, action: "logout" },
];

export function AppRail() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { openCria } = useCriaAI();
  const [openId, setOpenId] = useState<string | null>(null);
  const railRef = useRef<HTMLElement>(null);

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
    return (
      <div key={n.id} className="group relative flex w-full justify-center">
        <button
          onClick={() => handleClick(n)}
          className={cn(
            "relative grid h-11 w-11 place-items-center rounded-2xl transition-colors",
            n.featured
              ? "bg-primary text-primary-foreground shadow-lg hover:brightness-105"
              : active
              ? "bg-primary/15 text-primary"
              : "text-[hsl(var(--sidebar-foreground))] hover:bg-primary/10 hover:text-primary",
          )}
          aria-label={n.label}
        >
          <Icon className="h-5 w-5" />
          {active && !n.featured && (
            <span className="absolute -left-2 top-1/2 h-4 w-1 -translate-y-1/2 rounded bg-primary" />
          )}
        </button>

        {openId !== n.id && (
          <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100">
            {n.label}
          </span>
        )}

        {n.children && openId === n.id && (
          <div className="absolute left-full top-1/2 z-50 ml-3 min-w-[230px] -translate-y-1/2 rounded-[22px] border border-border bg-card/90 p-3 shadow-2xl backdrop-blur-xl">
            <div className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {n.label}
            </div>
            {n.children.map((c) => {
              const CIcon = c.icon;
              return (
                <button
                  key={c.to + c.label}
                  onClick={() => { setOpenId(null); navigate(c.to); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground/80 transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <CIcon className="h-4 w-4" /> {c.label}
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
      className="cria-rail-capsule fixed left-5 top-1/2 z-40 hidden w-[72px] -translate-y-1/2 flex-col items-center rounded-[26px] border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))] py-3 shadow-[0_22px_60px_-22px_rgba(35,25,70,0.3)] backdrop-blur-xl md:flex"
    >
      <div className="mb-2 grid h-[42px] w-[42px] place-items-center rounded-[13px] bg-primary font-display text-[19px] font-extrabold text-primary-foreground">
        c
      </div>
      <div className="flex w-full flex-col items-center gap-1.5">{TOP.map(renderNode)}</div>
      <div className="my-2 h-px w-8 bg-border" />
      <div className="flex w-full flex-col items-center gap-1.5">{BOTTOM.map(renderNode)}</div>
    </nav>
  );
}

export default AppRail;
