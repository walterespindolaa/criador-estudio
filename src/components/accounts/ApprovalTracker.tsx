import { useNavigate } from "react-router-dom";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useManagerApprovalItems } from "@/hooks/useApprovals";
import { Clock, RotateCcw, ChevronRight } from "lucide-react";

function initial(name: string | null) {
  return (name ?? "?").trim().charAt(0).toUpperCase() || "?";
}

type ApprovalTrackerProps = {
  hideHeader?: boolean;
  limit?: number;
  statusFilter?: "pendente" | "ajuste_solicitado" | "aprovado" | null;
};

export function ApprovalTracker({ hideHeader = false, limit, statusFilter = null }: ApprovalTrackerProps = {}) {
  const navigate = useNavigate();
  const { setActiveAccount } = useActiveAccount();
  const { items, isLoading } = useManagerApprovalItems();

  if (isLoading || items.length === 0) return null;

  const filtered = statusFilter ? items.filter((it) => it.approval_status === statusFilter) : items;
  const visible = typeof limit === "number" ? filtered.slice(0, limit) : filtered;
  if (visible.length === 0) return null;

  const open = (ownerId: string) => {
    setActiveAccount(ownerId);
    navigate("/app/aprovacao");
  };

  return (
    <section className="mb-8">
      {!hideHeader && (
        <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Acompanhamento de aprovações
        </h2>
      )}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {visible.map((it) => {
          const isAdjust = it.approval_status === "ajuste_solicitado";
          return (
            <button
              key={it.post_id}
              onClick={() => open(it.owner_id)}
              className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                {it.client_avatar ? (
                  <img src={it.client_avatar} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-sm font-display font-bold text-primary">{initial(it.client_name)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-body font-medium text-foreground truncate">{it.title}</p>
                <p className="text-[11px] text-muted-foreground font-body truncate">
                  {it.client_name ?? "Cliente"}{it.scheduled_date ? ` · ${it.scheduled_date}` : ""}
                </p>
                {isAdjust && it.last_comment && (
                  <p className="text-[11px] text-orange-700 font-body truncate mt-0.5">“{it.last_comment}”</p>
                )}
              </div>
              <span className={`shrink-0 text-[11px] font-body font-semibold px-2 py-1 rounded-full inline-flex items-center gap-1 ${
                isAdjust ? "bg-orange-100 text-orange-800 border border-orange-200" : "bg-yellow-100 text-yellow-900 border border-yellow-300"
              }`}>
                {isAdjust ? <RotateCcw className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {isAdjust ? "Em ajuste" : "Aguardando"}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
