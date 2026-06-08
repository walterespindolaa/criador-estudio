import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { useCreateFinTransfer, type TransferKind } from "@/hooks/useFinance";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().split("T")[0];
type Props = { open: boolean; onOpenChange: (o: boolean) => void };

export function FinTransferDialog({ open, onOpenChange }: Props) {
  const transfer = useCreateFinTransfer();
  const [kind, setKind] = useState<TransferKind>("Pró-labore");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState("");

  const reset = () => { setKind("Pró-labore"); setAmount(""); setDate(today()); setDescription(""); };

  const submit = async () => {
    const value = Number(amount);
    if (!value || value <= 0) { toast.error("Informe um valor."); return; }
    await transfer.mutateAsync({ kind, amount: value, date, description });
    toast.success("Transferência registrada nos dois lados!");
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2"><ArrowLeftRight className="h-4 w-4" /> Transferir p/ Pessoa Física</DialogTitle>
          <DialogDescription className="font-body text-sm">Tira dinheiro da empresa pra você. Cria a saída na Empresa e a entrada na PF de uma vez.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-2">
            {(["Pró-labore", "Distribuição de lucros"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                className={cn("py-2 px-2 rounded-xl text-sm font-body font-bold border transition-colors", kind === k ? "border-primary bg-primary/5 text-foreground" : "bg-card border-border text-muted-foreground hover:border-primary/30")}>
                {k === "Pró-labore" ? "Pró-labore" : "Distribuição"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Valor (R$) *</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl" /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Descrição (opcional)</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={kind} className="rounded-xl" /></div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={transfer.isPending}>Cancelar</Button>
          <Button onClick={submit} disabled={transfer.isPending || !amount}>{transfer.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Transferir</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
