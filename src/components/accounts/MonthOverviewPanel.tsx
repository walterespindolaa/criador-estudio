import { useMemo, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ChevronLeft, ChevronRight, CalendarRange, CheckCircle2, Clock, RotateCcw, Eye, EyeOff } from "lucide-react";
import { useAllExternalPosts } from "@/hooks/useCriaPost";
import { toISODateBR, hojeBR, parseDateOnly } from "@/lib/date-br";

// Chave do localStorage pra lembrar se o painel está visível ou recolhido.
const OPEN_KEY = "home_month_overview_open";

// "Visão geral do mês": produção de posts do gestor (todos os clientes) agregada
// por status do Cria Post, pra a social mídia se organizar. Só dados reais do
// banco (useAllExternalPosts já traz os posts de TODOS os clientes do gestor).
//
// Os 5 status são exatamente os do kanban do Cria Post (approval_status):
// em_producao -> pendente(aguardando cliente) -> ajuste_solicitado -> aprovado -> postado.
// Não existem "revisão interna" nem "agendado" no schema, então não são inventados.

type StatusKey = "em_producao" | "pendente" | "ajuste_solicitado" | "aprovado" | "postado";

// Cores por status derivadas dos tokens do tema (src/index.css), pra o mesmo
// status ter a mesma cor no kanban do Cria Post e aqui, e acompanhar o tema
// quando ele mudar. Mapeamento espelha o STATUS do CriaPostBoard:
// em produção=lilás, aguardando=amarelo, ajuste=laranja CRIA, aprovado=verde,
// postado=muted (cinza). Usa hsl(var(--token)) em vez de hex fixo.
const STATUS_META: { key: StatusKey; label: string; color: string }[] = [
  { key: "em_producao", label: "Em produção", color: "hsl(var(--cria-lilas))" },
  { key: "pendente", label: "Aguardando cliente", color: "hsl(var(--cria-amarelo))" },
  { key: "ajuste_solicitado", label: "Ajuste solicitado", color: "hsl(var(--cria-laranja))" },
  { key: "aprovado", label: "Aprovado", color: "hsl(var(--cria-verde))" },
  { key: "postado", label: "Postado", color: "hsl(var(--muted-foreground))" },
];

// "YYYY-MM" de um post: usa a data agendada (o mês pra onde o post foi planejado);
// se não tiver data (típico de "Em produção"), cai no mês em que foi criado.
function postMonth(p: { scheduled_date: string | null; created_at: string }): string {
  if (p.scheduled_date) return p.scheduled_date.slice(0, 7);
  return toISODateBR(new Date(p.created_at)).slice(0, 7);
}

