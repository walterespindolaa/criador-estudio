import { useNavigate } from "react-router-dom";
import { Zap, ArrowRight, CheckCircle2 } from "lucide-react";
import { useSmartNotifications } from "@/hooks/useSmartNotifications";

/* AVISOS DENTRO DA PRÓXIMA AÇÃO (Walter, 30/10/2026, mockup aprovado).
   O bloco "Notificações" da home repetia o primeiro aviso, que já é a
   próxima ação. Com comAvisos, os outros (até 3) entram aqui embaixo e o
   bloco separado sai da home. */
const ROTULO: Record<string, { txt: string; cls: string }> = {
  warning: { txt: "AVISO", cls: "bg-amber-100 text-amber-800" },
  tip: { txt: "DICA", cls: "bg-blue-100 text-blue-800" },
  achievement: { txt: "CONQUISTA", cls: "bg-emerald-100 text-emerald-800" },
  reminder: { txt: "LEMBRETE", cls: "bg-violet-100 text-violet-800" },
};

export function NextBestAction({ comAvisos = false }: { comAvisos?: boolean } = {}) {
  const navigate = useNavigate();
  const { notifications } = useSmartNotifications();
  const top = notifications[0];
  const outros = comAvisos ? notifications.slice(1, 4) : [];

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
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-5">
    <div className="flex items-center gap-4">
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
    {outros.length > 0 && (
      <ul className="mt-3 space-y-1.5 border-t border-primary/15 pt-3 sm:ml-[60px]">
        {outros.map((n) => (
          <li key={n.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px]">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ROTULO[n.type]?.cls ?? "bg-muted"}`}>{ROTULO[n.type]?.txt ?? "AVISO"}</span>
            <b className="font-semibold">{n.title}</b>
            <span className="min-w-0 flex-1 truncate text-muted-foreground max-sm:basis-full">{n.message}</span>
            {n.action && (
              <button type="button" onClick={() => navigate(n.action!.url)} className="shrink-0 font-bold text-primary hover:underline">
                {n.action.label} →
              </button>
            )}
          </li>
        ))}
      </ul>
    )}
    </div>
  );
}

export default NextBestAction;
