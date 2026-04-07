import { NavLink } from "react-router-dom";
import { Lightbulb, Kanban, CalendarDays, BookOpen, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

const bottomNavItems = [
  { title: "Ideias", url: "/app/ideias", icon: Lightbulb },
  { title: "Criando", url: "/app/criando", icon: Kanban },
  { title: "Plano", url: "/app/plano", icon: CalendarDays },
  { title: "Biblioteca", url: "/app/biblioteca", icon: BookOpen },
  { title: "Histórico", url: "/app/historico", icon: Archive },
];

export function BottomBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#FAF8F4] border-t border-[rgba(28,28,26,0.08)] z-50 md:hidden flex items-center justify-around px-2">
      {bottomNavItems.map((item) => (
        <NavLink
          key={item.url}
          to={item.url}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center justify-center gap-1 transition-colors px-1",
              isActive ? "text-[#C4622D]" : "text-muted-foreground hover:text-foreground"
            )
          }
        >
          <item.icon className="h-5 w-5" />
          <span className="text-[11px] font-body font-medium">{item.title}</span>
        </NavLink>
      ))}
    </nav>
  );
}
