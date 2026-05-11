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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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

  const initials = profile?.name
    ? profile.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "CF";

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border"
    >
      {/* Profile header */}
      <div className={cn("flex flex-col items-center", collapsed ? "px-2 pt-4 pb-2" : "px-4 pt-6 pb-4")}>
        <button onClick={() => navigate("/app")} className="flex flex-col items-center gap-3 w-full">
          {!collapsed ? (
            <>
              <Avatar className="h-20 w-20 ring-2 ring-sidebar-primary/20 shadow-md">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt={profile?.name || "Avatar"} />
                ) : null}
                <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-2xl font-display font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="text-base font-display font-bold text-sidebar-foreground leading-tight truncate max-w-[160px]">
                  {profile?.name || "Usuário"}
                </p>
                <p className="text-[11px] font-body text-sidebar-foreground/50 mt-1">CreatorsFlow</p>
              </div>
            </>
          ) : (
            <Avatar className="h-9 w-9">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={profile?.name || "Avatar"} />
              ) : null}
              <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs font-display font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          )}
        </button>
      </div>
      {!collapsed && <div className="mx-4 mb-2 border-b border-sidebar-border" />}

      <SidebarContent className="px-2">
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] font-body font-semibold uppercase tracking-widest text-sidebar-foreground/50 px-3 mb-1">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={(item as any).end}
                        className="hover:bg-sidebar-accent/60 rounded-xl transition-colors text-sidebar-foreground/80"
                        activeClassName="bg-sidebar-primary/10 text-sidebar-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4 flex-shrink-0" />
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

      <SidebarFooter className="px-2 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              tooltip="Sair"
              className={cn(
                "rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                collapsed && "justify-center"
              )}
            >
              <LogOut className={cn("h-4 w-4 flex-shrink-0", !collapsed && "mr-2")} />
              {!collapsed && <span className="font-body text-sm">Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
