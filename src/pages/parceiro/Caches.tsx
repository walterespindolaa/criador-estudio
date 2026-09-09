import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Loader2, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { useManagerOutlet } from "@/components/accounts/ManagerLayout";
import { useModules } from "@/hooks/useModules";
import { hojeBR } from "@/lib/date-br";
import { cn } from "@/lib/utils";
import { CardAbertoDialog } from "@/pages/app/MinhasDemandas";
import { useAcoesLancamento, useMeusCaches, useMeusCachesDetalhe, useMeusLancamentos, type LancamentoDoParceiro } from "@/hooks/useParceiro";

/* ═══════════════════════════════════════════════════════════════════════════
   MEUS CACHÊS

   Era um card espremido no topo de "Marcas que atendo", com dois totais e uma
   linha por agência. Dinheiro dividindo tela com identidade de marca é confusão
   (Walter, 09/09/2026): viraram duas páginas.

   E o total sozinho não responde a pergunta que ele faz na hora de cobrar, que
   é "de QUAIS entregas vem esse valor". Agora a página abre no que ele tem a
   receber, quebra por agência, e lista peça a peça, com o card abrindo dali.
   ═══════════════════════════════════════════════════════════════════════════ */

const brl = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ehPago = (s: string) => /pago|recebid|quitad/i.test(s);

