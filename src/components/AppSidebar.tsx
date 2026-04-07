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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate, useLocation } from "react-router-dom";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { useProfile } from "@/hooks/useProfile";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const groups = [
  {
    label: "Operação",
    items: [
      { title: "Dashboard", url: "/app", icon: LayoutDashboard, end: true },
      { title: "Ideias", url: "/app/ideias", icon: Lightbulb },
      { title: "Criando", url: "/app/criando", icon: Kanban },
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
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useProfile();

  const sidebarColor = profile?.theme_sidebar || undefined;

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border"
      style={sidebarColor ? { '--sidebar-background': sidebarColor } as React.CSSProperties : undefined}
    >
      {/* Logo */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <button onClick={() => navigate("/app")} className="text-left flex items-center gap-2 min-w-0">
          {!collapsed ? (
            <h1 className="text-lg font-display font-bold text-sidebar-foreground tracking-tight truncate">
              CreatorsFlow
            </h1>
          ) : (
            <span className="text-lg font-display font-bold text-sidebar-foreground">CF</span>
          )}
        </button>
      </div>

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
                        end={item.end}
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

      {/* Bottom area */}
      <div className="mt-auto p-2 space-y-1">
        <div className="flex items-center justify-center px-2">
          <NotificationsBell />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/app/configuracoes"
                className="hover:bg-sidebar-accent/60 rounded-xl transition-colors text-sidebar-foreground/80"
                activeClassName="bg-sidebar-primary/10 text-sidebar-primary font-medium"
              >
                <Settings className="mr-2 h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="font-body text-sm">Configurações</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
    </Sidebar>
  );
}
