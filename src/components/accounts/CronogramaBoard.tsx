import { useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Send, Link2, CalendarRange, Building2, PartyPopper, Check, AtSign, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCronogramas, useCronogramaItems, useCronogramaDatas, CRONOGRAMA_TYPES,
  type Cronograma, type CronogramaItem, type ItemStatus,
} from "@/hooks/useCronograma";
import { useExternalClients } from "@/hooks/useCriaPost";
import { DATAS_COMEMORATIVAS } from "@/lib/datasComemorativas";

const TYPE_COLOR: Record<string, string> = {
  "Reels": "bg-red-600", "Carrossel": "bg-green-700", "Feed": "bg-blue-700",
  "Stories": "bg-gray-500", "Carrossel/Stories": "bg-green-700", "Feed/Stories": "bg-blue-700",
};
const ST_LABEL: Record<ItemStatus, string> = { pendente: "Pendente", aprovado: "Aprovado", recusado: "Recusado", ajuste: "Ajuste pedido" };
const ST_CLASS: Record<ItemStatus, string> = {
  pendente: "bg-muted text-muted-foreground", aprovado: "bg-green-100 text-green-700",
  recusado: "bg-red-100 text-red-700", ajuste: "bg-amber-100 text-amber-700",
};

// máscara DD/MM enquanto digita (ex.: "1505" -> "15/05")
const maskDay = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
};

// posts (Cria Post) ainda via cast — padrão do projeto.
const sbFrom = supabase.from.bind(supabase) as unknown as (t: string) => ReturnType<typeof supabase.from>;

