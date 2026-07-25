import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hojeBR } from "@/lib/date-br";

// ── INATIVAR CLIENTE: pede a DATA DE ENCERRAMENTO ──
// Ao mudar o status pra "inativo", perguntamos quando o contrato encerrou.
// A mensalidade conta ATÉ o mês dessa data; a partir do mês seguinte, o cliente
// sai da carteira/MRR e para de gerar mensalidade. O histórico anterior fica.
export function InactivateClientDialog({
  open,
  defaultDate,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  defaultDate?: string | null;
  onConfirm: (endDate: string) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState<string>(defaultDate || hojeBR());
  // Reabrir o dialog reinicia a data (default: encerramento já salvo, senão hoje BR).
  useEffect(() => {
    if (open) setDate(defaultDate || hojeBR());
  }, [open, defaultDate]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="font-display">Encerrar contrato do cliente</DialogTitle></DialogHeader>
        <p className="text-[13px] font-body text-muted-foreground -mt-1">
          Informe a <strong>data de encerramento</strong>. A mensalidade conta até o mês dessa data;
          a partir do mês seguinte ela some da carteira e não gera novas cobranças. O que já foi
          lançado antes continua no histórico.
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs">Data de encerramento</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onConfirm(date || hojeBR())} disabled={!date}>Inativar cliente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
