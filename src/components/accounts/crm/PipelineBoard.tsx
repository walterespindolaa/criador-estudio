import { useMemo, useState } from "react";
import { Plus, DollarSign, Trash2, Target } from "lucide-react";
import { toast } from "sonner";
import {
  useCrmLeads, useCreateCrmLead, useUpdateCrmLead, useDeleteCrmLead,
  useCrmClients, useCreateCrmClient, useCreateCrmContract,
  CRM_STAGES, CRM_STAGE_LABELS, type CrmLead, type CrmStage, type CrmLeadInput,
} from "@/hooks/useCrm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const brl = (v?: number | null) => `R$ ${Number(v ?? 0).toLocaleString("pt-BR")}`;
const POT: Record<string, string> = { alto: "🟢", medio: "🟡", baixo: "🔴" };
const STAGE_BG: Record<CrmStage, string> = {
  lead: "bg-muted/50", contato: "bg-blue-500/5", reuniao: "bg-violet-500/5",
  proposta: "bg-primary/5", negociacao: "bg-primary/10", fechado: "bg-green-500/10", perdido: "bg-destructive/5",
};

export function PipelineBoard() {
  const { data: leads = [] } = useCrmLeads();
  const { data: clients = [] } = useCrmClients();
  const createLead = useCreateCrmLead();
  const updateLead = useUpdateCrmLead();
  const delLead = useDeleteCrmLead();
  const createClient = useCreateCrmClient();
  const createContract = useCreateCrmContract();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLead, setEditLead] = useState<CrmLead | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const open = leads.filter((l) => l.stage !== "fechado" && l.stage !== "perdido");
    const nego = leads.filter((l) => l.stage === "proposta" || l.stage === "negociacao");
    return {
      pipeline: open.reduce((s, l) => s + Number(l.monthly_value ?? 0), 0),
      negoVal: nego.reduce((s, l) => s + Number(l.monthly_value ?? 0), 0),
      fechados: leads.filter((l) => l.stage === "fechado").length,
      mrr: clients.filter((c) => c.active).reduce((s, c) => s + Number(c.monthly_value ?? 0), 0),
    };
  }, [leads, clients]);

  const handleDrop = async (stage: CrmStage) => {
    const id = dragId; setDragId(null);
    if (!id) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.stage === stage) return;
    try {
      await updateLead.mutateAsync({ id: lead.id, stage });
      if (stage === "fechado") {
        const exists = clients.find((c) => c.crm_lead_id === lead.id);
        let clientId = exists?.id ?? null;
        if (!exists) {
          const c = await createClient.mutateAsync({
            name: lead.name, instagram: lead.instagram, email: lead.email, phone: lead.phone,
            segment: lead.segment, monthly_value: lead.monthly_value, crm_lead_id: lead.id,
          });
          clientId = c.id;
        }
        await createContract.mutateAsync({
          title: `Contrato - ${lead.name}`, status: "fechado",
          monthly_value: lead.monthly_value ?? 0, contract_value: lead.monthly_value ?? 0,
          closed_date: new Date().toISOString().split("T")[0], crm_lead_id: lead.id, crm_client_id: clientId,
        });
        toast.success("Lead convertido em cliente + contrato!");
      }
    } catch { /* hooks já mostram o erro */ }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Pipeline ativo", value: brl(metrics.pipeline) },
          { label: "Em negociação", value: brl(metrics.negoVal) },
          { label: "Fechados", value: String(metrics.fechados) },
          { label: "MRR (clientes)", value: brl(metrics.mrr) },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-body font-semibold">{m.label}</p>
            <p className="text-xl font-display font-extrabold text-foreground mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-display font-bold text-foreground">Pipeline de prospecção</h3>
        <Button size="sm" onClick={() => { setEditLead(null); setDialogOpen(true); }}><Plus className="h-3.5 w-3.5 mr-1.5" /> Novo lead</Button>
      </div>

      <div className="overflow-x-auto pb-4 -mx-1 px-1">
        <div className="flex gap-3 min-w-max">
          {CRM_STAGES.map((stage) => {
            const col = leads.filter((l) => l.stage === stage);
            return (
              <div key={stage} className="w-60 shrink-0" onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(stage)}>
                <div className="flex items-center justify-between px-2 py-2">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{CRM_STAGE_LABELS[stage]}</h4>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{col.length}</Badge>
                </div>
                <div className={cn("min-h-[280px] rounded-xl p-2 space-y-2", STAGE_BG[stage])}>
                  {col.map((lead) => (
                    <div key={lead.id} draggable onDragStart={() => setDragId(lead.id)} onDragEnd={() => setDragId(null)}
                      onClick={() => { setEditLead(lead); setDialogOpen(true); }}
                      className={cn("rounded-xl border border-border bg-card p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all", dragId === lead.id && "opacity-40")}>
                      <p className="text-xs font-display font-bold text-foreground truncate">{lead.name}</p>
                      {lead.company && <p className="text-[10px] text-muted-foreground truncate">{lead.company}</p>}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {lead.segment && <Badge variant="outline" className="text-[9px] h-4">{lead.segment}</Badge>}
                        {lead.closing_potential && <Badge variant="outline" className="text-[9px] h-4">{POT[lead.closing_potential]} {lead.closing_potential}</Badge>}
                      </div>
                      {Number(lead.monthly_value) > 0 && <p className="text-[11px] font-semibold text-primary flex items-center gap-0.5 mt-1.5"><DollarSign className="h-3 w-3" />{brl(lead.monthly_value)}</p>}
                      {lead.next_interaction_date && <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1"><Target className="h-2.5 w-2.5" />{new Date(lead.next_interaction_date + "T00:00:00").toLocaleDateString("pt-BR")}</p>}
                    </div>
                  ))}
                  {col.length === 0 && <div className="text-center py-12 text-muted-foreground/40 text-[10px]">Arraste leads aqui</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {dialogOpen && (
        <LeadDialog
          key={editLead?.id ?? "new"}
          lead={editLead}
          onClose={() => { setDialogOpen(false); setEditLead(null); }}
          onCreate={async (input) => { await createLead.mutateAsync(input); setDialogOpen(false); }}
          onUpdate={async (id, updates) => { await updateLead.mutateAsync({ id, ...updates }); setDialogOpen(false); setEditLead(null); }}
          onDelete={async (id) => { if (confirm("Excluir este lead?")) { await delLead.mutateAsync(id); setDialogOpen(false); setEditLead(null); } }}
          saving={createLead.isPending || updateLead.isPending}
        />
      )}
    </div>
  );
}

function LeadDialog({ lead, onClose, onCreate, onUpdate, onDelete, saving }: {
  lead: CrmLead | null; onClose: () => void;
  onCreate: (i: CrmLeadInput) => void; onUpdate: (id: string, u: Partial<CrmLeadInput>) => void;
  onDelete: (id: string) => void; saving: boolean;
}) {
  const [f, setF] = useState<CrmLeadInput>(() => (lead ? { ...lead } : { name: "" }));
  const set = (patch: Partial<CrmLeadInput>) => setF((p) => ({ ...p, ...patch }));
  const submit = () => {
    if (!f.name?.trim()) { toast.error("Nome é obrigatório."); return; }
    if (lead) onUpdate(lead.id, f); else onCreate(f);
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">{lead ? "Editar lead" : "Novo lead"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <L label="Nome *"><Input value={f.name ?? ""} onChange={(e) => set({ name: e.target.value })} className="rounded-xl" /></L>
          <L label="Empresa"><Input value={f.company ?? ""} onChange={(e) => set({ company: e.target.value })} className="rounded-xl" /></L>
          <L label="Instagram"><Input value={f.instagram ?? ""} onChange={(e) => set({ instagram: e.target.value })} className="rounded-xl" /></L>
          <L label="Telefone"><Input value={f.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} className="rounded-xl" /></L>
          <L label="Segmento"><Input value={f.segment ?? ""} onChange={(e) => set({ segment: e.target.value })} className="rounded-xl" /></L>
          <L label="Valor mensal (R$)"><Input type="number" value={f.monthly_value ?? 0} onChange={(e) => set({ monthly_value: Number(e.target.value) })} className="rounded-xl" /></L>
          <L label="Potencial">
            <select value={f.closing_potential ?? ""} onChange={(e) => set({ closing_potential: (e.target.value || null) as CrmLeadInput["closing_potential"] })}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="">—</option><option value="alto">🟢 Alto</option><option value="medio">🟡 Médio</option><option value="baixo">🔴 Baixo</option>
            </select>
          </L>
          <L label="Próxima ação (data)"><Input type="date" value={f.next_interaction_date ?? ""} onChange={(e) => set({ next_interaction_date: e.target.value || null })} className="rounded-xl" /></L>
          <L label="Próximos passos" full><Input value={f.next_steps ?? ""} onChange={(e) => set({ next_steps: e.target.value })} className="rounded-xl" /></L>
          <L label="Principal dor" full><Textarea rows={2} value={f.main_pain ?? ""} onChange={(e) => set({ main_pain: e.target.value })} className="rounded-xl text-sm" /></L>
          <L label="Notas" full><Textarea rows={2} value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} className="rounded-xl text-sm" /></L>
        </div>
        <div className="flex items-center justify-between gap-2 mt-5">
          {lead ? <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(lead.id)}><Trash2 className="h-4 w-4 mr-1.5" /> Excluir</Button> : <span />}
          <div className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={saving}>{lead ? "Salvar" : "Criar"}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function L({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn("space-y-1.5", full && "sm:col-span-2")}><Label className="text-xs">{label}</Label>{children}</div>;
}
