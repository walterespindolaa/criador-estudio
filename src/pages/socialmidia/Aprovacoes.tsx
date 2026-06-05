import { useState } from "react";
import { ApprovalTracker } from "@/components/accounts/ApprovalTracker";
import { ManagerSectionTitle } from "@/components/accounts/ManagerSectionTitle";
import { cn } from "@/lib/utils";

type ApprovalFilter = "pendente" | "ajuste_solicitado" | "aprovado" | null;

export default function Aprovacoes() {
  const [apprFilter, setApprFilter] = useState<ApprovalFilter>(null);
  return (
    <div>
      <ManagerSectionTitle t="Acompanhamento de Aprovações" s="Todas as pendências dos seus clientes num lugar só." />
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {([["Todas", null], ["Em ajuste", "ajuste_solicitado"], ["Pendentes", "pendente"], ["Aprovados", "aprovado"]] as [string, ApprovalFilter][]).map(([label, val]) => (
          <button key={label} onClick={() => setApprFilter(val)}
            className={cn("px-3.5 py-1.5 rounded-full text-xs font-body font-bold border transition-colors",
              apprFilter === val ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground")}>{label}</button>
        ))}
      </div>
      <ApprovalTracker hideHeader statusFilter={apprFilter} />
    </div>
  );
}
