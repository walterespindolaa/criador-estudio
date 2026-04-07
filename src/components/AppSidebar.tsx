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
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Minhas Ideias", url: "/app/ideias", icon: Lightbulb },
  { title: "Estou Criando", url: "/app/criando", icon: Kanban },
  { title: "Meu Plano", url: "/app/plano", icon: CalendarDays },
  { title: "Biblioteca", url: "/app/biblioteca", icon: BookOpen },
  { title: "Tarefas", url: "/app/tarefas", icon: ListTodo },
  { title: "Arquivos", url: "/app/arquivos", icon: FolderOpen },
  { title: "Histórico", url: "/app/historico", icon: Archive },
  { title: "Aprender Mais", url: "/app/aprender", icon: GraduationCap },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="p-4 pb-2">
        <button onClick={() => navigate("/app")} className="text-left">
          {!collapsed ? (
            <h1 className="text-xl font-display font-bold text-foreground">Criadores</h1>
          ) : (
            <span className="text-xl font-display font-bold text-foreground">C</span>
          )}
        </button>
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-accent/60 rounded-xl transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span className="font-body">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <div className="mt-auto p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/app/configuracoes"
                className="hover:bg-accent/60 rounded-xl transition-colors"
                activeClassName="bg-primary/10 text-primary font-medium"
              >
                <Settings className="mr-2 h-4 w-4" />
                {!collapsed && <span className="font-body">Configurações</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
    </Sidebar>
  );
}
