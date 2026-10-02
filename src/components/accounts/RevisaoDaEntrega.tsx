import { useEffect, useState } from "react";
import { Check, CheckCircle2, Loader2, RotateCcw, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { useAprovarEntrega, useAtualizarCache, usePedidosDoCliente, usePedirAjuste, type PedidoDoCliente } from "@/hooks/useParceiro";
import { brlReais } from "@/lib/money";

/* ═══════════════════════════════════════════════════════════════════════════
   O LADO DA SOCIAL MÍDIA DENTRO DO CARD (Walter, 29/09/2026)

   Duas coisas que ela procurava e não achava no card aberto:
    1. "tá pra eu revisar, mas não tem onde eu dar check que tá ok ou pedir
       ajuste". A peça aparecia em "Pra você revisar" e, aberta, só tinha a
       conversa e o "Ir até o post". Agora a revisão acontece aqui mesmo.
    2. "tem como ter um espaço pra ver o cachê? acabei não colocando de uns".
       O cachê só existia dentro do "Enviar para", no editor do post. Aqui ele
       aparece e edita sem sair do card, e sem mexer em parceiro nem prazo.

   Revisar = a entrega foi feita E ainda não foi pro cliente. Mesma regra da
   lista "Pra você revisar" do painel, pra as duas nunca discordarem.
   ═══════════════════════════════════════════════════════════════════════════ */

export const JA_FOI_PRO_CLIENTE = ["pendente", "aprovado", "postado"];

export function precisaRevisar(producaoStatus: string | null | undefined, aprovacao: string | null | undefined) {
  return producaoStatus === "entregue" && !JA_FOI_PRO_CLIENTE.includes(aprovacao ?? "");
}

/** Os botões de revisão. `compacto` é a versão da linha da lista (sem textos
 *  de apoio); o card usa a completa. */
export function AcoesDeRevisao({ postId, nomeParceiro, compacto = false, pedidoCliente, onEuResolvo }: {
  postId: string; nomeParceiro?: string | null; compacto?: boolean;
  /** Pedido de ajuste do cliente final, ainda não tratado (02/10/2026). */
  pedidoCliente?: PedidoDoCliente | null;
  /** "Eu resolvo": leva ao post pra ela mesma ajustar e reenviar ao cliente. */
  onEuResolvo?: () => void;
}) {
  const aprovar = useAprovarEntrega();
  const ajuste = usePedirAjuste();
  const [pedindo, setPedindo] = useState(false);
  const [motivo, setMotivo] = useState("");
  useEffect(() => { setPedindo(false); setMotivo(""); }, [postId]);
  const abrirPedido = () => {
    // Pedido do cliente já entra como motivo: ela só edita se quiser.
    if (pedidoCliente && !motivo.trim()) setMotivo(`O cliente pediu: "${pedidoCliente.texto}"`);
    setPedindo(true);
  };
  const ocupado = aprovar.isPending || ajuste.isPending;
  const quem = nomeParceiro?.split(" ")[0] ?? "o parceiro";

  if (pedindo) {
    return (
      // stopPropagation: na lista, a linha inteira abre o card. Digitar o
      // motivo não pode abrir nada.
      <div className="w-full space-y-2" onClick={(e) => e.stopPropagation()}>
        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} autoFocus
          placeholder={`O que ${quem} precisa mudar? Junte tudo num texto só.`}
          className="resize-none text-[13px] bg-card" />
        <div className="flex items-center gap-2 justify-end">
          <Button size="sm" variant="ghost" className="rounded-xl h-8" disabled={ocupado} onClick={() => { setPedindo(false); setMotivo(""); }}>
            Cancelar
          </Button>
          <Button size="sm" className="rounded-xl h-8 bg-violet-600 hover:bg-violet-700 text-white" disabled={ocupado || !motivo.trim()}
            onClick={() => ajuste.mutate({ postId, motivo }, { onSuccess: () => { setPedindo(false); setMotivo(""); } })}>
            {ajuste.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RotateCcw className="h-3.5 w-3.5 mr-1" /> Mandar pro {quem}</>}
          </Button>
        </div>
      </div>
    );
  }

  if (pedidoCliente) {
    return (
      <div className="w-full space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-orange-800">O cliente pediu ajuste</p>
          <p className={cn("text-[12.5px] font-body text-orange-950 whitespace-pre-line", compacto && "line-clamp-3")}>{pedidoCliente.texto}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" className="rounded-xl h-8 bg-violet-600 hover:bg-violet-700 text-white" disabled={ocupado} onClick={abrirPedido}
            title={`Volta pra coluna Ajuste de ${quem}, com o pedido do cliente`}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Mandar pro {quem}
          </Button>
          {onEuResolvo && (
            <Button size="sm" variant="outline" className="rounded-xl h-8" disabled={ocupado} onClick={onEuResolvo}
              title="Ajuste que você mesma faz (legenda, data). Abre o post.">
              Eu resolvo
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
      <Button size="sm" className="rounded-xl h-8 bg-green-600 hover:bg-green-700 text-white" disabled={ocupado}
        title="A peça vai pra 'Aguardando cliente' no quadro do Cria Post"
        onClick={() => aprovar.mutate({ postId, destino: "cliente" })}>
        {aprovar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" /> Tá ok</>}
      </Button>
      <Button size="sm" variant="outline" className="rounded-xl h-8 border-violet-300 text-violet-700 hover:bg-violet-50" disabled={ocupado}
        onClick={abrirPedido}>
        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Pedir ajuste
      </Button>
      {!compacto && (
        <button type="button" disabled={ocupado} onClick={() => aprovar.mutate({ postId, destino: "direto" })}
          className="text-[11.5px] font-body text-muted-foreground hover:text-foreground underline underline-offset-2">
          aprovar sem mandar pro cliente
        </button>
      )}
    </div>
  );
}

/** Bloco que entra no card aberto quando quem abre é a social mídia. */
export function PainelDaAgenciaNoCard({ postId, producaoStatus, aprovacao, cache, nomeParceiro, onEuResolvo }: {
  postId: string;
  producaoStatus: string | null | undefined;
  aprovacao: string | null | undefined;
  cache: number | null | undefined;
  nomeParceiro?: string | null;
  onEuResolvo?: () => void;
}) {
  const salvarCache = useAtualizarCache();
  const [valor, setValor] = useState<number | null>(cache ?? null);
  useEffect(() => { setValor(cache ?? null); }, [cache, postId]);
  // Compara como número: null e 0 são o mesmo "sem cachê".
  const mudou = Number(valor ?? 0) !== Number(cache ?? 0);
  const revisar = precisaRevisar(producaoStatus, aprovacao);
  const semCache = !cache || Number(cache) <= 0;
  const { data: pedidos = {} } = usePedidosDoCliente(revisar && aprovacao === "ajuste_solicitado" ? [postId] : []);
  const pedido = pedidos[postId] ?? null;

  return (
    <div className="mt-4 space-y-3">
      {revisar && (
        <div className="rounded-2xl border-2 border-green-200 bg-green-50/60 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-green-800 flex items-center gap-1.5 mb-0.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> {pedido ? "Volta do cliente pra você decidir" : "Entrega pra você revisar"}
          </p>
          <p className="text-[12px] font-body text-green-900/75 mb-2.5 leading-snug">
            {pedido
              ? <>O parceiro ainda não sabe deste pedido. <b>Mandar pro parceiro</b> devolve a peça pra ele com o texto do cliente; <b>Eu resolvo</b> é quando o ajuste é seu (legenda, data).</>
              : <>Confira o material. <b>Tá ok</b> manda a peça pra "Aguardando cliente". <b>Pedir ajuste</b> devolve pro parceiro com o motivo.</>}
          </p>
          <AcoesDeRevisao postId={postId} nomeParceiro={nomeParceiro} pedidoCliente={pedido} onEuResolvo={onEuResolvo} />
        </div>
      )}

      <div className={cn("rounded-2xl border p-3.5", semCache ? "border-amber-200 bg-amber-50/60" : "border-border bg-muted/30")}>
        <p className={cn("text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2",
          semCache ? "text-amber-800" : "text-muted-foreground")}>
          <Wallet className="h-3.5 w-3.5" /> Cachê desta peça
          {!semCache && <span className="normal-case tracking-normal font-display text-[13px] text-foreground ml-auto">{brlReais(Number(cache))}</span>}
        </p>
        <div className="flex items-center gap-2">
          <MoneyInput value={valor} onChange={setValor} className="h-9 rounded-xl flex-1 bg-card" />
          <Button size="sm" className="rounded-xl h-9" disabled={!mudou || salvarCache.isPending}
            onClick={() => salvarCache.mutate({ postId, cache: valor })}>
            {salvarCache.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
          </Button>
        </div>
        <p className="text-[11px] font-body text-muted-foreground mt-1.5 leading-snug">
          {semCache
            ? "Sem valor, a peça não entra no seu Caixa nem no \"a receber\" do parceiro."
            : producaoStatus === "entregue"
              ? "Já está no Caixa como despesa. Mudar aqui corrige o valor enquanto não estiver pago."
              : "Vira despesa no Caixa quando o parceiro entregar."}
        </p>
      </div>
    </div>
  );
}
