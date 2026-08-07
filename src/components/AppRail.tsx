import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, PenLine, Lightbulb, ClipboardCheck, Grid3X3, ListTodo,
  CalendarRange, Kanban, Target, FolderOpen, Palette, BookOpen, BookMarked,
  Link2, Sparkles, BadgeDollarSign, BarChart3, Archive, GraduationCap,
  PlayCircle, Settings, LogOut, Instagram, ShieldCheck, ChevronDown, ChevronsLeft,
  ChevronsRight, Wand2, IdCard, TrendingUp, Clapperboard, Trash2, Gem, Video, Globe, type LucideIcon,
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
  ]},
  { id: "mundo", label: "nav.world", icon: Globe, children: [
    { label: "nav.trends", icon: TrendingUp, to: "/app/tendencias" },
    { label: "nav.criaPrompter", icon: Video, to: "/app/prompter" },
  ]},
  { id: "planejar", label: "nav.plan", icon: CalendarRange, children: [
    { label: "nav.myFeed", icon: Grid3X3, to: "/app/feed" },
    { label: "nav.approvals", icon: ClipboardCheck, to: "/app/aprovacao" },
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

// Grupos que a pessoa FECHOU (aberto é o padrão), lembrados por aparelho.
const GRUPOS_FECHADOS_KEY = "cria_rail_grupos_fechados";

type AppRailProps = {
  // Fixado: o menu fica sempre aberto e a página abre espaço pra ele (o pai
  // AppLayout guarda esse estado, porque a margem do conteúdo depende dele).
  pinned?: boolean;
  onTogglePin?: () => void;
};

export function AppRail({ pinned = false, onTogglePin }: AppRailProps) {
  const t = useT();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { openCria } = useCriaAI();
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";
  const [hovered, setHovered] = useState(false);
  const expanded = pinned || hovered;

  // ── O FIM DA MEMÓRIA DE 2 LUGARES ─────────────────────────────────────────
  // Antes: acordeão de um grupo por vez, sem memória nenhuma. A pessoa tinha
  // que decorar "pasta + aba" e reabrir a pasta certa a cada visita.
  // Agora: com o menu aberto, os grupos viram SEÇÕES (cabeçalho pequeno em
  // caps + itens à vista). Tudo aberto por padrão; quem fechar uma seção é que
  // fica com ela fechada, e isso é lembrado por aparelho até reabrir.
  const [closedIds, setClosedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(GRUPOS_FECHADOS_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch { return new Set(); }
  });
  const persistClosed = (next: Set<string>) => {
    setClosedIds(next);
    try { localStorage.setItem(GRUPOS_FECHADOS_KEY, JSON.stringify([...next])); } catch { /* noop */ }
  };
  const toggleGroup = (id: string) => {
    const next = new Set(closedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    persistClosed(next);
  };

  const matchTo = (to?: string, end?: boolean) =>
    !!to && (end ? pathname === to : pathname === to || pathname.startsWith(to + "/"));
  const nodeActive = (n: NavNode) =>
    matchTo(n.to, n.end) || (n.children?.some((c) => matchTo(c.to)) ?? false);

  // O grupo da tela atual se abre sozinho a cada navegação: a pessoa nunca cai
  // numa rota cujo item está escondido. Depende SÓ da rota de propósito: fechar
  // o grupo ativo à mão é permitido e fica fechado até a próxima navegação.
  useEffect(() => {
    const grupoAtivo = TOP.find((n) => n.children?.some((c) => matchTo(c.to)));
    if (grupoAtivo && closedIds.has(grupoAtivo.id)) {
      const next = new Set(closedIds);
      next.delete(grupoAtivo.id);
      persistClosed(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleClick = (n: NavNode) => {
    if (n.children) { toggleGroup(n.id); return; }
    if (n.action === "cria") { openCria(); return; }
    if (n.action === "logout") { void supabase.auth.signOut().then(() => navigate("/login")); return; }
    if (n.to) navigate(n.to);
  };

  const renderChild = (c: NavChild) => {
    const CIcon = c.icon;
    const cActive = matchTo(c.to);
    // Item travado NAVEGA. Antes abria um popup genérico de "assine o Studio";
    // agora a pessoa cai na própria tela, onde o UpgradeGate mostra o que ELA
    // ganharia ali. Clicou porque queria.
    return (
      <button
        key={c.to + c.label}
        type="button"
        onClick={() => navigate(c.to)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
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
  };

  const renderNode = (n: NavNode) => {
    const Icon = n.icon;
    const active = nodeActive(n);

    // Grupo com o menu aberto: seção com cabeçalho pequeno (clicável só pra
    // quem quiser encolher) e os itens sempre visíveis logo abaixo.
    if (n.children && expanded) {
      const isOpen = !closedIds.has(n.id);
      return (
        <div key={n.id} className="w-full pt-1">
          <button
            type="button"
            onClick={() => toggleGroup(n.id)}
            aria-expanded={isOpen}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-lg px-3 pb-1 pt-1.5 text-left transition-colors",
              // Grupo da tela atual denuncia onde a pessoa está, mesmo fechado.
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="truncate text-[10px] font-semibold uppercase tracking-wider">{t(n.label)}</span>
            <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", !isOpen && "-rotate-90")} />
          </button>
          {isOpen && <div className="flex flex-col gap-0.5">{n.children.map(renderChild)}</div>}
        </div>
      );
    }

    // Item simples, ou grupo com o rail recolhido (só o ícone, com tooltip).
    return (
      <button
        key={n.id}
        type="button"
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
        {!expanded && active && !n.featured && (
          <span className="absolute -left-2 top-1/2 h-4 w-1 -translate-y-1/2 rounded bg-primary" />
        )}
      </button>
    );
  };

  return (
    <nav
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "cria-rail-capsule fixed left-5 top-[calc(50%+0.75rem)] z-40 hidden max-h-[92vh] -translate-y-1/2 flex-col items-stretch overflow-y-auto overflow-x-hidden rounded-[24px] border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))] py-2.5 shadow-[0_22px_60px_-22px_rgba(35,25,70,0.3)] backdrop-blur-xl transition-[width] duration-200 md:flex",
        expanded ? "w-[248px] px-2.5" : "w-[64px] px-0",
      )}
    >
      {/* A MARCA + O PIN. Logo de verdade (só o ícone quando recolhido) e, com o
          menu aberto, o botão de fixar: chevron duplo que alterna entre "sempre
          aberto" (a página abre espaço) e o recolher no hover de sempre. */}
      <div className={cn("mb-2 flex items-center", expanded ? "gap-2 px-2" : "justify-center")}>
        {expanded ? (
          <>
            <Logo className="h-7 w-auto" />
            <div className="flex-1" />
            <button
              type="button"
              onClick={onTogglePin}
              aria-pressed={pinned}
              title={pinned ? "Recolher o menu ao sair" : "Manter o menu sempre aberto"}
              aria-label={pinned ? "Recolher o menu ao sair" : "Manter o menu sempre aberto"}
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors",
                pinned
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
              )}
            >
              {pinned ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
            </button>
          </>
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
