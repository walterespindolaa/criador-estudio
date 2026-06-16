import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";

const PRIORITY_COLOR: Record<string, string> = {
  urgente: "#ef4444", alta: "#f59e0b", media: "var(--primary)", baixa: "#22c55e",
};
const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function dateLabel(iso: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(iso + "T00:00:00");
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function UpcomingTasks() {
  const navigate = useNavigate();
  const { tasks } = useTasks({ limit: 50 });
  const today = new Date().toISOString().split("T")[0];

  const upcoming = useMemo(() => {
    return tasks
      .filter((t) => t.status !== "concluida" && t.due_date)
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
      .slice(0, 5);
  }, [tasks]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-warm)]">
      <h3 className="mb-1 flex items-center gap-2 font-display text-[15px] font-bold">
        <CheckSquare className="h-4 w-4 text-primary" /> Próximas tarefas
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">Por vencimento</p>
      {upcoming.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Nenhuma tarefa com prazo. <button onClick={() => navigate("/app/tarefas")} className="font-semibold text-primary">Criar tarefa →</button></p>
      ) : (
        <ul className="divide-y divide-border">
          {upcoming.map((t) => {
            const overdue = t.due_date! < today;
            return (
              <li key={t.id} onClick={() => navigate("/app/tarefas")} className="flex cursor-pointer items-center gap-3 py-2.5 hover:opacity-80">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PRIORITY_COLOR[t.priority] ?? "var(--muted-foreground)" }} />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">{t.title}</p>
                <span className={overdue ? "shrink-0 text-xs font-semibold text-red-500" : "shrink-0 text-xs text-muted-foreground"}>{overdue ? "atrasada" : dateLabel(t.due_date!)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default UpcomingTasks;
