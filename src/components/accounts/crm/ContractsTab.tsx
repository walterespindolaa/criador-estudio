import { useState } from "react";
import { Plus, FileText } from "lucide-react";
import { useCrmContracts, useCreateCrmContract, useCrmClients } from "@/hooks/useCrm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const brl = (v?: number | null) => `R$ ${Number(v ?? 0).toLocaleString("pt-BR")}`;
const STATUS_LABEL: Record<string, string> = { enviado: "Enviado", fechado: "Fechado", encerrado: "Encerrado" };

export function ContractsTab() {
  const { data: contracts = [], isLoading } = useCrmContracts();
  const { data: clients = [] } = useCrmClients();
  const create = useCreateCrmContract();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(""); const [clientId, setClientId] = useState("");
  const [value, setValue] = useState(""); const [status, setStatus] = useState("enviado");

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";
  const save = async () => {
    if (!title.trim()) return;
    await create.mutateAsync({
      title: title.trim(), crm_client_id: clientId || null, monthly_value: Number(value) || 0,
      contract_value: Number(value) || 0, status: status as "enviado" | "fechado" | "encerrado",
      sent_date: new Date().toISOString().split("T")[0],
    });
    setOpen(false); setTitle(""); setClientId(""); setValue(""); setStatus("enviado");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-display font-bold text-foreground">Contratos</h3>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" /> Novo contrato</Button>
      </div>
      {isLoading ? (
        <div className="h-24 rounded-2xl bg-muted animate-pulse" />
      ) : contracts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><FileText className="h-5 w-5 text-muted-foreground" /></div>
          <p className="text-sm font-body text-foreground font-medium">Nenhum contrato ainda</p>
          <p className="text-xs text-muted-foreground font-body mt-1">Contratos também nascem quando um lead vai pra “Fechado” no pipeline.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-display font-bold text-foreground truncate">{c.title}</p>
                <p className="text-xs text-muted-foreground font-body">{clientName(c.crm_client_id)}{c.closed_date ? ` · fechado em ${new Date(c.closed_date + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-display font-bold text-primary">{brl(c.monthly_value)}/mês</span>
                <Badge variant={c.status === "fechado" ? "default" : c.status === "encerrado" ? "secondary" : "outline"} className="text-[10px]">{STATUS_LABEL[c.status]}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="font-display">Novo contrato</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5"><Label className="text-xs">Título *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Contrato - Café Aroma" className="rounded-xl" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Cliente</Label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Valor mensal (R$)</Label><Input type="number" value={value} onChange={(e) => setValue(e.target.value)} className="rounded-xl" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Status</Label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="enviado">Enviado</option><option value="fechado">Fechado</option><option value="encerrado">Encerrado</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save} disabled={!title.trim() || create.isPending}>Criar</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
