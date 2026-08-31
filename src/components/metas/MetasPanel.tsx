import { useState } from "react";
import { Plus, Target, Check, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMetas, CATEGORIAS_META, type MetaScope, type Meta } from "@/hooks/useMetas";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   PAINEL DE METAS · um componente, dois lugares:
   · scope "operacao": aba Metas do Cria Gestão (a operação da social mídia).
   · scope "cliente" + externalClientId: card na estratégia do cliente.
   Cada meta mostra criada em / concluída em (pedido do Walter, 31/08).
   ═══════════════════════════════════════════════════════════════════════════ */

const dataBR = (iso: string | null) => {
  if (!iso) return null;
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return null; }
};

const fmtNum = (n: number | null) => {
  if (n == null) return "0";
  return n.toLocaleString("pt-BR");
};

function BarraProgresso({ atual, alvo }: { atual: number | null; alvo: number | null }) {
  if (!alvo || alvo <= 0) return null;
  const pct = Math.min(100, Math.round(((atual ?? 0) / alvo) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-body font-bold text-muted-foreground tabular-nums shrink-0">{pct}%</span>
    </div>
  );
}

export function MetasPanel({ scope, externalClientId, compacto }: { scope: MetaScope; externalClientId?: string | null; compacto?: boolean }) {
  const { metas, carregando, criar, atualizar, concluir, reabrir, excluir } = useMetas(scope, externalClientId);
  const [novaOpen, setNovaOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("geral");
  const [alvo, setAlvo] = useState("");
  const [atual, setAtual] = useState("");
  const [prazo, setPrazo] = useState("");
  const [obs, setObs] = useState("");

  const ativas = metas.filter((m) => m.status !== "concluida");
  const concluidas = metas.filter((m) => m.status === "concluida");

  const handleCriar = async () => {
    if (!titulo.trim()) return;
    await criar.mutateAsync({
      title: titulo,
      category: categoria,
      target_value: alvo.trim() ? Number(alvo.replace(/\./g, "").replace(",", ".")) : null,
      current_value: atual.trim() ? Number(atual.replace(/\./g, "").replace(",", ".")) : 0,
      end_date: prazo || null,
      observation: obs.trim() || null,
    });
    setTitulo(""); setAlvo(""); setAtual(""); setPrazo(""); setObs(""); setCategoria("geral");
    setNovaOpen(false);
  };

  const CartaoMeta = ({ m }: { m: Meta }) => {
    const feita = m.status === "concluida";
    const catLabel = CATEGORIAS_META.find((c) => c.key === m.category)?.label ?? m.category;
    return (
      <div className={cn("rounded-2xl border border-border bg-card p-4 space-y-2.5", feita && "opacity-75")}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className={cn("font-body font-semibold text-sm text-foreground leading-snug", feita && "line-through decoration-emerald-500/60")}>{m.title}</p>
            <div className="flex items-center gap-2 flex-wrap mt-1 text-[11px] font-body text-muted-foreground">
              <span className="px-1.5 py-0.5 rounded bg-muted font-semibold">{catLabel}</span>
              {m.created_at && <span>criada em {dataBR(m.created_at)}</span>}
              {feita && m.concluida_em && <span className="text-emerald-600 font-semibold">✓ concluída em {dataBR(m.concluida_em)}</span>}
              {!feita && m.end_date && <span>prazo {dataBR(m.end_date)}</span>}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            {feita ? (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Reabrir" onClick={() => reabrir.mutate(m.id)}><RotateCcw className="h-3.5 w-3.5" /></Button>
            ) : (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-600" title="Marcar como concluída" onClick={() => concluir.mutate(m.id)}><Check className="h-4 w-4" /></Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" title="Excluir" onClick={() => excluir.mutate(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        {m.target_value != null && m.target_value > 0 && (
          <>
            <BarraProgresso atual={m.current_value} alvo={m.target_value} />
            {!feita && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-body text-muted-foreground shrink-0">Onde estou:</span>
                {/* Atualiza no blur pra não gravar a cada tecla. */}
                <Input
                  defaultValue={fmtNum(m.current_value)}
                  onBlur={(e) => {
                    const v = Number(e.target.value.replace(/\./g, "").replace(",", "."));
                    if (!Number.isNaN(v) && v !== (m.current_value ?? 0)) atualizar.mutate({ id: m.id, patch: { current_value: v } });
                  }}
                  className="h-7 w-24 rounded-lg text-xs text-right" inputMode="numeric" />
                <span className="text-[11px] font-body text-muted-foreground">de {fmtNum(m.target_value)}</span>
              </div>
            )}
          </>
        )}
        {m.observation && <p className="text-xs font-body text-muted-foreground leading-snug">{m.observation}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {!compacto && (
          <p className="text-xs font-body text-muted-foreground">
            {scope === "operacao"
              ? "As metas do SEU negócio: clientes na carteira, receita, entregas. Com data de criação e de conclusão."
              : "Metas combinadas com este cliente. Aparecem só pra você e sua equipe."}
          </p>
        )}
        <Button size="sm" variant={compacto ? "outline" : "hero"} onClick={() => setNovaOpen(true)} className="gap-1.5 ml-auto shrink-0">
          <Plus className="h-3.5 w-3.5" /> Nova meta
        </Button>
      </div>

      {carregando ? (
        <div className="py-8 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : metas.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl py-8 px-4 text-center">
          <Target className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-body text-muted-foreground">
            {scope === "operacao" ? "Nenhuma meta ainda. Ex.: chegar a 10 clientes, faturar R$ 8 mil/mês." : "Nenhuma meta pra este cliente ainda. Ex.: +1.000 seguidores no trimestre."}
          </p>
        </div>
      ) : (
        <div className={cn("grid gap-2.5", compacto ? "" : "sm:grid-cols-2")}>
          {ativas.map((m) => <CartaoMeta key={m.id} m={m} />)}
          {concluidas.map((m) => <CartaoMeta key={m.id} m={m} />)}
        </div>
      )}

      <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Nova meta</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>O que você quer alcançar?</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={scope === "operacao" ? "Ex.: Chegar a 10 clientes ativos" : "Ex.: Dobrar o alcance médio"} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIAS_META.map((c) => (
                  <button key={c.key} type="button" onClick={() => setCategoria(c.key)}
                    className={cn("px-2.5 py-1 rounded-full text-xs font-body border transition-colors",
                      categoria === c.key ? "bg-primary text-primary-foreground border-primary font-semibold" : "border-border text-muted-foreground hover:text-foreground")}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Valor alvo</Label>
                <Input value={alvo} onChange={(e) => setAlvo(e.target.value)} placeholder="10" inputMode="numeric" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Onde estou</Label>
                <Input value={atual} onChange={(e) => setAtual(e.target.value)} placeholder="3" inputMode="numeric" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prazo</Label>
                <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observação (opcional)</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="rounded-xl resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setNovaOpen(false)}>Cancelar</Button>
              <Button size="sm" variant="hero" onClick={() => void handleCriar()} disabled={!titulo.trim() || criar.isPending}>
                {criar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Criar meta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
