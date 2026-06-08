import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useFinRecurring, useCreateFinRecurring, useUpdateFinRecurring, useDeleteFinRecurring,
  type FinRecurring, type FinRecurringInput, type FinContext, type FinType,
} from "@/hooks/useFinance";

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type Props = {
  open: boolean; onOpenChange: (o: boolean) => void; ctx: FinContext;
  defaultCats: Record<FinType, string[]>; customCats?: { entrada?: string[]; despesa?: string[] };
  defaultSubs: Record<FinType, Record<string, string[]>>; customSubs?: { entrada?: Record<string, string[]>; despesa?: Record<string, string[]> };
};

export function FinRecurringDialog({ open, onOpenChange, ctx, defaultCats, customCats, defaultSubs, customSubs }: Props) {
  const { data: all = [] } = useFinRecurring();
  const create = useCreateFinRecurring();
  const update = useUpdateFinRecurring();
  const del = useDeleteFinRecurring();
  const list = all.filter((t) => (t.context ?? "pj") === ctx);

  const blank = (): FinRecurringInput => ({ context: ctx, type: "despesa", description: "", amount: 0, due_day: 5, active: true });
  const [editing, setEditing] = useState<FinRecurring | null>(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState<FinRecurringInput>(blank());
  const set = (patch: Partial<FinRecurringInput>) => setF((p) => ({ ...p, ...patch }));

  const startAdd = () => { setEditing(null); setF(blank()); setAdding(true); };
  const startEdit = (t: FinRecurring) => { setEditing(t); setF({ ...t }); setAdding(true); };
  const cancel = () => { setAdding(false); setEditing(null); };

  const ftype: FinType = f.type ?? "despesa";
  const cats = Array.from(new Set([...(defaultCats[ftype] ?? []), ...((customCats?.[ftype]) ?? [])]));
  const cat = f.category ?? "";
  const subs = cat ? Array.from(new Set([...((defaultSubs[ftype]?.[cat]) ?? []), ...((customSubs?.[ftype]?.[cat]) ?? [])])) : [];

  const save = async () => {
    if (!f.description?.trim()) return;
    if (editing) await update.mutateAsync({ id: editing.id, ...f });
    else await create.mutateAsync({ ...f, context: ctx });
    cancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2"><Repeat className="h-4 w-4" /> Recorrentes — {ctx === "pj" ? "Empresa" : "Pessoal"}</DialogTitle>
          <DialogDescription className="font-body text-sm">Custos e receitas fixos que se repetem todo mês. Você lança o mês com um clique no Caixa.</DialogDescription>
        </DialogHeader>

        {!adding ? (
          <div className="space-y-3 mt-2">
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground font-body py-4 text-center">Nenhum recorrente ainda.</p>
            ) : list.map((t) => (
              <div key={t.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                <button onClick={() => update.mutate({ id: t.id, active: !t.active })} className={cn("w-2.5 h-2.5 rounded-full shrink-0", t.active ? "bg-green-500" : "bg-muted-foreground/40")} aria-label="Ativar/pausar" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-display font-bold text-foreground truncate">{t.description}</p>
                  <p className="text-[11px] text-muted-foreground font-body truncate">{t.type === "entrada" ? "Entrada" : "Despesa"} · dia {t.due_day}{t.category ? ` · ${t.category}` : ""}{!t.active ? " · pausado" : ""}</p>
                </div>
                <span className="text-sm font-display font-bold text-foreground shrink-0">{brl(Number(t.amount))}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => startEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => { if (confirm("Excluir este recorrente?")) del.mutate(t.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={startAdd}><Plus className="h-4 w-4 mr-1.5" /> Novo recorrente</Button>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-2">
              {(["entrada", "despesa"] as const).map((t) => (
                <button key={t} onClick={() => set({ type: t, category: "", subcategory: "" })} className={cn("py-2 rounded-xl text-sm font-body font-bold border", ftype === t ? (t === "entrada" ? "bg-green-600 text-white border-green-600" : "bg-destructive text-white border-destructive") : "bg-card border-border text-muted-foreground")}>{t === "entrada" ? "Entrada" : "Despesa"}</button>
              ))}
            </div>
            <Fld label="Descrição *"><Input value={f.description ?? ""} onChange={(e) => set({ description: e.target.value })} placeholder="Ex: Canva Pro" className="rounded-xl" /></Fld>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Valor (R$)"><Input type="number" value={f.amount ?? 0} onChange={(e) => set({ amount: Number(e.target.value) })} className="rounded-xl" /></Fld>
              <Fld label="Vence dia (1–28)"><Input type="number" min={1} max={28} value={f.due_day ?? 5} onChange={(e) => set({ due_day: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })} className="rounded-xl" /></Fld>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Categoria">
                <Input list="rec-cats" value={f.category ?? ""} onChange={(e) => set({ category: e.target.value, subcategory: "" })} className="rounded-xl" />
                <datalist id="rec-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
              </Fld>
              <Fld label="Subcategoria">
                <Input list="rec-subs" value={f.subcategory ?? ""} onChange={(e) => set({ subcategory: e.target.value })} className="rounded-xl" />
                <datalist id="rec-subs">{subs.map((s) => <option key={s} value={s} />)}</datalist>
              </Fld>
            </div>
            <div className="flex items-center justify-between gap-2 mt-4">
              <Button variant="ghost" onClick={cancel}>Voltar</Button>
              <Button onClick={save} disabled={!f.description?.trim() || create.isPending || update.isPending}>{editing ? "Salvar" : "Adicionar"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
