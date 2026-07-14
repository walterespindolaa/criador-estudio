import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cpu, DollarSign, Image as ImageIcon, Search, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/money";

/* ═══════════════════════════════════════════════════════════════════════════
   BENCHMARK DAS IAs

   Você paga por cada IA que roda: o gateway (legendas, roteiros, ideias), o
   Apify (Cria Radar) e o Higgsfield (geração de imagem). Até agora esses custos
   eram invisíveis — dava pra descobrir que estava caro só olhando a fatura.

   Esta tela responde três perguntas, que são as que decidem upgrade e preço:
   1. Quanto está sendo USADO (e por quem)?
   2. Quanto isso está CUSTANDO?
   3. A cota que eu vendi está apertada ou sobrando?
   ═══════════════════════════════════════════════════════════════════════════ */

const USD_BRL = 5.6; // referência pra leitura; o que vale é o dólar da fatura

type Periodo = 30 | 90;

function Card({ icon: Icon, titulo, valor, sub, alerta }: {
  icon: typeof Cpu; titulo: string; valor: string; sub?: string; alerta?: boolean;
}) {
  return (
    <div className={`rounded-2xl border bg-card p-4 ${alerta ? "border-amber-500/40 bg-amber-500/[0.03]" : "border-border"}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`grid h-8 w-8 place-items-center rounded-xl ${alerta ? "bg-amber-500/15 text-amber-600" : "bg-muted text-foreground/70"}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[12px] font-body font-semibold text-muted-foreground">{titulo}</span>
      </div>
      <p className="font-display text-2xl font-extrabold text-foreground tabular-nums leading-none">{valor}</p>
      {sub && <p className="text-[11px] font-body text-muted-foreground mt-1.5 leading-tight">{sub}</p>}
    </div>
  );
}

export function AdminBenchmarks() {
  const [dias, setDias] = useState<Periodo>(30);
  const desde = useMemo(() => new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString(), [dias]);

  // ── Cria IA (gateway): o contador mensal por usuário ──
  const ia = useQuery({
    queryKey: ["bench-ia", dias],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_rate_limit")
        .select("user_id, call_count, window_start")
        .gte("window_start", desde);
      const rows = (data ?? []) as { user_id: string; call_count: number }[];
      const total = rows.reduce((s, r) => s + (r.call_count ?? 0), 0);
      const porUsuario = new Map<string, number>();
      for (const r of rows) porUsuario.set(r.user_id, (porUsuario.get(r.user_id) ?? 0) + (r.call_count ?? 0));
      const top = [...porUsuario.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      return { total, usuarios: porUsuario.size, top };
    },
  });

  // ── Cria Radar (Apify): custo REAL, que agora vem do run ──
  const hub = useQuery({
    queryKey: ["bench-hub", dias],
    queryFn: async () => {
      const { data } = await supabase
        .from("competitor_scrapes")
        .select("scrape_type, cost_usd, status, manager_id")
        .gte("created_at", desde);
      const rows = (data ?? []) as { scrape_type: string; cost_usd: number | null; status: string; manager_id: string }[];
      const custo = rows.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
      const porTipo = new Map<string, { n: number; usd: number }>();
      for (const r of rows) {
        const e = porTipo.get(r.scrape_type) ?? { n: 0, usd: 0 };
        e.n += 1; e.usd += Number(r.cost_usd) || 0;
        porTipo.set(r.scrape_type, e);
      }
      const erros = rows.filter((r) => r.status === "error").length;
      return {
        total: rows.length,
        custo,
        erros,
        contas: new Set(rows.map((r) => r.manager_id)).size,
        tipos: [...porTipo.entries()].sort((a, b) => b[1].usd - a[1].usd),
      };
    },
  });

  // ── Cria Estúdio (Higgsfield): quantas imagens ──
  const estudio = useQuery({
    queryKey: ["bench-estudio", dias],
    queryFn: async () => {
      const { count } = await supabase
        .from("higgsfield_jobs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", desde);
      return { total: count ?? 0 };
    },
  });

  const custoHubUsd = hub.data?.custo ?? 0;
  const custoHubMes = dias === 30 ? custoHubUsd : custoHubUsd / 3;
  // O Apify cobra US$49 de plataforma mesmo sem uso. Ele é o piso do custo.
  const custoTotalMes = custoHubMes + 49;
  const contasHub = hub.data?.contas ?? 0;
  // Regra que o Walter definiu: o custo variável não pode passar de 50% do preço.
  const receitaHub = contasHub * 49.9;
  const pctCusto = receitaHub > 0 ? Math.round(((custoHubMes * USD_BRL) / receitaHub) * 100) : 0;
  const taxaErro = hub.data?.total ? Math.round(((hub.data.erros ?? 0) / hub.data.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-extrabold text-foreground">Benchmark das IAs</h2>
          <p className="text-sm font-body text-muted-foreground mt-0.5">
            Quanto se usa, quanto custa, e se está na hora de mexer na cota ou no preço.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-border overflow-hidden">
          {([30, 90] as Periodo[]).map((d) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              className={`px-3 py-1.5 text-xs font-body font-semibold transition-colors ${
                dias === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d} dias
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card
          icon={Cpu}
          titulo="Cria IA (gerações)"
          valor={String(ia.data?.total ?? 0)}
          sub={`${ia.data?.usuarios ?? 0} contas usaram`}
        />
        <Card
          icon={Search}
          titulo="Cria Radar (análises)"
          valor={String(hub.data?.total ?? 0)}
          sub={`${contasHub} contas · ${taxaErro}% falharam`}
          alerta={taxaErro > 15}
        />
        <Card
          icon={ImageIcon}
          titulo="Cria Estúdio (imagens)"
          valor={String(estudio.data?.total ?? 0)}
          sub="geração por IA (Higgsfield)"
        />
        <Card
          icon={DollarSign}
          titulo="Custo do Radar / mês"
          valor={formatBRL(custoTotalMes * USD_BRL)}
          sub={`US$ ${custoHubMes.toFixed(2)} de uso + US$ 49 fixos do Apify`}
          alerta={pctCusto > 50}
        />
      </div>

      {/* O sinal que importa: o custo variável está comendo mais da metade do preço? */}
      {contasHub > 0 && (
        <div className={`rounded-2xl border p-4 ${pctCusto > 50 ? "border-amber-500/40 bg-amber-500/[0.04]" : "border-border bg-card"}`}>
          <div className="flex items-start gap-3">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${pctCusto > 50 ? "bg-amber-500/15 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}`}>
              {pctCusto > 50 ? <AlertTriangle className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <p className="font-display font-bold text-foreground">
                O uso do Radar come <strong>{pctCusto}%</strong> do que ele fatura
              </p>
              <p className="text-[13px] font-body text-muted-foreground mt-1 leading-relaxed">
                {pctCusto > 50
                  ? "Passou do limite de 50%. Ou a cota de créditos está generosa demais, ou o preço está baixo. Aperte a cota antes de subir o preço — mexer no preço de quem já assinou é caro."
                  : "Dentro do limite de 50%. Há folga pra aumentar a cota (e o valor percebido) sem machucar a margem."}
                {" "}O custo fixo do Apify (US$ 49) se paga com <strong>{Math.ceil((49 * USD_BRL) / 49.9)} assinantes</strong> do HUB.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Onde o dinheiro do HUB vai */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="font-display font-bold text-foreground mb-3">Custo por tipo de análise</p>
          {(hub.data?.tipos ?? []).length === 0 ? (
            <p className="text-[13px] font-body text-muted-foreground">Nenhuma análise no período.</p>
          ) : (
            <div className="space-y-2">
              {(hub.data?.tipos ?? []).map(([tipo, v]) => {
                const pct = custoHubUsd > 0 ? Math.round((v.usd / custoHubUsd) * 100) : 0;
                return (
                  <div key={tipo}>
                    <div className="flex items-center justify-between text-[13px] font-body">
                      <span className="text-foreground">{tipo}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {v.n}× · US$ {v.usd.toFixed(2)}
                        {v.n > 0 && <span className="opacity-60"> ({(v.usd / v.n).toFixed(3)}/un)</span>}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] font-body text-muted-foreground mt-3">
            O custo por unidade é o número real cobrado pelo Apify. Se a transcrição estiver
            comendo o orçamento, é ela que precisa custar mais créditos.
          </p>
        </div>

        {/* Quem consome a IA de texto */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="font-display font-bold text-foreground mb-3">Quem mais usa a Cria IA</p>
          {(ia.data?.top ?? []).length === 0 ? (
            <p className="text-[13px] font-body text-muted-foreground">Nenhum uso no período.</p>
          ) : (
            <div className="space-y-1.5">
              {(ia.data?.top ?? []).map(([uid, n]) => (
                <div key={uid} className="flex items-center justify-between gap-3 text-[13px] font-body">
                  <span className="truncate font-mono text-[11px] text-muted-foreground">{uid.slice(0, 8)}…</span>
                  <span className="tabular-nums text-foreground font-semibold shrink-0">{n}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] font-body text-muted-foreground mt-3">
            Se alguém do Pro (150/mês) vive estourando, a cota está funcionando como
            upsell. Se ninguém chega perto, ela está larga demais e você paga por nada.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AdminBenchmarks;
