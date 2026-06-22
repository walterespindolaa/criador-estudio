import { useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Send, Link2, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCronogramas, useCronogramaItems, CRONOGRAMA_TYPES,
  type Cronograma, type CronogramaItem, type ItemStatus,
} from "@/hooks/useCronograma";

const TYPE_COLOR: Record<string, string> = {
  "Reels": "bg-red-600", "Carrossel": "bg-green-700", "Feed": "bg-blue-700",
  "Stories": "bg-gray-500", "Carrossel/Stories": "bg-green-700", "Feed/Stories": "bg-blue-700",
};
const ST_LABEL: Record<ItemStatus, string> = { pendente: "Pendente", aprovado: "Aprovado", recusado: "Recusado", ajuste: "Ajuste pedido" };
const ST_CLASS: Record<ItemStatus, string> = {
  pendente: "bg-muted text-muted-foreground", aprovado: "bg-green-100 text-green-700",
  recusado: "bg-red-100 text-red-700", ajuste: "bg-amber-100 text-amber-700",
};

export function CronogramaBoard() {
  const { cronogramas, create, update, remove } = useCronogramas();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newClient, setNewClient] = useState("");

  const selected = selectedId ? cronogramas.find((c) => c.id === selectedId) ?? null : null;

  const createCronograma = async () => {
    if (!newTitle.trim()) return;
    const c = await create.mutateAsync({ title: newTitle.trim(), client_label: newClient.trim() || null });
    setNewOpen(false); setNewTitle(""); setNewClient("");
    setSelectedId(c.id);
  };

  if (selected) {
    return <CronogramaDetail c={selected} onBack={() => setSelectedId(null)} onUpdate={update.mutate} onDelete={async (id) => { await remove.mutateAsync(id); setSelectedId(null); }} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <p className="text-sm text-muted-foreground">Monte o calendário de conteúdos e envie pro cliente aprovar.</p>
        <Button size="sm" onClick={() => setNewOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Novo cronograma</Button>
      </div>

      {cronogramas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><CalendarRange className="h-5 w-5 text-muted-foreground" /></div>
          <p className="text-sm font-medium text-foreground">Nenhum cronograma ainda</p>
          <p className="text-xs text-muted-foreground mt-1">Crie um cronograma e adicione os conteúdos do mês.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cronogramas.map((c) => (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className="text-left bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-1">
                <CalendarRange className="h-4 w-4 text-primary" />
                <span className="font-display font-bold text-foreground">{c.title}</span>
              </div>
              {c.client_label && <p className="text-xs text-muted-foreground">{c.client_label}</p>}
              <span className={cn("inline-block mt-3 text-[10px] font-bold px-2 py-0.5 rounded-full",
                c.status === "aprovado" ? "bg-green-100 text-green-700" : c.status === "enviado" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground")}>
                {c.status === "aprovado" ? "Aprovado" : c.status === "enviado" ? "Enviado" : "Rascunho"}
              </span>
            </button>
          ))}
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-display">Novo cronograma</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="text-xs">Título</Label><Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex.: Julho 2026" className="rounded-xl" /></div>
            <div><Label className="text-xs">Cliente (opcional)</Label><Input value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="@cliente" className="rounded-xl" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={createCronograma} disabled={!newTitle.trim()} className="rounded-xl">Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CronogramaDetail({ c, onBack, onUpdate, onDelete }: {
  c: Cronograma; onBack: () => void;
  onUpdate: (p: { id: string } & Partial<Cronograma>) => void;
  onDelete: (id: string) => void;
}) {
  const { items, addItem, updateItem, deleteItem } = useCronogramaItems(c.id);
  const [editing, setEditing] = useState<CronogramaItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [f, setF] = useState<Partial<CronogramaItem>>({});

  const openNew = () => { setEditing(null); setF({ type: "Reels" }); setFormOpen(true); };
  const openEdit = (it: CronogramaItem) => { setEditing(it); setF(it); setFormOpen(true); };
  const saveItem = async () => {
    if (editing) await updateItem.mutateAsync({ id: editing.id, copy: f.copy ?? null, description: f.description ?? null, date: f.date ?? null, type: f.type ?? null });
    else await addItem.mutateAsync({ copy: f.copy ?? null, description: f.description ?? null, date: f.date ?? null, type: f.type ?? null });
    setFormOpen(false);
  };

  const link = `${window.location.origin}/cronograma/${c.token}`;
  const sendForApproval = () => {
    onUpdate({ id: c.id, status: "enviado" });
    navigator.clipboard?.writeText(link).then(() => toast.success("Link de aprovação copiado!")).catch(() => toast.success("Enviado pra aprovação."));
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
        <div className="min-w-0">
          <h3 className="font-display font-bold text-foreground leading-tight">{c.title}</h3>
          {c.client_label && <p className="text-xs text-muted-foreground">{c.client_label}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(link); toast.success("Link copiado."); }} className="gap-1.5"><Link2 className="h-3.5 w-3.5" /> Copiar link</Button>
          <Button size="sm" onClick={sendForApproval} className="gap-1.5"><Send className="h-3.5 w-3.5" /> Enviar pra aprovação</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Excluir este cronograma?")) onDelete(c.id); }}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/30 border-b border-border text-left">
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2.5 font-bold">Nº</th>
                <th className="px-3 py-2.5 font-bold">Copy</th>
                <th className="px-3 py-2.5 font-bold">Descrição</th>
                <th className="px-3 py-2.5 font-bold">Data</th>
                <th className="px-3 py-2.5 font-bold">Tipo</th>
                <th className="px-3 py-2.5 font-bold">Status / Comentário</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id} className="border-b border-border/40 last:border-0 hover:bg-accent/30 group">
                  <td className="px-3 py-2.5 font-bold text-muted-foreground">#{i + 1}</td>
                  <td className="px-3 py-2.5 font-semibold">{it.copy || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[280px]">{it.description}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{it.date ? it.date.split("-").reverse().slice(0, 2).join("/") : "—"}</td>
                  <td className="px-3 py-2.5">{it.type && <span className={cn("text-[11px] font-bold text-white px-2 py-0.5 rounded-full whitespace-nowrap", TYPE_COLOR[it.type] ?? "bg-gray-500")}>{it.type}</span>}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", ST_CLASS[it.approval_status])}>{ST_LABEL[it.approval_status]}</span>
                    {it.client_comment && <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 mt-1 max-w-[240px]">"{it.client_comment}"</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(it)} className="w-7 h-7 rounded-lg border border-border grid place-items-center hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { if (confirm("Excluir item?")) deleteItem.mutate(it.id); }} className="w-7 h-7 rounded-lg border border-border grid place-items-center hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 text-center border-t border-border">
          <Button variant="outline" size="sm" onClick={openNew} className="gap-1.5"><Plus className="h-4 w-4" /> Adicionar item</Button>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="text-xs">Copy / título</Label><Input value={f.copy ?? ""} onChange={(e) => setF((p) => ({ ...p, copy: e.target.value }))} className="rounded-xl" /></div>
            <div><Label className="text-xs">Descrição</Label><Textarea value={f.description ?? ""} onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} rows={3} className="rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Data</Label><Input type="date" value={f.date ?? ""} onChange={(e) => setF((p) => ({ ...p, date: e.target.value }))} className="rounded-xl" /></div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={f.type ?? "Reels"} onValueChange={(v) => setF((p) => ({ ...p, type: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{CRONOGRAMA_TYPES.map((tp) => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={saveItem} className="rounded-xl">{editing ? "Salvar" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
