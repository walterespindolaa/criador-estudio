import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, PenLine, Lightbulb, ClipboardCheck, Grid3X3, ListTodo,
  CalendarRange, Kanban, Target, FolderOpen, Palette, BookOpen, BookMarked,
  Link2, Sparkles, BadgeDollarSign, BarChart3, Archive, GraduationCap,
  PlayCircle, Settings, LogOut, Instagram, ShieldCheck, ChevronDown, Wand2, IdCard, TrendingUp, Clapperboard, Trash2, Gem, Video, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCriaAI } from "@/contexts/CriaAIContext";
import { useProfile } from "@/hooks/useProfile";
import { useT } from "@/lib/i18n";
import { PlanTag } from "@/components/shared/PlanTag";
import { Logo } from "@/components/shared/Logo";
import { supabase } from "@/integrations/supabase/client";

type NavChild = { label: string; icon: LucideIcon; to: string };
type NavNode = {
  id: string; label: string; icon: LucideIcon;
  to?: string; end?: boolean; children?: NavChild[];
  action?: "cria" | "logout"; featured?: boolean;
};

const TOP: NavNode[] = [
  { id: "dash", label: "nav.home", icon: LayoutDashboard, to: "/app", end: true },
  { id: "ia", label: "nav.criaAi", icon: Sparkles, action: "cria", featured: true },
  { id: "criar", label: "nav.create", icon: PenLine, children: [
    { label: "nav.ideas", icon: Lightbulb, to: "/app/ideias" },
    { label: "nav.inProduction", icon: Kanban, to: "/app/criando" },
    { label: "nav.criaPlan", icon: Wand2, to: "/app/autopilot" },
    { label: "nav.criaStories", icon: Clapperboard, to: "/app/stories" },
    { label: "nav.criaPrompter", icon: Video, to: "/app/prompter" },
    { label: "nav.trends", icon: TrendingUp, to: "/app/tendencias" },
    { label: "nav.approvals", icon: ClipboardCheck, to: "/app/aprovacao" },
    { label: "nav.myFeed", icon: Grid3X3, to: "/app/feed" },
  ]},
  { id: "planejar", label: "nav.plan", icon: CalendarRange, children: [
    { label: "nav.calendarGoals", icon: Target, to: "/app/metas" },
    { label: "nav.tasks", icon: ListTodo, to: "/app/tarefas" },
    { label: "nav.files", icon: FolderOpen, to: "/app/arquivos" },
  ]},
  { id: "marca", label: "nav.myBrand", icon: Palette, children: [
    { label: "nav.brandbook", icon: BookMarked, to: "/app/brandbook" },
    { label: "nav.linkInBio", icon: Link2, to: "/app/linkinbio" },
    { label: "nav.mediaKit", icon: IdCard, to: "/app/media-kit" },
    { label: "nav.library", icon: BookOpen, to: "/app/biblioteca" },
  ]},
  { id: "result", label: "nav.results", icon: BarChart3, children: [
    { label: "nav.insights", icon: Instagram, to: "/app/insights" },
    { label: "nav.reports", icon: BarChart3, to: "/app/relatorios" },
    { label: "nav.history", icon: Archive, to: "/app/historico" },
  ]},
  { id: "aprender", label: "nav.learn", icon: GraduationCap, children: [
    { label: "nav.courses", icon: BookMarked, to: "/app/aprender" },
    { label: "nav.tutorials", icon: PlayCircle, to: "/app/aprender" },
  ]},
  { id: "parcerias", label: "nav.partnerships", icon: BadgeDollarSign, to: "/app/collabs" },
];

const BOTTOM: NavNode[] = [
  { id: "lixeira", label: "nav.trash", icon: Trash2, to: "/app/lixeira" },
  // PLANOS. Não existia NENHUM lugar no sistema pra pessoa ver o plano que tem,
  // comparar, ou fazer upgrade. Quem quisesse pagar mais não tinha por onde.
  { id: "planos", label: "Planos", icon: Gem, to: "/app/assinar" },
  { id: "cfg", label: "nav.settings", icon: Settings, to: "/app/configuracoes" },
  { id: "out", label: "nav.signOut", icon: LogOut, action: "logout" },
];

export function AppRail() {
  const t = useT();
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
          title={!expanded ? t(n.label) : undefined}
          aria-label={t(n.label)}
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
          {expanded && <span className="flex-1 truncate text-left text-sm font-medium">{t(n.label)}</span>}
          {/* Parcerias (Collabs) é item de 1º nível e é do Studio — passava sem selo. */}
          {expanded && n.to && !n.children && <PlanTag to={n.to} />}
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
              // Item travado agora NAVEGA. Antes abria um popup genérico de
              // "assine o Studio"; agora a pessoa cai na própria tela, onde o
              // UpgradeGate mostra o que ELA ganharia ali. Clicou porque queria.
              return (
                <button
                  key={c.to + c.label}
                  onClick={() => { setOpenId(null); navigate(c.to); }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl py-2 pl-11 pr-3 text-left text-sm font-medium transition-colors",
                    cActive ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-primary/10 hover:text-primary",
                  )}
                >
                  <CIcon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{t(c.label)}</span>
                  {/* O selo sai do mapa de planos, não de um booleano na mão:
                      antes SÓ o Cria Plano e o Stories tinham marcação, e
                      Insights / Tendências / Media Kit / Relatórios apareciam
                      como se fossem de todo mundo. */}
                  <PlanTag to={c.to} />
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
      {/* A MARCA. Era um "c" digitado à mão num quadrado (não era a logo).
          Agora usa a logo de verdade: só o ícone quando recolhido, o lettering
          inteiro quando expande. */}
      <div className={cn("mb-2 flex items-center", expanded ? "gap-2 px-2" : "justify-center")}>
        {expanded ? (
          <Logo className="h-7 w-auto" />
        ) : (
          <Logo icon className="h-[38px] w-[38px] rounded-[12px]" />
        )}
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
