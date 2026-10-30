import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMinhasPecasCria, usePedirPortfolio, useTirarDoPortfolio, type PecaDoCria } from "@/hooks/usePortfolioCria";
import { cn } from "@/lib/utils";

/* PEÇAS DO CRIA NO PORTFÓLIO (Walter, 30/10/2026, mockup aprovado).
   O prestador marca as peças que entregou pelo Cria. Nenhuma aparece na
   página sem o "pode" do dono da marca: o pedido passa pela agência e pelo
   cliente (ou pela regra fixa na ficha do cliente). */

const SELO: Record<string, { txt: string; cls: string }> = {
  com_agencia: { txt: "com a agência", cls: "bg-amber-100 text-amber-800" },
  com_cliente: { txt: "com o cliente", cls: "bg-amber-100 text-amber-800" },
  liberada: { txt: "liberada", cls: "bg-emerald-100 text-emerald-800" },
  recusada: { txt: "não liberada", cls: "bg-muted text-muted-foreground" },
};

export function PecasDoCriaDialog({ aberto, onClose }: { aberto: boolean; onClose: () => void }) {
  const q = useMinhasPecasCria(aberto);
  const pedir = usePedirPortfolio();
  const tirar = useTirarDoPortfolio();
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  useEffect(() => { if (aberto) setMarcadas(new Set()); }, [aberto]);
  const pecas = q.data ?? [];

  const alternar = (p: PecaDoCria) => {
    if (p.status) return; // já pedida: decide quem é dono da marca
    setMarcadas((s) => { const n = new Set(s); if (n.has(p.post_id)) n.delete(p.post_id); else n.add(p.post_id); return n; });
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Peças que você entregou pelo Cria</DialogTitle>
          <DialogDescription>
            Marque as que quer mostrar. Cada uma só aparece na sua página quando o dono da marca liberar, com ou sem o nome dela. Enquanto isso, só você vê.
          </DialogDescription>
        </DialogHeader>
        {q.isLoading ? (
          <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : pecas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Ainda não tem peça entregue com imagem pelo Cria. Quando você entregar uma, ela aparece aqui.</p>
        ) : (
          <div className="grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {pecas.map((p) => {
              const marcada = marcadas.has(p.post_id);
              return (
                <div key={p.post_id} className="relative">
                  <button type="button" onClick={() => alternar(p)} disabled={!!p.status}
                    className={cn("relative block aspect-[4/5] w-full overflow-hidden rounded-xl bg-muted", marcada && "ring-2 ring-primary ring-offset-2")}>
                    <img src={p.capa} alt={p.titulo ?? ""} loading="lazy" className="h-full w-full object-cover" />
                    {!p.status && (
                      <span className={cn("absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-md border border-white bg-white/80", marcada && "bg-primary text-primary-foreground")}>
                        {marcada && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                    )}
                    {p.status && (
                      <span className={cn("absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold", SELO[p.status].cls)}>{SELO[p.status].txt}</span>
                    )}
                  </button>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">{p.status === "liberada" ? p.rotulo : (p.segmento ?? p.titulo ?? "")}</p>
                  {p.status && p.status !== "recusada" && (
                    <button type="button" onClick={() => tirar.mutate(p.post_id)} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                      {p.status === "liberada" ? "Tirar da página" : "Cancelar pedido"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button disabled={marcadas.size === 0 || pedir.isPending}
            onClick={() => pedir.mutate([...marcadas], { onSuccess: () => setMarcadas(new Set()) })}>
            {pedir.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Pedir liberação{marcadas.size > 0 ? ` (${marcadas.size})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