export default function Caches() {
  const { data: porAgencia = [] } = useMeusCaches();
  const { data: linhas = [], isLoading } = useMeusCachesDetalhe();
  const { data: meus = [] } = useMeusLancamentos();
  const { salvar, excluir } = useAcoesLancamento();
  const { openModule } = useManagerOutlet();
  const { modules } = useModules();
  const [abrirCard, setAbrirCard] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"aberto" | "pago" | "tudo">("aberto");
  const [editando, setEditando] = useState<Partial<LancamentoDoParceiro> | null>(null);

  /* Os totais somam as DUAS origens: o que veio das agências pelo Cria e o que
     ele lançou na mão. Separar em dois números seria devolver pra ele a conta
     que a página existe pra fazer (Walter, 09/09/2026). */
  const meuAberto = meus.reduce((s, l) => s + Math.max(0, Number(l.valor ?? 0) - Number(l.valor_pago ?? 0)), 0);
  const meuPago = meus.reduce((s, l) => s + Number(l.valor_pago ?? 0), 0);
  const totalPendente = porAgencia.reduce((s, c) => s + Number(c.pendente ?? 0), 0) + meuAberto;
  const totalPago = porAgencia.reduce((s, c) => s + Number(c.pago ?? 0), 0) + meuPago;

  const meusVisiveis = useMemo(() => meus.filter((l) => {
    if (filtro === "tudo") return true;
    const quitado = Number(l.valor_pago ?? 0) >= Number(l.valor ?? 0);
    return filtro === "pago" ? quitado : !quitado;
  }), [meus, filtro]);

  const criaCaixa = modules.find((m) => m.code === "criacaixa" || /caixa/i.test(m.name));

  const visiveis = useMemo(() => linhas.filter((l) => {
    if (filtro === "tudo") return true;
    return filtro === "pago" ? ehPago(l.status) : !ehPago(l.status);
  }), [linhas, filtro]);

  // Agrupa por agência: é assim que a cobrança acontece, uma conversa por agência.
  const grupos = useMemo(() => {
    const m = new Map<string, { nome: string; itens: typeof visiveis; soma: number }>();
    for (const l of visiveis) {
      const g = m.get(l.agencia_id) ?? { nome: l.agencia_nome, itens: [], soma: 0 };
      g.itens.push(l);
      if (!ehPago(l.status)) g.soma += Number(l.valor ?? 0);
      m.set(l.agencia_id, g);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].soma - a[1].soma);
  }, [visiveis]);

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* O QUE EU TENHO A RECEBER: o número que abre a página. */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="rounded-2xl border-amber-200 bg-amber-50/60 p-5">
          <p className="text-[11px] font-body font-bold uppercase tracking-wider text-amber-900/70 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> A receber
          </p>
          <p className="font-display font-extrabold text-3xl text-amber-900 mt-1 leading-none">{brl(totalPendente)}</p>
          <p className="text-[11.5px] font-body text-amber-900/70 mt-1.5">
            Entra no Caixa da agência quando você entrega. Quem marca como pago é ela.
          </p>
        </Card>
        <Card className="rounded-2xl border-green-200 bg-green-50/60 p-5">
          <p className="text-[11px] font-body font-bold uppercase tracking-wider text-green-800/70 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Já recebido
          </p>
          <p className="font-display font-extrabold text-3xl text-green-800 mt-1 leading-none">{brl(totalPago)}</p>
          <p className="text-[11.5px] font-body text-green-800/70 mt-1.5">
            Somando tudo que as agências já quitaram com você.
          </p>
        </Card>
      </div>

      {/* AS ENTREGAS, uma a uma. É o que ele manda quando cobra. */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h2 className="font-display font-bold text-[15px] text-foreground flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" /> De onde vem esse valor
          </h2>
          <div className="flex items-center gap-2">
          <Button size="sm" className="rounded-xl"
            onClick={() => setEditando({ cliente: "", valor: 0, valor_pago: 0, data: hojeBR() })}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar cachê
          </Button>
          <div className="flex gap-1 rounded-xl bg-muted p-0.5">
            {([["aberto", "Em aberto"], ["pago", "Pagos"], ["tudo", "Tudo"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setFiltro(k)}
                className={cn("px-3 py-1 rounded-lg text-[12px] font-body font-semibold transition-colors",
                  filtro === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                {l}
              </button>
            ))}
          </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-14"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : visiveis.length === 0 ? (
          <Card className="p-10 rounded-2xl border-dashed text-center">
            <p className="text-sm font-body text-muted-foreground max-w-md mx-auto">
              {filtro === "pago"
                ? "Nenhum cachê pago ainda."
                : "Nenhum cachê em aberto pelas agências do Cria. Trabalho fechado por fora ou por pacote você anota em \"Adicionar cachê\"."}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {grupos.map(([agenciaId, g]) => (
              <Card key={agenciaId} className="rounded-2xl border-border overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/30">
                  <p className="font-display font-bold text-[14px] text-foreground truncate">{g.nome}</p>
                  {g.soma > 0 && (
                    <span className="text-[12.5px] font-display font-extrabold text-amber-800 shrink-0">{brl(g.soma)} a receber</span>
                  )}
                </div>
                <ul className="divide-y divide-border/70">
                  {g.itens.map((l) => {
                    const pago = ehPago(l.status);
                    return (
                      <li key={l.id}>
                        <button type="button" disabled={!l.post_id}
                          onClick={() => l.post_id && setAbrirCard(l.post_id)}
                          className={cn("w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                            l.post_id ? "hover:bg-muted/40" : "cursor-default")}>
                          <span className="w-8 h-8 rounded-lg grid place-items-center text-white text-[11px] font-display font-bold shrink-0 overflow-hidden"
                            style={{ background: l.cliente_cor || "#7C90F0" }}>
                            {l.cliente_logo
                              ? <img src={l.cliente_logo} alt="" className="w-full h-full object-cover" loading="lazy" />
                              : (l.cliente_nome || "C").charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-body font-semibold text-foreground truncate">
                              {l.post_titulo || l.descricao || "Entrega"}
                            </span>
                            <span className="block text-[11px] font-body text-muted-foreground truncate">
                              {l.cliente_nome ?? "Sem cliente"} · {dataBR(l.data)}
                            </span>
                          </span>
                          <span className="text-right shrink-0">
                            <span className={cn("block text-[13px] font-display font-extrabold", pago ? "text-green-700" : "text-amber-800")}>
                              {brl(Number(l.valor))}
                            </span>
                            <span className={cn("block text-[10px] font-body font-bold", pago ? "text-green-700" : "text-amber-700")}>
                              {pago ? "pago" : "em aberto"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* O QUE ELE LANÇOU NA MÃO: pacote fechado, agência de fora do Cria,
          valor combinado no WhatsApp. Sem isso a página respondia metade da
          vida financeira dele e ele voltava pra planilha. */}
      {meusVisiveis.length > 0 && (
        <section>
          <h2 className="font-display font-bold text-[15px] text-foreground mb-2 px-0.5">Lançados por você</h2>
          <Card className="rounded-2xl border-border overflow-hidden">
            <ul className="divide-y divide-border/70">
              {meusVisiveis.map((l) => {
                const falta = Math.max(0, Number(l.valor ?? 0) - Number(l.valor_pago ?? 0));
                const quitado = falta <= 0;
                return (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-body font-semibold text-foreground truncate">{l.cliente}</span>
                      <span className="block text-[11px] font-body text-muted-foreground truncate">
                        {l.descricao ? `${l.descricao} · ` : ""}{dataBR(l.data)}
                        {l.forma_pagamento ? ` · ${l.forma_pagamento}` : ""}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className={cn("block text-[13px] font-display font-extrabold", quitado ? "text-green-700" : "text-amber-800")}>
                        {quitado ? brl(Number(l.valor)) : brl(falta)}
                      </span>
                      <span className={cn("block text-[10px] font-body font-bold", quitado ? "text-green-700" : "text-amber-700")}>
                        {quitado ? "quitado" : Number(l.valor_pago) > 0 ? `falta, de ${brl(Number(l.valor))}` : "em aberto"}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <button type="button" aria-label="Editar" onClick={() => setEditando(l)}
                        className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" aria-label="Excluir" onClick={() => excluir.mutate(l.id)}
                        className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}

      <p className="text-[11.5px] font-body text-muted-foreground px-0.5">
        O valor de cada peça delegada é combinado pela agência quando ela te manda o trabalho. Divergiu, é com ela.
        O que você lançou na mão é só seu, nenhuma agência vê.
      </p>

      {/* O CONVITE PRO CRIA CAIXA. Esta página é caderninho: soma o que entra e
          o que falta. Quem precisa de fluxo de caixa, imposto, contas fixas e
          recorrência tem o módulo, e é aqui que a dor aparece. */}
      {criaCaixa && criaCaixa.status !== "active" && criaCaixa.status !== "past_due" && (
        <button type="button" onClick={() => openModule(criaCaixa)}
          className="w-full text-left rounded-2xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all">
          <p className="text-[10.5px] font-body font-bold uppercase tracking-wider text-primary">Cria Caixa</p>
          <p className="font-display font-bold text-[16px] text-foreground mt-1">
            Isto aqui é o seu caderninho. O Caixa é o financeiro do seu negócio.
          </p>
          <p className="text-[12.5px] font-body text-muted-foreground leading-relaxed mt-1.5 max-w-2xl">
            Contas a receber com aviso de atraso, despesas fixas, recorrência, quanto sobra de verdade no mês
            e quanto cada cliente te dá de lucro. É a diferença entre saber que tem dinheiro entrando
            e saber se o mês fechou no azul.
          </p>
          <span className="inline-flex items-center gap-1.5 mt-3 text-[12.5px] font-display font-bold text-primary">
            Conhecer o Cria Caixa
          </span>
        </button>
      )}

      <CardAbertoDialog postId={abrirCard} aoFechar={() => setAbrirCard(null)} />

      {/* Lançar na mão: cliente, valor, quanto já entrou e como. Sem categoria,
          sem centro de custo, sem plano de contas. É anotação, não contabilidade. */}
      <Dialog open={!!editando} onOpenChange={(v) => !v && setEditando(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">{editando?.id ? "Editar cachê" : "Adicionar cachê"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente ou agência</Label>
              <Input value={editando?.cliente ?? ""} placeholder="Ex.: Zephyr Investimentos, ou o nome da agência"
                onChange={(e) => setEditando((p) => ({ ...(p ?? {}), cliente: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">O que foi <span className="font-normal text-muted-foreground">opcional</span></Label>
              <Input value={editando?.descricao ?? ""} placeholder="Ex.: pacote de 8 artes de setembro"
                onChange={(e) => setEditando((p) => ({ ...(p ?? {}), descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Valor combinado</Label>
                <MoneyInput value={Number(editando?.valor ?? 0)} onChange={(v) => setEditando((p) => ({ ...(p ?? {}), valor: v }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Já recebi</Label>
                <MoneyInput value={Number(editando?.valor_pago ?? 0)} onChange={(v) => setEditando((p) => ({ ...(p ?? {}), valor_pago: v }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Como foi pago</Label>
                <Input value={editando?.forma_pagamento ?? ""} placeholder="Pix, transferência, boleto..."
                  onChange={(e) => setEditando((p) => ({ ...(p ?? {}), forma_pagamento: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data</Label>
                <Input type="date" value={editando?.data ?? hojeBR()}
                  onChange={(e) => setEditando((p) => ({ ...(p ?? {}), data: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button disabled={!editando?.cliente?.trim() || salvar.isPending}
              onClick={() => {
                if (!editando?.cliente?.trim()) return;
                salvar.mutate({ ...editando, cliente: editando.cliente, data: editando.data ?? hojeBR() },
                  { onSuccess: () => setEditando(null) });
              }}>
              {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
