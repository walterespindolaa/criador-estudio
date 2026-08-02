import { cn } from "@/lib/utils";

// Alternador "Kanban | Calendário" (mesmo visual usado no Cria Post).
// Fica aqui pra as duas telas dividirem o mesmo componente. O Cria Post ainda
// tem a versão inline dele; a troca por este componente é o próximo passo.
export type BoardView = "kanban" | "calendario";

export function ViewToggle({ value, onChange, className }: {
  value: BoardView;
  onChange: (v: BoardView) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-lg border border-border overflow-hidden", className)}>
      {(["kanban", "calendario"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={cn(
            "px-3 py-1.5 text-xs font-body font-semibold transition-colors",
            value === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v === "kanban" ? "Kanban" : "Calendário"}
        </button>
      ))}
    </div>
  );
}
