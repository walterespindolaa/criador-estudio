import { useEffect } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { Contact, Users } from "lucide-react";
import { ModuleGate } from "@/components/accounts/ModuleGate";
import { ModuleHero, type SubTab } from "@/components/brand/ModuleHero";
import { ExternalApprovalsPanel } from "@/components/accounts/ExternalApprovalsPanel";
import { ManagerCalendar } from "@/components/accounts/ManagerCalendar";
import { QuickReportCard } from "@/components/accounts/QuickReportCard";
import { Button } from "@/components/ui/button";
import { useMeusParceiros } from "@/hooks/useParceiro";

// O Cria Post virou o painel de APROVAÇÕES por link. A lista de clientes que morava
// aqui foi consolidada em /socialmidia/clientes (hub único): clicar em qualquer post
// abre o cliente lá. Assim não existem mais duas listas de clientes concorrentes.
//
// "COM PARCEIROS" SAIU DAQUI (Walter, 28/09/2026): a produção com designers e
// editores foi pra Equipe, que é onde se pensa em gente. O endereço antigo
// continua valendo (avisos antigos no sino apontam pra ele): redireciona pra
// Equipe > Produção levando o ?post= junto.
export default function CriaPost() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const { search } = useLocation();
  const { data: parceiros = [] } = useMeusParceiros();
  const ativa = tab === "calendario" ? "calendario" : "aprovacoes";

  // /criapost sem aba → cai na de aprovações (senão nenhuma aba fica marcada).
  useEffect(() => {
    if (tab === "parceiros") navigate(`/socialmidia/equipe/producao${search}`, { replace: true });
    else if (!tab) navigate("/socialmidia/criapost/aprovacoes", { replace: true });
  }, [tab, navigate, search]);

  // Aba = rota. Dá pra favoritar o calendário geral e o "voltar" funciona.
  const tabs: SubTab[] = [
    { to: "/socialmidia/criapost/aprovacoes", label: "Aprovações" },
    { to: "/socialmidia/criapost/calendario", label: "Calendário geral" },
  ];

  return (
    <ModuleGate code="aprovapost_externo">
      <ModuleHero
        title="Cria Post"
        subtitle="As aprovações por link de todos os clientes. Pra criar e editar posts, abra o cliente."
        color="laranja"
        tabs={tabs}
        actions={
          <>
            {/* Atalho pra quem ainda procura a produção aqui. */}
            {parceiros.length > 0 && (
              <Button variant="outline" size="sm" className="bg-background/70" asChild>
                <Link to="/socialmidia/equipe/producao"><Users className="h-4 w-4 mr-1.5" /> Com parceiros</Link>
              </Button>
            )}
            <Button variant="outline" size="sm" className="bg-background/70" asChild>
              <Link to="/socialmidia/clientes"><Contact className="h-4 w-4 mr-1.5" /> Ver clientes</Link>
            </Button>
          </>
        }
      />

      {ativa === "aprovacoes" ? (
        <>
          {/* Relatório rápido: cliente + período + 1 clique, sem passar pela personalização */}
          <QuickReportCard />
          <ExternalApprovalsPanel />
        </>
      ) : (
        <ManagerCalendar />
      )}
    </ModuleGate>
  );
}
