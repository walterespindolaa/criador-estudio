// Cria Caixa > Empresa > Terceiros.
// Mockup aprovado: CRIA/mockup-caixa-terceiros.html (29/09/2026).
//
// O que resolve: a agência conferia na mão, todo dia 15, o que cada designer /
// editor / filmmaker produziu e quanto deve. Aqui fica a ficha do combinado de
// cada um, o fechamento do período (ou datas escolhidas) e o pagamento em lote.
// Cada valor é uma despesa do Caixa ligada ao cliente, então já entra na margem
// dele em "Clientes".
import { useMemo, useState } from "react";
import { Plus, Copy, Wallet, Pencil, Archive, FileText } from "lucide-react";
import { RelatorioTerceirosDialog } from "@/components/accounts/RelatorioTerceirosDialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { confirmar } from "@/components/shared/Confirm";
import { cn } from "@/lib/utils";
import { mascarar } from "@/hooks/useValoresOcultos";
import { hojeBR } from "@/lib/date-br";
import { useActiveAccount } from "@/contexts/AccountContext";
import { useCrmClients } from "@/hooks/useCrm";
import {
  ROTULO_FECHAMENTO, dentro, periodoDoFechamento, rotuloPeriodo,
  type Fechamento, type Periodo,
} from "@/lib/fechamento";
import {
  ROTULO_PAPEL_TERCEIRO, chaveTerceiro, useArquivarTerceiro, useLancarAvulso, useLinhasTerceiros,
  usePagarFechamento, useSalvarFicha, useTerceiros, type LinhaTerceiro, type Terceiro,
} from "@/hooks/useTerceiros";