export function CronogramaBoard({ fixedClientId }: { fixedClientId?: string }) {
  const { clients } = useExternalClients();
  const { cronogramas, create, update, remove } = useCronogramas();
  const [clientId, setClientId] = useState<string | null>(fixedClientId ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const selected = selectedId ? cronogramas.find((c) => c.id === selectedId) ?? null : null;
  const selectedClient = clientId ? clients.find((c) => c.id === clientId) ?? null : null;
  const clientCronos = cronogramas.filter((c) => c.external_client_id === clientId);
  const countFor = (cid: string) => cronogramas.filter((c) => c.external_client_id === cid).length;

  // Nível 3 — detalhe do cronograma
  if (selected) {
    return <CronogramaDetail c={selected} onBack={() => setSelectedId(null)} onUpdate={update.mutate} onDelete={async (id) => { await remove.mutateAsync(id); setSelectedId(null); }} />;
  }

  const createCronograma = async () => {
    if (!newTitle.trim() || !selectedClient) return;
    const c = await create.mutateAsync({ title: newTitle.trim(), external_client_id: selectedClient.id, client_label: selectedClient.name, client_handle: selectedClient.instagram_handle ?? null });
    setNewOpen(false); setNewTitle("");
    setSelectedId(c.id);
  };

  // Nível 2 — cronogramas do cliente (histórico)
  if (clientId && selectedClient) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {!fixedClientId && <Button variant="ghost" size="sm" onClick={() => setClientId(null)} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Clientes</Button>}
          <div className="min-w-0">
            <h3 className="font-display font-bold text-foreground leading-tight">{selectedClient.name}</h3>
            {selectedClient.instagram_handle && <p className="text-xs text-muted-foreground">@{selectedClient.instagram_handle.replace(/^@/, "")}</p>}
          </div>
          <Button size="sm" onClick={() => setNewOpen(true)} className="ml-auto gap-1.5"><Plus className="h-4 w-4" /> Novo cronograma</Button>
        </div>

        {clientCronos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><CalendarRange className="h-5 w-5 text-muted-foreground" /></div>
            <p className="text-sm font-medium text-foreground">Nenhum cronograma pra este cliente</p>
            <p className="text-xs text-muted-foreground mt-1">Crie o primeiro cronograma de conteúdos.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientCronos.map((c) => (
              <button key={c.id} onClick={() => setSelectedId(c.id)} className="text-left bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-1"><CalendarRange className="h-4 w-4 text-primary" /><span className="font-display font-bold text-foreground">{c.title}</span></div>
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
            <DialogHeader><DialogTitle className="font-display">Novo cronograma · {selectedClient.name}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div><Label className="text-xs">Título</Label><Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex.: Julho 2026" className="rounded-xl" /></div>
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

  // Nível 1 — lista de clientes
  const activeClients = clients.filter((c) => c.active);
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">Escolha um cliente pra ver o histórico e montar cronogramas.</p>
      {activeClients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><Building2 className="h-5 w-5 text-muted-foreground" /></div>
          <p className="text-sm font-medium text-foreground">Nenhum cliente cadastrado</p>
          <p className="text-xs text-muted-foreground mt-1">Cadastre um cliente na aba "Posts" pra começar.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeClients.map((cl) => (
            <button key={cl.id} onClick={() => setClientId(cl.id)} className="text-left bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md transition-all flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[2px] shrink-0">
                <div className="w-full h-full rounded-full bg-card grid place-items-center font-display font-extrabold text-primary">{cl.name.charAt(0).toUpperCase()}</div>
              </div>
              <div className="min-w-0">
                <p className="font-display font-bold text-foreground truncate">{cl.name}</p>
                <p className="text-xs text-muted-foreground">{countFor(cl.id)} cronograma{countFor(cl.id) === 1 ? "" : "s"}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CronogramaDetail({ c, onBack, onUpdate, onDelete }: {
  c: Cronograma; onBack: () => void;
  onUpdate: (p: { id: string } & Partial<Cronograma>) => void;
  onDelete: (id: string) => void;
}) {
  const { items, addItem, updateItem, deleteItem } = useCronogramaItems(c.id);
  const { user } = useAuth();
  const [editing, setEditing] = useState<CronogramaItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [f, setF] = useState<Partial<CronogramaItem>>({});
  const [handle, setHandle] = useState(c.client_handle ?? "");
  const [converting, setConverting] = useState(false);

  const approvedToConvert = items.filter((it) => it.approval_status === "aprovado" && !it.converted_post_id);

  const convertApproved = async () => {
    if (!c.external_client_id) { toast.error("Esse cronograma não está vinculado a um cliente."); return; }
    if (!user || approvedToConvert.length === 0) return;
    setConverting(true);
    try {
      for (const it of approvedToConvert) {
        const { data, error } = await sbFrom("posts").insert({
          user_id: user.id,
          external_client_id: c.external_client_id,
          title: it.copy ?? "(sem título)",
          platform: "instagram",
          format: it.type ?? "Feed",
          caption: it.description ?? null,
          status: "editando",
          approval_status: "pendente",
          approval_mode: "fast",
          scheduled_date: it.date ?? null,
        } as never).select("id").single();
        if (error) throw error;
        await updateItem.mutateAsync({ id: it.id, converted_post_id: (data as { id: string }).id });
      }
      toast.success(`${approvedToConvert.length} post(s) criado(s) no Cria Post do cliente!`);
    } catch {
      toast.error("Erro ao converter pro Cria Post. Tente de novo.");
    } finally {
      setConverting(false);
    }
  };

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
          <div className="flex items-center gap-1.5 mt-0.5">
            {c.client_label && <span className="text-xs text-muted-foreground">{c.client_label} ·</span>}
            <div className="relative">
              <AtSign className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                value={handle.replace(/^@/, "")}
                onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
                onBlur={() => onUpdate({ id: c.id, client_handle: handle.replace(/^@/, "") || null })}
                placeholder="cliente"
                className="h-6 w-32 pl-5 pr-1.5 text-xs rounded-md border border-border bg-background text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {approvedToConvert.length > 0 && (
            <Button variant="secondary" size="sm" onClick={convertApproved} disabled={converting} className="gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5" /> {converting ? "Convertendo…" : `Converter ${approvedToConvert.length} aprovado(s) → Cria Post`}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(link); toast.success("Link copiado."); }} className="gap-1.5"><Link2 className="h-3.5 w-3.5" /> Copiar link</Button>
          <Button size="sm" onClick={sendForApproval} className="gap-1.5"><Send className="h-3.5 w-3.5" /> Enviar pra aprovação</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Excluir este cronograma?")) onDelete(c.id); }}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <DatasComemorativasSection cronogramaId={c.id} />

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
                    {it.converted_post_id && <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full"><Check className="h-2.5 w-2.5" /> no Cria Post</span>}
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

function DatasComemorativasSection({ cronogramaId }: { cronogramaId: string }) {
  const { datas, addData, addManyDatas, deleteData } = useCronogramaDatas(cronogramaId);
  const [label, setLabel] = useState("");
  const [day, setDay] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const addCustom = async () => {
    if (!label.trim()) return;
    await addData.mutateAsync({ label: label.trim(), day_label: day.trim() || null });
    setLabel(""); setDay("");
  };

  const existingLabels = new Set(datas.map((d) => d.label.toLowerCase()));
  const selectedCount = datas.filter((d) => d.selected).length;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h4 className="font-display font-bold text-foreground flex items-center gap-2 text-sm">
          <PartyPopper className="h-4 w-4 text-primary" /> Datas comemorativas
          {datas.length > 0 && <span className="text-xs font-body font-normal text-muted-foreground">· {selectedCount} marcadas pelo cliente</span>}
        </h4>
        <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Lista anual</Button>
      </div>

      <p className="text-xs text-muted-foreground mb-3">Adicione datas pro cliente marcar quais quer trabalhar. Ele dá check no link.</p>

      {datas.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3">
          {datas.map((d) => (
            <div key={d.id} className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-2 group", d.selected ? "border-primary/40 bg-primary/[0.04]" : "border-border")}>
              {d.selected
                ? <span className="w-4 h-4 rounded bg-primary grid place-items-center shrink-0"><Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} /></span>
                : <span className="w-4 h-4 rounded border border-border shrink-0" />}
              <span className="text-sm text-foreground">{d.label}</span>
              {d.day_label && <span className="text-xs text-muted-foreground">{d.day_label}</span>}
              <button onClick={() => deleteData.mutate(d.id)} className="ml-auto opacity-0 group-hover:opacity-100 text-destructive transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()} placeholder="Ex.: Dia do Café" className="rounded-xl flex-1 min-w-[160px] h-9" />
        <Input value={day} onChange={(e) => setDay(maskDay(e.target.value))} onKeyDown={(e) => e.key === "Enter" && addCustom()} placeholder="14/04" inputMode="numeric" className="rounded-xl w-24 h-9" />
        <Button onClick={addCustom} disabled={!label.trim()} className="rounded-xl h-9 gap-1.5"><Plus className="h-4 w-4" /> Adicionar</Button>
      </div>

      <AnnualDatesDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        existingLabels={existingLabels}
        onConfirm={async (rows) => { if (rows.length) await addManyDatas.mutateAsync(rows); setPickerOpen(false); }}
      />
    </div>
  );
}

function AnnualDatesDialog({ open, onOpenChange, existingLabels, onConfirm }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingLabels: Set<string>;
  onConfirm: (rows: { label: string; day_label: string | null }[]) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setPicked((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const rows = DATAS_COMEMORATIVAS.flatMap((g) => g.items.map((it) => ({ key: `${g.month}-${it.label}`, label: it.label, day_label: it.day })));
  const confirm = () => onConfirm(rows.filter((r) => picked.has(r.key)).map(({ label, day_label }) => ({ label, day_label })));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Lista anual de datas</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Marque as datas pra adicionar ao cronograma deste cliente.</p>
        <div className="space-y-4 py-2">
          {DATAS_COMEMORATIVAS.map((g) => (
            <div key={g.month}>
              <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">{g.month}</p>
              <div className="grid gap-1">
                {g.items.map((it) => {
                  const key = `${g.month}-${it.label}`;
                  const already = existingLabels.has(it.label.toLowerCase());
                  const checked = picked.has(key);
                  return (
                    <button key={key} disabled={already} onClick={() => toggle(key)}
                      className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-1.5 text-left transition-colors",
                        already ? "opacity-40 cursor-not-allowed border-border" : checked ? "border-primary bg-primary/[0.05]" : "border-border hover:border-primary/40")}>
                      <span className={cn("w-4 h-4 rounded grid place-items-center shrink-0", checked ? "bg-primary" : "border border-border")}>
                        {checked && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
                      </span>
                      <span className="text-sm text-foreground flex-1">{it.label}</span>
                      <span className="text-xs text-muted-foreground">{already ? "já incluída" : it.day}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          <Button onClick={confirm} disabled={picked.size === 0} className="rounded-xl">Adicionar {picked.size > 0 ? `(${picked.size})` : ""}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
