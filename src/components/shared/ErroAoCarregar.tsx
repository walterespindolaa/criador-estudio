import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/* ═══════════════════════════════════════════════════════════════════════════
   QUANDO A TELA NÃO CARREGA

   O CRIA tinha estado vazio (EmptyState) e estado carregando (skeleton), mas
   não tinha estado de ERRO. Cada hook decidia sozinho o que fazer quando a
   consulta falhava, e a decisão mais comum era `return []`: o erro sumia e a
   tela mostrava o vazio. Pra quem está do outro lado, cair a internet e não ter
   nenhuma demanda são a MESMA imagem.

   Pro parceiro isso é grave de um jeito específico: a tela vazia diz a ele que
   nenhuma agência mandou trabalho. Ele fecha o app e vai fazer outra coisa, sem
   saber que tinha entrega pra hoje.

   As regras aqui são as mesmas do EmptyState, traduzidas pro erro:
   1. Fala do que aconteceu em português, sem código e sem culpa dele.
   2. Deixa claro que o trabalho dele NÃO sumiu: é a tela que não carregou.
   3. Um botão, com verbo, que resolve na hora ("Tentar de novo").
   ═══════════════════════════════════════════════════════════════════════════ */

export function ErroAoCarregar({ oQue, aoTentarDeNovo, tentando, compacto }: {
  /** O que não carregou, em português: "suas demandas", "seus cachês". */
  oQue: string;
  aoTentarDeNovo?: () => void;
  tentando?: boolean;
  /** Versão de uma linha, pra blocos dentro de uma tela que já carregou. */
  compacto?: boolean;
}) {
  if (compacto) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5">
        <WifiOff className="h-4 w-4 text-amber-700 shrink-0" />
        <p className="text-[12.5px] font-body text-amber-900 min-w-0 flex-1">
          Não consegui carregar {oQue} agora. Nada foi perdido.
        </p>
        {aoTentarDeNovo && (
          <Button size="sm" variant="outline" className="rounded-xl shrink-0 border-amber-300 bg-card text-amber-900 hover:bg-amber-100"
            onClick={aoTentarDeNovo} disabled={tentando}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${tentando ? "animate-spin" : ""}`} /> Tentar de novo
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="rounded-2xl border-border p-10 text-center">
      <span className="w-12 h-12 rounded-2xl bg-amber-100 grid place-items-center mx-auto mb-3">
        <WifiOff className="h-5 w-5 text-amber-700" />
      </span>
      <p className="font-display font-bold text-[16px] text-foreground">Não consegui carregar {oQue}</p>
      <p className="text-[13px] font-body text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
        Pode ter sido a internet oscilando. Seu trabalho está guardado: é só esta tela que não conseguiu buscar.
      </p>
      {aoTentarDeNovo && (
        <Button className="rounded-xl mt-4" onClick={aoTentarDeNovo} disabled={tentando}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${tentando ? "animate-spin" : ""}`} /> Tentar de novo
        </Button>
      )}
    </Card>
  );
}
