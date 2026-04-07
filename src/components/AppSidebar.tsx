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
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
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

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { profile } = useProfile();

  const sidebarColor = profile?.theme_sidebar || undefined;

  // Convert hex to HSL for the CSS variable
  const sidebarStyle: React.CSSProperties | undefined = sidebarColor
    ? { '--sidebar-background': hexToHsl(sidebarColor) } as React.CSSProperties
    : undefined;

  const initials = profile?.name
    ? profile.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "CF";

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border"
      style={sidebarStyle}
    >
      {/* Profile header */}
      <div className="px-4 pt-5 pb-3 flex flex-col items-center gap-2">
        <button onClick={() => navigate("/app")} className="flex flex-col items-center gap-2">
          {!collapsed ? (
            <>
              <Avatar className="h-14 w-14 ring-2 ring-sidebar-primary/20">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt={profile?.name || "Avatar"} />
                ) : null}
                <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-lg font-display font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="text-sm font-display font-semibold text-sidebar-foreground leading-tight truncate max-w-[140px]">
                  {profile?.name || "Usuário"}
                </p>
                <p className="text-[10px] font-body text-sidebar-foreground/50 mt-0.5">CreatorsFlow</p>
              </div>
            </>
          ) : (
            <Avatar className="h-8 w-8">
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
    </Sidebar>
  );
}
