import { useState } from "react";
import { ArrowRight, Bell, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useSmartNotifications, type SmartNotification } from "@/hooks/useSmartNotifications";

const MAX_VISIBLE = 5;

const TYPE_STYLES: Record<SmartNotification["type"], { border: string; chip: string }> = {
  warning: {
    border: "border-l-amber-500",
    chip: "bg-amber-50 text-amber-700",
  },
  tip: {
    border: "border-l-blue-500",
    chip: "bg-blue-50 text-blue-700",
  },
  achievement: {
    border: "border-l-emerald-500",
    chip: "bg-emerald-50 text-emerald-700",
  },
  reminder: {
    border: "border-l-purple-500",
    chip: "bg-purple-50 text-purple-700",
  },
};

const TYPE_LABEL: Record<SmartNotification["type"], string> = {
  warning: "Aviso",
  tip: "Dica",
  achievement: "Conquista",
  reminder: "Lembrete",
};

export function SmartNotificationsCard() {
  const { notifications } = useSmartNotifications();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  if (notifications.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-sm font-display font-semibold text-foreground">Notificações</h3>
            <p className="text-[10px] text-muted-foreground font-body">Tudo em dia ✨</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground font-body text-center py-3">
          Tudo em dia! 🎉
          <br />
          <span className="text-xs">Continua publicando assim, criador!</span>
        </p>
      </div>
    );
  }

  const visible = expanded ? notifications : notifications.slice(0, MAX_VISIBLE);
  const hidden = notifications.length - MAX_VISIBLE;

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
          <Bell className="h-4 w-4 text-white" strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-display font-semibold text-foreground">Notificações</h3>
          <p className="text-[10px] text-muted-foreground font-body">Análise do seu fluxo</p>
        </div>
        <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-display font-bold">
          {notifications.length}
        </span>
      </div>

      <ul className="space-y-2.5">
        {visible.map((notif) => {
          const styles = TYPE_STYLES[notif.type];
          return (
            <li
              key={notif.id}
              className={cn(
                "border-l-2 bg-background/60 rounded-r-xl rounded-l-sm pl-3 pr-3 py-2.5",
                styles.border
              )}
            >
              <div className="flex items-start gap-2">
                <span className="text-base leading-none mt-0.5 shrink-0" aria-hidden="true">
                  {notif.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-sm font-display font-semibold text-foreground leading-snug">
                      {notif.title}
                    </p>
                    <span
                      className={cn(
                        "text-[9px] font-body font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full",
                        styles.chip
                      )}
                    >
                      {TYPE_LABEL[notif.type]}
                    </span>
                  </div>
                  <p className="text-xs font-body text-muted-foreground leading-relaxed">{notif.message}</p>
                  {notif.action && (
                    <button
                      type="button"
                      onClick={() => notif.action && navigate(notif.action.url)}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-body font-semibold text-primary hover:underline"
                    >
                      {notif.action.label} <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {!expanded && hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 text-xs font-body font-medium text-primary hover:underline"
        >
          Ver mais {hidden} notificaç{hidden === 1 ? "ão" : "ões"}
        </button>
      )}
      {expanded && hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-3 text-xs font-body font-medium text-muted-foreground hover:text-foreground"
        >
          Ver menos
        </button>
      )}
    </div>
  );
}
