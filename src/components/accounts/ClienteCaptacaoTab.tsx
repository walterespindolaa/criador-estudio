import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus, CalendarPlus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCaptures } from "@/hooks/useAgenda";
import { useCaptureScripts } from "@/hooks/useCaptureScripts";
import { useScriptApprovalsTodos } from "@/hooks/useScriptApprovals";
import { ResumoCaptacaoCliente } from "@/components/captacao/ResumoCaptacaoCliente";

/* ═══════════════════════════════════════════════════════════════════════════
   CRIA CAPTAÇÃO DENTRO DA FICHA DO CLIENTE (Gabriela, 23/09/2026)

   "não tem como ter a captação aqui em cima também? todos os outros têm."
   E depois: "por que eu só consigo fazer essas coisas no Cria Captação?"

   Ciclo 4 da v4: esta aba e a pasta do cliente no módulo montam o MESMO
   resumo (ResumoCaptacaoCliente). A diferença entre as duas é só o que fica
   em volta. As ações que precisam do editor de roteiro, do PDF e do envio
   continuam no módulo, mas daqui elas são um toque: o link leva pra pasta
   do cliente já com a ação aberta (`?acao=novo-roteiro` ou `?acao=marcar`).
   Duplicar o editor aqui criaria duas versões da mesma tela, e foi assim que
   nasceram a copy duplicada e o 5 x 6.
   ═══════════════════════════════════════════════════════════════════════════ */

export function ClienteCaptacaoTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { data: captures = [], isLoading } = useCaptures();
  const { data: scripts = [] } = useCaptureScripts();
  const { data: envios = [] } = useScriptApprovalsTodos({ crmClientId: clientId });

  // Só o que é DESTE cliente. O vínculo forte é o crm_client_id; pasta avulsa
  // (cliente fora do CRM) não entra aqui, porque ela não tem ficha.
  const minhas = useMemo(() => captures.filter((c) => c.crm_client_id === clientId), [captures, clientId]);
  const meusRoteiros = useMemo(() => scripts.filter((s) => s.crm_client_id === clientId), [scripts, clientId]);

  const base = `/socialmidia/captacao?cliente=${encodeURIComponent(clientId)}`;

  if (isLoading) {
    return <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm font-body text-muted-foreground">Carregando a captação…</div>;
  }

  return (
    <div className="space-y-4">
      <ResumoCaptacaoCliente
        captures={minhas}
        scripts={meusRoteiros}
        envios={envios}
        clientName={clientName}
        acoes={
          <>
            <Button size="sm" asChild className="rounded-xl">
              <Link to={`${base}&acao=novo-roteiro`}><Plus className="h-3.5 w-3.5 mr-1.5" /> Novo roteiro</Link>
            </Button>
            <Button size="sm" variant="outline" asChild className="rounded-xl">
              <Link to={`${base}&acao=marcar`}><CalendarPlus className="h-3.5 w-3.5 mr-1.5" /> Marcar gravação</Link>
            </Button>
          </>
        }
      />

      {/* O planejamento de rota mora no módulo de propósito: ele cruza clientes. */}
      <div className="rounded-2xl border border-dashed border-border p-4 flex items-center gap-3 flex-wrap">
        <p className="text-xs font-body text-muted-foreground flex-1 min-w-[240px]">
          O guia de gravação em PDF, o envio pro cliente revisar e a rota do dia (quem mais gravar na mesma ida)
          ficam na pasta deste cliente no Cria Captação.
        </p>
        <Button variant="outline" size="sm" asChild className="shrink-0 rounded-xl">
          <Link to={base}>Abrir a pasta <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
        </Button>
      </div>
    </div>
  );
}
