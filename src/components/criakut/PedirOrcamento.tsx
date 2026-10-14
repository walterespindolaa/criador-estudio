import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useBaseCriakut, useMeuPerfilCriakut, usePedirOrcamento } from "@/hooks/useCriakut";
import { UNIDADES, precoTexto, reaisParaCentavos, type Servico, type Unidade } from "@/lib/criakut";
import { cn } from "@/lib/utils";

/* PEDIR ORÇAMENTO direto na página da pessoa. Vira uma PROPOSTA com conversa
   (aba Propostas dos dois). Dá pra partir de um serviço da tabela dela. */

type Props = {
  open: boolean; onOpenChange: (o: boolean) => void;
  contratadoId: string; nome: string; servicos: Servico[];
};

export function PedirOrcamento({ open, onOpenChange, contratadoId, nome, servicos }: Props) {
  const navigate = useNavigate();
  const base = useBaseCriakut();
  const meu = useMeuPerfilCriakut();
  const pedir = usePedirOrcamento();
  const [titulo, setTitulo] = useState("");
  const [escopo, setEscopo] = useState("");
  const [valor, setValor] = useState("");
  const [unidade, setUnidade] = useState<Unidade>("peca");
  const [prazo, setPrazo] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  useEffect(() => { if (open) { setTitulo(""); setEscopo(""); setValor(""); setUnidade("peca"); setPrazo(""); setRecorrente(false); } }, [open]);

  const usarServico = (s: Servico) => {
    setTitulo(s.titulo);
    setUnidade(s.unidade);
    setValor(s.preco_centavos != null ? String(s.preco_centavos / 100).replace(".", ",") : "");
    setRecorrente(s.unidade === "mes");
  };

  const hoje = new Date().toISOString().slice(0, 10);
  const mandar = async () => {
    if (titulo.trim().length < 2) { toast.error("Diga o que você precisa."); return; }
    if (prazo && prazo < hoje) { toast.error("O prazo já passou."); return; }
    const id = await pedir.mutateAsync({ contratado: contratadoId, titulo: titulo.trim(), escopo: escopo.trim(),
      valor_centavos: reaisParaCentavos(valor), unidade, prazo: prazo || null, recorrente });
    toast.success(`Pedido enviado pra ${nome.split(" ")[0]}! A conversa fica em Propostas.`);
    onOpenChange(false);
    navigate(`${base}?aba=propostas&p=${id}`);
  };

  const semPagina = !meu.isLoading && !meu.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pedir orçamento pra {nome.split(" ")[0]}</DialogTitle>
          <DialogDescription>O pedido abre uma conversa só de vocês dois. Nada é cobrado pelo Cria.</DialogDescription>
        </DialogHeader>
        {semPagina ? (
          <div className="rounded-xl bg-muted p-4 text-[13.5px]">
            Pra pedir orçamento você precisa ter sua página no Criakut (é ela que a outra pessoa vê).
            <Button className="mt-3 w-full rounded-xl" onClick={() => { onOpenChange(false); navigate(base); }}>Criar minha página</Button>
          </div>
        ) : (
          <div className="grid gap-3.5">
            {servicos.length > 0 && (
              <div>
                <Label className="text-[12px] text-muted-foreground">Partir de um serviço da tabela</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {servicos.map((s, i) => (
                    <button key={s.id ?? i} type="button" onClick={() => usarServico(s)}
                      className={cn("rounded-full border px-3 py-1 text-[12px] font-semibold", titulo === s.titulo ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                      {s.titulo} · {precoTexto(s.preco_centavos, s.unidade)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-1.5"><Label>O que você precisa</Label>
              <Input value={titulo} maxLength={120} placeholder="Ex.: 8 carrosséis por mês pra clínica" onChange={(e) => setTitulo(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Detalhes</Label>
              <Textarea rows={4} value={escopo} maxLength={2000} placeholder="Nicho, quantidade, referências, o que já existe..." onChange={(e) => setEscopo(e.target.value)} /></div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="grid gap-1.5"><Label>Quanto você pensa em pagar (R$)</Label>
                <Input inputMode="decimal" value={valor} placeholder="em branco = a combinar" onChange={(e) => setValor(e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Por</Label>
                <select className="h-10 rounded-md border border-input bg-background px-2 text-[13px]" value={unidade} onChange={(e) => setUnidade(e.target.value as Unidade)}>
                  {UNIDADES.map((u) => <option key={u.valor} value={u.valor}>{u.sufixo.replace("/", "").trim()}</option>)}
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-2 items-end">
              <div className="grid gap-1.5"><Label>Prazo (opcional)</Label>
                <Input type="date" min={hoje} value={prazo} onChange={(e) => setPrazo(e.target.value)} /></div>
              <label className="flex h-10 items-center gap-2 text-[13px]"><Switch checked={recorrente} onCheckedChange={setRecorrente} /> Todo mês</label>
            </div>
            <p className="text-[11.5px] text-muted-foreground">Combine tudo pela conversa: é ela que conta como histórico se der algum problema, e é por ela que a nota e o depoimento ficam valendo.</p>
            <Button className="h-11 rounded-xl" disabled={pedir.isPending || titulo.trim().length < 2} onClick={() => void mandar().catch(() => undefined)}>
              {pedir.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Mandar pedido
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
