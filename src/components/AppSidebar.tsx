import {
  Lightbulb,
  Kanban,
  TrendingUp,
  LayoutDashboard,
  BookOpen,
  Archive,
  Settings,
  GraduationCap,
  FolderOpen,
  ListTodo,
  BookMarked,
  LogOut,
  Grid3X3,
  Sparkles,
  BarChart3,
  Shield,
  Link2,
  IdCard,
  Handshake,
  ClipboardCheck,
  Package,
  Target,
  Clapperboard,
  Video,
  Wand2,
  Instagram,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/NavLink";
import { useNavigate, Link } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useCriaAI } from "@/contexts/CriaAIContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/shared/Logo";
import { AiUsageBadge } from "@/components/shared/AiUsageBadge";
import { useTier } from "@/hooks/useTier";
import { FEATURES, tierAtLeast, type FeatureKey } from "@/lib/plans";
import { AccountSwitcher } from "@/components/accounts/AccountSwitcher";

// Mesma linha de raciocínio do menu mobile (BottomBar): CRIAR -> PLANEJAR ->
// RESULTADOS -> MINHA MARCA -> MUNDO CRIA -> APRENDER -> MAIS. Ordem e grupos
// batem com o celular pra a pessoa achar tudo no mesmo lugar nos dois lados.
const groups = [
  {
    label: "Criar",
    items: [
      // Dashboard/Início continua sendo a porta de entrada, no topo do primeiro grupo.
      { title: "Dashboard", url: "/app", icon: LayoutDashboard, end: true },
      { title: "Ideias", url: "/app/ideias", icon: Lightbulb },
      // Cria Plano existia só no menu do celular e na URL: no desktop a pessoa
      // não achava a ferramenta que mais impressiona. Entra aqui, antes do
      // kanban, porque é ele que ENCHE o kanban.
      { title: "Cria Plano", url: "/app/autopilot", icon: Wand2, feature: "cria-plano" },
      { title: "Criando", url: "/app/criando", icon: Kanban },
      // Tarefa é o que destrava o post ("gravar o reel", "escrever a legenda"),
      // então mora ao lado do Criando e não em Planejar.
      { title: "Tarefas", url: "/app/tarefas", icon: ListTodo },
      { title: "Cria Stories", url: "/app/stories", icon: Clapperboard, feature: "stories" },
    ],
  },
  {
    label: "Planejar",
    items: [
      { title: "Meu Feed", url: "/app/feed", icon: Grid3X3, feature: "feed" },
      { title: "Aprovações", url: "/app/aprovacao", icon: ClipboardCheck },
      { title: "Metas", url: "/app/metas", icon: Target },
      { title: "Arquivos", url: "/app/arquivos", icon: FolderOpen },
    ],
  },
  {
    label: "Resultados",
    items: [
      // Insights também estava fora do menu do desktop, existindo só no celular.
      // Vem primeiro do grupo: é a tela com os números reais do Instagram.
      { title: "Insights", url: "/app/insights", icon: Instagram, feature: "insights" },
      { title: "Relatórios", url: "/app/relatorios", icon: BarChart3, feature: "relatorios" },
      { title: "Histórico", url: "/app/historico", icon: Archive, feature: "historico" },
    ],
  },
  {
    label: "Minha marca",
    items: [
      { title: "Brandbook", url: "/app/brandbook", icon: BookMarked },
      { title: "Link in Bio", url: "/app/linkinbio", icon: Link2 },
      { title: "Media Kit", url: "/app/media-kit", icon: IdCard, feature: "media-kit" },
      { title: "Biblioteca", url: "/app/biblioteca", icon: BookOpen, feature: "biblioteca" },
    ],
  },
  {
    label: "Mundo CRIA",
    items: [
      { title: "Tendências", url: "/app/tendencias", icon: TrendingUp, feature: "tendencias" },
      { title: "Cria Prompter", url: "/app/prompter", icon: Video, feature: "prompter" },
    ],
  },
  {
    label: "Aprender",
    items: [
      { title: "Aprender", url: "/app/aprender", icon: GraduationCap },
    ],
  },
  {
    label: "Mais",
    items: [
      { title: "Collabs", url: "/app/collabs", icon: Handshake, feature: "collabs" },
      // Módulos segue restrito a manager. A flag saiu do grupo e virou de item,
      // filtrada na renderização, pra não vazar pra quem não é agência.
      { title: "Módulos", url: "/app/modulos", icon: Package, managerOnly: true },
      { title: "Configurações", url: "/app/configuracoes", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { signOut } = useAuth();
  const { openCria } = useCriaAI();
  const { tier } = useTier();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const initial = profile?.name?.charAt(0)?.toUpperCase() || "C";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="flex items-center justify-center px-2 py-4 border-b border-sidebar-border/50">
        <Link to="/app" className="block transition-opacity hover:opacity-80" aria-label="Ir pra home">
          {collapsed ? (
            <Logo icon className="h-8 w-8" />
          ) : (
            <Logo className="h-9 w-auto" />
          )}
        </Link>
      </div>

      {!collapsed && (
        <div className="px-3 pt-3">
          <AccountSwitcher />
        </div>
      )}

      <button
        onClick={() => navigate("/app")}
        className={cn(
          "flex items-center gap-3 mb-2 w-full text-left",
          collapsed ? "justify-center p-3" : "p-4"
        )}
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 p-[2px] overflow-hidden shrink-0">
          <div className="w-full h-full rounded-full bg-card overflow-hidden flex items-center justify-center">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <span className="text-primary font-display font-bold text-sm">{initial}</span>
            )}
          </div>
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-display font-semibold text-foreground truncate">
              {profile?.name || "Criador"}
            </span>
            {profile?.instagram_handle && (
              <span className="text-[11px] text-muted-foreground truncate">
                @{profile.instagram_handle.replace(/^@/, "")}
              </span>
            )}
          </div>
        )}
      </button>

      <SidebarContent className="px-2">
        {groups
          .filter((group) => !(group as { managerOnly?: boolean }).managerOnly || profile?.account_type === "manager")
          .map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[11px] font-display font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mt-4 mb-1.5">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items
                  .filter((item) => !(item as { managerOnly?: boolean }).managerOnly || profile?.account_type === "manager")
                  .map((item) => {
                  // O item TRAVADO continua clicável, de propósito. Antes ele jogava
                  // a pessoa em /app/assinar (uma tabela de preços genérica). Agora
                  // ele abre a própria tela, onde o UpgradeGate mostra o que ela
                  // ganharia ALI. Ela clicou naquilo porque queria aquilo.
                  const fk = (item as { feature?: FeatureKey }).feature;
                  const min = fk ? FEATURES[fk]?.minimo : undefined;
                  const travado = !!min && min !== "admin" && !tierAtLeast(tier, min);
                  const selo = min === "studio" ? "Studio" : min === "pro" ? "Pro" : null;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <NavLink
                          to={item.url}
                          end={(item as { end?: boolean }).end}
                          className="group relative rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150"
                          activeClassName="bg-primary/10 text-primary font-semibold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-5 before:bg-primary before:rounded-r-full before:content-['']"
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
                          {!collapsed && (
                            <>
                              <span className="font-body text-sm">{item.title}</span>
                              {travado && selo && (
                                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                  {selo}
                                </span>
                              )}
                            </>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {profile?.role === "admin" && (
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="text-[11px] font-display font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mt-4 mb-1.5">
                Admin
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Admin">
                    <NavLink
                      to="/app/cf-admin-panel"
                      className="group relative rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150"
                      activeClassName="bg-red-500/10 text-red-500 font-semibold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-5 before:bg-red-500 before:rounded-r-full before:content-['']"
                    >
                      <Shield className="h-5 w-5 flex-shrink-0 text-red-500" strokeWidth={1.5} />
                      {!collapsed && <span className="font-body text-sm">Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="mt-auto">
        {!collapsed && <AiUsageBadge />}
        <div className={cn("border-t border-border", collapsed ? "p-2" : "p-3")}>
          <button
            type="button"
            onClick={() => openCria()}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-primary transition-all group",
              "bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10",
              "hover:from-primary/15 hover:via-purple-500/15 hover:to-pink-500/15",
              collapsed && "justify-center px-2"
            )}
            aria-label="cria"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-pink-400 flex items-center justify-center shadow-sm group-hover:shadow-glow transition-shadow flex-shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2} />
            </div>
            {!collapsed && <span className="text-sm font-display font-semibold">cria</span>}
          </button>
        </div>
        <div className={cn(collapsed ? "px-2 pb-3" : "px-3 pb-3")}>
          <button
            type="button"
            onClick={handleSignOut}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all",
              collapsed && "justify-center px-2"
            )}
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
            {!collapsed && <span className="text-sm font-body">Sair</span>}
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
