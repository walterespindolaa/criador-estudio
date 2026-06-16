import { useNavigate } from "react-router-dom";
import { Zap, ArrowRight, CheckCircle2 } from "lucide-react";
import { useSmartNotifications } from "@/hooks/useSmartNotifications";

export function NextBestAction() {
  const navigate = useNavigate();
  const { notifications } = useSmartNotifications();
  const top = notifications[0];

  if (!top) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-primary/15 bg-primary/[0.06] p-5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-[15px] font-bold">Você está em dia ✨</p>
          <p className="text-sm text-muted-foreground">Sem pendências urgentes. Que tal planejar a próxima semana?</p>
        </div>
        <button onClick={() => navigate("/app/metas")} className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
          Ver metas <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-5">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Zap className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Sua próxima melhor ação</p>
        <p className="font-display text-[15px] font-bold leading-tight">{top.title}</p>
        <p className="line-clamp-2 text-sm text-muted-foreground">{top.message}</p>
      </div>
      {top.action && (
        <button onClick={() => navigate(top.action!.url)} className="ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
          {top.action.label} <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default NextBestAction;