// Formata "YYYY-MM" em Date local do 1º dia do mês. Formatação de calendário,
// sem toISOString (que usaria UTC e poderia pular o mês à noite no BR).
function ymToDate(ym: string): Date {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1);
}
function monthLabel(ym: string): string {
  const d = ymToDate(ym);
  const s = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// YYYY-MM-DD de um Date local (getters locais, sem tz), pra montar a janela dos
// últimos dias sem risco de drift de fuso.
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function MonthOverviewPanel() {
  const { data: posts = [], isLoading } = useAllExternalPosts();

  const currentMonth = hojeBR().slice(0, 7);

  // Lista contígua de meses do mais antigo com post até o mês atual (inclusive),
  // ordenada do mais novo pro mais antigo. Garante navegação suave e o mês atual
  // sempre presente. Sem dados, é só o mês atual.
  const months = useMemo(() => {
    let earliest = currentMonth;
    for (const p of posts) {
      const m = postMonth(p);
      if (m < earliest) earliest = m;
    }
    const list: string[] = [];
    const cur = ymToDate(currentMonth);
    let cursor = ymToDate(earliest);
    while (cursor <= cur) {
      list.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return list.reverse();
  }, [posts, currentMonth]);

  const [month, setMonth] = useState(currentMonth);
  const idx = months.indexOf(month) === -1 ? 0 : months.indexOf(month);
  const goOlder = () => { if (idx < months.length - 1) setMonth(months[idx + 1]); };
  const goNewer = () => { if (idx > 0) setMonth(months[idx - 1]); };

  // Contagem por status do mês selecionado.
  const { counts, total } = useMemo(() => {
    const c: Record<StatusKey, number> = { em_producao: 0, pendente: 0, ajuste_solicitado: 0, aprovado: 0, postado: 0 };
    let t = 0;
    for (const p of posts) {
      if (postMonth(p) !== month) continue;
      const st = (p.approval_status ?? "pendente") as StatusKey;
      if (st in c) { c[st] += 1; t += 1; }
    }
    return { counts: c, total: t };
  }, [posts, month]);

  // Destaques: entregues (aprovado+postado) x em andamento (produção+aguardando+ajuste).
  const entregues = counts.aprovado + counts.postado;
  const andamento = counts.em_producao + counts.pendente + counts.ajuste_solicitado;

  // Mini evolução: posts CRIADOS por dia (created_at no fuso BR), últimos 14 dias,
  // + resumos de 7 e 30 dias. Base a partir de "hoje" BR pra bater com o calendário.
  const evolution = useMemo(() => {
    const created: Record<string, number> = {};
    for (const p of posts) {
      const d = toISODateBR(new Date(p.created_at));
      created[d] = (created[d] ?? 0) + 1;
    }
    const today = parseDateOnly(hojeBR());
    const days: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const key = ymd(d);
      days.push({ date: key, count: created[key] ?? 0 });
    }
    const cut7 = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6));
    const cut30 = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29));
    let last7 = 0, last30 = 0;
    for (const [k, v] of Object.entries(created)) {
      if (k >= cut30 && k <= ymd(today)) last30 += v;
      if (k >= cut7 && k <= ymd(today)) last7 += v;
    }
    const max = Math.max(1, ...days.map((d) => d.count));
    return { days, last7, last30, max };
  }, [posts]);

  const pieData = STATUS_META
    .map((s) => ({ key: s.key, name: s.label, value: counts[s.key], color: s.color }))
    .filter((d) => d.value > 0);

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  // Olhinho: recolhe o painel deixando só cabeçalho. Default aberto; persiste no
  // localStorage (só "0" oculta). Falha silenciosa se o storage não existir.
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(OPEN_KEY) !== "0"; } catch { return true; }
  });
  const toggleOpen = () => setOpen((v) => {
    const next = !v;
    try { localStorage.setItem(OPEN_KEY, next ? "1" : "0"); } catch { /* ignora */ }
    return next;
  });

  return (
    <section className="rounded-3xl border border-border bg-card p-4 sm:p-5 mb-8">
      {/* Cabeçalho + seletor de mês */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><CalendarRange className="h-4 w-4" /></span>
          <h2 className="text-sm font-display font-bold text-foreground truncate">Visão geral do mês</h2>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Seletor de mês só aparece quando o painel está expandido */}
          {open && (
            <>
              <button type="button" onClick={goOlder} disabled={idx >= months.length - 1}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors" aria-label="Mês anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-body font-bold text-foreground w-[92px] sm:w-[120px] text-center tabular-nums">{monthLabel(month)}</span>
              <button type="button" onClick={goNewer} disabled={idx <= 0}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors" aria-label="Próximo mês">
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
          {/* Olhinho: oculta/mostra o conteúdo do painel */}
          <button type="button" onClick={toggleOpen}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
            aria-label={open ? "Ocultar visão geral" : "Mostrar visão geral"} aria-pressed={!open}>
            {open ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Conteúdo do painel: some quando recolhido pelo olhinho */}
      {open && (<>
      {isLoading ? (
        <div className="h-48 rounded-2xl bg-muted animate-pulse" />
      ) : total === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center">
          <p className="text-sm font-body font-medium text-foreground">Nenhum post neste mês</p>
          <p className="text-xs text-muted-foreground font-body mt-1">Crie posts no Cria Post pra acompanhar a produção por aqui.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Donut com o total no centro */}
            <div className="relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={pieData.length > 1 ? 2 : 0} stroke="none">
                    {pieData.map((entry) => <Cell key={entry.key} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-display font-extrabold text-foreground leading-none tabular-nums">{total}</span>
                <span className="text-[11px] font-body text-muted-foreground mt-0.5">{total === 1 ? "post no mês" : "posts no mês"}</span>
              </div>
            </div>

            {/* Lista lateral: status + contagem + % */}
            <div className="flex flex-col justify-center gap-1.5">
              {STATUS_META.map((s) => {
                const n = counts[s.key];
                return (
                  <div key={s.key} className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-[13px] font-body text-foreground flex-1 min-w-0 truncate">{s.label}</span>
                    <span className="text-[13px] font-body font-bold text-foreground tabular-nums">{n}</span>
                    <span className="text-[11px] font-body text-muted-foreground tabular-nums w-9 text-right">{pct(n)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Linha de destaque: entregue x andamento + ajustes.
              Mesmas cores da paleta de status: entregue=verde (aprovado+postado),
              andamento=lilás (em produção), ajuste=laranja CRIA. Fundo/borda são
              tints do token e o número fica em text-foreground pra legibilidade
              nos dois temas. */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-xl border px-3 py-2.5" style={{ background: "hsl(var(--cria-verde) / 0.1)", borderColor: "hsl(var(--cria-verde) / 0.25)" }}>
              <p className="flex items-center gap-1 text-[10.5px] font-body font-bold uppercase tracking-wide" style={{ color: "hsl(var(--cria-verde))" }}><CheckCircle2 className="h-3 w-3" /> Entregues</p>
              <p className="text-lg font-display font-extrabold text-foreground leading-none mt-1 tabular-nums">{entregues}</p>
              <p className="text-[10.5px] font-body text-muted-foreground mt-0.5">aprovados + postados</p>
            </div>
            <div className="rounded-xl border px-3 py-2.5" style={{ background: "hsl(var(--cria-lilas) / 0.12)", borderColor: "hsl(var(--cria-lilas) / 0.3)" }}>
              <p className="flex items-center gap-1 text-[10.5px] font-body font-bold uppercase tracking-wide" style={{ color: "hsl(var(--cria-lilas))" }}><Clock className="h-3 w-3" /> Em andamento</p>
              <p className="text-lg font-display font-extrabold text-foreground leading-none mt-1 tabular-nums">{andamento}</p>
              <p className="text-[10.5px] font-body text-muted-foreground mt-0.5">{counts.pendente} aguardando cliente</p>
            </div>
            <div className="rounded-xl border px-3 py-2.5" style={{ background: "hsl(var(--cria-laranja) / 0.1)", borderColor: "hsl(var(--cria-laranja) / 0.25)" }}>
              <p className="flex items-center gap-1 text-[10.5px] font-body font-bold uppercase tracking-wide" style={{ color: "hsl(var(--cria-laranja))" }}><RotateCcw className="h-3 w-3" /> Ajuste</p>
              <p className="text-lg font-display font-extrabold text-foreground leading-none mt-1 tabular-nums">{counts.ajuste_solicitado}</p>
              <p className="text-[10.5px] font-body text-muted-foreground mt-0.5">precisam de ajuste</p>
            </div>
          </div>
        </>
      )}

      {/* Mini evolução: posts criados nos últimos dias (independe do mês selecionado) */}
      {!isLoading && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider">Posts criados</p>
            <p className="text-[11px] font-body text-muted-foreground">
              <span className="font-bold text-foreground tabular-nums">{evolution.last7}</span> em 7 dias · <span className="font-bold text-foreground tabular-nums">{evolution.last30}</span> em 30 dias
            </p>
          </div>
          {/* Barras dos últimos 14 dias (CSS puro) */}
          <div className="flex items-end gap-1 h-10">
            {evolution.days.map((d) => (
              <div key={d.date} className="flex-1 flex items-end" title={`${d.date.slice(8)}/${d.date.slice(5, 7)}: ${d.count} post(s)`}>
                <div className="w-full rounded-sm bg-primary/70" style={{ height: `${(d.count / evolution.max) * 100}%`, minHeight: d.count > 0 ? 3 : 1, opacity: d.count > 0 ? 1 : 0.25 }} />
              </div>
            ))}
          </div>
        </div>
      )}
      </>)}
    </section>
  );
}
