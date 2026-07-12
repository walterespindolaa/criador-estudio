import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Trash2, Pencil, Building2, User, Check, Repeat, ArrowLeftRight, RotateCcw, SkipForward, ExternalLink, Receipt } from "lucide-react";
import { toast } from "sonner";
import {
  useFinRecords, useCreateFinRecord, useUpdateFinRecord, useDeleteFinRecord, useFinRecurring, useCreateFinRecurring, useGenerateRecurring, useDeleteFinByGroup,
  useFinMonthly, useEnsureMonthly, useConfirmMonthly, useUndoMonthly, useSkipMonthly,
  type FinRecord, type FinType, type FinStatus, type FinContext, type FinRecordInput, type FinMonthly, type FinRecurring,
} from "@/hooks/useFinance";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { PAYMENT_METHODS, taxOfMonth, taxOfClient, regimeLabel, isPctRegime } from "@/lib/finance";
import { useCrmClients } from "@/hooks/useCrm";
import { useManagerProfile } from "@/hooks/useModules";
import { ModuleGate } from "@/components/accounts/ModuleGate";
import { ManagerSectionTitle } from "@/components/accounts/ManagerSectionTitle";
import { FinCompanyDialog } from "@/components/accounts/FinCompanyDialog";
import { FinRecurringDialog } from "@/components/accounts/FinRecurringDialog";
import { FinTransferDialog } from "@/components/accounts/FinTransferDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const pad0 = (n: number) => String(n).padStart(2, "0");
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const STATUS_STYLE: Record<FinStatus, string> = {
  pago: "bg-green-100 text-green-700", pendente: "bg-amber-100 text-amber-700", atrasado: "bg-destructive/10 text-destructive",
};
const STATUS_LABEL: Record<FinStatus, string> = { pago: "Pago", pendente: "Pendente", atrasado: "Atrasado" };
const DEFAULT_CATS: Record<FinContext, Record<FinType, string[]>> = {
  pj: {
    entrada: ["Mensalidade", "Projeto avulso", "Tráfego reembolsado", "Outras receitas"],
    despesa: ["Ferramentas", "Tráfego pago", "Edição / Freelancer", "Equipamento", "Impostos", "Pró-labore", "Distribuição", "Outras despesas"],
  },
  pf: {
    entrada: ["Pró-labore", "Distribuição de lucros", "Renda extra", "Outras receitas"],
    despesa: ["Moradia", "Alimentação", "Transporte", "Lazer", "Saúde", "Educação", "Outras despesas"],
  },
};
const DEFAULT_SUBCATS: Record<FinContext, Record<FinType, Record<string, string[]>>> = {
  pj: {
    entrada: { "Projeto avulso": ["Identidade visual", "Campanha", "Ensaio"] },
    despesa: {
      "Ferramentas": ["Canva", "CapCut", "Agendador", "Hospedagem / Bunny", "IA"],
      "Tráfego pago": ["Meta Ads", "Google Ads", "TikTok Ads"],
      "Edição / Freelancer": ["Editor", "Designer", "Redator"],
      "Equipamento": ["Câmera", "Iluminação", "Áudio"],
    },
  },
  pf: {
    entrada: {},
    despesa: {
      "Moradia": ["Aluguel", "Contas", "Internet"],
      "Transporte": ["Combustível", "App / transporte", "Manutenção"],
      "Saúde": ["Plano", "Academia", "Terapia"],
    },
  },
};

export default function CriaCaixa() {
  return <ModuleGate code="financeiro"><CaixaInner /></ModuleGate>;
}

