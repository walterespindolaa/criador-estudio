import { useMemo, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Minus, Users2, Wallet, Kanban } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { useProdutividadePeriodo, computeProdStats } from "@/hooks/useProdutividade";
import { useFinRecords } from "@/hooks/useFinance";
import { useCrmClients } from "@/hooks/useCrm";
import { clienteInativo } from "@/lib/cliente-status";
import { formatBRL } from "@/lib/money";
import { hojeBR, parseDateOnly } from "@/lib/date-br";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   RELATÓRIO GERENCIAL DA OPERAÇÃO (31/08) · pedido do Walter (#284)

   A visão de DONA DE NEGÓCIO da social mídia: produção + financeiro + carteira
   (novos, encerrados, ativos) num período que ela escolhe (mês, semestre, ano
   ou datas livres), SEMPRE comparado com o período anterior de mesmo tamanho.
   Nada aqui é métrica inventada: produção vem do useProdutividade (as mesmas
   contagens do relatório de produtividade), dinheiro vem do fin_records do
   Caixa e carteira vem das fichas do CRM.
   ═══════════════════════════════════════════════════════════════════════════ */

type Modo = "mes" | "semestre" | "ano" | "personalizado";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const diaAntes = (s: string) => { const d = parseDateOnly(s); d.setDate(d.getDate() - 1); return iso(d); };

function rotuloPeriodo(from: string, to: string) {
  const f = (s: string) => parseDateOnly(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  return `${f(from)} a ${f(to)}`;
}

/** Período atual + o anterior de MESMO tamanho, por modo. */
function calcularPeriodos(modo: Modo, mes: string, semestre: string, ano: string, de: string, ate: string) {
  if (modo === "mes" && /^\d{4}-\d{2}$/.test(mes)) {
    const [y, m] = mes.split("-").map(Number);
    const from = `${mes}-01`;
    const to = iso(new Date(y, m, 0));
    const prevY = m === 1 ? y - 1 : y, prevM = m === 1 ? 12 : m - 1;
    const pFrom = `${prevY}-${String(prevM).padStart(2, "0")}-01`;
    const pTo = iso(new Date(prevY, prevM, 0));
    return { from, to, pFrom, pTo };
  }
  if (modo === "semestre") {
    const [yS, hS] = semestre.split("-");
    const y = Number(yS); const h = hS === "2" ? 2 : 1;
    const from = h === 1 ? `${y}-01-01` : `${y}-07-01`;
    const to = h === 1 ? `${y}-06-30` : `${y}-12-31`;
    const pFrom = h === 1 ? `${y - 1}-07-01` : `${y}-01-01`;
    const pTo = h === 1 ? `${y - 1}-12-31` : `${y}-06-30`;
    return { from, to, pFrom, pTo };
  }
  if (modo === "ano" && /^\d{4}$/.test(ano)) {
    const y = Number(ano);
    return { from: `${y}-01-01`, to: `${y}-12-31`, pFrom: `${y - 1}-01-01`, pTo: `${y - 1}-12-31` };
  }
  // Personalizado: o anterior tem o MESMO número de dias, terminando na véspera.
  const fromD = parseDateOnly(de), toD = parseDateOnly(ate);
  const dias = Math.max(1, Math.round((toD.getTime() - fromD.getTime()) / 86400000) + 1);
  const pTo = diaAntes(de);
  const pFromD = parseDateOnly(pTo); pFromD.setDate(pFromD.getDate() - (dias - 1));
  return { from: de, to: ate, pFrom: iso(pFromD), pTo };
}

function Delta({ atual, anterior, invertido }: { atual: number; anterior: number; invertido?: boolean }) {
  if (anterior === 0 && atual === 0) return <span className="text-[11px] font-body text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" /> sem base</span>;
  if (anterior === 0) return <span className="text-[11px] font-body text-muted-foreground">novo no período</span>;
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  const bom = invertido ? pct <= 0 : pct >= 0;
  const Icone = pct === 0 ? Minus : pct > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cn("text-[11px] font-body font-bold flex items-center gap-0.5", pct === 0 ? "text-muted-foreground" : bom ? "text-emerald-600" : "text-red-500")}>
      <Icone className="h-3 w-3" /> {pct > 0 ? "+" : ""}{pct}% vs anterior
    </span>
  );
}

function CardNumero({ titulo, valor, anterior, formato, invertido }: { titulo: string; valor: number; anterior: number; formato?: "brl" | "n"; invertido?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] font-body font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="text-2xl font-display font-extrabold text-foreground mt-1 tabular-nums">
        {formato === "brl" ? formatBRL(valor, { zeroAsDash: false }) : valor.toLocaleString("pt-BR")}
      </p>
      <div className="mt-1"><Delta atual={valor} anterior={anterior} invertido={invertido} /></div>
    </div>
  );
}

