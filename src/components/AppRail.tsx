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
    // Ordem pedida pelo Walter (31/08): Produção, Ideias, Tarefas.
    { label: "nav.inProduction", icon: Kanban, to: "/app/criando" },
    { label: "nav.ideas", icon: Lightbulb, to: "/app/ideias" },
    { label: "nav.tasks", icon: ListTodo, to: "/app/tarefas" },
  ]},
  // Cria Plano e Cria Stories saíram do CRIAR pro Mundo CRIA (pedido do
  // Walter, 31/08): é o grupo das ferramentas com cara de produto.
  { id: "mundo", label: "nav.world", icon: Globe, children: [
    { label: "nav.criaPlan", icon: Wand2, to: "/app/autopilot" },
    { label: "nav.criaStories", icon: Clapperboard, to: "/app/stories" },
    { label: "nav.trends", icon: TrendingUp, to: "/app/tendencias" },
    { label: "nav.criaPrompter", icon: Video, to: "/app/prompter" },
  ]},
  { id: "planejar", label: "nav.plan", icon: CalendarRange, children: [
    { label: "nav.myFeed", icon: Grid3X3, to: "/app/feed" },
    { label: "nav.approvals", icon: ClipboardCheck, to: "/app/aprovacao" },
    { label: "nav.calendarGoals", icon: Target, to: "/app/metas" },
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

// v2: guarda os grupos ABERTOS (fechado é o padrão; só Criar e Planejar
// nascem abertos). A chave v1 guardava o inverso (os fechados) e é migrada
// abaixo sem perder a preferência de quem já tinha customizado.
const GRUPOS_ABERTOS_KEY = "cria_rail_grupos_abertos_v2";
const GRUPOS_FECHADOS_KEY_V1 = "cria_rail_grupos_fechados";
const ABERTOS_PADRAO = ["criar", "planejar"];
const TODOS_GRUPOS = TOP.filter((n) => n.children).map((n) => n.id);

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

  // ── SEÇÕES COM MEMÓRIA POR APARELHO ───────────────────────────────────────
  // Com o menu aberto, os grupos viram SEÇÕES (cabeçalho pequeno em caps).
  // Padrão de primeira visita: tudo retraído, MENOS Criar e Planejar (o miolo
  // do dia a dia). Quem abrir/fechar uma seção fica com ela assim, lembrado
  // por aparelho. Migração da v1: a chave antiga guardava os FECHADOS (aberto
  // era padrão); se ela existe é porque a pessoa mexeu de propósito, então o
  // estado dela é convertido (abertos = todos menos os fechados) em vez de
  // jogado fora. O padrão novo só vale pra quem nunca teve preferência.
  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(GRUPOS_ABERTOS_KEY);
      if (raw) return new Set(JSON.parse(raw) as string[]);
      const v1 = localStorage.getItem(GRUPOS_FECHADOS_KEY_V1);
      if (v1) {
        const fechados = new Set(JSON.parse(v1) as string[]);
        const abertos = TODOS_GRUPOS.filter((id) => !fechados.has(id));
        localStorage.setItem(GRUPOS_ABERTOS_KEY, JSON.stringify(abertos));
        localStorage.removeItem(GRUPOS_FECHADOS_KEY_V1);
        return new Set(abertos);
      }
      return new Set(ABERTOS_PADRAO);
    } catch { return new Set(ABERTOS_PADRAO); }
  });
  const toggleGroup = (id: string) => {
    const next = new Set(openIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setOpenIds(next);
    // Só o clique da pessoa grava preferência (navegação não conta como escolha).
    try { localStorage.setItem(GRUPOS_ABERTOS_KEY, JSON.stringify([...next])); } catch { /* noop */ }
  };

  const matchTo = (to?: string, end?: boolean) =>
    !!to && (end ? pathname === to : pathname === to || pathname.startsWith(to + "/"));
  const nodeActive = (n: NavNode) =>
    matchTo(n.to, n.end) || (n.children?.some((c) => matchTo(c.to)) ?? false);

  // O grupo da tela atual se abre sozinho a cada navegação: a pessoa nunca cai
  // numa rota cujo item está escondido. Abre SEM persistir: é conveniência de
  // rota, não escolha de layout; a preferência salva só muda no clique do
  // cabeçalho. Fechar o grupo ativo à mão continua permitido.
  useEffect(() => {
    const grupoAtivo = TOP.find((n) => n.children?.some((c) => matchTo(c.to)));
    if (grupoAtivo && !openIds.has(grupoAtivo.id)) {
      setOpenIds((prev) => new Set(prev).add(grupoAtivo.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleClick = (n: NavNode) => {
    if (n.children) { toggleGroup(n.id); return; }
    if (n.action === "cria") { openCria(); return; }
    if (n.action === "logout") { void supabase.auth.signOut().then(() => navigate("/login")); return; }
    if (n.to) navigate(n.to);
  };

  const renderChild = (c: NavChild, visible: boolean) => {
    const CIcon = c.icon;
    const cActive = matchTo(c.to);
    // Item travado NAVEGA. Antes abria um popup genérico de "assine o Studio";
    // agora a pessoa cai na própria tela, onde o UpgradeGate mostra o que ELA
    // ganharia ali. Clicou porque queria.
    return (
      <button
        key={c.to + c.label}
        type="button"
        // Seção retraída: os itens ficam fora do tab (estão só escondidos pela
        // animação, não desmontados).
        tabIndex={visible ? undefined : -1}
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
      const isOpen = openIds.has(n.id);
      return (
        <div key={n.id} className="w-full pt-2">
          <button
            type="button"
            onClick={() => toggleGroup(n.id)}
            aria-expanded={isOpen}
            className={cn(
              // Título de seção em DESTAQUE (pedido do Walter, rodada 2): só a
              // cor não bastou ("colorido mas sem destaque"), então o título
              // virou uma pílula com fundo, igual no AppSidebar.
              // mb-1.5: a pílula do título ficava COLADA no primeiro item (print
              // do Walter, 31/08).
              "flex w-max max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1 mx-1 mb-1.5 text-left transition-colors",
              active ? "bg-primary/15 text-primary" : "bg-primary/10 text-primary/90 hover:bg-primary/15 hover:text-primary",
            )}
          >
            <span className="truncate text-[10.5px] font-display font-extrabold uppercase tracking-[0.1em]">{t(n.label)}</span>
            <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform duration-200", !isOpen && "-rotate-90")} />
          </button>
          {/* Abre/fecha deslizando (truque do grid 0fr → 1fr): nada de sumir
              no susto nem empurrar o resto do menu com pulo. */}
          <div
            aria-hidden={!isOpen}
            className={cn(
              "grid transition-[grid-template-rows] duration-200 ease-out",
              isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-0.5">{n.children.map((c) => renderChild(c, isOpen))}</div>
            </div>
          </div>
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
        {/* Parcerias (Collabs) é item de 1º nível e é do Studio passava sem selo. */}
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
        // Um CARTÃO inteiro: overflow-hidden aqui garante os 4 cantos redondos
        // sempre; quem rola é o miolo lá embaixo, nunca o cartão (era isso que
        // deixava o lado direito "quadrado" com a barra grudada na borda).
        "cria-rail-capsule fixed left-5 top-[calc(50%+0.75rem)] z-40 hidden max-h-[92vh] -translate-y-1/2 flex-col items-stretch overflow-hidden rounded-[24px] border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))] shadow-[0_22px_60px_-22px_rgba(35,25,70,0.3)] backdrop-blur-xl transition-[width] duration-200 md:flex",
        expanded ? "w-[248px]" : "w-[64px]",
      )}
    >
      {/* A MARCA + O PIN. Cabeçalho de altura fixa FORA da área de rolagem
          (logo e pin nunca somem nem brigam com o canto). Aberto, a logo
          alinha na coluna dos ícones dos itens e o pin encosta na folga
          direita; recolhido, só o ícone da logo centrado. */}
      <div className={cn("flex h-[52px] shrink-0 items-center", expanded ? "pl-[22px] pr-2.5" : "justify-center")}>
        {expanded ? (
          <>
            <Logo className="h-6 w-auto" />
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => {
                // Recolher precisa recolher NA HORA. Sem isto, o mouse ainda
                // esta sobre o menu, o hover segura ele aberto e so a pagina
                // recua, criando o efeito de "a pagina foi pra tras e o menu
                // ficou". Zerar o hover faz os dois se moverem juntos.
                if (pinned) setHovered(false);
                onTogglePin();
              }}
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

      {/* O MIOLO ROLÁVEL. A margem direita afasta a scrollbar (fina, ver
          .cria-rail-scroll no index.css) da borda arredondada do cartão. */}
      <div
        className={cn(
          "cria-rail-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-2.5",
          expanded ? "mr-1.5 pl-2.5 pr-1" : "px-0",
        )}
      >
        <div className="flex w-full flex-col items-stretch gap-1">{TOP.map(renderNode)}</div>
        <div className="mx-auto my-2 h-px w-8 bg-border" />
        <div className="flex w-full flex-col items-stretch gap-1">
          {isAdmin && renderNode({ id: "admin", label: "Admin", icon: ShieldCheck, to: "/app/cf-admin-panel" })}
          {BOTTOM.map(renderNode)}
        </div>
      </div>
    </nav>
  );
}

export default AppRail;
