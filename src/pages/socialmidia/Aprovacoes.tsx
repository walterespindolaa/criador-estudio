import { useState } from "react";
import { Link } from "react-router-dom";
import { Send, ChevronRight } from "lucide-react";
import { ApprovalTracker } from "@/components/accounts/ApprovalTracker";
import { ManagerSectionTitle } from "@/components/accounts/ManagerSectionTitle";
import { cn } from "@/lib/utils";

type ApprovalFilter = "pendente" | "ajuste_solicitado" | "aprovado" | null;

export default function Aprovacoes() {
  const [apprFilter, setApprFilter] = useState<ApprovalFilter>(null);
  return (
    <div>
      <ManagerSectionTitle t="Aprovações" s="As pendências que o Cria te manda pra revisar." />
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {([["Todas", null], ["Em ajuste", "ajuste_solicitado"], ["Pendentes", "pendente"], ["Aprovados", "aprovado"]] as [string, ApprovalFilter][]).map(([label, val]) => (
          <button key={label} onClick={() => setApprFilter(val)}
            className={cn("px-3.5 py-1.5 rounded-full text-xs font-body font-bold border transition-colors",
              apprFilter === val ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground")}>{label}</button>
        ))}
      </div>
      <ApprovalTracker hideHeader statusFilter={apprFilter} />

      {/* As aprovações por link dos clientes ficam no Cria Post (dono do kanban). */}
      <Link to="/socialmidia/criapost" className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0"><Send className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="font-display font-bold text-foreground text-sm">Aprovações por link (Cria Post)</p>
            <p className="text-xs text-muted-foreground font-body">As aprovações dos clientes por link ficam no Cria Post. Toque pra ver e gerenciar.</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </Link>
    </div>
  );
}
