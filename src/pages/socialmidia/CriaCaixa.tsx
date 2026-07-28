import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Trash2, Pencil, Building2, User, Check, Repeat, ArrowLeftRight, RotateCcw, SkipForward, ExternalLink, Receipt, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  useFinRecords, useCreateFinRecord, useUpdateFinRecord, useDeleteFinRecord, useFinRecurring, useCreateFinRecurring, useGenerateRecurring, useDeleteFinByGroup,
  useFinMonthly, useEnsureMonthly, useConfirmMonthly, useUndoMonthly, useSkipMonthly,
  type FinRecord, type FinType, type FinStatus, type FinContext, type FinRecordInput, type FinMonthly, type FinRecurring,
} from "@/hooks/useFinance";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { PAYMENT_METHODS, taxOfMonth, taxOfClient, regimeLabel, isPctRegime, mensalidadeAtivaNoMes, receitaDoMesPJ, billablePendingMonthlies } from "@/lib/finance";
import { useCrmClients, type CrmClient } from "@/hooks/useCrm";
import { useManagerProfile, type FinSettings } from "@/hooks/useModules";
import { ModuleGate } from "@/components/accounts/ModuleGate";
import { useActiveAccount } from "@/contexts/AccountContext";
import { ModuleHero, type SubTab } from "@/components/brand/ModuleHero";
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
import { hojeBR, toISODateBR, parseDateOnly } from "@/lib/date-br";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { confirmar } from "@/components/shared/Confirm";

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  return <ModuleGate code="financeiro" teamCode="cria_caixa"><CaixaInner /></ModuleGate>;
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
  const now = parseDateOnly(hojeBR()); // fuso BR: não vira o mês/dia após ~21h (UTC)
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  // Colaborador (acesso de equipe) só enxerga o financeiro da EMPRESA (PJ).
  // O Pessoal (PF) é privado do dono da conta.
  const { actingAsTeam } = useActiveAccount();

  // ── ROTA: /socialmidia/criacaixa/<empresa|pessoal>/<seção> ──
  // Antes tudo caía numa página só e a informação ficava jogada. Agora cada
  // seção tem URL própria: dá pra favoritar, compartilhar e o "voltar" funciona.
  const parts = pathname.split("/").filter(Boolean);           // [socialmidia, criacaixa, ctx, sec]
  const ctxSeg = parts[2] ?? "";
  const wantsPf = ctxSeg === "pessoal" || ctxSeg === "pessoafisica";
  // Colaborador nunca fica no contexto PF, mesmo digitando a URL direto.
  const ctx: FinContext = actingAsTeam ? "pj" : (wantsPf ? "pf" : "pj");
  const section = parts[3] ?? "visao";
  // Sub-aba de "Mensalidades" (só PJ): ?sub=lancamentos abre a lista de lançamentos
  // dentro da mesma aba. Deep-link coerente e a aba "Mensalidades" segue destacada.
  const mensSub: "mensalidades" | "lancamentos" = new URLSearchParams(search).get("sub") === "lancamentos" ? "lancamentos" : "mensalidades";

  // Normaliza a URL (inclusive os links antigos /pessoafisica).
  useEffect(() => {
    // Colaborador tentando abrir /pessoal cai de volta na Empresa.
    if (actingAsTeam && wantsPf) {
      navigate(`/socialmidia/criacaixa/empresa/${section}`, { replace: true });
      return;
    }
    if (parts.length < 4) {
      const c = wantsPf ? "pessoal" : "empresa";
      navigate(`/socialmidia/criacaixa/${c}/visao`, { replace: true });
      return;
    }
    // No PJ, "Lançamentos" agora é sub-aba de Mensalidades. O link antigo
    // /empresa/lancamentos passa a abrir /empresa/mensalidades?sub=lancamentos.
    if (ctx === "pj" && section === "lancamentos") {
      navigate(`/socialmidia/criacaixa/empresa/mensalidades?sub=lancamentos`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, actingAsTeam]);

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

  const recebido = monthCtx.filter((r) => r.type === "entrada" && r.status === "pago").reduce((s, r) => s + Number(r.amount), 0);
  const despesas = monthCtx.filter((r) => r.type === "despesa").reduce((s, r) => s + Number(r.amount), 0);

  // ── Mensalidades como INSTÂNCIA do mês (fin_monthly) ──
  const monthRef = `${ym.y}-${pad0(ym.m + 1)}-01`;
  // Fuso BR: usar hojeBR() evita que após ~21h o "hoje" vire o dia seguinte (UTC)
  // e a mensalidade que vence hoje apareça como atrasada.
  const todayISO = hojeBR();
  const { data: monthlies = [] } = useFinMonthly(monthRef);
  const ensureMonthly = useEnsureMonthly();
  const confirmMonthly = useConfirmMonthly();
  const undoMonthly = useUndoMonthly();
  const skipMonthly = useSkipMonthly();
  const [skipping, setSkipping] = useState<FinMonthly | null>(null);
  const [skipReason, setSkipReason] = useState("");

  // Carteira do MÊS VISTO: cliente encerrado (contract_end_date) conta só até o
  // mês do encerramento; a partir do mês seguinte sai da carteira e do MRR.
  const viewedMonth = `${ym.y}-${pad0(ym.m + 1)}`;
  const activeClients = useMemo(
    () => clients.filter((c) => mensalidadeAtivaNoMes(c, viewedMonth)),
    [clients, viewedMonth],
  );

  // Cria as instâncias do mês (idempotente, não sobrescreve o que já foi pago/pulado).
  useEffect(() => {
    if (!activeClients.length) return;
    ensureMonthly.mutate({
      monthRef,
      clients: activeClients.map((c) => ({ id: c.id, monthly_value: c.monthly_value, payment_day: c.payment_day, status: c.status, contract_end_date: c.contract_end_date })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthRef, activeClients.length]);

  const mrr = activeClients.reduce((s, c) => s + Number(c.monthly_value), 0);

  // ── RECEITA DO MÊS (PJ): fonte única (receitaDoMesPJ), a MESMA da Home ──
  // Antes cada tela somava do seu jeito e a receita AVULSA (freelance/lançamento
  // sem cliente) caía de fora do card da home. Agora a Visão geral do Caixa e o
  // card "previsto neste mês" da home chamam esta mesma conta, então cruzam:
  //   • recebido       = entradas pagas (mensalidade paga + avulso pago)
  //   • aReceberMensal = mensalidades do mês ainda pendentes (pulado NÃO entra)
  //   • aReceberAvulso = entradas lançadas à mão ainda não pagas (inclui SEM cliente)
  //   • previstoBruto  = recebido + a receber (mensal + avulso)
  //   • mensalidadesDoMes / outrasReceitas = recorte carteira × avulsos
  // Só faz sentido no PJ; o PF usa a PessoalVisao (não lê estes números).
  const receitaMes = receitaDoMesPJ(records, monthlies, clients, viewedMonth);
  const { aReceberMensal, aReceberAvulso, aReceber, previstoBruto, mensalidadesDoMes, outrasReceitas } = receitaMes;

  // Mensalidades pendentes que REALMENTE contam (dedup da paga à mão + corte de
  // cliente inativo/excluído). Mesma regra da Visão geral, reusada nas abas.
  const billableMonthlies = useMemo(
    () => billablePendingMonthlies(monthlies, records, clients, viewedMonth),
    [monthlies, records, clients, viewedMonth],
  );
  const billablePendingIds = useMemo(
    () => new Set(billableMonthlies.map((m) => m.id)),
    [billableMonthlies],
  );

  // Despesas: separo o que já saiu do que ainda vai sair, a pessoa precisa ver as duas.
  const despesasPagas = monthCtx.filter((r) => r.type === "despesa" && r.status === "pago").reduce((s, r) => s + Number(r.amount), 0);
  const aPagar = despesas - despesasPagas;

  // Líquido previsto = previsão bruta − despesas (todas) do contexto.
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
    // Só as que realmente contam (dedup da paga à mão + cliente ativo), pra a
    // rentabilidade bater com a Visão geral.
    billableMonthlies.forEach((m) => {
      if (!m.crm_client_id) return;
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
  }, [monthCtx, billableMonthlies, clients, fin]);

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

  // ── LANÇAMENTOS: fin_records reais + mensalidades pendentes projetadas ──
  // A aba Lançamentos só listava fin_records reais já materializados. As
  // mensalidades pendentes vivem em fin_monthly e só viram fin_record quando
  // marcadas como recebidas, então o filtro "Pendente" mostrava "nenhum
  // lançamento" mesmo com mensalidade a receber no mês. Aqui juntamos as duas
  // fontes sem duplicar: os lançamentos reais do mês + as mensalidades ainda
  // pendentes (projetadas). Só entra o que está "pendente" (pago já tem o
  // fin_record real; pulado não conta), e só no contexto Empresa (PJ).
  type LancItem =
    | { kind: "record"; rec: FinRecord }
    | { kind: "monthly"; m: FinMonthly; nome: string; status: FinStatus; atrasada: boolean };
  const lancItems = useMemo<LancItem[]>(() => {
    const recs: LancItem[] = monthCtx.map((rec) => ({ kind: "record", rec }));
    if (!isPj) return recs;
    const proj: LancItem[] = billableMonthlies
      .map((m) => ({
        kind: "monthly", m,
        nome: clients.find((c) => c.id === m.crm_client_id)?.name ?? "Cliente",
        // Mensalidade pendente reflete o status real do banco ("pendente"),
        // pra aparecer no filtro "Pendente". O visual de vencida é só um aviso.
        status: "pendente" as FinStatus,
        atrasada: m.due_date < todayISO,
      }));
    // Mesma ordenação da lista de fin_records: data desc.
    return [...recs, ...proj].sort((a, b) => {
      const da = a.kind === "record" ? a.rec.date : a.m.due_date;
      const db = b.kind === "record" ? b.rec.date : b.m.due_date;
      return db.localeCompare(da);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthCtx, billableMonthlies, isPj, clients, todayISO]);

  const filteredItems = lancItems.filter((it) => {
    const type: FinType = it.kind === "record" ? it.rec.type : "entrada";
    const status: FinStatus = it.kind === "record" ? it.rec.status : it.status;
    return (typeF === "todos" || type === typeF) && (statusF === "todos" || status === statusF);
  });

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
    // Sem o perfil carregado, o payload gravaria null por cima de nome/razão/CNPJ.
    if (!profile) { toast.error("Aguarde carregar seu perfil antes de adicionar categorias."); return; }
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
    // Sem o perfil carregado, o payload gravaria null por cima de nome/razão/CNPJ.
    if (!profile) { toast.error("Aguarde carregar seu perfil antes de adicionar subcategorias."); return; }
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

  // ── SUBMENU do módulo. Cada aba é uma URL. ──
  const base = `/socialmidia/criacaixa/${isPj ? "empresa" : "pessoal"}`;
  // "Lançamentos" deixou de ser aba própria no PJ: virou uma sub-aba dentro de
  // "Mensalidades" (as duas eram redundantes/complementares). No PF continua aba.
  const tabs: SubTab[] = isPj
    ? [
        { to: `${base}/visao`, label: "Visão geral" },
        { to: `${base}/clientes`, label: "Clientes" },
        { to: `${base}/calendario`, label: "Calendário" },
        { to: `${base}/mensalidades`, label: "Mensalidades" },
        { to: `${base}/relatorios`, label: "Relatórios" },
      ]
    : [
        { to: `${base}/visao`, label: "Visão geral" },
        { to: `${base}/calendario`, label: "Calendário" },
        { to: `${base}/lancamentos`, label: "Lançamentos" },
        { to: `${base}/relatorios`, label: "Relatórios" },
      ];

  // Colaborador só tem Empresa; o dono continua com Empresa + Pessoal.
  const ctxOptions: Array<[FinContext, string, typeof Building2]> = actingAsTeam
    ? [["pj", "Empresa", Building2]]
    : [["pj", "Empresa", Building2], ["pf", "Pessoal", User]];
  const seletorPjPf = (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="inline-flex items-center gap-1 rounded-2xl border border-border bg-background/70 backdrop-blur-sm p-1">
        {ctxOptions.map(([v, l, Icon]) => (
          <button key={v} onClick={() => navigate(`/socialmidia/criacaixa/${v === "pj" ? "empresa" : "pessoal"}/visao`)}
            className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-body font-bold transition-colors", ctx === v ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
            <Icon className="h-4 w-4" /> {l}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8 bg-background/70" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-display font-bold text-foreground min-w-[100px] text-center">{MONTHS[ym.m]} {ym.y}</span>
        <Button variant="outline" size="icon" className="h-8 w-8 bg-background/70" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );

  const show = (s: string) => section === s;

  // ── Mensalidades × Lançamentos ──
  // No PJ os dois vivem na mesma aba "Mensalidades" (sub-abas). No PF, "Lançamentos"
  // continua sendo aba própria (o PF não tem mensalidades).
  const showMensTab = isPj && section === "mensalidades";
  const showMensContent = showMensTab && mensSub === "mensalidades";
  const showLancContent = (showMensTab && mensSub === "lancamentos") || (!isPj && section === "lancamentos");

  return (
    <div>
      <ModuleHero
        title="Cria Caixa"
        subtitle="O financeiro da sua operação, empresa e pessoal, separados."
        color="azul"
        tabs={tabs}
        actions={
          <>
            <Button size="sm" onClick={() => { setEditing(null); setDialog(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo lançamento
            </Button>
            {isPj && !actingAsTeam && <Button variant="outline" size="sm" className="bg-background/70" onClick={() => setTransferOpen(true)}><ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" /> Transferir p/ PF</Button>}
            <Button variant="outline" size="sm" className="bg-background/70" onClick={() => setRecurringOpen(true)}><Repeat className="h-3.5 w-3.5 mr-1.5" /> Recorrentes</Button>
            <Button variant="outline" size="sm" className="bg-background/70" onClick={() => setCompanyOpen(true)}><Building2 className="h-3.5 w-3.5 mr-1.5" /> Minha empresa</Button>
          </>
        }
      >
        {seletorPjPf}
      </ModuleHero>

      {/* Colaborador: aviso de que só o financeiro da empresa está visível. */}
      {actingAsTeam && (
        <div className="mb-5 flex items-start gap-2 rounded-2xl bg-amber-500/[0.08] border border-amber-500/25 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[13px] font-body text-amber-900/80 leading-relaxed">
            Você vê só o financeiro <strong>da empresa</strong>. O <strong>Pessoal</strong> é privado do dono da conta e não aparece aqui.
          </p>
        </div>
      )}

      {/* O aviso de recorrente pendente aparece em qualquer seção, é ação, não informação. */}
      {pendingRecurring.length > 0 && (
        <button onClick={lancarRecorrentes} disabled={generate.isPending}
          className="w-full mb-5 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-primary/10 transition-colors">
          <span className="text-sm font-body text-foreground"><span className="font-bold">{pendingRecurring.length}</span> recorrente(s) de {MONTHS[ym.m]} ainda não lançado(s).</span>
          <span className="text-sm font-display font-bold text-primary shrink-0 flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5" /> Lançar do mês</span>
        </button>
      )}

      {/* ═══════ VISÃO GERAL ═══════ */}
      {show("visao") && (isPj ? (
        <>
          {/* PREVISÃO DO MÊS, em destaque. Bruto = já recebido + o que falta receber. Líquido = bruto − despesas. */}
          <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 mb-3">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider">Previsão total do mês (bruto)</p>
                <p className="text-3xl font-display font-extrabold text-foreground mt-0.5">{brl(previstoBruto)}</p>
                <p className="text-[12px] font-body text-muted-foreground mt-0.5">
                  {brl(recebido)} já recebido + {brl(aReceber)} a receber
                </p>
                {/* Reconcilia com a home: mensalidades da carteira + o que é avulso. */}
                <p className="text-[12px] font-body text-muted-foreground mt-0.5">
                  {brl(mensalidadesDoMes)} em mensalidades da carteira
                  {outrasReceitas > 0.005 ? <> + <strong className="text-foreground">{brl(outrasReceitas)}</strong> em outras receitas (avulsas)</> : ""}
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
        <PessoalVisao
          recebido={recebido} despesas={despesas} monthCtx={monthCtx}
          recurring={recurring} fin={fin} ym={ym}
          onNovo={() => { setEditing(null); setDialog(true); }}
        />
      ))}

      {/* ═══════ CALENDÁRIO ═══════ */}
      {show("calendario") && (
        <CalendarioFinanceiro
          monthlies={isPj ? monthlies : []}
          billablePendingIds={isPj ? billablePendingIds : new Set()}
          records={records}
          recurring={recurring}
          pendingRecurring={pendingRecurring}
          ctx={ctx}
          ym={ym}
          clientName={clientName}
          acoes={{
            confirmarMensalidade: (m, nome) => confirmMonthly.mutate({ m, clientName: nome }),
            desfazerMensalidade: (m) => undoMonthly.mutate(m),
            pularMensalidade: (m) => setSkipping(m),
            mudarStatus: (id, status) => upd.mutate({ id, status }),
            editarLancamento: (r) => { setEditing(r); setDialog(true); },
            lancarRecorrentes,
            ocupado: confirmMonthly.isPending || undoMonthly.isPending || skipMonthly.isPending || upd.isPending || generate.isPending,
          }}
        />
      )}

      {/* ═══════ RELATÓRIOS ═══════ */}
      {show("relatorios") && (
        <>
          <RelatorioPeriodo records={records} ctx={ctx} clients={clients} monthlies={monthlies} mrr={mrr} fin={fin} />
          <CashflowChart records={records} ctx={ctx} ym={ym} />
        </>
      )}

      {/* ═══════ MENSALIDADES (com sub-aba Lançamentos) ═══════ */}
      {showMensTab && (
        <div className="flex items-center gap-1 mb-4 rounded-2xl border border-border bg-card p-1 w-fit">
          {([["mensalidades", "Mensalidades"], ["lancamentos", "Lançamentos"]] as const).map(([k, l]) => (
            <button key={k}
              onClick={() => navigate(k === "lancamentos" ? `${base}/mensalidades?sub=lancamentos` : `${base}/mensalidades`)}
              className={cn("px-4 py-1.5 rounded-xl text-xs font-body font-bold transition-colors",
                mensSub === k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              {l}
            </button>
          ))}
        </div>
      )}

      {showMensContent && monthlies.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-body text-foreground font-medium">Nenhuma mensalidade neste mês</p>
          <p className="text-xs text-muted-foreground font-body mt-1">
            Preencha o <strong>valor mensal</strong> e o <strong>dia de pagamento</strong> na ficha dos clientes, elas nascem sozinhas todo mês.
          </p>
        </div>
      )}
      {showMensContent && monthlies.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 mb-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-display font-bold text-foreground">Mensalidades do mês</h3>
            <span className="text-[11px] text-muted-foreground font-body">Receita mensal: <span className="font-bold text-foreground">{brl(mrr)}</span></span>
          </div>
          <div className="space-y-1">
            {monthlies.map((m) => {
              const nome = clientName(m.crm_client_id) ?? "Cliente";
              const venc = m.due_date.split("-").reverse().slice(0, 2).join("/");
              const atrasado = m.status === "pendente" && m.due_date < todayISO;
              // No mobile isto era uma linha só e o "vence 01/07" quebrava letra por
              // letra na vertical. Agora é um card: nome + valor em cima, ações embaixo.
              return (
                <div key={m.id} className={cn(
                  "rounded-xl border border-border p-3 sm:border-0 sm:p-2 sm:rounded-xl sm:hover:bg-muted/40 transition-colors",
                  m.status === "pulado" && "opacity-60",
                )}>
                  <div className="flex items-center gap-3 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-body font-semibold text-foreground truncate">{nome}</p>
                      <p className="text-[11px] font-body text-muted-foreground truncate">
                        vence {venc}
                        {m.status === "pulado" && m.skip_reason ? ` · pulado: ${m.skip_reason}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-display font-bold text-foreground shrink-0 whitespace-nowrap">{brl(Number(m.amount))}</span>
                    {m.status === "pago" && <Badge className="bg-green-100 text-green-700 text-[10px] shrink-0">Recebido</Badge>}
                    {m.status === "pulado" && <Badge className="bg-muted text-muted-foreground text-[10px] shrink-0">Pulado</Badge>}
                    {m.status === "pendente" && atrasado && <Badge className="bg-red-100 text-red-700 text-[10px] shrink-0">Atrasado</Badge>}
                  </div>

                  <div className="flex items-center gap-1.5 mt-2.5 sm:mt-2">
                    {m.status === "pago" || m.status === "pulado" ? (
                      <Button size="sm" variant="outline" className="h-8 flex-1 sm:flex-none"
                        onClick={() => undoMonthly.mutate(m)} disabled={undoMonthly.isPending}>
                        <RotateCcw className="h-3 w-3 mr-1" /> {m.status === "pago" ? "Desfazer" : "Reverter"}
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" className="h-8 flex-1 sm:flex-none"
                          onClick={() => confirmMonthly.mutate({ m, clientName: nome })} disabled={confirmMonthly.isPending}>
                          <Check className="h-3 w-3 mr-1" /> Marcar recebido
                        </Button>
                        {/* PULAR: mês em que o cliente não paga (férias, pausa, cortesia). */}
                        <Button size="sm" variant="outline" className="h-8 shrink-0 text-muted-foreground"
                          onClick={() => setSkipping(m)} disabled={skipMonthly.isPending}>
                          <SkipForward className="h-3 w-3 mr-1" /> Pular
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pular mensalidade, pede o motivo */}
      <Dialog open={!!skipping} onOpenChange={(o) => { if (!o) { setSkipping(null); setSkipReason(""); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-display">Pular esta mensalidade</DialogTitle></DialogHeader>
          <p className="text-[13px] font-body text-muted-foreground -mt-1">
            O mês fica registrado como <strong>pulado</strong>, não vira lançamento e não conta na previsão. Dá pra reverter depois.
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

      {/* ── IMPOSTO DO MÊS ── mastigado a partir do regime tributário da empresa.
           Fica na Visão geral: é a primeira coisa que a pessoa precisa saber. */}
      {show("visao") && isPj && (
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
                    : <>DAS fixo do MEI, não muda com o faturamento</>}
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
              Estimativa de organização com base no que você configurou, não é apuração fiscal. Confirme com sua contabilidade.
            </p>
          </div>
        ) : (
          <button onClick={() => setCompanyOpen(true)}
            className="w-full rounded-2xl border border-dashed border-primary/40 bg-primary/[0.03] p-4 mb-5 text-left hover:bg-primary/[0.07] transition-colors">
            <p className="text-sm font-display font-bold text-foreground">Configure o regime tributário</p>
            <p className="text-[12px] font-body text-muted-foreground mt-0.5">
              Diga se você é MEI, Simples ou Presumido em <strong>Minha empresa</strong> e o Caixa passa a calcular sozinho quanto separar de imposto, no mês e por cliente.
            </p>
          </button>
        )
      )}

      {/* ═══════ CLIENTES, rentabilidade ═══════ */}
      {show("clientes") && isPj && clientRows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-body text-foreground font-medium">Nenhum cliente com movimento em {MONTHS[ym.m]}</p>
          <p className="text-xs text-muted-foreground font-body mt-1">
            Vincule os lançamentos a um cliente e esta tela mostra receita, custo, imposto e margem de cada um.
          </p>
        </div>
      )}
      {show("clientes") && isPj && clientRows.length > 0 && (
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
                  {/* Atalho pra aba Financeiro da ficha: é lá que se lança e edita os custos por categoria. */}
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
                    title="Custos e margem na ficha do cliente" onClick={() => navigate(`/socialmidia/clientes/${c.id}/financeiro`)}>
                    <Receipt className="h-4 w-4" />
                  </Button>
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

      {/* ═══════ LANÇAMENTOS (sub-aba de Mensalidades no PJ; aba própria no PF) ═══════ */}
      {showLancContent && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(["todos", "entrada", "despesa"] as const).map((t) => (
            <button key={t} onClick={() => setTypeF(t)} className={cn("px-3 py-1.5 rounded-full text-xs font-body font-bold border", typeF === t ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground")}>{t === "todos" ? "Tudo" : t === "entrada" ? "Entradas" : "Despesas"}</button>
          ))}
          <span className="w-px h-5 bg-border mx-1" />
          {(["todos", "pago", "pendente", "atrasado"] as const).map((s) => (
            <button key={s} onClick={() => setStatusF(s)} className={cn("px-3 py-1.5 rounded-full text-xs font-body font-bold border", statusF === s ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground")}>{s === "todos" ? "Status" : STATUS_LABEL[s]}</button>
          ))}
        </div>
      )}

      {showLancContent && (isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-body text-foreground font-medium">Nenhum lançamento neste mês</p>
          <p className="text-xs text-muted-foreground font-body mt-1">{isPj ? "Marque mensalidades recebidas ou adicione despesas da empresa." : "Adicione sua renda (pró-labore) e seus gastos pessoais."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((it) => {
            // Mensalidade pendente projetada: ainda não é fin_record, então não
            // tem editar/excluir; a ação é "Marcar recebido" (vira fin_record).
            if (it.kind === "monthly") {
              const m = it.m;
              const venc = new Date(m.due_date + "T00:00:00").toLocaleDateString("pt-BR");
              return (
                <div key={`m-${m.id}`} className="group rounded-2xl border border-dashed border-border bg-card p-3.5 sm:p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-green-100 text-green-700">
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-display font-bold text-foreground leading-snug">Mensalidade, {it.nome}</p>
                      <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                        vence {venc} · Mensalidade · a receber
                        {it.atrasada ? " · vencida" : ""}
                      </p>
                    </div>
                    <span className="text-sm font-display font-extrabold shrink-0 whitespace-nowrap text-green-700">
                      +{brl(Number(m.amount))}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-border/60">
                    <span className={cn("text-[11px] font-bold rounded-full px-2.5 py-1.5", it.atrasada ? STATUS_STYLE.atrasado : STATUS_STYLE.pendente)}>
                      {it.atrasada ? "Atrasado" : "Pendente"}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button size="sm" className="h-8" onClick={() => confirmMonthly.mutate({ m, clientName: it.nome })} disabled={confirmMonthly.isPending}>
                        <Check className="h-3 w-3 mr-1" /> Marcar recebido
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }
            const r = it.rec;
            const isIn = r.type === "entrada";
            return (
              // No mobile a descrição, o status e o valor brigavam pelo mesmo espaço e
              // sobrava "Paul...". Agora: linha 1 = descrição + valor. Linha 2 = data,
              // categoria, cliente. Linha 3 = status e ações. Nada é cortado.
              <div key={r.id} className="group rounded-2xl border border-border bg-card p-3.5 sm:p-4">
                <div className="flex items-start gap-3">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", isIn ? "bg-green-100 text-green-700" : "bg-destructive/10 text-destructive")}>
                    {isIn ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-display font-bold text-foreground leading-snug">{r.description}</p>
                    <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                      {new Date(r.date + "T00:00:00").toLocaleDateString("pt-BR")}
                      {r.category ? ` · ${r.category}${r.subcategory ? ` › ${r.subcategory}` : ""}` : ""}
                      {clientName(r.crm_client_id) ? ` · ${clientName(r.crm_client_id)}` : ""}
                      {r.transfer_group ? " · ↔ transferência" : ""}
                    </p>
                  </div>
                  <span className={cn("text-sm font-display font-extrabold shrink-0 whitespace-nowrap", isIn ? "text-green-700" : "text-destructive")}>
                    {isIn ? "+" : "−"}{brl(Number(r.amount))}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-border/60">
                  {/* Status editável direto na lista (antes era só um badge de leitura). */}
                  <select value={r.status} onClick={(e) => e.stopPropagation()}
                    onChange={(e) => upd.mutate({ id: r.id, status: e.target.value as FinStatus })}
                    className={cn("text-[11px] font-bold rounded-full px-2.5 py-1.5 border-0 outline-none cursor-pointer", STATUS_STYLE[r.status])}>
                    {(["pendente", "pago", "atrasado"] as FinStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setDialog(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => { if (r.transfer_group) { if (await confirmar({ titulo: "Excluir esta transferência?", descricao: "Ela existe nos dois lados: sai da Empresa e do Pessoal ao mesmo tempo." })) delGroup.mutate(r.transfer_group); } else if (await confirmar({ titulo: "Excluir este lançamento?" })) del.mutate(r.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {dialog && (
        <RecordDialog key={editing?.id ?? "new"} record={editing} context={ctx} clients={clients} defaultDate={monthDate} defaultCats={DEFAULT_CATS[ctx]} customCats={customCats} defaultSubs={DEFAULT_SUBCATS[ctx]} customSubs={customSubs} onAddCategory={addCategory} onAddSubcategory={addSubcategory} onClose={() => { setDialog(false); setEditing(null); }} />
      )}
      <FinCompanyDialog open={companyOpen} onOpenChange={setCompanyOpen} />
      <FinRecurringDialog open={recurringOpen} onOpenChange={setRecurringOpen} ctx={ctx} defaultCats={DEFAULT_CATS[ctx]} customCats={customCats} defaultSubs={DEFAULT_SUBCATS[ctx]} customSubs={customSubs} />
      <FinTransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// PESSOA FÍSICA, no padrão do Atlas.
//
// Antes eram três cartõezinhos (entrou / gastou / sobrou) e ponto. Isso não
// é gestão pessoal, é um extrato. O Atlas responde três perguntas que faltavam:
//   1. Quanto sobra de verdade depois das contas fixas que ainda vão cair?
//   2. Pra onde vai meu dinheiro? (gasto por categoria, com peso)
//   3. Quanto eu consigo guardar? (reserva do mês)
// ═══════════════════════════════════════════════════════════════════════
function PessoalVisao({ recebido, despesas, monthCtx, recurring, fin, ym, onNovo }: {
  recebido: number;
  despesas: number;
  monthCtx: FinRecord[];
  recurring: FinRecurring[];
  fin: { reservePct?: number };
  ym: { y: number; m: number };
  onNovo: () => void;
}) {
  // Contas fixas do mês que AINDA não foram lançadas, é o que muda a conta do "sobra".
  const fixasPendentes = recurring.filter(
    (t) => t.active && (t.context ?? "pj") === "pf" && t.type === "despesa" &&
      !monthCtx.some((r) => r.recurring_id === t.id),
  );
  const aPagarFixo = fixasPendentes.reduce((s, t) => s + Number(t.amount), 0);

  const jaGastou = despesas;
  const sobraReal = recebido - jaGastou - aPagarFixo;   // ← a conta honesta
  const comprometido = recebido > 0 ? ((jaGastou + aPagarFixo) / recebido) * 100 : 0;

  // Pra onde vai o dinheiro.
  const porCat = useMemo(() => {
    const map = new Map<string, number>();
    monthCtx.filter((r) => r.type === "despesa").forEach((r) => {
      const k = r.category?.trim() || "Sem categoria";
      map.set(k, (map.get(k) ?? 0) + Number(r.amount));
    });
    fixasPendentes.forEach((t) => {
      const k = t.category?.trim() || "Contas fixas";
      map.set(k, (map.get(k) ?? 0) + Number(t.amount));
    });
    const total = [...map.values()].reduce((s, v) => s + v, 0);
    return [...map.entries()]
      .map(([cat, v]) => ({ cat, v, pct: total > 0 ? (v / total) * 100 : 0 }))
      .sort((a, b) => b.v - a.v);
  }, [monthCtx, fixasPendentes]);

  const metaPct = Number(fin.reservePct) || 0;
  const metaReserva = recebido * metaPct / 100;
  const guardado = Math.max(0, sobraReal);
  const atingido = metaReserva > 0 ? Math.min(100, (guardado / metaReserva) * 100) : 0;

  return (
    <>
      {/* SOBRA REAL, a única métrica que importa no fim do mês. */}
      <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 mb-3">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider">Sobra real de {MONTHS[ym.m]}</p>
            <p className={cn("text-3xl font-display font-extrabold mt-0.5", sobraReal >= 0 ? "text-foreground" : "text-red-500")}>{brl(sobraReal)}</p>
            <p className="text-[12px] font-body text-muted-foreground mt-0.5">
              {brl(recebido)} entrou − {brl(jaGastou)} já gasto
              {aPagarFixo > 0 && <> − <strong className="text-foreground">{brl(aPagarFixo)}</strong> de contas fixas que ainda vão cair</>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider">Comprometido</p>
            <p className={cn("text-2xl font-display font-extrabold mt-0.5", comprometido > 90 ? "text-red-500" : comprometido > 70 ? "text-amber-600" : "text-green-600")}>
              {recebido > 0 ? `${comprometido.toFixed(0)}%` : "-"}
            </p>
            <p className="text-[12px] font-body text-muted-foreground mt-0.5">da sua renda do mês</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Metric label="Entrou" value={brl(recebido)} tone="green" />
        <Metric label="Já gastou" value={brl(jaGastou)} tone="red" />
        <Metric label="Contas a pagar" value={brl(aPagarFixo)} tone="amber"
          hint={fixasPendentes.length ? `${fixasPendentes.length} conta(s) fixa(s)` : "nada a vencer"} />
        <Metric label="Sobra" value={brl(sobraReal)} tone={sobraReal >= 0 ? "green" : "red"} hint="depois de tudo" />
      </div>

      {/* CONTAS FIXAS DO MÊS, o que ainda vai cair, com o que fazer. */}
      {fixasPendentes.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] p-4 mb-5">
          <p className="text-sm font-display font-bold text-foreground mb-1">Contas fixas que ainda vão cair</p>
          <p className="text-[11.5px] font-body text-muted-foreground mb-3">
            Já estão descontadas da sua sobra. Use “Lançar do mês” lá em cima pra registrar todas de uma vez.
          </p>
          <div className="space-y-1.5">
            {fixasPendentes.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl bg-card border border-border px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-body font-medium text-foreground truncate">{t.description}</p>
                  <p className="text-[11px] font-body text-muted-foreground">vence dia {t.due_day}{t.category ? ` · ${t.category}` : ""}</p>
                </div>
                <span className="text-sm font-display font-bold text-destructive shrink-0">−{brl(Number(t.amount))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PRA ONDE VAI O DINHEIRO */}
      <div className="rounded-2xl border border-border bg-card p-4 mb-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-display font-bold text-foreground">Pra onde vai o seu dinheiro</h3>
          <span className="text-[11px] font-body text-muted-foreground">inclui as contas a vencer</span>
        </div>
        {porCat.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-[12.5px] font-body text-muted-foreground mb-3">Nenhum gasto em {MONTHS[ym.m]} ainda.</p>
            <Button size="sm" variant="outline" onClick={onNovo}><Plus className="h-3.5 w-3.5 mr-1.5" /> Lançar um gasto</Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {porCat.map((c) => (
              <div key={c.cat}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[12.5px] font-body font-medium text-foreground truncate">{c.cat}</span>
                  <span className="text-[12.5px] font-body text-muted-foreground shrink-0">
                    <strong className="text-foreground">{brl(c.v)}</strong> · {c.pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-destructive/70" style={{ width: `${Math.max(2, c.pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RESERVA DO MÊS */}
      <div className="rounded-2xl border border-border bg-card p-4 mb-5">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="text-sm font-display font-bold text-foreground">Reserva do mês</h3>
          <span className="text-[11px] font-body text-muted-foreground">
            {metaPct > 0 ? <>meta: guardar {metaPct}% ({brl(metaReserva)})</> : "defina a meta em “Minha empresa”"}
          </span>
        </div>
        {metaPct > 0 ? (
          <>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden mb-2">
              <div className={cn("h-full rounded-full transition-all", atingido >= 100 ? "bg-green-600" : "bg-primary")} style={{ width: `${Math.max(2, atingido)}%` }} />
            </div>
            <p className="text-[12px] font-body text-muted-foreground">
              {guardado > 0
                ? <>Sobrou <strong className="text-foreground">{brl(guardado)}</strong>, {atingido >= 100 ? "meta batida 🎯" : `${atingido.toFixed(0)}% da meta`}</>
                : "Este mês não sobrou nada pra guardar."}
            </p>
          </>
        ) : (
          <p className="text-[12.5px] font-body text-muted-foreground">
            Quanto da sua renda você quer guardar todo mês? Defina em <strong>Minha empresa → Reserva</strong> e a barra passa a te cobrar.
          </p>
        )}
      </div>
    </>
  );
}

function Metric({ label, value, tone, hint }: { label: string; value: string; tone: "green" | "red" | "amber"; hint?: string }) {
  const c = tone === "green" ? "text-green-700" : tone === "red" ? "text-destructive" : "text-amber-600";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-body font-semibold">{label}</p>
      {/* break-words: uma mensalidade alta (ex.: R$ 120.000,00) quebra a linha em
          vez de estourar o card no grid de 2 colunas do mobile. */}
      <p className={cn("text-xl font-display font-extrabold mt-1 leading-tight tabular-nums break-words", c)}>{value}</p>
      {hint && <p className="text-[10.5px] font-body text-muted-foreground mt-0.5 leading-tight">{hint}</p>}
    </div>
  );
}

function MiniStat({ label, value, tone, hint }: { label: string; value: string; tone: "green" | "red" | "muted"; hint?: string }) {
  const c = tone === "green" ? "text-green-700" : tone === "red" ? "text-destructive" : "text-foreground";
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body font-semibold">{label}</p>
      <p className={cn("text-sm font-display font-bold mt-0.5 leading-tight tabular-nums break-words", c)}>{value}</p>
      {hint && <p className="text-[10px] font-body text-muted-foreground truncate" title={hint}>{hint}</p>}
    </div>
  );
}

function Alloc({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground font-body font-semibold">{label}</p>
      <p className="text-base font-display font-extrabold text-foreground mt-0.5 leading-tight tabular-nums break-words">{value}</p>
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
        receitas: recs.filter((r) => r.type === "entrada" && r.status === "pago").reduce((s, r) => s + Number(r.amount), 0),
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
    // Valor obrigatório: sem esta trava o lançamento salvava com R$ 0 (criação e edição).
    if (!f.amount || f.amount <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
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
      <DialogContent className="sm:max-w-lg">
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

          {/* Repetir todo mês, sem precisar abrir a tela de Recorrentes. */}
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
// CALENDÁRIO DE ENTRADAS E SAÍDAS. PJ e PF.
// Mostra o mês inteiro, dia a dia: mensalidades (no vencimento de cada
// cliente), lançamentos, e, o pulo do gato, os RECORRENTES ainda não
// lançados, como PREVISTO (tracejado). Assim dá pra navegar pros meses
// que vêm e enxergar a recorrência antes de ela virar lançamento.
// ═══════════════════════════════════════════════════════════════════
// A origem de cada evento. É o que permite AGIR: mensalidade tem confirmar/pular,
// lançamento tem status, previsto ainda não existe (só dá pra lançar).
type EvSrc =
  | { t: "monthly"; m: FinMonthly }
  | { t: "record"; r: FinRecord }
  | { t: "previsto"; tpl: FinRecurring };

type Ev = {
  id: string; day: number; kind: "receber" | "pagar";
  label: string; amount: number; done: boolean; previsto: boolean;
  src: EvSrc;
};

function CalendarioFinanceiro({ monthlies, billablePendingIds, records, recurring, pendingRecurring, ctx, ym, clientName, acoes }: {
  monthlies: FinMonthly[];
  billablePendingIds: Set<string>;
  records: FinRecord[];
  recurring: FinRecurring[];
  pendingRecurring: FinRecurring[];
  ctx: FinContext;
  ym: { y: number; m: number };
  clientName: (id: string | null) => string | null;
  acoes: {
    confirmarMensalidade: (m: FinMonthly, nome: string) => void;
    desfazerMensalidade: (m: FinMonthly) => void;
    pularMensalidade: (m: FinMonthly) => void;
    mudarStatus: (id: string, status: FinStatus) => void;
    editarLancamento: (r: FinRecord) => void;
    lancarRecorrentes: () => void;
    ocupado: boolean;
  };
}) {
  const first = new Date(ym.y, ym.m, 1);
  const lastDay = new Date(ym.y, ym.m + 1, 0).getDate();
  const startDow = first.getDay(); // domingo = 0 (semana começa no domingo)
  // Fuso BR: o realce de "hoje" no calendário precisa bater com o dia local BR.
  const hoje = hojeBR();
  const [diaAberto, setDiaAberto] = useState<number | null>(null);

  const evs = useMemo<Ev[]>(() => {
    const out: Ev[] = [];

    // 1) Mensalidades do mês (só PJ), cada uma no vencimento do cliente.
    //    Mantemos as PULADAS/PAGAS aqui: escondê-las tirava a chance de reverter.
    //    Mas a pendente que NÃO conta (paga à mão / cliente inativo-excluído) é
    //    pulada, pra o "entra R$" não somar dinheiro que já entrou ou fantasma.
    for (const m of monthlies) {
      if (m.status === "pendente" && !billablePendingIds.has(m.id)) continue;
      out.push({
        id: "m-" + m.id, day: Number(m.due_date.slice(8, 10)), kind: "receber",
        label: clientName(m.crm_client_id) ?? "Cliente", amount: Number(m.amount),
        done: m.status === "pago" || m.status === "pulado", previsto: false,
        src: { t: "monthly", m },
      });
    }

    // 2) Lançamentos reais do mês, entradas E despesas (antes só vinham as despesas).
    //    Pula os records materializados a partir de uma mensalidade (loop 1 já
    //    mostra esse item com o nome do cliente), senão o dia duplica.
    const fromMonthly = new Set(
      monthlies.map((m) => (m as { fin_record_id?: string | null }).fin_record_id).filter(Boolean) as string[],
    );
    for (const r of records) {
      if ((r.context ?? "pj") !== ctx) continue;
      if (fromMonthly.has(r.id)) continue;
      const d = new Date(r.date + "T00:00:00");
      if (d.getFullYear() !== ym.y || d.getMonth() !== ym.m) continue;
      out.push({
        id: "r-" + r.id, day: d.getDate(), kind: r.type === "entrada" ? "receber" : "pagar",
        label: r.description, amount: Number(r.amount), done: r.status === "pago", previsto: false,
        src: { t: "record", r },
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
        src: { t: "previsto", tpl: t },
      });
    }
    return out;
  }, [monthlies, billablePendingIds, records, recurring, pendingRecurring, ctx, ym, lastDay, clientName]);

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
          Cadastre recorrentes e o dia de pagamento dos clientes, o calendário se preenche sozinho, inclusive nos meses que vêm.
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
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] font-body">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> entra <strong className="text-foreground">{brl(totalReceber)}</strong></span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> sai <strong className="text-foreground">{brl(totalPagar)}</strong></span>
          <span className={cn("inline-flex items-center gap-1 font-bold", totalReceber - totalPagar >= 0 ? "text-green-700" : "text-red-600")}>
            saldo {brl(totalReceber - totalPagar)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <p key={i} className="text-[10px] uppercase tracking-wider font-body font-semibold text-muted-foreground text-center">
            <span className="sm:hidden">{d}</span>
            <span className="hidden sm:inline">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][i]}</span>
          </p>
        ))}
      </div>

      {/* MOBILE: o mês INTEIRO em 7 colunas, como todo calendário do mundo.
          Antes eu escondia os dias vazios e mostrava 2 colunas: virava uma lista
          desalinhada onde ninguém achava o dia 17. Agora o dia é um quadradinho
          com bolinhas coloridas (entra/sai); toca e o detalhe abre embaixo. */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {Array.from({ length: startDow }).map((_, i) => <div key={"e" + i} />)}
        {Array.from({ length: lastDay }, (_, i) => i + 1).map((day) => {
          const list = byDay.get(day) ?? [];
          const iso = `${ym.y}-${pad0(ym.m + 1)}-${pad0(day)}`;
          const isToday = iso === hoje;
          const aberto = diaAberto === day;
          const vazio = list.length === 0;
          const temEntrada = list.some((e) => e.kind === "receber");
          const temSaida = list.some((e) => e.kind === "pagar");
          const tudoResolvido = !vazio && list.every((e) => e.done);

          return (
            <button
              key={day}
              type="button"
              onClick={() => setDiaAberto(aberto ? null : day)}
              className={cn(
                "rounded-lg border text-left transition-all",
                "aspect-square p-1 flex flex-col items-center justify-center gap-1",   // mobile: quadradinho
                "sm:aspect-auto sm:min-h-[64px] sm:items-stretch sm:justify-start sm:p-1.5 sm:gap-0 sm:space-y-1",
                aberto ? "border-primary ring-2 ring-primary/30 bg-primary/[0.06]"
                  : isToday ? "border-primary bg-primary/5"
                  : vazio ? "border-border/50" : "border-border hover:border-primary/50",
              )}
              aria-label={`Dia ${day}${vazio ? ", sem movimento" : `, ${list.length} item(ns)`}`}
            >
              <span className={cn("text-[12px] sm:text-[11px] font-display font-bold",
                aberto || isToday ? "text-primary" : vazio ? "text-muted-foreground/45" : "text-foreground")}>
                {day}
              </span>

              {/* Mobile: bolinhas. Cabem no quadradinho e dizem o essencial. */}
              {!vazio && (
                <span className="flex items-center gap-0.5 sm:hidden">
                  {temEntrada && <span className={cn("h-1.5 w-1.5 rounded-full", tudoResolvido ? "bg-green-500/35" : "bg-green-500")} />}
                  {temSaida && <span className={cn("h-1.5 w-1.5 rounded-full", tudoResolvido ? "bg-red-500/35" : "bg-red-500")} />}
                </span>
              )}

              {/* Desktop: as etiquetas com valor, como antes. */}
              {list.map((e) => (
                <div key={e.id}
                  className={cn("hidden sm:block rounded px-1 py-0.5 text-[10px] font-body leading-tight truncate",
                    e.done && "opacity-50 line-through",
                    e.previsto && "border border-dashed opacity-80",
                    e.kind === "receber"
                      ? cn("text-green-700", e.previsto ? "border-green-600/40 bg-green-500/5" : "bg-green-500/10")
                      : cn("text-red-600", e.previsto ? "border-red-600/40 bg-red-500/5" : "bg-red-500/10"))}
                  title={`${e.label} · ${brl(e.amount)}${e.previsto ? " (previsto)" : ""}`}>
                  {e.kind === "receber" ? "+" : "−"}{brl(e.amount)} {e.label}
                </div>
              ))}
            </button>
          );
        })}
      </div>

      {/* ═══ PAINEL DO DIA ═══
          O calendário mostrava e não deixava fazer nada. Agora clicou no dia,
          as pendências daquele dia abrem aqui embaixo, com o botão de cada ação:
          marcar pago, desfazer, pular a mensalidade, mudar o status do lançamento. */}
      {diaAberto !== null && (
        <DiaDetalhe
          dia={diaAberto}
          mes={MONTHS[ym.m]}
          itens={byDay.get(diaAberto) ?? []}
          clientName={clientName}
          acoes={acoes}
          onFechar={() => setDiaAberto(null)}
        />
      )}
    </div>
  );
}

function DiaDetalhe({ dia, mes, itens, clientName, acoes, onFechar }: {
  dia: number;
  mes: string;
  itens: Ev[];
  clientName: (id: string | null) => string | null;
  acoes: {
    confirmarMensalidade: (m: FinMonthly, nome: string) => void;
    desfazerMensalidade: (m: FinMonthly) => void;
    pularMensalidade: (m: FinMonthly) => void;
    mudarStatus: (id: string, status: FinStatus) => void;
    editarLancamento: (r: FinRecord) => void;
    lancarRecorrentes: () => void;
    ocupado: boolean;
  };
  onFechar: () => void;
}) {
  const entra = itens.filter((e) => e.kind === "receber" && !e.done).reduce((s, e) => s + e.amount, 0);
  const sai = itens.filter((e) => e.kind === "pagar" && !e.done).reduce((s, e) => s + e.amount, 0);

  return (
    <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/[0.03] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <h4 className="text-sm font-display font-bold text-foreground">Dia {dia} de {mes}</h4>
          <p className="text-[11.5px] font-body text-muted-foreground">
            {itens.length === 0
              ? "Nada marcado neste dia."
              : <>{brl(entra)} a entrar · {brl(sai)} a sair</>}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onFechar}>Fechar</Button>
      </div>

      {itens.length === 0 ? (
        <p className="text-[12.5px] font-body text-muted-foreground py-2">Sem pendências neste dia.</p>
      ) : (
        <div className="space-y-2">
          {itens.map((e) => {
            const s = e.src;

            // ── MENSALIDADE: confirmar, desfazer, pular ──
            if (s.t === "monthly") {
              const m = s.m;
              const nome = clientName(m.crm_client_id) ?? "Cliente";
              return (
                <div key={e.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-body font-semibold text-foreground truncate">{nome}</p>
                    <p className="text-[11px] font-body text-muted-foreground">
                      Mensalidade
                      {m.status === "pulado" && m.skip_reason ? ` · pulada: ${m.skip_reason}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-display font-bold text-green-700 shrink-0">{brl(Number(m.amount))}</span>

                  {m.status === "pago" ? (
                    <>
                      <Badge className="bg-green-100 text-green-700 text-[10px] shrink-0">Recebido</Badge>
                      <Button size="sm" variant="outline" className="h-8 shrink-0" disabled={acoes.ocupado}
                        onClick={() => acoes.desfazerMensalidade(m)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Desfazer
                      </Button>
                    </>
                  ) : m.status === "pulado" ? (
                    <>
                      <Badge className="bg-muted text-muted-foreground text-[10px] shrink-0">Pulada</Badge>
                      <Button size="sm" variant="outline" className="h-8 shrink-0" disabled={acoes.ocupado}
                        onClick={() => acoes.desfazerMensalidade(m)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Reverter
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" className="h-8 shrink-0" disabled={acoes.ocupado}
                        onClick={() => acoes.confirmarMensalidade(m, nome)}>
                        <Check className="h-3 w-3 mr-1" /> Marcar recebido
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 shrink-0 text-muted-foreground" disabled={acoes.ocupado}
                        onClick={() => acoes.pularMensalidade(m)}>
                        <SkipForward className="h-3 w-3 mr-1" /> Pular
                      </Button>
                    </>
                  )}
                </div>
              );
            }

            // ── LANÇAMENTO: muda o status ali mesmo ──
            if (s.t === "record") {
              const r = s.r;
              const isIn = r.type === "entrada";
              return (
                <div key={e.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-body font-semibold text-foreground truncate">{r.description}</p>
                    <p className="text-[11px] font-body text-muted-foreground truncate">
                      {r.category ?? "sem categoria"}{clientName(r.crm_client_id) ? ` · ${clientName(r.crm_client_id)}` : ""}
                    </p>
                  </div>
                  <span className={cn("text-sm font-display font-bold shrink-0", isIn ? "text-green-700" : "text-destructive")}>
                    {isIn ? "+" : "−"}{brl(Number(r.amount))}
                  </span>
                  <select value={r.status} disabled={acoes.ocupado}
                    onChange={(ev) => acoes.mudarStatus(r.id, ev.target.value as FinStatus)}
                    className={cn("text-[11px] font-bold shrink-0 rounded-lg px-2 py-1.5 border-0 outline-none cursor-pointer", STATUS_STYLE[r.status])}>
                    {(["pendente", "pago", "atrasado"] as FinStatus[]).map((st) => (
                      <option key={st} value={st}>{STATUS_LABEL[st]}</option>
                    ))}
                  </select>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => acoes.editarLancamento(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            }

            // ── PREVISTO: ainda não existe como lançamento ──
            const tpl = s.tpl;
            return (
              <div key={e.id} className="rounded-xl border border-dashed border-border bg-card/60 p-3 flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-body font-semibold text-foreground truncate">{tpl.description}</p>
                  <p className="text-[11px] font-body text-muted-foreground">Previsto (recorrente ainda não lançado)</p>
                </div>
                <span className={cn("text-sm font-display font-bold shrink-0", tpl.type === "entrada" ? "text-green-700" : "text-destructive")}>
                  {tpl.type === "entrada" ? "+" : "−"}{brl(Number(tpl.amount))}
                </span>
                <Button size="sm" variant="outline" className="h-8 shrink-0" disabled={acoes.ocupado}
                  onClick={acoes.lancarRecorrentes}>
                  <Repeat className="h-3 w-3 mr-1" /> Lançar do mês
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// RELATÓRIO POR PERÍODO, extrai mês / ano / intervalo livre,
// com a evolução mês a mês e exportação em CSV.
// ═══════════════════════════════════════════════════════════════════
function RelatorioPeriodo({ records, ctx, clients = [], monthlies = [], mrr = 0, fin }: {
  records: FinRecord[]; ctx: FinContext;
  clients?: CrmClient[]; monthlies?: FinMonthly[]; mrr?: number; fin?: FinSettings;
}) {
  const hoje = parseDateOnly(hojeBR()); // fuso BR
  const [de, setDe] = useState(`${hoje.getFullYear()}-01-01`);
  const [ate, setAte] = useState(hojeBR());
  const isPj = ctx === "pj";

  const preset = (kind: "mes" | "ano" | "12m") => {
    const y = hoje.getFullYear(), m = hoje.getMonth();
    if (kind === "mes") { setDe(`${y}-${pad0(m + 1)}-01`); setAte(toISODateBR(new Date(y, m + 1, 0))); }
    else if (kind === "ano") { setDe(`${y}-01-01`); setAte(`${y}-12-31`); }
    else { const d = new Date(y, m - 11, 1); setDe(toISODateBR(d)); setAte(toISODateBR(new Date(y, m + 1, 0))); }
  };

  const rows = records.filter((r) => (r.context ?? "pj") === ctx && r.date >= de && r.date <= ate);
  const entradas = rows.filter((r) => r.type === "entrada" && r.status === "pago").reduce((s, r) => s + Number(r.amount), 0);
  const saidas = rows.filter((r) => r.type === "despesa").reduce((s, r) => s + Number(r.amount), 0);

  // ── Recorte da receita: mensalidade × avulso (só o que JÁ entrou). ──
  const mensalRecebida = rows.filter((r) => r.type === "entrada" && r.status === "pago" && (r.category ?? "") === "Mensalidade").reduce((s, r) => s + Number(r.amount), 0);
  const avulsaRecebida = entradas - mensalRecebida;

  // ── A receber no período: entradas lançadas ainda não pagas (pendente/atrasado). ──
  const aReceberRows = rows.filter((r) => r.type === "entrada" && r.status !== "pago");
  const aReceber = aReceberRows.reduce((s, r) => s + Number(r.amount), 0);

  // ── Inadimplência do MÊS CORRENTE (fin_monthly já vencido e não pago). ──
  // Fonte real: as instâncias do mês, MESMA regra billable das outras abas
  // (tira a paga à mão e o cliente inativo/excluído, senão vira inadimplente falso).
  const hojeStr = hojeBR();
  const mesCorrente = hojeStr.slice(0, 7);
  const inadimplentes = billablePendingMonthlies(monthlies, records, clients, mesCorrente)
    .filter((m) => m.due_date < hojeStr)
    .map((m) => ({ nome: clients.find((c) => c.id === m.crm_client_id)?.name ?? "Cliente", valor: Number(m.amount), venc: m.due_date }))
    .sort((a, b) => b.valor - a.valor);
  const inadimplenciaTotal = inadimplentes.reduce((s, i) => s + i.valor, 0);

  // ── Ranking por cliente no período: receita recebida, custo e margem. ──
  const nomeCliente = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "Sem cliente";
  const porCliente = useMemo(() => {
    const map = new Map<string, { recebido: number; custo: number }>();
    for (const r of rows) {
      if (!r.crm_client_id) continue;
      const cur = map.get(r.crm_client_id) ?? { recebido: 0, custo: 0 };
      if (r.type === "entrada" && r.status === "pago") cur.recebido += Number(r.amount);
      else if (r.type === "despesa") cur.custo += Number(r.amount);
      map.set(r.crm_client_id, cur);
    }
    const receitaTotal = [...map.values()].reduce((s, v) => s + v.recebido, 0);
    return [...map.entries()]
      .map(([id, v]) => {
        const imposto = taxOfClient(fin, v.recebido, receitaTotal);
        const margem = v.recebido - v.custo - imposto;
        return { id, nome: nomeCliente(id), ...v, imposto, margem, margemPct: v.recebido > 0 ? (margem / v.recebido) * 100 : 0 };
      })
      .filter((x) => x.recebido > 0 || x.custo > 0)
      .sort((a, b) => b.recebido - a.recebido);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, clients, fin]);
  const maxReceita = Math.max(1, ...porCliente.map((c) => c.recebido));
  // Ticket médio de MENSALIDADE: divide pela quantidade de clientes que pagaram
  // mensalidade no período (não por quem só teve avulso, que puxava o ticket pra baixo).
  const clientesComMensalidade = new Set(
    rows
      .filter((r) => r.type === "entrada" && r.status === "pago" && (r.category ?? "") === "Mensalidade" && r.crm_client_id)
      .map((r) => String(r.crm_client_id)),
  ).size;
  const ticketMedio = clientesComMensalidade > 0 ? mensalRecebida / clientesComMensalidade : 0;

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
        {/* Mobile: os dois campos de data dividem a linha (flex-1); no desktop voltam ao w-40 fixo. */}
        <div className="flex-1 min-w-[9rem]"><p className="text-[10px] font-body font-semibold text-muted-foreground uppercase mb-1">De</p><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-9 rounded-xl w-full sm:w-40" /></div>
        <div className="flex-1 min-w-[9rem]"><p className="text-[10px] font-body font-semibold text-muted-foreground uppercase mb-1">Até</p><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9 rounded-xl w-full sm:w-40" /></div>
        <div className="flex gap-1 flex-wrap">
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

      {/* ── RECEITA: mensalidade × avulso, e o que ainda falta receber ── */}
      {isPj && entradas > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Composição da receita recebida</p>
          <div className="h-2.5 rounded-full overflow-hidden flex bg-muted mb-2">
            <div className="h-full bg-primary" style={{ width: `${(mensalRecebida / entradas) * 100}%` }} title="Mensalidades" />
            <div className="h-full bg-emerald-400" style={{ width: `${(avulsaRecebida / entradas) * 100}%` }} title="Avulsas" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat label="Mensalidades" value={brl(mensalRecebida)} tone="green" hint={`${((mensalRecebida / entradas) * 100).toFixed(0)}% da receita`} />
            <MiniStat label="Avulsas" value={brl(avulsaRecebida)} tone="green" hint={`${((avulsaRecebida / entradas) * 100).toFixed(0)}% da receita`} />
            <MiniStat label="A receber" value={brl(aReceber)} tone="muted" hint={aReceberRows.length ? `${aReceberRows.length} lançamento(s)` : "nada pendente"} />
            <MiniStat label="Ticket médio" value={brl(ticketMedio)} tone="muted" hint="mensalidade ÷ clientes pagantes" />
          </div>
        </div>
      )}

      {/* ── INADIMPLÊNCIA: quem venceu neste mês e ainda não pagou ── */}
      {isPj && inadimplentes.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/[0.04] p-3">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
            <p className="text-[11px] font-body font-bold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Inadimplência do mês
            </p>
            <span className="text-[12px] font-display font-bold text-red-600">{brl(inadimplenciaTotal)}</span>
          </div>
          <div className="space-y-1">
            {inadimplentes.map((i) => (
              <div key={i.nome + i.venc} className="flex items-center gap-2 text-[12px] font-body">
                <span className="min-w-0 flex-1 truncate text-foreground">{i.nome}</span>
                <span className="text-muted-foreground shrink-0">venceu {i.venc.split("-").reverse().slice(0, 2).join("/")}</span>
                <span className="shrink-0 font-semibold text-red-600 tabular-nums">{brl(i.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RANKING POR CLIENTE: receita, custo e margem no período ── */}
      {isPj && porCliente.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Receita por cliente (recebido no período)</p>
          <div className="space-y-2">
            {porCliente.slice(0, 8).map((c) => (
              <div key={c.id}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[12.5px] font-body font-medium text-foreground truncate min-w-0">{c.nome}</span>
                  <span className="text-[12px] font-body text-muted-foreground shrink-0 tabular-nums">
                    <strong className="text-foreground">{brl(c.recebido)}</strong>
                    {c.custo > 0 ? <> · custo {brl(c.custo)}</> : ""}
                    {" · "}<span className={cn("font-semibold", c.margem >= 0 ? "text-green-700" : "text-red-600")}>margem {brl(c.margem)}</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(2, (c.recebido / maxReceita) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          {porCliente.length > 8 && <p className="text-[10.5px] font-body text-muted-foreground mt-1.5">+{porCliente.length - 8} outro(s) cliente(s)</p>}
        </div>
      )}

      {/* ── PROJEÇÃO: com base na carteira atual (MRR) ── */}
      {isPj && mrr > 0 && (
        <div className="mb-4 rounded-xl border border-primary/20 bg-primary/[0.03] p-3">
          <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Projeção pela carteira atual</p>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Por mês" value={brl(mrr)} tone="green" hint="MRR da carteira" />
            <MiniStat label="Trimestre" value={brl(mrr * 3)} tone="muted" hint="3 meses" />
            <MiniStat label="12 meses" value={brl(mrr * 12)} tone="muted" hint="recorrência anual" />
          </div>
          <p className="text-[10.5px] font-body text-muted-foreground mt-2">
            Estimativa: mantém a carteira de hoje, sem contar avulsos nem reajustes. Clientes encerrados já saíram da conta.
          </p>
        </div>
      )}

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
              <div key={k} className="rounded-lg px-2 py-1.5 hover:bg-muted/40">
                {/* Desktop: linha única (mês · receita · custo · saldo). */}
                <div className="hidden sm:flex items-center gap-3">
                  <span className="text-[12px] font-body font-semibold text-foreground w-20 shrink-0 capitalize">{label}</span>
                  <span className="text-[12px] font-body text-green-700 shrink-0">+{brl(v.receita)}</span>
                  <span className="text-[12px] font-body text-red-600 shrink-0">−{brl(v.custo)}</span>
                  <span className={cn("text-[12px] font-display font-bold ml-auto shrink-0", saldo >= 0 ? "text-green-700" : "text-red-600")}>{brl(saldo)}</span>
                </div>
                {/* Mobile: mês + saldo em cima; receita e custo embaixo, pra três valores
                    em reais nunca estourarem a largura em 390px. */}
                <div className="sm:hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-body font-semibold text-foreground flex-1 min-w-0 truncate capitalize">{label}</span>
                    <span className={cn("text-[12px] font-display font-bold shrink-0", saldo >= 0 ? "text-green-700" : "text-red-600")}>{brl(saldo)}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11.5px] font-body text-green-700">+{brl(v.receita)}</span>
                    <span className="text-[11.5px] font-body text-red-600">−{brl(v.custo)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
