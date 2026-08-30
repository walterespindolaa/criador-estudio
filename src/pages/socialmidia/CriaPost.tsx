import { useEffect, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Contact } from "lucide-react";
import { ModuleGate } from "@/components/accounts/ModuleGate";
import { ModuleHero, type SubTab } from "@/components/brand/ModuleHero";
import { ExternalApprovalsPanel } from "@/components/accounts/ExternalApprovalsPanel";
import { ManagerCalendar } from "@/components/accounts/ManagerCalendar";
import { PainelComParceiros } from "@/components/accounts/PainelComParceiros";
import { QuickReportCard } from "@/components/accounts/QuickReportCard";
import { Button } from "@/components/ui/button";
import { useExternalClients } from "@/hooks/useCriaPost";
import { useMeusParceiros } from "@/hooks/useParceiro";

// O Cria Post virou o painel de APROVAÇÕES por link. A lista de clientes que morava
// aqui foi consolidada em /socialmidia/clientes (hub único): clicar em qualquer post
// abre o cliente lá. Assim não existem mais duas listas de clientes concorrentes.
export default function CriaPost() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const { data: parceiros = [] } = useMeusParceiros();
  const { clients } = useExternalClients();
  const ativa = tab === "calendario" ? "calendario" : tab === "parceiros" ? "parceiros" : "aprovacoes";

  // /criapost sem aba → cai na de aprovações (senão nenhuma aba fica marcada).
  useEffect(() => {
    if (!tab) navigate("/socialmidia/criapost/aprovacoes", { replace: true });
  }, [tab, navigate]);

  // Aba = rota. Dá pra favoritar o calendário geral e o "voltar" funciona.
  // "Com parceiros" só existe pra quem TEM parceiro acoplado: aba que abre
  // uma tela vazia é ruído, não recurso.
  const tabs: SubTab[] = [
    { to: "/socialmidia/criapost/aprovacoes", label: "Aprovações" },
    { to: "/socialmidia/criapost/calendario", label: "Calendário geral" },
    ...(parceiros.length > 0
      ? [{ to: "/socialmidia/criapost/parceiros", label: "Com parceiros" }]
      : []),
  ];

  const nomesClientes = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of clients as { id: string; name: string | null }[]) m[c.id] = c.name ?? "Cliente";
    return m;
  }, [clients]);

  return (
    <ModuleGate code="aprovapost_externo">
      <ModuleHero
        title="Cria Post"
        subtitle="As aprovações por link de todos os clientes. Pra criar e editar posts, abra o cliente."
        color="laranja"
        tabs={tabs}
        actions={
          <Button variant="outline" size="sm" className="bg-background/70" asChild>
            <Link to="/socialmidia/clientes"><Contact className="h-4 w-4 mr-1.5" /> Ver clientes</Link>
          </Button>
        }
      />

      {ativa === "aprovacoes" ? (
        <>
          {/* Relatório rápido: cliente + período + 1 clique, sem passar pela personalização */}
          <QuickReportCard />
          <ExternalApprovalsPanel />
        </>
      ) : ativa === "parceiros" ? (
        <PainelComParceiros clientes={nomesClientes} />
      ) : (
        <ManagerCalendar />
      )}
    </ModuleGate>
  );
}
