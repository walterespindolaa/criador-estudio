import { Link } from "react-router-dom";
import { Contact } from "lucide-react";
import { ModuleGate } from "@/components/accounts/ModuleGate";
import { ExternalApprovalsPanel } from "@/components/accounts/ExternalApprovalsPanel";
import { ManagerCalendar } from "@/components/accounts/ManagerCalendar";
import { QuickReportCard } from "@/components/accounts/QuickReportCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// O Cria Post virou o painel de APROVAÇÕES por link. A lista de clientes que morava
// aqui foi consolidada em /socialmidia/clientes (hub único): clicar em qualquer post
// abre o cliente lá. Assim não existem mais duas listas de clientes concorrentes.
export default function CriaPost() {
  return (
    <ModuleGate code="aprovapost_externo">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight">Cria Post</h1>
          <p className="text-sm text-muted-foreground font-body mt-1">Acompanhe as aprovações por link de todos os clientes. Pra criar e editar posts, abra o cliente.</p>
        </div>
        <Button variant="outline" asChild className="shrink-0">
          <Link to="/socialmidia/clientes"><Contact className="h-4 w-4 mr-1.5" /> Ver clientes</Link>
        </Button>
      </div>
      <Tabs defaultValue="aprovacoes" className="w-full">
        <TabsList className="bg-card border border-border rounded-2xl p-1.5 mb-5">
          <TabsTrigger value="aprovacoes" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Aprovações</TabsTrigger>
          <TabsTrigger value="calendario" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Calendário geral</TabsTrigger>
        </TabsList>
        <TabsContent value="aprovacoes">
          {/* Relatório rápido: cliente + período + 1 clique, sem passar pela personalização */}
          <QuickReportCard />
          <ExternalApprovalsPanel />
        </TabsContent>
        <TabsContent value="calendario"><ManagerCalendar /></TabsContent>
      </Tabs>
    </ModuleGate>
  );
}
