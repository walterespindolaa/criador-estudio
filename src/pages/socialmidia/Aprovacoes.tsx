import { useState } from "react";
import { Link } from "react-router-dom";
import { Send, ChevronRight, CalendarRange, Clock, RotateCcw } from "lucide-react";
import { ApprovalTracker } from "@/components/accounts/ApprovalTracker";
import { ManagerSectionTitle } from "@/components/accounts/ManagerSectionTitle";
import { useExternalClients } from "@/hooks/useCriaPost";
import { useCronogramas } from "@/hooks/useCronograma";
import { cn } from "@/lib/utils";

type ApprovalFilter = "pendente" | "ajuste_solicitado" | "aprovado" | null;

export default function Aprovacoes() {
  const [apprFilter, setApprFilter] = useState<ApprovalFilter>(null);
  const { pending } = useExternalClients();
  const { cronogramas } = useCronogramas();

  const linkPending = Object.values(pending ?? {}).reduce((a, b) => a + (b || 0), 0);
  const clientsWaiting = Object.keys(pending ?? {}).filter((k) => (pending[k] ?? 0) > 0).length;
  const cronoAtivos = cronogramas.filter((c) => c.status !== "arquivado").length;

  return (
    <div>
      <ManagerSectionTitle t="Aprovações" s="Seu painel do que está pendente: o que falta revisar, o que espera o cliente e o que pediu ajuste." />

      {/* Direcionamento: cards de resumo (sem repetir o kanban do Cria Post) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <Link to="/socialmidia/criapost" className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500/12 text-amber-600 shrink-0"><Clock className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="font-display font-bold text-foreground text-sm">Aprovação por link (Cria Post)</p>
              <p className="text-xs text-muted-foreground font-body">{linkPending > 0 ? `${linkPending} post(s) esperando em ${clientsWaiting} cliente(s)` : "Tudo em dia com os clientes"}</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </Link>

        <Link to="/socialmidia/clientes" className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary shrink-0"><CalendarRange className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="font-display font-bold text-foreground text-sm">Cronogramas dos clientes</p>
              <p className="text-xs text-muted-foreground font-body">{cronoAtivos > 0 ? `${cronoAtivos} cronograma(s) ativo(s)` : "Nenhum cronograma ativo"}</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </Link>
      </div>

      {/* Suas aprovações do Cria (posts que o Cria te manda pra revisar) */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Send className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-display font-bold text-foreground">O que o Cria te manda revisar</p>
      </div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {([["Todas", null], ["Em ajuste", "ajuste_solicitado"], ["Pendentes", "pendente"], ["Aprovados", "aprovado"]] as [string, ApprovalFilter][]).map(([label, val]) => (
          <button key={label} onClick={() => setApprFilter(val)}
            className={cn("px-3.5 py-1.5 rounded-full text-xs font-body font-bold border transition-colors flex items-center gap-1",
              apprFilter === val ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
            {val === "ajuste_solicitado" && <RotateCcw className="h-3 w-3" />}{label}
          </button>
        ))}
      </div>
      <ApprovalTracker hideHeader statusFilter={apprFilter} />
    </div>
  );
}
