import { useState } from "react";
import { Plus, FileText, Pencil, Trash2 } from "lucide-react";
import {
  useCrmContracts, useCreateCrmContract, useUpdateCrmContract, useDeleteCrmContract,
  useCrmClients, type CrmContract, type CrmContractInput,
} from "@/hooks/useCrm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContractGeneratorDialog } from "@/components/accounts/crm/ContractGeneratorDialog";
import { toast } from "sonner";

const brl = (v?: number | null) => `R$ ${Number(v ?? 0).toLocaleString("pt-BR")}`;
const STATUS_LABEL: Record<string, string> = { enviado: "Enviado", fechado: "Fechado", encerrado: "Encerrado" };

export function ContractsTab() {
  const { data: contracts = [], isLoading } = useCrmContracts();
  const { data: clients = [] } = useCrmClients();
  const create = useCreateCrmContract();
  const update = useUpdateCrmContract();
  const del = useDeleteCrmContract();
  const [genOpen, setGenOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CrmContract | null>(null);

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";
  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (c: CrmContract) => { setEditing(c); setDialogOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-display font-bold text-foreground">Contratos</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setGenOpen(true)}><FileText className="h-3.5 w-3.5 mr-1.5" /> Gerar contrato</Button>
          <Button size="sm" variant="outline" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1.5" /> Novo contrato</Button>
        </div>
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
            <div key={c.id} className="group rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors">
              <button type="button" onClick={() => openEdit(c)} className="min-w-0 flex-1 text-left">
                <p className="text-sm font-display font-bold text-foreground truncate">{c.title}</p>
                <p className="text-xs text-muted-foreground font-body">{clientName(c.crm_client_id)}{c.closed_date ? ` · fechado em ${new Date(c.closed_date + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}</p>
              </button>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-display font-bold text-primary">{brl(c.monthly_value)}/mês</span>
                <Badge variant={c.status === "fechado" ? "default" : c.status === "encerrado" ? "secondary" : "outline"} className="text-[10px]">{STATUS_LABEL[c.status]}</Badge>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={async () => { if (confirm(`Excluir o contrato "${c.title}"?`)) await del.mutateAsync(c.id); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {dialogOpen && (
        <ContractDialog
          key={editing?.id ?? "new"}
          contract={editing}
          clients={clients}
          saving={create.isPending || update.isPending}
          onClose={() => { setDialogOpen(false); setEditing(null); }}
          onCreate={async (input) => { await create.mutateAsync(input); setDialogOpen(false); }}
          onUpdate={async (id, updates) => { await update.mutateAsync({ id, ...updates }); toast.success("Contrato atualizado!"); setDialogOpen(false); setEditing(null); }}
          onDelete={async (id) => { if (confirm("Excluir este contrato?")) { await del.mutateAsync(id); setDialogOpen(false); setEditing(null); } }}
        />
      )}
      <ContractGeneratorDialog open={genOpen} onOpenChange={setGenOpen} />
    </div>
  );
}

function ContractDialog({ contract, clients, saving, onClose, onCreate, onUpdate, onDelete }: {
  contract: CrmContract | null;
  clients: { id: string; name: string }[];
  saving: boolean;
  onClose: () => void;
  onCreate: (i: CrmContractInput) => void;
  onUpdate: (id: string, u: Partial<CrmContractInput>) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(contract?.title ?? "");
  const [clientId, setClientId] = useState(contract?.crm_client_id ?? "");
  const [value, setValue] = useState(String(contract?.monthly_value ?? ""));
  const [status, setStatus] = useState<CrmContract["status"]>(contract?.status ?? "enviado");
  const [notes, setNotes] = useState(contract?.notes ?? "");

  const submit = () => {
    if (!title.trim()) { toast.error("Título é obrigatório."); return; }
    const mv = Number(value) || 0;
    const base: CrmContractInput = {
      title: title.trim(),
      crm_client_id: clientId || null,
      monthly_value: mv,
      contract_value: mv,
      status,
      notes: notes.trim() || null,
    };
    if (contract) {
      const updates: Partial<CrmContractInput> = { ...base };
      if (status === "fechado" && !contract.closed_date) updates.closed_date = new Date().toISOString().split("T")[0];
      if (status === "encerrado" && !contract.ended_date) updates.ended_date = new Date().toISOString().split("T")[0];
      onUpdate(contract.id, updates);
    } else {
      onCreate({ ...base, sent_date: new Date().toISOString().split("T")[0] });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">{contract ? "Editar contrato" : "Novo contrato"}</DialogTitle></DialogHeader>
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
              <select value={status} onChange={(e) => setStatus(e.target.value as CrmContract["status"])} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="enviado">Enviado</option><option value="fechado">Fechado</option><option value="encerrado">Encerrado</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Notas</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl text-sm" /></div>
        </div>
        <div className="flex items-center justify-between gap-2 mt-5">
          {contract ? <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(contract.id)}><Trash2 className="h-4 w-4 mr-1.5" /> Excluir</Button> : <span />}
          <div className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={!title.trim() || saving}>{contract ? "Salvar" : "Criar"}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
