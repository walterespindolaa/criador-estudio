import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, Repeat, ArrowUpRight, ArrowDownRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { PAYMENT_METHODS } from "@/lib/finance";
import { useCrmClients } from "@/hooks/useCrm";
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
  const { data: clients = [] } = useCrmClients();
  const create = useCreateFinRecurring();
  const update = useUpdateFinRecurring();
  const del = useDeleteFinRecurring();
  const list = all.filter((t) => (t.context ?? "pj") === ctx);

  const entradas = list.filter((t) => t.type === "entrada");
  const despesas = list.filter((t) => t.type === "despesa");
  const somaAtiva = (arr: FinRecurring[]) => arr.filter((t) => t.active).reduce((s, t) => s + Number(t.amount), 0);
  const totalEntrada = somaAtiva(entradas);
  const totalDespesa = somaAtiva(despesas);
  const saldoFixo = totalEntrada - totalDespesa;

  const blank = (): FinRecurringInput => ({ context: ctx, type: "despesa", description: "", amount: 0, due_day: 5, active: true });
  const [editing, setEditing] = useState<FinRecurring | null>(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState<FinRecurringInput>(blank());
  const set = (patch: Partial<FinRecurringInput>) => setF((p) => ({ ...p, ...patch }));

  const startAdd = (type: FinType) => { setEditing(null); setF({ ...blank(), type }); setAdding(true); };
  const startEdit = (t: FinRecurring) => { setEditing(t); setF({ ...t }); setAdding(true); };
  const cancel = () => { setAdding(false); setEditing(null); };

  const ftype: FinType = f.type ?? "despesa";
  const cats = Array.from(new Set([...(defaultCats[ftype] ?? []), ...((customCats?.[ftype]) ?? [])]));
  const cat = f.category ?? "";
  const subs = cat ? Array.from(new Set([...((defaultSubs[ftype]?.[cat]) ?? []), ...((customSubs?.[ftype]?.[cat]) ?? [])])) : [];

  const clientName = (id: string | null | undefined) => clients.find((c) => c.id === id)?.name ?? null;

  const save = async () => {
    if (!f.description?.trim()) return;
    if (editing) await update.mutateAsync({ id: editing.id, ...f });
    else await create.mutateAsync({ ...f, context: ctx });
    cancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2"><Repeat className="h-4 w-4" /> Recorrentes, {ctx === "pj" ? "Empresa" : "Pessoal"}</DialogTitle>
          <DialogDescription className="font-body text-sm">
            O que se repete todo mês. Aparece no calendário como <strong>previsto</strong> antes mesmo de ser lançado — e você lança o mês inteiro com um clique no Caixa.
          </DialogDescription>
        </DialogHeader>

        {!adding ? (
          <div className="space-y-4 mt-1">
            {/* Resumo — o que sai e o que entra todo mês, fixo. */}
            <div className="grid grid-cols-3 gap-2">
              <Resumo label="Entra fixo" value={brl(totalEntrada)} tone="green" sub={`${entradas.filter((t) => t.active).length} ativo(s)`} />
              <Resumo label="Sai fixo" value={brl(totalDespesa)} tone="red" sub={`${despesas.filter((t) => t.active).length} ativo(s)`} />
              <Resumo label="Saldo fixo" value={brl(saldoFixo)} tone={saldoFixo >= 0 ? "green" : "red"} sub="todo mês" />
            </div>

            <Grupo
              titulo="Entradas fixas" icone={<ArrowUpRight className="h-3.5 w-3.5" />} tone="green"
              itens={entradas} clientName={clientName}
              onAdd={() => startAdd("entrada")} onEdit={startEdit}
              onToggle={(t) => update.mutate({ id: t.id, active: !t.active })}
              onDelete={(t) => { if (confirm(`Excluir "${t.description}"? Os lançamentos já criados não somem.`)) del.mutate(t.id); }}
              vazio="Mensalidade fixa, retainer, aluguel de equipamento…"
            />

            <Grupo
              titulo="Despesas fixas" icone={<ArrowDownRight className="h-3.5 w-3.5" />} tone="red"
              itens={despesas} clientName={clientName}
              onAdd={() => startAdd("despesa")} onEdit={startEdit}
              onToggle={(t) => update.mutate({ id: t.id, active: !t.active })}
              onDelete={(t) => { if (confirm(`Excluir "${t.description}"? Os lançamentos já criados não somem.`)) del.mutate(t.id); }}
              vazio="Canva, editor, hospedagem, contador…"
            />
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
              <Fld label="Valor"><MoneyInput value={f.amount ?? null} onChange={(v) => set({ amount: v ?? 0 })} /></Fld>
              <Fld label="Todo dia (1–28)">
                <Input type="number" min={1} max={28} value={f.due_day ?? 5} onChange={(e) => set({ due_day: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })} className="rounded-xl" />
              </Fld>
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

            {ctx === "pj" && (
              <div className="grid grid-cols-2 gap-3">
                <Fld label="Cliente (opcional)">
                  <select value={f.crm_client_id ?? ""} onChange={(e) => set({ crm_client_id: e.target.value || null })} className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm">
                    <option value="">-</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Fld>
                <Fld label="Forma de pagamento">
                  <select value={f.payment_method ?? ""} onChange={(e) => set({ payment_method: e.target.value || null })} className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm">
                    <option value="">-</option>{PAYMENT_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Fld>
              </div>
            )}

            <p className="text-[11.5px] font-body text-muted-foreground rounded-xl bg-muted/40 px-3 py-2">
              Vincular ao cliente é o que faz esse custo aparecer na <strong>rentabilidade daquele cliente</strong>. Sem cliente, vira custo da operação.
            </p>

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

function Resumo({ label, value, tone, sub }: { label: string; value: string; tone: "green" | "red"; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body font-semibold">{label}</p>
      <p className={cn("text-base font-display font-extrabold mt-0.5", tone === "green" ? "text-green-700" : "text-destructive")}>{value}</p>
      <p className="text-[10px] font-body text-muted-foreground">{sub}</p>
    </div>
  );
}

function Grupo({ titulo, icone, tone, itens, clientName, onAdd, onEdit, onToggle, onDelete, vazio }: {
  titulo: string; icone: React.ReactNode; tone: "green" | "red";
  itens: FinRecurring[];
  clientName: (id: string | null | undefined) => string | null;
  onAdd: () => void; onEdit: (t: FinRecurring) => void;
  onToggle: (t: FinRecurring) => void; onDelete: (t: FinRecurring) => void;
  vazio: string;
}) {
  const cor = tone === "green" ? "text-green-700" : "text-destructive";
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className={cn("text-[11px] font-body font-bold uppercase tracking-wider flex items-center gap-1.5", cor)}>{icone} {titulo}</p>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar</Button>
      </div>

      {itens.length === 0 ? (
        <button onClick={onAdd} className="w-full rounded-xl border border-dashed border-border px-3 py-3 text-left hover:border-primary/40 transition-colors">
          <p className="text-[12px] font-body text-muted-foreground">{vazio}</p>
        </button>
      ) : (
        <div className="space-y-1.5">
          {itens.map((t) => {
            const cli = clientName(t.crm_client_id);
            return (
              <div key={t.id} className={cn("rounded-xl border border-border bg-card p-3 flex items-center gap-3", !t.active && "opacity-55")}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-display font-bold text-foreground truncate">{t.description}</p>
                    {!t.active && <span className="text-[9.5px] font-body font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Pausado</span>}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-body truncate">
                    todo dia <strong className="text-foreground">{t.due_day}</strong>
                    {t.category ? ` · ${t.category}${t.subcategory ? ` › ${t.subcategory}` : ""}` : ""}
                    {cli ? ` · ${cli}` : ""}
                  </p>
                </div>
                <span className={cn("text-sm font-display font-extrabold shrink-0", cor)}>{brl(Number(t.amount))}</span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title={t.active ? "Pausar" : "Reativar"} onClick={() => onToggle(t)}>
                    {t.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(t)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
