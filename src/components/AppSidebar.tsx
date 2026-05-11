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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
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

const groups = [
  {
    label: "Operação",
    items: [
      { title: "Dashboard", url: "/app", icon: LayoutDashboard, end: true },
      { title: "Ideias", url: "/app/ideias", icon: Lightbulb },
      { title: "Criando", url: "/app/criando", icon: Kanban },
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
    ],
  },
  {
    label: "Histórico",
    items: [
      { title: "Histórico", url: "/app/historico", icon: Archive },
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const initial = profile?.name?.charAt(0)?.toUpperCase() || "C";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <button
        onClick={() => navigate("/app")}
        className={cn(
          "flex items-center gap-3 mb-2 w-full text-left",
          collapsed ? "justify-center p-3" : "p-4"
        )}
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden ring-2 ring-primary/10 shrink-0">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-primary font-display font-bold text-sm">{initial}</span>
          )}
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
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end={(item as { end?: boolean }).end}
                        className="group rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150"
                        activeClassName="bg-primary/10 text-primary font-semibold"
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
                        {!collapsed && <span className="font-body text-sm">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="mt-auto">
        <div className={cn("border-t border-border", collapsed ? "p-2" : "p-3")}>
          <button
            type="button"
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-primary/5 hover:bg-primary/10 text-primary transition-all",
              collapsed && "justify-center px-2"
            )}
            aria-label="Cria IA"
          >
            <Sparkles className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
            {!collapsed && <span className="text-sm font-display font-semibold">Cria IA</span>}
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
