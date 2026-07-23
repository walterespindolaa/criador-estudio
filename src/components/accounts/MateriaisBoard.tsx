import { useState } from "react";
import {
  useClientMaterials, type ClientMaterial, type MaterialKind, type MaterialStatus,
} from "@/hooks/useClientMaterials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { confirmar } from "@/components/shared/Confirm";
import { Plus, MoreVertical, Loader2, User, CalendarDays, Package } from "lucide-react";
import { parseDateOnly } from "@/lib/date-br";

const COLUMNS: { key: MaterialStatus; label: string; dot: string }[] = [
  { key: "solicitado", label: "Solicitado", dot: "bg-amber-500" },
  { key: "a_fazer", label: "A fazer", dot: "bg-slate-400" },
  { key: "em_aprovacao", label: "Em aprovação", dot: "bg-blue-500" },
  { key: "ajuste", label: "Ajuste", dot: "bg-orange-500" },
  { key: "finalizado", label: "Finalizado", dot: "bg-green-500" },
];

const KINDS: { key: MaterialKind; label: string }[] = [
  { key: "apresentacao", label: "Apresentação" },
  { key: "flyer", label: "Flyer" },
  { key: "arte_avulsa", label: "Arte avulsa" },
  { key: "logo", label: "Logo" },
  { key: "outro", label: "Outro" },
];
const kindLabel = (k: MaterialKind) => KINDS.find((x) => x.key === k)?.label ?? "Outro";

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  try {
    return parseDateOnly(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch { return null; }
}

type FormState = { title: string; description: string; kind: MaterialKind; due_date: string };
const EMPTY: FormState = { title: "", description: "", kind: "arte_avulsa", due_date: "" };

export function MateriaisBoard({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { materials, isLoading, isError, createMaterial, updateMaterial, deleteMaterial } = useClientMaterials(clientId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientMaterial | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const openNew = () => { setEditing(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (m: ClientMaterial) => {
    setEditing(m);
    setForm({ title: m.title, description: m.description ?? "", kind: m.kind, due_date: m.due_date ?? "" });
    setDialogOpen(true);
  };

  const save = () => {
    const title = form.title.trim();
    if (!title) return;
    const payload = {
      title,
      description: form.description.trim() || null,
      kind: form.kind,
      due_date: form.due_date || null,
    };
    if (editing) {
      updateMaterial.mutate({ id: editing.id, ...payload }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createMaterial.mutate(payload, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const move = (m: ClientMaterial, status: MaterialStatus) => {
    if (m.status === status) return;
    updateMaterial.mutate({ id: m.id, status });
  };

  const remove = async (m: ClientMaterial) => {
    if (!(await confirmar({ titulo: "Excluir este material?", descricao: m.title, acao: "Excluir", destrutivo: true }))) return;
    deleteMaterial.mutate(m.id);
  };

  const saving = createMaterial.isPending || updateMaterial.isPending;
  const byStatus = (s: MaterialStatus) => materials.filter((m) => m.status === s);
  const pedidosCliente = materials.filter((m) => m.requested_by === "cliente" && m.status === "solicitado").length;

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-[12px] font-body text-muted-foreground leading-relaxed">
            Demandas de material fora do fluxo de posts (apresentação, flyer, arte avulsa, logo…). O que o cliente pedir pelo portal cai aqui em <span className="font-semibold text-foreground">Solicitado</span>.
          </p>
          {pedidosCliente > 0 && (
            <p className="text-[12px] font-body text-amber-700 mt-1 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> {pedidosCliente} pedido{pedidosCliente > 1 ? "s" : ""} do cliente aguardando.
            </p>
          )}
        </div>
        <Button onClick={openNew} className="shrink-0 rounded-xl h-10">
          <Plus className="h-4 w-4 mr-1.5" /> Novo material
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : isError ? (
        <p className="text-sm text-muted-foreground font-body py-10 text-center">Não consegui carregar os materiais.</p>
      ) : (
        // Mobile-first: colunas empilham; a partir de md vira kanban horizontal com scroll.
        <div className="flex flex-col gap-4 md:flex-row md:gap-3 md:overflow-x-auto md:pb-2 md:-mx-1 md:px-1">
          {COLUMNS.map((col) => {
            const items = byStatus(col.key);
            return (
              <section key={col.key} className="md:w-[260px] md:shrink-0">
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <h3 className="text-sm font-display font-bold text-foreground">{col.label}</h3>
                  <span className="text-[11px] font-body text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2.5 md:min-h-[60px]">
                  {items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 py-6 text-center text-[12px] text-muted-foreground font-body">
                      Vazio
                    </div>
                  ) : (
                    items.map((m) => (
                      <MaterialCard key={m.id} m={m} onEdit={() => openEdit(m)} onRemove={() => remove(m)} onMove={(s) => move(m, s)} />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar material" : "Novo material"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-1">
            <div>
              <label className="text-xs font-body font-semibold text-muted-foreground">Título</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Flyer de aniversário" className="mt-1" autoFocus />
            </div>
            <div>
              <label className="text-xs font-body font-semibold text-muted-foreground">Tipo</label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {KINDS.map((k) => (
                  <button key={k.key} type="button" onClick={() => setForm({ ...form, kind: k.key })}
                    className={`text-[12px] font-body font-semibold rounded-lg px-2.5 py-1.5 border transition-colors ${form.kind === k.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground"}`}>
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-body font-semibold text-muted-foreground">Descrição</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhes, referências, medidas…" rows={3} className="mt-1 resize-none" />
            </div>
            <div>
              <label className="text-xs font-body font-semibold text-muted-foreground">Prazo (opcional)</label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !form.title.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MaterialCard({ m, onEdit, onRemove, onMove }: {
  m: ClientMaterial; onEdit: () => void; onRemove: () => void; onMove: (s: MaterialStatus) => void;
}) {
  const due = fmtDate(m.due_date);
  const fromClient = m.requested_by === "cliente";
  return (
    <article className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 text-[10px] font-body font-bold uppercase tracking-wide text-primary bg-primary/10 rounded-md px-1.5 py-0.5">
            <Package className="h-3 w-3" /> {kindLabel(m.kind)}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground p-1 -mr-1 -mt-1 rounded-lg" aria-label="Ações do material">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {COLUMNS.filter((c) => c.key !== m.status).map((c) => (
              <DropdownMenuItem key={c.key} onClick={() => onMove(c.key)}>
                <span className={`w-2 h-2 rounded-full mr-2 ${c.dot}`} /> Mover p/ {c.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={onRemove} className="text-red-600 focus:text-red-600">Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <h4 className="text-sm font-display font-bold text-foreground mt-1.5 leading-snug">{m.title}</h4>
      {m.description && <p className="text-[12px] font-body text-muted-foreground mt-1 line-clamp-2">{m.description}</p>}
      <div className="flex items-center gap-2 flex-wrap mt-2.5">
        {fromClient && (
          <span className="inline-flex items-center gap-1 text-[10px] font-body font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-1.5 py-0.5">
            <User className="h-3 w-3" /> Pedido do cliente
          </span>
        )}
        {due && (
          <span className="inline-flex items-center gap-1 text-[11px] font-body text-muted-foreground">
            <CalendarDays className="h-3 w-3" /> {due}
          </span>
        )}
      </div>
    </article>
  );
}
