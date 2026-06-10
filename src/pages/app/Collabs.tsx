import { useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Check, Bell, Clock, AlertTriangle, Archive, ArchiveRestore, Handshake, ChevronLeft, ChevronRight } from "lucide-react";
import { useTier } from "@/hooks/useTier";
import {
  useCollabs, collabReminders, COLLAB_STATUSES, COLLAB_STATUS_LABEL,
  type CollabStatus, type CollabWithDeliverables, type CollabReminder,
} from "@/hooks/useCollabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CollabDialog } from "@/components/collabs/CollabDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const brl = (v?: number | null) =>
  v == null ? "—" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const STATUS_DOT: Record<CollabStatus, string> = {
  lead: "#9b97ad", negociando: "#d97706", fechado: "#8B5CF6", entregue: "#16a34a", pago: "#9b97ad",
};

export default function Collabs() {
  const { tier } = useTier();
  const { collabs, isLoading, updateCollab, deleteCollab } = useCollabs();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<CollabWithDeliverables | null>(null);

  if (tier !== "studio") return <Navigate to="/app/assinar" replace />;

  const active = collabs.filter((c) => !c.archived);
  const archived = collabs.filter((c) => c.archived);
  const reminders = collabReminders(collabs);

  const nowMonth = new Date().toISOString().slice(0, 7);
  const fechadoMes = active
    .filter((c) => ["fechado", "entregue", "pago"].includes(c.status) && c.updated_at.slice(0, 7) === nowMonth)
    .reduce((s, c) => s + (c.value ?? 0), 0);
  const aReceber = active.filter((c) => c.status !== "pago").reduce((s, c) => s + (c.value ?? 0), 0);
  const entregasPend = active.reduce((s, c) => s + Math.max(0, c.total - c.done), 0);

  const openNew = () => { setEditingId(null); setDialogOpen(true); };
  const openEdit = (c: CollabWithDeliverables) => { setEditingId(c.id); setDialogOpen(true); };

  const moveCollab = (c: CollabWithDeliverables, dir: -1 | 1) => {
    const i = COLLAB_STATUSES.indexOf(c.status);
    const next = COLLAB_STATUSES[i + dir];
    if (next) updateCollab.mutate({ id: c.id, status: next });
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight">Collabs</h1>
          <p className="text-sm text-muted-foreground font-body mt-1">Suas parcerias com marcas — do primeiro contato ao pagamento.</p>
        </div>
        <Button onClick={openNew} className="rounded-xl gap-2"><Plus className="h-4 w-4" />Nova collab</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="Fechado no mês" value={brl(fechadoMes)} tone="green" />
        <Kpi label="A receber" value={brl(aReceber)} tone="amber" />
        <Kpi label="Entregas pendentes" value={String(entregasPend)} />
        <Kpi label="Collabs ativas" value={String(active.length)} />
      </div>

      {reminders.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-1.5 mb-5">
          <div className="flex items-center gap-2 px-3 pt-2 pb-1 text-sm font-display font-bold">
            <Bell className="h-4 w-4 text-primary" /> Lembretes
          </div>
          {reminders.map((r) => <ReminderRow key={r.id} r={r} onOpen={() => openEdit(r.collab)} />)}
        </div>
      )}

      <Tabs defaultValue="pipeline" className="w-full">
        <TabsList className="bg-card border border-border rounded-2xl p-1.5 mb-5 flex-wrap h-auto">
          <TabsTrigger value="pipeline" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Pipeline</TabsTrigger>
          <TabsTrigger value="lista" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Lista</TabsTrigger>
          <TabsTrigger value="historico" className="rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <Pipeline active={active} isLoading={isLoading} onOpen={openEdit} onNew={openNew} onMove={moveCollab} />
        </TabsContent>
        <TabsContent value="lista">
          <ListView rows={active} isLoading={isLoading} onOpen={openEdit}
            onArchive={(c) => updateCollab.mutate({ id: c.id, archived: true })} onDelete={setConfirmDel} />
        </TabsContent>
        <TabsContent value="historico">
          <ListView rows={archived} isLoading={isLoading} onOpen={openEdit} historico
            onArchive={(c) => updateCollab.mutate({ id: c.id, archived: false })} onDelete={setConfirmDel} />
        </TabsContent>
      </Tabs>

      <CollabDialog open={dialogOpen} onOpenChange={setDialogOpen} collabId={editingId} />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir collab?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel ? `"${confirmDel.brand}" e seus entregáveis serão removidos. Essa ação não pode ser desfeita.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmDel) deleteCollab.mutate(confirmDel.id); setConfirmDel(null); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "green" | "amber" }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
      <div className={cn("text-xl md:text-2xl font-display font-extrabold tracking-tight mt-1.5",
        tone === "green" && "text-green-600", tone === "amber" && "text-amber-600")}>{value}</div>
    </div>
  );
}

function ReminderRow({ r, onOpen }: { r: CollabReminder; onOpen: () => void }) {
  const map = {
    atrasado: { bg: "bg-red-50", ic: "text-red-600", Icon: AlertTriangle },
    pendente: { bg: "bg-amber-50", ic: "text-amber-600", Icon: Clock },
    objetivo: { bg: "bg-green-50", ic: "text-green-600", Icon: Check },
  } as const;
  const m = map[r.kind];
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl", m.bg)}>
      <div className={cn("h-8 w-8 rounded-lg bg-white grid place-items-center flex-shrink-0", m.ic)}><m.Icon className="h-4 w-4" /></div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{r.title}</div>
        <div className="text-xs text-muted-foreground truncate">{r.meta}</div>
      </div>
      <button onClick={onOpen} className="ml-auto text-xs font-semibold text-primary bg-primary/10 rounded-lg px-2.5 py-1.5 flex-shrink-0">Ver collab</button>
    </div>
  );
}

function Pipeline({ active, isLoading, onOpen, onNew, onMove }: {
  active: CollabWithDeliverables[]; isLoading: boolean;
  onOpen: (c: CollabWithDeliverables) => void; onNew: () => void;
  onMove: (c: CollabWithDeliverables, dir: -1 | 1) => void;
}) {
  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>;
  if (active.length === 0) return <EmptyState onNew={onNew} />;
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {COLLAB_STATUSES.map((s) => {
        const items = active.filter((c) => c.status === s);
        return (
          <div key={s} className="min-w-[190px] flex-1">
            <div className="flex items-center gap-2 mb-2.5 px-0.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_DOT[s] }} />
              <span className="text-[13px] font-display font-bold">{COLLAB_STATUS_LABEL[s]}</span>
              <span className="text-[11px] text-muted-foreground bg-card border border-border rounded-full px-2 font-semibold">{items.length}</span>
            </div>
            <div className="space-y-2.5">
              {items.map((c) => <CollabCard key={c.id} c={c} onOpen={() => onOpen(c)} onMove={(dir) => onMove(c, dir)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CollabCard({ c, onOpen, onMove }: {
  c: CollabWithDeliverables; onOpen: () => void; onMove: (dir: -1 | 1) => void;
}) {
  const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
  const full = c.total > 0 && c.done === c.total;
  const overdue = !!c.deadline && c.status !== "pago" && c.done < c.total &&
    new Date(c.deadline + "T00:00:00") < new Date(new Date().toDateString());
  const idx = COLLAB_STATUSES.indexOf(c.status);
  const canPrev = idx > 0;
  const canNext = idx < COLLAB_STATUSES.length - 1;
  return (
    <div onClick={onOpen} role="button" tabIndex={0}
      className="w-full text-left bg-card border border-border rounded-2xl p-3 hover:shadow-md transition-all border-l-[3px] cursor-pointer"
      style={{ borderLeftColor: STATUS_DOT[c.status] }}>
      <div className="flex items-center gap-2.5 mb-2">
        <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary grid place-items-center font-display font-extrabold text-xs flex-shrink-0">{c.brand.charAt(0).toUpperCase()}</div>
        <div className="min-w-0">
          <div className="text-[13px] font-display font-bold leading-tight truncate">{c.brand}</div>
          <div className="text-[11px] text-muted-foreground">{c.value != null ? brl(c.value) : "cachê a definir"}</div>
        </div>
      </div>
      {c.total > 0 && (
        <div className="mb-2">
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1"><span>Entregáveis</span><span className="font-semibold text-foreground">{c.done}/{c.total}</span></div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className={cn("h-full rounded-full", full ? "bg-green-600" : "bg-primary")} style={{ width: `${pct}%` }} /></div>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {full && <Chip tone="green">Objetivo atingido</Chip>}
          {overdue && <Chip tone="red">Atrasado</Chip>}
          {!full && !overdue && c.deadline && <Chip tone="gray">{fmtDate(c.deadline)}</Chip>}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button type="button" disabled={!canPrev} onClick={(e) => { e.stopPropagation(); onMove(-1); }}
            className="h-6 w-6 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent" title="Voltar etapa">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" disabled={!canNext} onClick={(e) => { e.stopPropagation(); onMove(1); }}
            className="h-6 w-6 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent" title="Avançar etapa">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ListView({ rows, isLoading, onOpen, onArchive, onDelete, historico }: {
  rows: CollabWithDeliverables[]; isLoading: boolean;
  onOpen: (c: CollabWithDeliverables) => void; onArchive: (c: CollabWithDeliverables) => void;
  onDelete: (c: CollabWithDeliverables) => void; historico?: boolean;
}) {
  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>;
  if (rows.length === 0)
    return <div className="text-sm text-muted-foreground py-10 text-center bg-card border border-border rounded-2xl">{historico ? "Nenhuma collab arquivada ainda." : "Nenhuma collab por aqui ainda."}</div>;
  return (
    <div className="space-y-2.5">
      {rows.map((c) => (
        <div key={c.id} className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center font-display font-extrabold text-sm flex-shrink-0">{c.brand.charAt(0).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-display font-bold truncate">{c.brand}</span>
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: STATUS_DOT[c.status] }} />
              <span className="text-[11px] text-muted-foreground">{COLLAB_STATUS_LABEL[c.status]}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {brl(c.value)} · {c.total > 0 ? `${c.done}/${c.total} entregas` : "sem entregáveis"}{c.deadline ? ` · prazo ${fmtDate(c.deadline)}` : ""}
            </div>
          </div>
          <button onClick={() => onOpen(c)} className="text-muted-foreground hover:text-primary p-1.5 flex-shrink-0" title="Editar"><Pencil className="h-4 w-4" /></button>
          <button onClick={() => onArchive(c)} className="text-muted-foreground hover:text-foreground p-1.5 flex-shrink-0" title={historico ? "Restaurar" : "Arquivar"}>{historico ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</button>
          <button onClick={() => onDelete(c)} className="text-muted-foreground hover:text-red-600 p-1.5 flex-shrink-0" title="Excluir"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}

function Chip({ tone, children }: { tone: "green" | "red" | "amber" | "gray"; children: ReactNode }) {
  const map = { green: "bg-green-100 text-green-700", red: "bg-red-100 text-red-700", amber: "bg-amber-100 text-amber-700", gray: "bg-muted text-muted-foreground" };
  return <span className={cn("text-[11px] font-semibold rounded-lg px-2 py-0.5", map[tone])}>{children}</span>;
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="bg-card border border-border rounded-2xl py-12 px-6 text-center">
      <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary grid place-items-center mx-auto mb-3"><Handshake className="h-6 w-6" /></div>
      <div className="font-display font-bold text-foreground">Nenhuma collab ainda</div>
      <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm mx-auto">Cadastre sua primeira parceria com uma marca e acompanhe cachê, entregáveis e prazos num só lugar.</p>
      <Button onClick={onNew} className="rounded-xl gap-2"><Plus className="h-4 w-4" />Nova collab</Button>
    </div>
  );
}
