import { useMemo, useState } from "react";
import { Plus, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Trash2, Pencil } from "lucide-react";
import {
  useFinRecords, useCreateFinRecord, useUpdateFinRecord, useDeleteFinRecord,
  type FinRecord, type FinType, type FinStatus, type FinRecordInput,
} from "@/hooks/useFinance";
import { useCrmClients } from "@/hooks/useCrm";
import { ModuleGate } from "@/components/accounts/ModuleGate";
import { ManagerSectionTitle } from "@/components/accounts/ManagerSectionTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const STATUS_STYLE: Record<FinStatus, string> = {
  pago: "bg-green-100 text-green-700", pendente: "bg-amber-100 text-amber-700", atrasado: "bg-destructive/10 text-destructive",
};
const STATUS_LABEL: Record<FinStatus, string> = { pago: "Pago", pendente: "Pendente", atrasado: "Atrasado" };

export default function CriaCaixa() {
  return <ModuleGate code="financeiro"><CaixaInner /></ModuleGate>;
}

function CaixaInner() {
  const { data: records = [], isLoading } = useFinRecords();
  const { data: clients = [] } = useCrmClients();
  const del = useDeleteFinRecord();

  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [typeF, setTypeF] = useState<FinType | "todos">("todos");
  const [statusF, setStatusF] = useState<FinStatus | "todos">("todos");
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<FinRecord | null>(null);

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? null;
  const inMonth = (d: string) => { const dt = new Date(d + "T00:00:00"); return dt.getFullYear() === ym.y && dt.getMonth() === ym.m; };

  const monthRecords = useMemo(() => records.filter((r) => inMonth(r.date)), [records, ym]);
  const filtered = monthRecords.filter((r) => (typeF === "todos" || r.type === typeF) && (statusF === "todos" || r.status === statusF));
  const metrics = useMemo(() => {
    const entradas = monthRecords.filter((r) => r.type === "entrada").reduce((s, r) => s + Number(r.amount), 0);
    const despesas = monthRecords.filter((r) => r.type === "despesa").reduce((s, r) => s + Number(r.amount), 0);
    const atrasado = records.filter((r) => r.status === "atrasado").reduce((s, r) => s + Number(r.amount), 0);
    return { entradas, despesas, saldo: entradas - despesas, atrasado };
  }, [monthRecords, records]);
  const shift = (delta: number) => setYm((p) => { const d = new Date(p.y, p.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <ManagerSectionTitle t="Cria Caixa" s="O financeiro da sua operação — entradas, despesas e saldo." />
        <Button size="sm" onClick={() => { setEditing(null); setDialog(true); }}><Plus className="h-3.5 w-3.5 mr-1.5" /> Novo lançamento</Button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-display font-bold text-foreground min-w-[110px] text-center">{MONTHS[ym.m]} {ym.y}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Metric label="Entradas" value={brl(metrics.entradas)} tone="green" />
        <Metric label="Despesas" value={brl(metrics.despesas)} tone="red" />
        <Metric label="Saldo do mês" value={brl(metrics.saldo)} tone={metrics.saldo >= 0 ? "green" : "red"} />
        <Metric label="A receber em atraso" value={brl(metrics.atrasado)} tone="amber" />
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(["todos", "entrada", "despesa"] as const).map((t) => (
          <button key={t} onClick={() => setTypeF(t)} className={cn("px-3 py-1.5 rounded-full text-xs font-body font-bold border", typeF === t ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground")}>{t === "todos" ? "Tudo" : t === "entrada" ? "Entradas" : "Despesas"}</button>
        ))}
        <span className="w-px h-5 bg-border mx-1" />
        {(["todos", "pago", "pendente", "atrasado"] as const).map((s) => (
          <button key={s} onClick={() => setStatusF(s)} className={cn("px-3 py-1.5 rounded-full text-xs font-body font-bold border", statusF === s ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground")}>{s === "todos" ? "Status" : STATUS_LABEL[s]}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-body text-foreground font-medium">Nenhum lançamento neste mês</p>
          <p className="text-xs text-muted-foreground font-body mt-1">Adicione entradas e despesas pra acompanhar o caixa.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const isIn = r.type === "entrada";
            return (
              <div key={r.id} className="group rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", isIn ? "bg-green-100 text-green-700" : "bg-destructive/10 text-destructive")}>
                  {isIn ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-display font-bold text-foreground truncate">{r.description}</p>
                  <p className="text-[11px] text-muted-foreground font-body truncate">
                    {new Date(r.date + "T00:00:00").toLocaleDateString("pt-BR")}{r.category ? ` · ${r.category}` : ""}{clientName(r.crm_client_id) ? ` · ${clientName(r.crm_client_id)}` : ""}
                  </p>
                </div>
                <Badge className={cn("text-[10px] shrink-0", STATUS_STYLE[r.status])}>{STATUS_LABEL[r.status]}</Badge>
                <span className={cn("text-sm font-display font-extrabold shrink-0", isIn ? "text-green-700" : "text-destructive")}>{isIn ? "+" : "−"}{brl(Number(r.amount))}</span>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setDialog(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Excluir lançamento?")) del.mutate(r.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dialog && (
        <RecordDialog
          key={editing?.id ?? "new"}
          record={editing}
          clients={clients}
          defaultDate={`${ym.y}-${String(ym.m + 1).padStart(2, "0")}-${String(Math.min(now.getDate(), 28)).padStart(2, "0")}`}
          onClose={() => { setDialog(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "green" | "red" | "amber" }) {
  const c = tone === "green" ? "text-green-700" : tone === "red" ? "text-destructive" : "text-amber-600";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-body font-semibold">{label}</p>
      <p className={cn("text-xl font-display font-extrabold mt-1", c)}>{value}</p>
    </div>
  );
}

function RecordDialog({ record, clients, defaultDate, onClose }: {
  record: FinRecord | null; clients: { id: string; name: string }[]; defaultDate: string; onClose: () => void;
}) {
  const create = useCreateFinRecord(); const update = useUpdateFinRecord();
  const [f, setF] = useState<FinRecordInput>(() => record ? { ...record } : { type: "entrada", description: "", amount: 0, status: "pendente", date: defaultDate });
  const set = (patch: Partial<FinRecordInput>) => setF((p) => ({ ...p, ...patch }));
  const submit = async () => {
    if (!f.description?.trim()) return;
    if (record) await update.mutateAsync({ id: record.id, ...f });
    else await create.mutateAsync(f as FinRecordInput);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">{record ? "Editar lançamento" : "Novo lançamento"}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-2">
            {(["entrada", "despesa"] as const).map((t) => (
              <button key={t} onClick={() => set({ type: t })} className={cn("py-2 rounded-xl text-sm font-body font-bold border", f.type === t ? (t === "entrada" ? "bg-green-600 text-white border-green-600" : "bg-destructive text-white border-destructive") : "bg-card border-border text-muted-foreground")}>{t === "entrada" ? "Entrada" : "Despesa"}</button>
            ))}
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Descrição *</Label><Input value={f.description ?? ""} onChange={(e) => set({ description: e.target.value })} className="rounded-xl" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Valor (R$) *</Label><Input type="number" value={f.amount ?? 0} onChange={(e) => set({ amount: Number(e.target.value) })} className="rounded-xl" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Data</Label><Input type="date" value={f.date ?? defaultDate} onChange={(e) => set({ date: e.target.value })} className="rounded-xl" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Categoria</Label><Input value={f.category ?? ""} onChange={(e) => set({ category: e.target.value })} placeholder="Ex: Serviços, Ferramentas" className="rounded-xl" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Status</Label>
              <select value={f.status ?? "pendente"} onChange={(e) => set({ status: e.target.value as FinStatus })} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="pago">Pago</option><option value="pendente">Pendente</option><option value="atrasado">Atrasado</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Cliente (opcional)</Label>
              <select value={f.crm_client_id ?? ""} onChange={(e) => set({ crm_client_id: e.target.value || null })} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Forma de pagamento</Label><Input value={f.payment_method ?? ""} onChange={(e) => set({ payment_method: e.target.value })} placeholder="Pix, cartão..." className="rounded-xl" /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={!f.description?.trim() || create.isPending || update.isPending}>{record ? "Salvar" : "Criar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