function CaixaInner() {
  const { data: records = [], isLoading } = useFinRecords();
  const { data: clients = [] } = useCrmClients();
  const { profile, save } = useManagerProfile();
  const del = useDeleteFinRecord();
  const upd = useUpdateFinRecord();   // status editável direto na lista
  const { data: recurring = [] } = useFinRecurring();
  const generate = useGenerateRecurring();
  const delGroup = useDeleteFinByGroup();

  const fin = profile?.fin_settings ?? {};
  const now = new Date();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const caixaSeg = pathname.split("/").filter(Boolean).pop() || "";
  const ctx: FinContext = caixaSeg === "pessoafisica" ? "pf" : "pj";
  useEffect(() => { if (caixaSeg === "criacaixa") navigate("/socialmidia/criacaixa/empresa", { replace: true }); }, [caixaSeg, navigate]);
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [typeF, setTypeF] = useState<FinType | "todos">("todos");
  const [statusF, setStatusF] = useState<FinStatus | "todos">("todos");
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<FinRecord | null>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? null;
  const inMonth = (d: string) => { const dt = new Date(d + "T00:00:00"); return dt.getFullYear() === ym.y && dt.getMonth() === ym.m; };

  const monthCtx = useMemo(() => records.filter((r) => inMonth(r.date) && (r.context ?? "pj") === ctx), [records, ym, ctx]);
  const filtered = monthCtx.filter((r) => (typeF === "todos" || r.type === typeF) && (statusF === "todos" || r.status === statusF));

  const recebido = monthCtx.filter((r) => r.type === "entrada" && r.status === "pago").reduce((s, r) => s + Number(r.amount), 0);
  const despesas = monthCtx.filter((r) => r.type === "despesa").reduce((s, r) => s + Number(r.amount), 0);

  // ── Mensalidades como INSTÂNCIA do mês (fin_monthly) ──
  const monthRef = `${ym.y}-${pad0(ym.m + 1)}-01`;
  const todayISO = new Date().toISOString().slice(0, 10);
  const { data: monthlies = [] } = useFinMonthly(monthRef);
  const ensureMonthly = useEnsureMonthly();
  const confirmMonthly = useConfirmMonthly();
  const undoMonthly = useUndoMonthly();
  const skipMonthly = useSkipMonthly();
  const [skipping, setSkipping] = useState<FinMonthly | null>(null);
  const [skipReason, setSkipReason] = useState("");

  const activeClients = useMemo(
    () => clients.filter((c) => (c.status ?? "ativo") !== "inativo" && Number(c.monthly_value) > 0),
    [clients],
  );

  // Cria as instâncias do mês (idempotente — não sobrescreve o que já foi pago/pulado).
  useEffect(() => {
    if (!activeClients.length) return;
    ensureMonthly.mutate({
      monthRef,
      clients: activeClients.map((c) => ({ id: c.id, monthly_value: c.monthly_value, payment_day: c.payment_day, status: c.status })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthRef, activeClients.length]);

  const mrr = activeClients.reduce((s, c) => s + Number(c.monthly_value), 0);

  // ── A RECEBER ──
  // Antes só contava mensalidade (fin_monthly). Uma entrada lançada à mão como
  // "pendente" não aparecia em lugar nenhum — o card ignorava. Agora conta as duas fontes:
  //   1) mensalidades do mês ainda pendentes (pulado NÃO entra)
  //   2) lançamentos de entrada com status pendente/atrasado
  const aReceberMensal = monthlies.filter((m) => m.status === "pendente").reduce((s, m) => s + Number(m.amount), 0);
  const aReceberAvulso = monthCtx
    .filter((r) => r.type === "entrada" && r.status !== "pago")
    .reduce((s, r) => s + Number(r.amount), 0);
  const aReceber = aReceberMensal + aReceberAvulso;

  // Despesas: separo o que já saiu do que ainda vai sair — a pessoa precisa ver as duas.
  const despesasPagas = monthCtx.filter((r) => r.type === "despesa" && r.status === "pago").reduce((s, r) => s + Number(r.amount), 0);
  const aPagar = despesas - despesasPagas;

  // Previsão do mês: bruto = recebido + a receber; líquido = bruto − despesas (todas).
  const previstoBruto = recebido + aReceber;
  const previstoLiquido = previstoBruto - despesas;
  // ── RENTABILIDADE POR CLIENTE ──
  // Pra cada cliente: quanto entrou, quanto ainda entra, quanto se gasta COM ele,
  // quanto de imposto ele gera, e o que sobra de fato (margem líquida).
  type ClientRow = {
    id: string; name: string; recebido: number; aReceber: number; receita: number;
    custo: number; custos: { label: string; v: number }[]; imposto: number; margem: number; margemPct: number;
  };
  const clientRows = useMemo<ClientRow[]>(() => {
    const map = new Map<string, { recebido: number; aReceber: number; custo: number; custos: { label: string; v: number }[] }>();
    const touch = (id: string) => {
      let cur = map.get(id);
      if (!cur) { cur = { recebido: 0, aReceber: 0, custo: 0, custos: [] }; map.set(id, cur); }
      return cur;
    };
    monthCtx.forEach((r) => {
      if (!r.crm_client_id) return;
      const cur = touch(r.crm_client_id);
      const v = Number(r.amount);
      if (r.type === "entrada") { if (r.status === "pago") cur.recebido += v; else cur.aReceber += v; }
      else { cur.custo += v; cur.custos.push({ label: r.subcategory || r.category || r.description, v }); }
    });
    // Mensalidade pendente é receita prevista do cliente, mesmo sem lançamento.
    monthlies.forEach((m) => {
      if (!m.crm_client_id || m.status !== "pendente") return;
      touch(m.crm_client_id).aReceber += Number(m.amount);
    });

    const rows = Array.from(map.entries()).map(([id, v]) => ({
      id, name: clients.find((c) => c.id === id)?.name ?? "Cliente",
      ...v, receita: v.recebido + v.aReceber,
    }));
    const receitaTotal = rows.reduce((s, r) => s + r.receita, 0);

    return rows
      .map((r) => {
        const imposto = taxOfClient(fin, r.receita, receitaTotal);
        const margem = r.receita - r.custo - imposto;
        return { ...r, imposto, margem, margemPct: r.receita > 0 ? (margem / r.receita) * 100 : 0 };
      })
      .filter((x) => x.receita > 0 || x.custo > 0)
      .sort((a, b) => b.margem - a.margem);
  }, [monthCtx, monthlies, clients, fin]);

  const imposto = taxOfMonth(fin, recebido);          // sobre o que JÁ entrou
  const impostoPrevisto = taxOfMonth(fin, previstoBruto); // sobre o previsto do mês
  const reinvest = recebido * (Number(fin.reinvestPct) || 0) / 100;
  const proLabore = recebido * (Number(fin.proLaborePct) || 0) / 100;
  const hasRuler = !!(fin.taxPct || fin.dasMonthly || fin.reinvestPct || fin.proLaborePct);
  const hasRegime = !!fin.regime;

  const shift = (delta: number) => setYm((p) => { const d = new Date(p.y, p.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthDate = `${ym.y}-${pad(ym.m + 1)}-${pad(Math.min(now.getDate(), 28))}`;

  const isPj = ctx === "pj";

  const monthStart = new Date(ym.y, ym.m, 1);
  const monthEnd = new Date(ym.y, ym.m + 1, 0);
  const pendingRecurring = recurring.filter((t) => {
    if (!t.active || (t.context ?? "pj") !== ctx) return false;
    const st = new Date(t.start_date + "T00:00:00");
    if (st > monthEnd) return false;
    if (t.end_date) { const en = new Date(t.end_date + "T00:00:00"); if (en < monthStart) return false; }
    return !monthCtx.some((r) => r.recurring_id === t.id);
  });
  const lancarRecorrentes = async () => {
    const rows: FinRecordInput[] = pendingRecurring.map((t) => ({
      context: ctx, type: t.type, description: t.description, category: t.category, subcategory: t.subcategory,
      amount: Number(t.amount), status: "pendente" as FinStatus, crm_client_id: t.crm_client_id,
      payment_method: t.payment_method ?? null, recurring_id: t.id,
      date: `${ym.y}-${pad(ym.m + 1)}-${pad(Math.min(t.due_day, 28))}`,
    }));
    const n = await generate.mutateAsync(rows);
    if (n) toast.success(`${n} lançamento(s) recorrente(s) criado(s).`);
  };

  const customCats = profile?.fin_settings?.categories?.[ctx];
  const addCategory = async (type: FinType, name: string) => {
    const p = profile;
    const fin = p?.fin_settings ?? {};
    const cur = fin.categories ?? {};
    const ctxCats = cur[ctx] ?? {};
    const list = Array.from(new Set([...(ctxCats[type] ?? []), name]));
    await save.mutateAsync({
      full_name: p?.full_name ?? null, business_name: p?.business_name ?? null, tax_id: p?.tax_id ?? null,
      whatsapp: p?.whatsapp ?? null, billing_email: p?.billing_email ?? null,
      instagram_handle: p?.instagram_handle ?? null, niche: p?.niche ?? null, client_range: p?.client_range ?? null,
      fin_settings: { ...fin, categories: { ...cur, [ctx]: { ...ctxCats, [type]: list } } },
    });
  };

  const customSubs = profile?.fin_settings?.subcats?.[ctx];
  const addSubcategory = async (type: FinType, category: string, name: string) => {
    const p = profile;
    const fin = p?.fin_settings ?? {};
    const cur = fin.subcats ?? {};
    const ctxSubs = cur[ctx] ?? {};
    const typeSubs = ctxSubs[type] ?? {};
    const list = Array.from(new Set([...(typeSubs[category] ?? []), name]));
    await save.mutateAsync({
      full_name: p?.full_name ?? null, business_name: p?.business_name ?? null, tax_id: p?.tax_id ?? null,
      whatsapp: p?.whatsapp ?? null, billing_email: p?.billing_email ?? null,
      instagram_handle: p?.instagram_handle ?? null, niche: p?.niche ?? null, client_range: p?.client_range ?? null,
      fin_settings: { ...fin, subcats: { ...cur, [ctx]: { ...ctxSubs, [type]: { ...typeSubs, [category]: list } } } },
    });
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <ManagerSectionTitle t="Cria Caixa" s="O financeiro da sua operação, empresa e pessoal, separados." />
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto scrollbar-none justify-start sm:justify-end">
          {isPj && <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)} className="shrink-0"><ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" /> Transferir p/ PF</Button>}
          <Button variant="outline" size="sm" onClick={() => setRecurringOpen(true)} className="shrink-0"><Repeat className="h-3.5 w-3.5 mr-1.5" /> Recorrentes</Button>
          <Button variant="outline" size="sm" onClick={() => setCompanyOpen(true)} className="shrink-0"><Building2 className="h-3.5 w-3.5 mr-1.5" /> Minha empresa</Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div className="inline-flex items-center gap-1 rounded-2xl border border-border bg-card p-1">
          {([["pj", "Empresa", Building2], ["pf", "Pessoa Física", User]] as const).map(([v, l, Icon]) => (
            <button key={v} onClick={() => navigate(`/socialmidia/criacaixa/${v === "pj" ? "empresa" : "pessoafisica"}`)}
              className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-body font-bold transition-colors", ctx === v ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="h-4 w-4" /> {l}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDialog(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo lançamento {ctx === "pj" ? "(Empresa)" : "(Pessoal)"}
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-display font-bold text-foreground min-w-[110px] text-center">{MONTHS[ym.m]} {ym.y}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {pendingRecurring.length > 0 && (
        <button onClick={lancarRecorrentes} disabled={generate.isPending}
          className="w-full mb-5 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-primary/10 transition-colors">
          <span className="text-sm font-body text-foreground"><span className="font-bold">{pendingRecurring.length}</span> recorrente(s) de {MONTHS[ym.m]} ainda não lançado(s).</span>
          <span className="text-sm font-display font-bold text-primary shrink-0 flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5" /> Lançar do mês</span>
        </button>
      )}

      {isPj ? (
        <>
          {/* PREVISÃO DO MÊS — em destaque. Bruto = já recebido + o que falta receber. Líquido = bruto − despesas. */}
          <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 mb-3">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider">Previsão total do mês (bruto)</p>
                <p className="text-3xl font-display font-extrabold text-foreground mt-0.5">{brl(previstoBruto)}</p>
                <p className="text-[12px] font-body text-muted-foreground mt-0.5">
                  {brl(recebido)} já recebido + {brl(aReceber)} a receber
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider">Líquido previsto</p>
                <p className={cn("text-2xl font-display font-extrabold mt-0.5", previstoLiquido >= 0 ? "text-green-600" : "text-red-500")}>{brl(previstoLiquido)}</p>
                <p className="text-[12px] font-body text-muted-foreground mt-0.5">depois de {brl(despesas)} de despesas</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Metric label="Recebido" value={brl(recebido)} tone="green" />
            <Metric label="A receber" value={brl(aReceber)} tone="amber"
              hint={aReceberAvulso > 0 ? `${brl(aReceberMensal)} mensalidade + ${brl(aReceberAvulso)} avulso` : "mensalidades pendentes"} />
            <Metric label="Despesas" value={brl(despesas)} tone="red"
              hint={aPagar > 0 ? `${brl(despesasPagas)} pagas + ${brl(aPagar)} a pagar` : "todas pagas"} />
            <Metric label="Lucro do mês" value={brl(recebido - despesasPagas)} tone={recebido - despesasPagas >= 0 ? "green" : "red"} hint="só o que já entrou/saiu" />
          </div>
        </>
      ) : (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <Metric label="Entrou" value={brl(recebido)} tone="green" />
          <Metric label="Gastos" value={brl(despesas)} tone="red" />
          <Metric label="Sobra" value={brl(recebido - despesas)} tone={recebido - despesas >= 0 ? "green" : "red"} />
        </div>
      )}

      <CalendarioFinanceiro
        monthlies={isPj ? monthlies : []}
        records={records}
        recurring={recurring}
        pendingRecurring={pendingRecurring}
        ctx={ctx}
        ym={ym}
        clientName={clientName}
      />

      <RelatorioPeriodo records={records} ctx={ctx} />

      <CashflowChart records={records} ctx={ctx} ym={ym} />

      {isPj && monthlies.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 mb-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-display font-bold text-foreground">Mensalidades do mês</h3>
            <span className="text-[11px] text-muted-foreground font-body">MRR ativo: <span className="font-bold text-foreground">{brl(mrr)}</span></span>
          </div>
          <div className="space-y-1">
            {monthlies.map((m) => {
              const nome = clientName(m.crm_client_id) ?? "Cliente";
              const venc = m.due_date.split("-").reverse().slice(0, 2).join("/");
              const atrasado = m.status === "pendente" && m.due_date < todayISO;
              return (
                <div key={m.id} className={cn("flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/40 transition-colors", m.status === "pulado" && "opacity-60")}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-body font-medium text-foreground truncate">{nome}</p>
                    <p className="text-[11px] font-body text-muted-foreground">
                      vence {venc}
                      {m.status === "pulado" && m.skip_reason && <> · pulado: {m.skip_reason}</>}
                    </p>
                  </div>
                  <span className="text-sm font-display font-bold text-foreground shrink-0">{brl(Number(m.amount))}</span>

                  {m.status === "pago" ? (
                    <>
                      <Badge className="bg-green-100 text-green-700 text-[10px] shrink-0">Recebido</Badge>
                      {/* DESFAZER: apaga o lançamento e volta pra pendente. */}
                      <Button size="sm" variant="ghost" className="h-7 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => undoMonthly.mutate(m)} disabled={undoMonthly.isPending}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Desfazer
                      </Button>
                    </>
                  ) : m.status === "pulado" ? (
                    <>
                      <Badge className="bg-muted text-muted-foreground text-[10px] shrink-0">Pulado</Badge>
                      <Button size="sm" variant="ghost" className="h-7 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => undoMonthly.mutate(m)} disabled={undoMonthly.isPending}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Reverter
                      </Button>
                    </>
                  ) : (
                    <>
                      {atrasado && <Badge className="bg-red-100 text-red-700 text-[10px] shrink-0">Atrasado</Badge>}
                      <Button size="sm" variant="outline" className="h-7 shrink-0"
                        onClick={() => confirmMonthly.mutate({ m, clientName: nome })} disabled={confirmMonthly.isPending}>
                        <Check className="h-3 w-3 mr-1" /> Marcar recebido
                      </Button>
                      {/* PULAR: mês em que o cliente não paga (férias, pausa, cortesia). */}
                      <Button size="sm" variant="ghost" className="h-7 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => setSkipping(m)} disabled={skipMonthly.isPending}>
                        <SkipForward className="h-3 w-3 mr-1" /> Pular
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pular mensalidade — pede o motivo */}
      <Dialog open={!!skipping} onOpenChange={(o) => { if (!o) { setSkipping(null); setSkipReason(""); } }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle className="font-display">Pular esta mensalidade</DialogTitle></DialogHeader>
          <p className="text-[13px] font-body text-muted-foreground -mt-1">
            O mês fica registrado como <strong>pulado</strong> — não vira lançamento e não conta na previsão. Dá pra reverter depois.
          </p>
          <Input value={skipReason} onChange={(e) => setSkipReason(e.target.value)} placeholder="Motivo (ex.: cliente pausou em julho)" className="rounded-xl" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSkipping(null); setSkipReason(""); }}>Cancelar</Button>
            <Button onClick={() => { if (skipping) skipMonthly.mutate({ m: skipping, reason: skipReason }); setSkipping(null); setSkipReason(""); }}>
              Pular mês
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── IMPOSTO DO MÊS ── mastigado a partir do regime tributário da empresa. */}
      {isPj && (
        hasRegime ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 mb-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5" /> Imposto de {MONTHS[ym.m]} · {regimeLabel(fin.regime)}
                  {isPctRegime(fin.regime) && Number(fin.taxPct) > 0 && <span className="font-body normal-case tracking-normal text-muted-foreground">({fin.taxPct}%)</span>}
                </p>
                <p className="text-2xl font-display font-extrabold text-foreground mt-1">{brl(imposto)}</p>
                <p className="text-[12px] font-body text-muted-foreground mt-0.5">
                  {isPctRegime(fin.regime)
                    ? <>sobre os {brl(recebido)} que já entraram · fecha o mês em <strong className="text-foreground">{brl(impostoPrevisto)}</strong> se receber tudo</>
                    : <>DAS fixo do MEI — não muda com o faturamento</>}
                </p>
              </div>
              {hasRuler && recebido > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <Alloc label="Reinvestir" value={brl(reinvest)} />
                  <Alloc label="Pró-labore" value={brl(proLabore)} />
                </div>
              )}
            </div>
            <p className="text-[10.5px] font-body text-muted-foreground mt-2.5 pt-2.5 border-t border-primary/15">
              Estimativa de organização com base no que você configurou — não é apuração fiscal. Confirme com sua contabilidade.
            </p>
          </div>
        ) : (
          <button onClick={() => setCompanyOpen(true)}
            className="w-full rounded-2xl border border-dashed border-primary/40 bg-primary/[0.03] p-4 mb-5 text-left hover:bg-primary/[0.07] transition-colors">
            <p className="text-sm font-display font-bold text-foreground">Configure o regime tributário</p>
            <p className="text-[12px] font-body text-muted-foreground mt-0.5">
              Diga se você é MEI, Simples ou Presumido em <strong>Minha empresa</strong> e o Caixa passa a calcular sozinho quanto separar de imposto — no mês e por cliente.
            </p>
          </button>
        )
      )}

      {/* ── RENTABILIDADE POR CLIENTE ── quanto paga, quanto custa, quanto de imposto gera, o que sobra. */}
      {isPj && clientRows.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 mb-5">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <h3 className="text-sm font-display font-bold text-foreground">Rentabilidade por cliente ({MONTHS[ym.m]})</h3>
            <span className="text-[11px] font-body text-muted-foreground">margem = receita − custos − imposto</span>
          </div>
          <p className="text-[11px] font-body text-muted-foreground mb-3">
            Só entra aqui o que você <strong>vinculou ao cliente</strong> no lançamento. Despesa sem cliente vira custo da operação, não do cliente.
          </p>

          <div className="space-y-2">
            {clientRows.map((c) => (
              <div key={c.id} className="rounded-xl border border-border/70 p-3 hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-display font-bold text-foreground truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground font-body">
                      {brl(c.recebido)} recebido{c.aReceber > 0 ? ` + ${brl(c.aReceber)} a receber` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-base font-display font-extrabold", c.margem >= 0 ? "text-green-700" : "text-destructive")}>{brl(c.margem)}</p>
                    <p className={cn("text-[11px] font-body font-semibold", c.margemPct >= 0 ? "text-green-700/80" : "text-destructive/80")}>
                      {c.margemPct.toFixed(0)}% de margem
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
                    title="Abrir no Cria Gestão" onClick={() => navigate(`/socialmidia/criacrm/${c.id}`)}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-border/60 grid grid-cols-3 gap-2">
                  <MiniStat label="Receita" value={brl(c.receita)} tone="green" />
                  <MiniStat label={c.custos.length ? `Custos (${c.custos.length})` : "Custos"} value={brl(c.custo)} tone="red"
                    hint={c.custos.slice(0, 3).map((x) => x.label).join(", ") || undefined} />
                  <MiniStat label="Imposto" value={brl(c.imposto)} tone="muted"
                    hint={isPctRegime(fin.regime) ? `${fin.taxPct ?? 0}% da receita` : "rateio do DAS"} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          <p className="text-xs text-muted-foreground font-body mt-1">{isPj ? "Marque mensalidades recebidas ou adicione despesas da empresa." : "Adicione sua renda (pró-labore) e seus gastos pessoais."}</p>
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
                    {new Date(r.date + "T00:00:00").toLocaleDateString("pt-BR")}{r.category ? ` · ${r.category}${r.subcategory ? ` › ${r.subcategory}` : ""}` : ""}{clientName(r.crm_client_id) ? ` · ${clientName(r.crm_client_id)}` : ""}{r.transfer_group ? " · ↔ transferência" : ""}
                  </p>
                </div>
                {/* Status editável direto na lista (antes era só um badge de leitura). */}
                <select value={r.status} onClick={(e) => e.stopPropagation()}
                  onChange={(e) => upd.mutate({ id: r.id, status: e.target.value as FinStatus })}
                  className={cn("text-[10px] font-bold shrink-0 rounded-full px-2 py-1 border-0 outline-none cursor-pointer", STATUS_STYLE[r.status])}>
                  {(["pendente", "pago", "atrasado"] as FinStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
                <span className={cn("text-sm font-display font-extrabold shrink-0", isIn ? "text-green-700" : "text-destructive")}>{isIn ? "+" : "−"}{brl(Number(r.amount))}</span>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setDialog(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (r.transfer_group) { if (confirm("Excluir esta transferência (Empresa e Pessoal)?")) delGroup.mutate(r.transfer_group); } else if (confirm("Excluir lançamento?")) del.mutate(r.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dialog && (
        <RecordDialog key={editing?.id ?? "new"} record={editing} context={ctx} clients={clients} defaultDate={monthDate} defaultCats={DEFAULT_CATS[ctx]} customCats={customCats} defaultSubs={DEFAULT_SUBCATS[ctx]} customSubs={customSubs} onAddCategory={addCategory} onAddSubcategory={addSubcategory} onClose={() => { setDialog(false); setEditing(null); }} />
      )}
      <FinCompanyDialog open={companyOpen} onOpenChange={setCompanyOpen} />
      <FinRecurringDialog open={recurringOpen} onOpenChange={setRecurringOpen} ctx={ctx} defaultCats={DEFAULT_CATS[ctx]} customCats={customCats} defaultSubs={DEFAULT_SUBCATS[ctx]} customSubs={customSubs} />
      <FinTransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
    </div>
  );
}

function Metric({ label, value, tone, hint }: { label: string; value: string; tone: "green" | "red" | "amber"; hint?: string }) {
  const c = tone === "green" ? "text-green-700" : tone === "red" ? "text-destructive" : "text-amber-600";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-body font-semibold">{label}</p>
      <p className={cn("text-xl font-display font-extrabold mt-1", c)}>{value}</p>
      {hint && <p className="text-[10.5px] font-body text-muted-foreground mt-0.5 leading-tight">{hint}</p>}
    </div>
  );
}

function MiniStat({ label, value, tone, hint }: { label: string; value: string; tone: "green" | "red" | "muted"; hint?: string }) {
  const c = tone === "green" ? "text-green-700" : tone === "red" ? "text-destructive" : "text-foreground";
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body font-semibold">{label}</p>
      <p className={cn("text-sm font-display font-bold mt-0.5", c)}>{value}</p>
      {hint && <p className="text-[10px] font-body text-muted-foreground truncate" title={hint}>{hint}</p>}
    </div>
  );
}

function Alloc({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground font-body font-semibold">{label}</p>
      <p className="text-base font-display font-extrabold text-foreground mt-0.5">{value}</p>
    </div>
  );
}

function CashflowChart({ records, ctx, ym }: { records: FinRecord[]; ctx: FinContext; ym: { y: number; m: number } }) {
  const data = useMemo(() => {
    const arr: { label: string; receitas: number; despesas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ym.y, ym.m - i, 1);
      const recs = records.filter((r) => {
        if ((r.context ?? "pj") !== ctx) return false;
        const dt = new Date(r.date + "T00:00:00");
        return dt.getFullYear() === d.getFullYear() && dt.getMonth() === d.getMonth();
      });
      arr.push({
        label: MONTHS[d.getMonth()],
        receitas: recs.filter((r) => r.type === "entrada").reduce((s, r) => s + Number(r.amount), 0),
        despesas: recs.filter((r) => r.type === "despesa").reduce((s, r) => s + Number(r.amount), 0),
      });
    }
    return arr;
  }, [records, ctx, ym]);

  if (!data.some((d) => d.receitas > 0 || d.despesas > 0)) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 mb-5">
      <h3 className="text-sm font-display font-bold text-foreground mb-3">Receitas × Despesas (últimos 6 meses)</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
            <Tooltip formatter={(v: number) => brl(Number(v))} contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="receitas" name="Receitas" fill="#16a34a" radius={[6, 6, 0, 0]} />
            <Bar dataKey="despesas" name="Despesas" fill="#dc2626" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RecordDialog({ record, context, clients, defaultDate, defaultCats, customCats, defaultSubs, customSubs, onAddCategory, onAddSubcategory, onClose }: {
  record: FinRecord | null; context: FinContext; clients: { id: string; name: string }[]; defaultDate: string;
  defaultCats: Record<FinType, string[]>; customCats?: { entrada?: string[]; despesa?: string[] };
  defaultSubs: Record<FinType, Record<string, string[]>>; customSubs?: { entrada?: Record<string, string[]>; despesa?: Record<string, string[]> };
  onAddCategory: (type: FinType, name: string) => Promise<void>; onAddSubcategory: (type: FinType, category: string, name: string) => Promise<void>; onClose: () => void;
}) {
  const create = useCreateFinRecord(); const update = useUpdateFinRecord();
  const createRecurring = useCreateFinRecurring();
  const [f, setF] = useState<FinRecordInput>(() => record ? { ...record } : { type: "entrada", description: "", amount: 0, status: "pendente", date: defaultDate, context });
  const set = (patch: Partial<FinRecordInput>) => setF((p) => ({ ...p, ...patch }));
  // Repetir todo mês: cria o lançamento de hoje E o modelo recorrente, num clique só.
  const [repeat, setRepeat] = useState(false);
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [addingSub, setAddingSub] = useState(false);
  const [newSub, setNewSub] = useState("");
  const cats = Array.from(new Set([...(defaultCats[f.type] ?? []), ...((customCats?.[f.type]) ?? [])]));
  const cat = f.category ?? "";
  const subs = cat ? Array.from(new Set([...((defaultSubs[f.type]?.[cat]) ?? []), ...((customSubs?.[f.type]?.[cat]) ?? [])])) : [];
  const confirmNewCat = async () => {
    const name = newCat.trim();
    if (!name) return;
    await onAddCategory(f.type, name);
    set({ category: name, subcategory: "" });
    setNewCat(""); setAddingCat(false);
  };
  const confirmNewSub = async () => {
    const name = newSub.trim();
    if (!name || !f.category) return;
    await onAddSubcategory(f.type, f.category, name);
    set({ subcategory: name });
    setNewSub(""); setAddingSub(false);
  };
  const submit = async () => {
    if (!f.description?.trim()) return;
    if (record) {
      await update.mutateAsync({ id: record.id, ...f });
    } else {
      await create.mutateAsync(f as FinRecordInput);
      if (repeat) {
        const dia = Number((f.date ?? defaultDate).slice(8, 10)) || 1;
        await createRecurring.mutateAsync({
          context, type: f.type, description: f.description!, category: f.category ?? null,
          subcategory: f.subcategory ?? null, amount: Number(f.amount) || 0,
          due_day: Math.min(28, Math.max(1, dia)), crm_client_id: f.crm_client_id ?? null,
          active: true, start_date: f.date ?? defaultDate,
        });
        toast.success("Vai repetir todo mês. Dá pra editar em “Recorrentes”.");
      }
    }
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">{record ? "Editar lançamento" : context === "pj" ? "Novo lançamento (Empresa)" : "Novo lançamento (Pessoal)"}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-2">
            {(["entrada", "despesa"] as const).map((t) => (
              <button key={t} onClick={() => set({ type: t, category: "", subcategory: "" })} className={cn("py-2 rounded-xl text-sm font-body font-bold border", f.type === t ? (t === "entrada" ? "bg-green-600 text-white border-green-600" : "bg-destructive text-white border-destructive") : "bg-card border-border text-muted-foreground")}>{t === "entrada" ? "Entrada" : "Despesa"}</button>
            ))}
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Descrição *</Label><Input value={f.description ?? ""} onChange={(e) => set({ description: e.target.value })} className="rounded-xl" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Valor *</Label><MoneyInput value={f.amount ?? null} onChange={(v) => set({ amount: v ?? 0 })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Data</Label><Input type="date" value={f.date ?? defaultDate} onChange={(e) => set({ date: e.target.value })} className="rounded-xl" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Categoria</Label>
              {addingCat ? (
                <div className="flex gap-2">
                  <Input autoFocus value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nova categoria" className="rounded-xl" onKeyDown={(e) => { if (e.key === "Enter") confirmNewCat(); }} />
                  <Button type="button" size="sm" onClick={confirmNewCat} disabled={!newCat.trim()}>OK</Button>
                </div>
              ) : (
                <select value={f.category ?? ""} onChange={(e) => { if (e.target.value === "__add__") { setAddingCat(true); return; } set({ category: e.target.value, subcategory: "" }); }}
                  className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm">
                  <option value="">sem categoria</option>
                  {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__add__">＋ Adicionar categoria…</option>
                </select>
              )}
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Status</Label>
              <select value={f.status ?? "pendente"} onChange={(e) => set({ status: e.target.value as FinStatus })} className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm">
                <option value="pago">Pago</option><option value="pendente">Pendente</option><option value="atrasado">Atrasado</option>
              </select>
            </div>
          </div>

          {f.category && (
            <div className="space-y-1.5"><Label className="text-xs">Subcategoria</Label>
              {addingSub ? (
                <div className="flex gap-2">
                  <Input autoFocus value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Nova subcategoria" className="rounded-xl" onKeyDown={(e) => { if (e.key === "Enter") confirmNewSub(); }} />
                  <Button type="button" size="sm" onClick={confirmNewSub} disabled={!newSub.trim()}>OK</Button>
                </div>
              ) : (
                <select value={f.subcategory ?? ""} onChange={(e) => { if (e.target.value === "__add__") { setAddingSub(true); return; } set({ subcategory: e.target.value }); }}
                  className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm">
                  <option value="">sem subcategoria</option>
                  {subs.map((s) => <option key={s} value={s}>{s}</option>)}
                  <option value="__add__">＋ Adicionar subcategoria…</option>
                </select>
              )}
            </div>
          )}
          {context === "pj" && (
            <div className="space-y-1.5"><Label className="text-xs">Cliente (opcional)</Label>
              <select value={f.crm_client_id ?? ""} onChange={(e) => set({ crm_client_id: e.target.value || null })} className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm">
                <option value="">-</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {/* Forma de pagamento agora é padronizada (select). Texto livre não dava pra somar,
              filtrar, nem mostrar na ficha do cliente no Cria Gestão. */}
          <div className="space-y-1.5"><Label className="text-xs">Forma de pagamento</Label>
            <select value={f.payment_method ?? ""} onChange={(e) => set({ payment_method: e.target.value || null })} className="w-full h-10 rounded-xl border border-input bg-card px-3 text-sm">
              <option value="">-</option>
              {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Repetir todo mês — sem precisar abrir a tela de Recorrentes. */}
          {!record && (
            <button type="button" onClick={() => setRepeat((r) => !r)}
              className={cn("w-full flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                repeat ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40")}>
              <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border", repeat ? "bg-primary border-primary text-white" : "border-muted-foreground/40")}>
                {repeat && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-body font-semibold text-foreground">Repetir todo mês</span>
                <span className="block text-[11.5px] font-body text-muted-foreground leading-tight">
                  {repeat
                    ? `Vira um recorrente todo dia ${Number((f.date ?? defaultDate).slice(8, 10)) || 1}. Você lança os próximos meses com um clique.`
                    : "Ex.: Canva, editor, mensalidade fixa."}
                </span>
              </span>
            </button>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={!f.description?.trim() || create.isPending || update.isPending || createRecurring.isPending}>{record ? "Salvar" : "Criar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CALENDÁRIO DE ENTRADAS E SAÍDAS — PJ e PF.
// Mostra o mês inteiro, dia a dia: mensalidades (no vencimento de cada
// cliente), lançamentos, e — o pulo do gato — os RECORRENTES ainda não
// lançados, como PREVISTO (tracejado). Assim dá pra navegar pros meses
// que vêm e enxergar a recorrência antes de ela virar lançamento.
// ═══════════════════════════════════════════════════════════════════
type Ev = { id: string; day: number; kind: "receber" | "pagar"; label: string; amount: number; done: boolean; previsto: boolean };

function CalendarioFinanceiro({ monthlies, records, recurring, pendingRecurring, ctx, ym, clientName }: {
  monthlies: FinMonthly[];
  records: FinRecord[];
  recurring: FinRecurring[];
  pendingRecurring: FinRecurring[];
  ctx: FinContext;
  ym: { y: number; m: number };
  clientName: (id: string | null) => string | null;
}) {
  const first = new Date(ym.y, ym.m, 1);
  const lastDay = new Date(ym.y, ym.m + 1, 0).getDate();
  const startDow = (first.getDay() + 6) % 7; // segunda = 0
  const hoje = new Date().toISOString().slice(0, 10);

  const evs = useMemo<Ev[]>(() => {
    const out: Ev[] = [];

    // 1) Mensalidades do mês (só PJ) — cada uma no vencimento do cliente.
    for (const m of monthlies) {
      if (m.status === "pulado") continue;
      out.push({
        id: "m-" + m.id, day: Number(m.due_date.slice(8, 10)), kind: "receber",
        label: clientName(m.crm_client_id) ?? "Cliente", amount: Number(m.amount),
        done: m.status === "pago", previsto: false,
      });
    }

    // 2) Lançamentos reais do mês — entradas E despesas (antes só vinham as despesas).
    for (const r of records) {
      if ((r.context ?? "pj") !== ctx) continue;
      const d = new Date(r.date + "T00:00:00");
      if (d.getFullYear() !== ym.y || d.getMonth() !== ym.m) continue;
      out.push({
        id: "r-" + r.id, day: d.getDate(), kind: r.type === "entrada" ? "receber" : "pagar",
        label: r.description, amount: Number(r.amount), done: r.status === "pago", previsto: false,
      });
    }

    // 3) Recorrentes ainda NÃO lançados neste mês → aparecem como previsto.
    //    É isso que faz o mês que vem já mostrar o Canva, o editor, o aluguel…
    const pendingIds = new Set(pendingRecurring.map((t) => t.id));
    for (const t of recurring) {
      if (!pendingIds.has(t.id)) continue;
      out.push({
        id: "p-" + t.id, day: Math.min(t.due_day, lastDay), kind: t.type === "entrada" ? "receber" : "pagar",
        label: t.description, amount: Number(t.amount), done: false, previsto: true,
      });
    }
    return out;
  }, [monthlies, records, recurring, pendingRecurring, ctx, ym, lastDay, clientName]);

  const byDay = new Map<number, Ev[]>();
  for (const e of evs) { const a = byDay.get(e.day) ?? []; a.push(e); byDay.set(e.day, a); }

  const totalReceber = evs.filter((e) => e.kind === "receber" && !e.done).reduce((s, e) => s + e.amount, 0);
  const totalPagar = evs.filter((e) => e.kind === "pagar" && !e.done).reduce((s, e) => s + e.amount, 0);
  const temPrevisto = evs.some((e) => e.previsto);

  if (evs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center mb-5">
        <p className="text-sm font-body text-foreground font-medium">Nada marcado em {MONTHS[ym.m]}</p>
        <p className="text-xs text-muted-foreground font-body mt-1">
          Cadastre recorrentes e o dia de pagamento dos clientes — o calendário se preenche sozinho, inclusive nos meses que vêm.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 mb-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-display font-bold text-foreground">Calendário de entradas e saídas</h3>
          {temPrevisto && <p className="text-[11px] font-body text-muted-foreground">Tracejado = previsto (recorrente ainda não lançado).</p>}
        </div>
        <div className="flex items-center gap-3 text-[11px] font-body">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> entra <strong className="text-foreground">{brl(totalReceber)}</strong></span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> sai <strong className="text-foreground">{brl(totalPagar)}</strong></span>
          <span className={cn("inline-flex items-center gap-1 font-bold", totalReceber - totalPagar >= 0 ? "text-green-700" : "text-red-600")}>
            saldo {brl(totalReceber - totalPagar)}
          </span>
        </div>
      </div>

      <div className="hidden sm:grid grid-cols-7 gap-1 mb-1">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
          <p key={d} className="text-[10px] uppercase tracking-wider font-body font-semibold text-muted-foreground text-center">{d}</p>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-7 gap-1">
        {Array.from({ length: startDow }).map((_, i) => <div key={"e" + i} className="hidden sm:block" />)}
        {Array.from({ length: lastDay }, (_, i) => i + 1).map((day) => {
          const list = byDay.get(day) ?? [];
          const iso = `${ym.y}-${pad0(ym.m + 1)}-${pad0(day)}`;
          const isToday = iso === hoje;
          if (list.length === 0) {
            return (
              <div key={day} className={cn("hidden sm:block min-h-[64px] rounded-lg border p-1.5", isToday ? "border-primary bg-primary/5" : "border-border/60")}>
                <span className={cn("text-[11px] font-display font-bold", isToday ? "text-primary" : "text-muted-foreground/50")}>{day}</span>
              </div>
            );
          }
          return (
            <div key={day} className={cn("min-h-[64px] rounded-lg border p-1.5 space-y-1", isToday ? "border-primary bg-primary/5" : "border-border")}>
              <span className={cn("text-[11px] font-display font-bold", isToday ? "text-primary" : "text-foreground")}>{day}</span>
              {list.map((e) => (
                <div key={e.id}
                  className={cn("rounded px-1 py-0.5 text-[10px] font-body leading-tight truncate",
                    e.done && "opacity-50 line-through",
                    e.previsto && "border border-dashed opacity-80",
                    e.kind === "receber"
                      ? cn("text-green-700", e.previsto ? "border-green-600/40 bg-green-500/5" : "bg-green-500/10")
                      : cn("text-red-600", e.previsto ? "border-red-600/40 bg-red-500/5" : "bg-red-500/10"))}
                  title={`${e.label} · ${brl(e.amount)}${e.previsto ? " (previsto)" : ""}`}>
                  {e.kind === "receber" ? "+" : "−"}{brl(e.amount)} {e.label}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// RELATÓRIO POR PERÍODO — extrai mês / ano / intervalo livre,
// com a evolução mês a mês e exportação em CSV.
// ═══════════════════════════════════════════════════════════════════
function RelatorioPeriodo({ records, ctx }: { records: FinRecord[]; ctx: FinContext }) {
  const hoje = new Date();
  const [de, setDe] = useState(`${hoje.getFullYear()}-01-01`);
  const [ate, setAte] = useState(hoje.toISOString().slice(0, 10));

  const preset = (kind: "mes" | "ano" | "12m") => {
    const y = hoje.getFullYear(), m = hoje.getMonth();
    if (kind === "mes") { setDe(`${y}-${pad0(m + 1)}-01`); setAte(new Date(y, m + 1, 0).toISOString().slice(0, 10)); }
    else if (kind === "ano") { setDe(`${y}-01-01`); setAte(`${y}-12-31`); }
    else { const d = new Date(y, m - 11, 1); setDe(d.toISOString().slice(0, 10)); setAte(new Date(y, m + 1, 0).toISOString().slice(0, 10)); }
  };

  const rows = records.filter((r) => (r.context ?? "pj") === ctx && r.date >= de && r.date <= ate);
  const entradas = rows.filter((r) => r.type === "entrada" && r.status === "pago").reduce((s, r) => s + Number(r.amount), 0);
  const saidas = rows.filter((r) => r.type === "despesa").reduce((s, r) => s + Number(r.amount), 0);

  // Evolução mês a mês dentro do período.
  const porMes = new Map<string, { receita: number; custo: number }>();
  for (const r of rows) {
    const k = r.date.slice(0, 7);
    const cur = porMes.get(k) ?? { receita: 0, custo: 0 };
    if (r.type === "entrada" && r.status === "pago") cur.receita += Number(r.amount);
    else if (r.type === "despesa") cur.custo += Number(r.amount);
    porMes.set(k, cur);
  }
  const meses = [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b));

  const exportCsv = () => {
    const head = "data;tipo;descricao;categoria;status;valor";
    const body = rows
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => [r.date, r.type, (r.description ?? "").replace(/;/g, ","), r.category ?? "", r.status, String(r.amount).replace(".", ",")].join(";"));
    const csv = [head, ...body].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `cria-caixa-${de}_a_${ate}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado.");
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 mb-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-display font-bold text-foreground">Relatório por período</h3>
        <Button size="sm" variant="outline" className="h-8" onClick={exportCsv} disabled={rows.length === 0}>Exportar CSV</Button>
      </div>

      <div className="flex items-end gap-2 flex-wrap mb-3">
        <div><p className="text-[10px] font-body font-semibold text-muted-foreground uppercase mb-1">De</p><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-9 rounded-xl w-40" /></div>
        <div><p className="text-[10px] font-body font-semibold text-muted-foreground uppercase mb-1">Até</p><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9 rounded-xl w-40" /></div>
        <div className="flex gap-1">
          {([["mes", "Este mês"], ["12m", "12 meses"], ["ano", "Este ano"]] as const).map(([k, l]) => (
            <Button key={k} size="sm" variant="ghost" className="h-9 text-xs" onClick={() => preset(k)}>{l}</Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Metric label="Entradas" value={brl(entradas)} tone="green" />
        <Metric label="Saídas" value={brl(saidas)} tone="red" />
        <Metric label="Resultado" value={brl(entradas - saidas)} tone={entradas - saidas >= 0 ? "green" : "red"} />
      </div>

      {meses.length === 0 ? (
        <p className="text-[12px] font-body text-muted-foreground text-center py-3">Nenhum lançamento nesse período.</p>
      ) : (
        <div className="space-y-1">
          <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Evolução mês a mês</p>
          {meses.map(([k, v]) => {
            const [yy, mm] = k.split("-");
            const label = new Date(Number(yy), Number(mm) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
            const saldo = v.receita - v.custo;
            return (
              <div key={k} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                <span className="text-[12px] font-body font-semibold text-foreground w-20 shrink-0 capitalize">{label}</span>
                <span className="text-[12px] font-body text-green-700 shrink-0">+{brl(v.receita)}</span>
                <span className="text-[12px] font-body text-red-600 shrink-0">−{brl(v.custo)}</span>
                <span className={cn("text-[12px] font-display font-bold ml-auto shrink-0", saldo >= 0 ? "text-green-700" : "text-red-600")}>{brl(saldo)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
