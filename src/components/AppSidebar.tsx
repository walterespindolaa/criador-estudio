import {
  Lightbulb,
  Kanban,
  LayoutDashboard,
  BookOpen,
  CalendarDays,
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
  Handshake,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
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
import { AccountSwitcher } from "@/components/accounts/AccountSwitcher";

const groups = [
  {
    label: "Operação",
    items: [
      { title: "Dashboard", url: "/app", icon: LayoutDashboard, end: true },
      { title: "Ideias", url: "/app/ideias", icon: Lightbulb },
      { title: "Criando", url: "/app/criando", icon: Kanban },
      { title: "Aprovações", url: "/app/aprovacao", icon: ClipboardCheck },
      { title: "Meu Feed", url: "/app/feed", icon: Grid3X3 },
      { title: "Tarefas", url: "/app/tarefas", icon: ListTodo },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { title: "Meu Plano", url: "/app/plano", icon: CalendarDays },
      { title: "Arquivos", url: "/app/arquivos", icon: FolderOpen },
    ],
  },
  {
    label: "Estratégia",
    items: [
      { title: "Biblioteca", url: "/app/biblioteca", icon: BookOpen },
      { title: "Brandbook", url: "/app/brandbook", icon: BookMarked },
      { title: "Link in Bio", url: "/app/linkinbio", icon: Link2 },
    ],
  },
  {
    label: "Monetização",
    studioOnly: true,
    items: [
      { title: "Collabs", url: "/app/collabs", icon: Handshake, comingSoon: true },
    ],
  },
  {
    label: "Análise",
    items: [
      { title: "Relatórios", url: "/app/relatorios", icon: BarChart3 },
      { title: "Histórico", url: "/app/historico", icon: Archive },
    ],
  },
  {
    label: "Comece por aqui",
    items: [
      { title: "Aprender", url: "/app/aprender", icon: GraduationCap },
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
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[11px] font-display font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mt-4 mb-1.5">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const comingSoon = (item as { comingSoon?: boolean }).comingSoon;
                  if (comingSoon) {
                    const locked = tier !== "studio";
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          tooltip={item.title}
                          onClick={() => {
                            if (locked) navigate("/app/assinar");
                            else toast("Collabs chega em breve! 🚀");
                          }}
                          className="group relative rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150"
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
                          {!collapsed && (
                            <>
                              <span className="font-body text-sm">{item.title}</span>
                              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                {locked ? "Studio" : "Em breve"}
                              </span>
                            </>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }
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
                          {!collapsed && <span className="font-body text-sm">{item.title}</span>}
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
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-sm group-hover:shadow-glow transition-shadow flex-shrink-0">
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