// Mesma regra do Caixa: dinheiro sempre passa pelo olhinho.
const brl = (v: number) => mascarar(`R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const aPagar = (l: LinhaTerceiro) => l.status !== "pago";
const FECHAMENTOS = Object.keys(ROTULO_FECHAMENTO) as Fechamento[];
const PAPEIS_MANUAIS = ["filmmaker", "fotografo", "designer", "editor_video", "copy", "trafego", "outro"];

/** Linhas que pertencem a este terceiro. */
function doTerceiro(t: Terceiro, linhas: LinhaTerceiro[]) {
  return t.member_id
    ? linhas.filter((l) => l.assignee_id === t.member_id)
    : linhas.filter((l) => l.terceiro_id === t.terceiro_id);
}

/** "Cachê Agatha: Carrossel X" / "Agatha: Diária" -> "Carrossel X" / "Diária" */
function nomeDaPeca(l: LinhaTerceiro, nome: string) {
  const d = l.description ?? "";
  for (const p of [`Cachê ${nome}: `, `${nome}: `]) if (d.startsWith(p)) return d.slice(p.length);
  return d;
}

type Modo = "atual" | "anterior" | "datas";

export function CaixaTerceiros() {
  const { actingAsTeam } = useActiveAccount();
  const ehDono = !actingAsTeam;
  const hoje = hojeBR();
  const { data: terceiros = [], isLoading } = useTerceiros();
  const { data: linhas = [] } = useLinhasTerceiros();
  const { data: clientes = [] } = useCrmClients();
  const nomeCliente = useMemo(() => new Map(clientes.map((c) => [c.id, c.name])), [clientes]);

  const [sel, setSel] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const atual = terceiros.find((t) => chaveTerceiro(t) === sel) ?? terceiros[0] ?? null;

  // ── KPIs ──
  const totalAPagar = linhas.filter(aPagar).reduce((s, l) => s + l.amount, 0);
  const mesHoje = hoje.slice(0, 7);
  const pagoNoMes = linhas.filter((l) => l.status === "pago" && (l.pago_em ?? l.date).slice(0, 7) === mesHoje).reduce((s, l) => s + l.amount, 0);
  const proximo = useMemo(() => {
    let melhor: { nome: string; ate: string } | null = null;
    for (const t of terceiros) {
      if (t.fechamento === "servico") continue;
      if (!doTerceiro(t, linhas).some(aPagar)) continue;
      const { ate } = periodoDoFechamento(t.fechamento, hoje);
      if (!melhor || ate < melhor.ate) melhor = { nome: t.nome, ate };
    }
    return melhor;
  }, [terceiros, linhas, hoje]);

  if (isLoading) return <div className="h-40 rounded-2xl bg-muted/40 animate-pulse" />;

  return (
    <div className="space-y-4">
      {actingAsTeam && (
        <p className="text-[12.5px] font-body text-amber-900/80 rounded-2xl bg-amber-500/[0.08] border border-amber-500/25 px-4 py-2.5">
          Você vê e lança os valores dos terceiros. <strong>Marcar como pago</strong> fica só com o dono da conta.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-card p-4">
          <p className="text-xl md:text-2xl font-display font-extrabold text-amber-800 leading-none">{brl(totalAPagar)}</p>
          <p className="text-[11px] font-body font-semibold text-muted-foreground mt-1.5">a pagar pra terceiros</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xl md:text-2xl font-display font-extrabold leading-none">{proximo ? dm(proximo.ate) : "sem"}</p>
          <p className="text-[11px] font-body font-semibold text-muted-foreground mt-1.5">
            {proximo ? `próximo fechamento (${proximo.nome})` : "nenhum fechamento pendente"}
          </p>
        </div>
        <div className="col-span-2 md:col-span-1 rounded-2xl border border-border bg-card p-4">
          <p className="text-xl md:text-2xl font-display font-extrabold text-green-700 leading-none">{brl(pagoNoMes)}</p>
          <p className="text-[11px] font-body font-semibold text-muted-foreground mt-1.5">pago este mês</p>
        </div>
      </div>

      <div className="grid md:grid-cols-[320px_1fr] gap-4 items-start">
        {/* LISTA */}
        <aside>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-display font-extrabold text-[15px]">Terceiros</h3>
            {/* Gabriela, 02/10/2026: produtividade, entregas e valores por período, em PDF. */}
            <Button size="sm" variant="outline" className="ml-auto h-8" onClick={() => setRelatorioAberto(true)} disabled={terceiros.length === 0}>
              <FileText className="h-3.5 w-3.5 mr-1" /> Relatório
            </Button>
            <Button size="sm" className="h-8" onClick={() => setNovoAberto(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo
            </Button>
          </div>
          {terceiros.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <p className="text-sm font-body font-medium">Nenhum terceiro ainda</p>
              <p className="text-xs text-muted-foreground font-body mt-1">
                Parceiros do Cria aparecem aqui sozinhos. Quem não tem conta você cadastra no "Novo".
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
              {terceiros.map((t) => {
                const k = chaveTerceiro(t);
                const pend = doTerceiro(t, linhas).filter(aPagar).reduce((s, l) => s + l.amount, 0);
                const on = atual && chaveTerceiro(atual) === k;
                return (
                  <button key={k} type="button" onClick={() => setSel(k)}
                    className={cn("w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors border-l-[3px]",
                      on ? "bg-primary/5 border-l-primary" : "border-l-transparent hover:bg-muted/40")}>
                    <Avatar t={t} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display font-bold text-[14px] leading-tight truncate">{t.nome}</span>
                      <span className="block text-[11px] font-body text-muted-foreground truncate">
                        {ROTULO_PAPEL_TERCEIRO[t.papel] ?? t.papel} · {t.no_cria ? "no Cria" : "avulso"}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className={cn("block font-display font-extrabold text-[13.5px]", pend > 0 ? "text-amber-800" : "text-green-700")}>
                        {pend > 0 ? brl(pend) : "em dia"}
                      </span>
                      <span className="block text-[10px] font-body text-muted-foreground">{ROTULO_FECHAMENTO[t.fechamento]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-[11px] font-body text-muted-foreground mt-2 px-0.5">
            Quem tem conta no Cria entra aqui sozinho quando vira parceiro. Quem não tem (filmmaker de diária, fotógrafo) você cadastra à mão.
          </p>
        </aside>

        {/* FICHA */}
        {atual ? (
          <Ficha key={chaveTerceiro(atual)} t={atual} linhas={doTerceiro(atual, linhas)} nomeCliente={nomeCliente}
            clientes={clientes.map((c) => ({ id: c.id, name: c.name }))} ehDono={ehDono} hoje={hoje} />
        ) : (
          <div className="hidden md:block rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground font-body">
            Escolha um terceiro na lista.
          </div>
        )}
      </div>

      {relatorioAberto && (
        <RelatorioTerceirosDialog open onOpenChange={setRelatorioAberto} terceiros={terceiros} linhas={linhas} nomeCliente={nomeCliente} />
      )}
      <NovoTerceiro aberto={novoAberto} aoFechar={() => setNovoAberto(false)} aoCriar={(id) => setSel(`t:${id}`)} />
    </div>
  );
}

function Avatar({ t, grande }: { t: Terceiro; grande?: boolean }) {
  return (
    <span className={cn("rounded-full text-white grid place-items-center font-bold shrink-0",
      grande ? "w-11 h-11 text-base" : "w-8 h-8 text-xs",
      t.no_cria ? "bg-gradient-to-br from-violet-400 to-violet-700" : "bg-gradient-to-br from-gray-400 to-gray-600")}>
      {(t.nome || "?").charAt(0).toUpperCase()}
    </span>
  );
}

function Ficha({ t, linhas, nomeCliente, clientes, ehDono, hoje }: {
  t: Terceiro; linhas: LinhaTerceiro[]; nomeCliente: Map<string, string>;
  clientes: { id: string; name: string }[]; ehDono: boolean; hoje: string;
}) {
  const salvar = useSalvarFicha();
  const arquivar = useArquivarTerceiro();
  const pagar = usePagarFechamento();

  // edição da ficha
  const [editando, setEditando] = useState(false);
  const [nota, setNota] = useState(t.nota);
  const [fechamento, setFechamento] = useState<Fechamento>(t.fechamento);
  const [pagamento, setPagamento] = useState(t.pagamento);

  // período
  const [modo, setModo] = useState<Modo>("atual");
  const padrao = periodoDoFechamento(t.fechamento, hoje);
  const [de, setDe] = useState(padrao.de);
  const [ate, setAte] = useState(padrao.ate);
  const periodo: Periodo =
    modo === "atual" ? padrao
      : modo === "anterior" ? periodoDoFechamento(t.fechamento, hoje, -1)
        : { de: de <= ate ? de : ate, ate: de <= ate ? ate : de };

  const doPeriodo = linhas.filter((l) => dentro(l.date, periodo)).sort((a, b) => a.date.localeCompare(b.date));
  const pendentes = doPeriodo.filter(aPagar);
  const totPend = pendentes.reduce((s, l) => s + l.amount, 0);
  const tot = doPeriodo.reduce((s, l) => s + l.amount, 0);

  const [avulsoAberto, setAvulsoAberto] = useState(false);
  const [pagarAberto, setPagarAberto] = useState(false);
  const [dataPgto, setDataPgto] = useState(hoje);

  const salvarFicha = async () => {
    await salvar.mutateAsync({ terceiro_id: t.terceiro_id, member_id: t.member_id, nota, fechamento, pagamento });
    setEditando(false);
    toast.success("Combinado salvo");
  };

  const copiarLista = async () => {
    const linhasTxt = doPeriodo.map((l) =>
      `${dm(l.date)} · ${l.crm_client_id ? nomeCliente.get(l.crm_client_id) ?? "Cliente" : "Agência"} · ${nomeDaPeca(l, t.nome)} · R$ ${l.amount.toFixed(2).replace(".", ",")}${l.status === "pago" ? " (pago)" : ""}`);
    const txt = [
      `${t.nome}, fechamento ${rotuloPeriodo(periodo)}`,
      "",
      ...linhasTxt,
      "",
      `Total: R$ ${tot.toFixed(2).replace(".", ",")}`,
      totPend !== tot ? `A pagar: R$ ${totPend.toFixed(2).replace(".", ",")}` : "",
    ].filter((x, i, a) => x !== "" || (i > 0 && a[i - 1] !== "")).join("\n").trim();
    try {
      await navigator.clipboard.writeText(txt);
      toast.success("Lista copiada. É só colar no WhatsApp.");
    } catch {
      toast.error("Não consegui copiar. Seu navegador bloqueou a área de transferência.");
    }
  };

  const confirmarPagamento = async () => {
    await pagar.mutateAsync({ ids: pendentes.map((l) => l.id), pago_em: dataPgto });
    setPagarAberto(false);
    toast.success(t.no_cria ? `Pago. ${t.nome} já vê em Meus cachês.` : "Pago.");
  };

  const aoArquivar = async () => {
    if (!t.terceiro_id) return;
    const ok = await confirmar({
      titulo: `Arquivar ${t.nome}?`,
      descricao: "Some da lista. Os valores já lançados continuam no Caixa.",
      acao: "Arquivar",
    });
    if (ok) await arquivar.mutateAsync(t.terceiro_id);
  };

  return (
    <main className="rounded-3xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Avatar t={t} grande />
        <div className="min-w-0">
          <h3 className="font-display font-extrabold text-xl leading-tight">{t.nome}</h3>
          <p className="text-xs font-body text-muted-foreground">
            {ROTULO_PAPEL_TERCEIRO[t.papel] ?? t.papel} · {t.no_cria ? "parceiro no Cria, vê os cachês na área dele" : "sem conta no Cria"}
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto md:ml-auto">
          <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={() => setAvulsoAberto(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Lançar avulso
          </Button>
          {ehDono && !t.no_cria && t.terceiro_id && (
            <Button variant="ghost" size="sm" onClick={aoArquivar} title="Arquivar"><Archive className="h-4 w-4" /></Button>
          )}
        </div>
      </div>

      {/* COMBINADO */}
      <section className="mt-5">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="font-display font-bold text-[13px]">O combinado</h4>
          <span className="text-[11px] font-body text-muted-foreground">só a agência vê</span>
          {!editando && (
            <button type="button" onClick={() => setEditando(true)} className="ml-auto text-[12px] font-body font-bold text-primary flex items-center gap-1">
              <Pencil className="h-3 w-3" /> Editar
            </button>
          )}
        </div>
        {editando ? (
          <div className="space-y-3 rounded-2xl border-[1.5px] border-dashed border-amber-300 bg-amber-50/40 p-3">
            <Textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={5}
              placeholder={"Ex.: Arte de feed R$ 40, carrossel R$ 90, story R$ 25.\nAjuste simples não cobra."} className="bg-card" />
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Fechamento</Label>
                <select value={fechamento} onChange={(e) => setFechamento(e.target.value as Fechamento)}
                  className="mt-1 w-full h-10 rounded-md border border-input bg-card px-3 text-sm">
                  {FECHAMENTOS.map((f) => <option key={f} value={f}>{ROTULO_FECHAMENTO[f]}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Forma de pagamento</Label>
                <Input value={pagamento} onChange={(e) => setPagamento(e.target.value)} placeholder="Ex.: Pix no celular" className="mt-1 bg-card" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setEditando(false); setNota(t.nota); setFechamento(t.fechamento); setPagamento(t.pagamento); }}>Cancelar</Button>
              <Button size="sm" onClick={salvarFicha} disabled={salvar.isPending}>{salvar.isPending ? "Salvando..." : "Salvar"}</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border-[1.5px] border-dashed border-amber-300/80 bg-amber-50/40 px-4 py-3 text-[13px] font-body leading-relaxed whitespace-pre-line min-h-[56px]">
              {t.nota || <span className="text-muted-foreground">Nada anotado ainda. Clique em Editar e escreva os valores e o que foi combinado.</span>}
            </div>
            <div className="flex gap-2 flex-wrap mt-2">
              <span className="text-[11.5px] font-body bg-muted/60 rounded-lg px-2.5 py-1">Fechamento: <strong>{ROTULO_FECHAMENTO[t.fechamento]}</strong></span>
              {t.pagamento && <span className="text-[11.5px] font-body bg-muted/60 rounded-lg px-2.5 py-1">{t.pagamento}</span>}
            </div>
          </>
        )}
      </section>

      {/* FECHAMENTO */}
      <section className="mt-6">
        <h4 className="font-display font-bold text-[13px] mb-2">Fechamento</h4>
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <div className="inline-flex rounded-xl bg-muted p-0.5">
            {(["atual", "anterior", "datas"] as Modo[]).map((m) => (
              <button key={m} type="button" onClick={() => setModo(m)}
                className={cn("text-xs font-body font-bold px-3 py-1.5 rounded-lg transition-colors",
                  modo === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                {m === "atual" ? "Atual" : m === "anterior" ? "Anterior" : "Escolher datas"}
              </button>
            ))}
          </div>
          {modo === "datas" ? (
            <div className="flex items-center gap-2 flex-wrap text-xs font-body text-muted-foreground">
              <label className="flex items-center gap-1.5">de <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-8 w-[150px]" /></label>
              <label className="flex items-center gap-1.5">até <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-8 w-[150px]" /></label>
            </div>
          ) : (
            <span className="text-xs font-body text-muted-foreground">{rotuloPeriodo(periodo)}</span>
          )}
        </div>
        <p className="text-[11px] font-body text-muted-foreground mb-2">
          Conta pela <strong>data da entrega</strong> da peça (ou a data do serviço, no avulso).
          {modo !== "datas" && " Atual e Anterior seguem o fechamento deste terceiro."}
        </p>

        {doPeriodo.length === 0 ? (
          <p className="text-sm font-body text-muted-foreground py-6 text-center">Nada nesse período.</p>
        ) : (
          <>
            <div className="divide-y divide-border/70 border-y border-border">
              {doPeriodo.map((l) => {
                const pago = l.status === "pago";
                return (
                  <div key={l.id} className={cn("grid grid-cols-[44px_1fr_auto_auto] md:grid-cols-[52px_160px_1fr_auto_auto] items-center gap-2 md:gap-3 py-2.5 text-[12.5px] font-body", pago && "text-muted-foreground")}>
                    <span>{dm(l.date)}</span>
                    <span className="truncate">{l.crm_client_id ? nomeCliente.get(l.crm_client_id) ?? "Cliente" : "Agência"}</span>
                    <span className="hidden md:block truncate">{nomeDaPeca(l, t.nome)}{!l.post_id && <span className="ml-1.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">avulso</span>}</span>
                    <span className={cn("text-[10px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap", pago ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800")}>
                      {pago ? "pago" : "a pagar"}
                    </span>
                    <span className={cn("text-right font-bold whitespace-nowrap", pago && "line-through")}>{brl(l.amount)}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-end gap-4 flex-wrap pt-3">
              <div>
                <p className="text-[11px] font-body text-muted-foreground">A pagar no período</p>
                <p className="font-display font-extrabold text-xl leading-tight">{brl(totPend)}</p>
              </div>
              <div>
                <p className="text-[11px] font-body text-muted-foreground">Total do período</p>
                <p className="font-display font-bold text-base leading-tight">{brl(tot)}</p>
              </div>
              <div className="flex gap-2 flex-wrap items-center w-full md:w-auto md:ml-auto">
                <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={copiarLista}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar lista pra conferir
                </Button>
                {ehDono ? (
                  <Button size="sm" className="flex-1 md:flex-none" disabled={pendentes.length === 0} onClick={() => { setDataPgto(hojeBR()); setPagarAberto(true); }}>
                    <Wallet className="h-3.5 w-3.5 mr-1" /> Pagar fechamento
                  </Button>
                ) : (
                  <span className="text-[11px] font-body text-muted-foreground">Só o dono marca como pago</span>
                )}
              </div>
            </div>
          </>
        )}
        <p className="text-[11px] font-body text-muted-foreground mt-3 leading-relaxed">
          Cada linha é uma despesa no Caixa ligada ao cliente, então já entra na margem dele em "Clientes".
          {t.no_cria ? " Os cachês nascem sozinhos quando a peça é entregue com valor." : ' Pra quem não tem conta, os valores entram pelo "Lançar avulso".'}
        </p>
      </section>

      <Avulso aberto={avulsoAberto} aoFechar={() => setAvulsoAberto(false)} t={t} clientes={clientes} hoje={hoje} />

      <Dialog open={pagarAberto} onOpenChange={setPagarAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar fechamento</DialogTitle>
            <DialogDescription>Tudo que está a pagar neste período vira pago.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-muted/60 px-4 py-3 text-sm font-body">
            <strong>{t.nome}</strong> · {rotuloPeriodo(periodo)}<br />
            {pendentes.length} {pendentes.length === 1 ? "item" : "itens"} · <strong>{brl(totPend)}</strong>
          </div>
          <div>
            <Label className="text-xs">Data do pagamento</Label>
            <Input type="date" value={dataPgto} onChange={(e) => setDataPgto(e.target.value)} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPagarAberto(false)}>Cancelar</Button>
            <Button onClick={confirmarPagamento} disabled={pagar.isPending || !dataPgto}>{pagar.isPending ? "Registrando..." : "Confirmar pagamento"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Avulso({ aberto, aoFechar, t, clientes, hoje }: {
  aberto: boolean; aoFechar: () => void; t: Terceiro; clientes: { id: string; name: string }[]; hoje: string;
}) {
  const lancar = useLancarAvulso();
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState<number | null>(null);
  const [data, setData] = useState(hoje);
  const [cliente, setCliente] = useState<string>("");

  const ok = desc.trim().length > 0 && !!valor && valor > 0 && !!data;
  const enviar = async () => {
    await lancar.mutateAsync({ terceiro: t, description: desc.trim(), amount: valor!, date: data, crm_client_id: cliente || null });
    toast.success("Lançado como a pagar");
    setDesc(""); setValor(null); setCliente(""); setData(hoje);
    aoFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar valor avulso · {t.nome}</DialogTitle>
          <DialogDescription>Diária, deslocamento, extra. Entra como custo do cliente no Caixa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Descrição</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: Diária de gravação" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Cliente</Label>
              <select value={cliente} onChange={(e) => setCliente(e.target.value)} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Sem cliente (custo da agência)</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Valor</Label>
              <MoneyInput value={valor} onChange={setValor} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Data do serviço</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button onClick={enviar} disabled={!ok || lancar.isPending}>{lancar.isPending ? "Lançando..." : "Lançar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovoTerceiro({ aberto, aoFechar, aoCriar }: { aberto: boolean; aoFechar: () => void; aoCriar: (id: string) => void }) {
  const salvar = useSalvarFicha();
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState("filmmaker");
  const [fechamento, setFechamento] = useState<Fechamento>("servico");
  const [nota, setNota] = useState("");
  const [pagamento, setPagamento] = useState("");

  const enviar = async () => {
    const id = await salvar.mutateAsync({ terceiro_id: null, member_id: null, nome: nome.trim(), papel, fechamento, nota, pagamento });
    toast.success("Terceiro cadastrado");
    setNome(""); setNota(""); setPagamento(""); setPapel("filmmaker"); setFechamento("servico");
    aoCriar(id);
    aoFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo terceiro</DialogTitle>
          <DialogDescription>Pra quem não tem conta no Cria. Parceiro que entra pela Equipe aparece aqui sozinho.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Bruno filmmaker" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">O que faz</Label>
              <select value={papel} onChange={(e) => setPapel(e.target.value)} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                {PAPEIS_MANUAIS.map((p) => <option key={p} value={p}>{ROTULO_PAPEL_TERCEIRO[p]}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Fechamento</Label>
              <select value={fechamento} onChange={(e) => setFechamento(e.target.value as Fechamento)} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                {FECHAMENTOS.map((f) => <option key={f} value={f}>{ROTULO_FECHAMENTO[f]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs">O combinado</Label>
            <Textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={4} placeholder="Valores, o que está incluso, prazo de pagamento..." className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Forma de pagamento</Label>
            <Input value={pagamento} onChange={(e) => setPagamento(e.target.value)} placeholder="Ex.: Pix no e-mail" className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button onClick={enviar} disabled={!nome.trim() || salvar.isPending}>{salvar.isPending ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
