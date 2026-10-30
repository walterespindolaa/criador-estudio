import { useState } from "react";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDecidirPortfolioAgencia, usePedidoPortfolioDoCard } from "@/hooks/usePortfolioCria";

/* PEDIDO DE PORTFÓLIO NO CARD (Walter, 30/10/2026, mockup aprovado).
   O parceiro quer mostrar esta peça na página dele no Criakut. A social mídia
   decide aqui: recusa direto, ou manda pro cliente decidir no link de
   aprovação. Só aparece quando há pedido. */
export function PedidoPortfolioDoCard({ postId }: { postId: string }) {
  const { data: pedidos = [] } = usePedidoPortfolioDoCard(postId);
  const decidir = useDecidirPortfolioAgencia();
  const [aberto, setAberto] = useState(false);
  const p = pedidos.find((x) => x.status === "com_agencia") ?? pedidos.find((x) => x.status === "com_cliente");
  if (!p) return null;
  const nome = p.prestador.split(" ")[0];
  const comCliente = p.status === "com_cliente";

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={comCliente ? "" : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"}>
          <ImageIcon className="h-3.5 w-3.5 mr-1.5" /> {comCliente ? "Portfólio: com o cliente" : `Portfólio: ${nome} pediu`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3 rounded-2xl">
        <p className="font-display font-bold text-sm">{nome} quer mostrar esta peça no portfólio</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {comCliente
            ? "O pedido está no link de aprovação do cliente. Ele escolhe: não mostrar, mostrar sem a marca ou com a marca."
            : "Ela só aparece na página do Criakut se o cliente deixar. Você pode recusar direto ou perguntar pra ele no link de aprovação."}
        </p>
        {!comCliente && (
          <div className="mt-3 flex gap-2">
            <Button size="sm" disabled={decidir.isPending} onClick={() => decidir.mutate({ id: p.id, acao: "pedir_cliente" }, { onSuccess: () => setAberto(false) })}>
              {decidir.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Pedir pro cliente
            </Button>
            <Button size="sm" variant="outline" disabled={decidir.isPending} onClick={() => decidir.mutate({ id: p.id, acao: "recusar" }, { onSuccess: () => setAberto(false) })}>
              Recusar
            </Button>
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">Cliente que nunca deixa (ou sempre deixa)? Na ficha dele, em Canal da marca, dá pra deixar fixo e não perguntar mais.</p>
      </PopoverContent>
    </Popover>
  );
}

export default PedidoPortfolioDoCard;
