import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Lightbulb, Kanban, CalendarDays, BookOpen, MoreHorizontal, Archive, GraduationCap, FolderOpen, ListTodo, X, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const primaryItems = [
  { title: "Ideias", url: "/app/ideias", icon: Lightbulb },
  { title: "Criando", url: "/app/criando", icon: Kanban },
  { title: "Plano", url: "/app/plano", icon: CalendarDays },
  { title: "Biblioteca", url: "/app/biblioteca", icon: BookOpen },
];

const moreItems = [
  { title: "Tarefas", url: "/app/tarefas", icon: ListTodo },
  { title: "Arquivos", url: "/app/arquivos", icon: FolderOpen },
  { title: "Moodboard", url: "/app/moodboard", icon: Heart },
  { title: "Histórico", url: "/app/historico", icon: Archive },
  { title: "Aprender", url: "/app/aprender", icon: GraduationCap },
];

export function BottomBar() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute bottom-16 right-2 bg-card border border-border rounded-xl shadow-lg p-2 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
            {moreItems.map((item) => (
              <NavLink
                key={item.url}
                to={item.url}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-body",
                    isActive ? "text-primary bg-primary/10" : "text-foreground hover:bg-accent"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[hsl(var(--background))] border-t border-border z-50 md:hidden flex items-center justify-around px-2">
        {primaryItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 transition-colors px-1",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[11px] font-body font-medium">{item.title}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className={cn(
            "flex flex-col items-center justify-center gap-1 transition-colors px-1",
            moreOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {moreOpen ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
          <span className="text-[11px] font-body font-medium">Mais</span>
        </button>
      </nav>
    </>
  );
}