function Secao({ icone: Icone, titulo, children }: { icone: typeof BarChart3; titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-display font-extrabold uppercase tracking-wide text-foreground">
        <span className="w-7 h-7 rounded-lg bg-primary/10 grid place-items-center text-primary"><Icone className="h-4 w-4" /></span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export default function RelatorioGerencial() {
  const hoje = hojeBR();
  const [modo, setModo] = useState<Modo>("mes");
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [semestre, setSemestre] = useState(`${hoje.slice(0, 4)}-${Number(hoje.slice(5, 7)) <= 6 ? "1" : "2"}`);
  const [ano, setAno] = useState(hoje.slice(0, 4));
  const [de, setDe] = useState(`${hoje.slice(0, 7)}-01`);
  const [ate, setAte] = useState(hoje);

  const { from, to, pFrom, pTo } = useMemo(
    () => calcularPeriodos(modo, mes, semestre, ano, de, ate),
    [modo, mes, semestre, ano, de, ate],
  );

  // Produção: as MESMAS contagens do relatório de produtividade, em dois períodos.
  const atualQ = useProdutividadePeriodo(from, to, true);
  const antQ = useProdutividadePeriodo(pFrom, pTo, true);
  const prod = useMemo(() => computeProdStats(atualQ.data, from, to), [atualQ.data, from, to]);
  const prodAnt = useMemo(() => computeProdStats(antQ.data, pFrom, pTo), [antQ.data, pFrom, pTo]);

  // Financeiro: lançamentos PJ do Caixa desde o começo do período anterior.
  const { data: fin = [] } = useFinRecords({ since: pFrom });
  const somaFin = (a: string, b: string, tipo: "entrada" | "saida") => fin
    .filter((r) => (r.context ?? "pj") === "pj" && r.type === tipo && r.status === "pago" && String(r.date) >= a && String(r.date) <= b)
    .reduce((s, r) => s + Number(r.amount), 0);
  const recebido = somaFin(from, to, "entrada");
  const recebidoAnt = somaFin(pFrom, pTo, "entrada");
  const despesas = somaFin(from, to, "saida");
  const despesasAnt = somaFin(pFrom, pTo, "saida");

  // Carteira/churn: fichas do CRM. Novo = ficha criada no período; encerrado =
  // contrato com fim dentro do período; ativos = a foto de hoje.
  const { data: clients = [] } = useCrmClients();
  const dentro = (isoStr: string | null | undefined, a: string, b: string) => {
    if (!isoStr) return false;
    const d = String(isoStr).slice(0, 10);
    return d >= a && d <= b;
  };
  const novosC = clients.filter((c) => dentro(c.created_at, from, to)).length;
  const novosAnt = clients.filter((c) => dentro(c.created_at, pFrom, pTo)).length;
  const encerrados = clients.filter((c) => dentro((c as { contract_end_date?: string | null }).contract_end_date, from, to)).length;
  const encerradosAnt = clients.filter((c) => dentro((c as { contract_end_date?: string | null }).contract_end_date, pFrom, pTo)).length;
  const ativos = clients.filter((c) => !clienteInativo(c)).length;

  const dadosProducao = [
    { nome: "Posts", Atual: prod.posts.total, Anterior: prodAnt.posts.total },
    { nome: "Publicados", Atual: prod.posts.publicados, Anterior: prodAnt.posts.publicados },
    { nome: "Captações", Atual: prod.capt.total, Anterior: prodAnt.capt.total },
    { nome: "Tarefas concl.", Atual: prod.tarefas.concluidas, Anterior: prodAnt.tarefas.concluidas },
    { nome: "Criações", Atual: prod.criacoes, Anterior: prodAnt.criacoes },
  ];
  const dadosFin = [
    { nome: "Recebido", Atual: recebido, Anterior: recebidoAnt },
    { nome: "Despesas", Atual: despesas, Anterior: despesasAnt },
    { nome: "Saldo", Atual: recebido - despesas, Anterior: recebidoAnt - despesasAnt },
  ];

  const carregando = atualQ.isLoading || antQ.isLoading;

  return (
    <div className="pb-20 md:pb-6 space-y-6">
      {/* Seletor de período + comparativo sempre visível */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {([["mes", "Mensal"], ["semestre", "Semestre"], ["ano", "Anual"], ["personalizado", "Personalizado"]] as [Modo, string][]).map(([m, l]) => (
            <button key={m} type="button" onClick={() => setModo(m)}
              className={cn("px-3.5 py-1.5 rounded-full text-xs font-body border transition-colors",
                modo === m ? "bg-primary text-primary-foreground border-primary font-semibold" : "border-border text-muted-foreground hover:text-foreground")}>
              {l}
            </button>
          ))}
          {/* No celular o grupo de datas quebra pra linha de baixo em vez de espremer. */}
          <div className="flex items-center gap-2 flex-wrap sm:ml-auto w-full sm:w-auto">
            {modo === "mes" && <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="h-8 w-40 rounded-xl text-xs" />}
            {modo === "semestre" && (
              <select value={semestre} onChange={(e) => setSemestre(e.target.value)} className="h-8 rounded-xl border border-border bg-card px-2 text-xs font-body">
                {[0, 1, 2].map((back) => {
                  const y = Number(hoje.slice(0, 4)) - back;
                  return [`${y}-2`, `${y}-1`].map((v) => (
                    <option key={v} value={v}>{v.endsWith("1") ? `1º semestre ${v.slice(0, 4)}` : `2º semestre ${v.slice(0, 4)}`}</option>
                  ));
                })}
              </select>
            )}
            {modo === "ano" && (
              <select value={ano} onChange={(e) => setAno(e.target.value)} className="h-8 rounded-xl border border-border bg-card px-2 text-xs font-body">
                {[0, 1, 2, 3].map((back) => { const y = Number(hoje.slice(0, 4)) - back; return <option key={y} value={String(y)}>{y}</option>; })}
              </select>
            )}
            {modo === "personalizado" && (
              <>
                <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-8 w-36 rounded-xl text-xs" />
                <span className="text-xs text-muted-foreground">até</span>
                <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-8 w-36 rounded-xl text-xs" />
              </>
            )}
          </div>
        </div>
        <p className="text-[11px] font-body text-muted-foreground">
          Período: <span className="font-semibold text-foreground">{rotuloPeriodo(from, to)}</span> · comparado com <span className="font-semibold">{rotuloPeriodo(pFrom, pTo)}</span>
          {carregando && " · carregando..."}
        </p>
      </div>

      {/* ── CARTEIRA ── */}
      <Secao icone={Users2} titulo="Carteira de clientes">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <CardNumero titulo="Clientes ativos hoje" valor={ativos} anterior={ativos} />
          <CardNumero titulo="Novos no período" valor={novosC} anterior={novosAnt} />
          <CardNumero titulo="Encerrados (churn)" valor={encerrados} anterior={encerradosAnt} invertido />
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] font-body font-semibold uppercase tracking-wide text-muted-foreground">Saldo da carteira</p>
            <p className={cn("text-2xl font-display font-extrabold mt-1 tabular-nums", novosC - encerrados >= 0 ? "text-emerald-600" : "text-red-500")}>
              {novosC - encerrados >= 0 ? "+" : ""}{novosC - encerrados}
            </p>
            <p className="text-[11px] font-body text-muted-foreground mt-1">novos menos encerrados</p>
          </div>
        </div>
      </Secao>

      {/* ── PRODUÇÃO ── */}
      <Secao icone={Kanban} titulo="Produção">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <CardNumero titulo="Posts no período" valor={prod.posts.total} anterior={prodAnt.posts.total} />
          <CardNumero titulo="Publicados" valor={prod.posts.publicados} anterior={prodAnt.posts.publicados} />
          <CardNumero titulo="Captações" valor={prod.capt.total} anterior={prodAnt.capt.total} />
          <CardNumero titulo="Tarefas concluídas" valor={prod.tarefas.concluidas} anterior={prodAnt.tarefas.concluidas} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-body font-semibold text-muted-foreground mb-2">Atual x período anterior</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosProducao} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000014" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                <Tooltip cursor={{ fill: "#00000008" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Anterior" fill="#D8C9CF" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Atual" fill="#A02348" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {prod.formatos.length > 0 && (
            <p className="text-[11px] font-body text-muted-foreground mt-2">
              Por formato: {prod.formatos.slice(0, 5).map((f) => `${f.code} ${f.total}`).join(" · ")}
            </p>
          )}
        </div>
      </Secao>

      {/* ── FINANCEIRO ── */}
      <Secao icone={Wallet} titulo="Financeiro (Caixa PJ, valores pagos)">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <CardNumero titulo="Recebido" valor={recebido} anterior={recebidoAnt} formato="brl" />
          <CardNumero titulo="Despesas" valor={despesas} anterior={despesasAnt} formato="brl" invertido />
          <CardNumero titulo="Saldo" valor={recebido - despesas} anterior={recebidoAnt - despesasAnt} formato="brl" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosFin} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000014" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={64}
                  tickFormatter={(v: number) => formatBRL(v, { zeroAsDash: false }).replace(",00", "")} />
                <Tooltip cursor={{ fill: "#00000008" }} formatter={(v: number) => formatBRL(v, { zeroAsDash: false })} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Anterior" fill="#D8C9CF" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Atual" fill="#0F6E56" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] font-body text-muted-foreground mt-2">
            Fonte: lançamentos do Cria Caixa (PJ) com status pago. Relatórios de períodos muito longos podem truncar lançamentos antigos (limite de 2.000).
          </p>
        </div>
      </Secao>
    </div>
  );
}
