import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import {
  RefreshCw, Megaphone, Link2, Instagram, Sparkles, AlertTriangle, Lightbulb, ArrowDown, Globe,
  LayoutDashboard, MousePointerClick, CalendarClock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AdminLpComportamento, KpiCard } from "./AdminLpComportamento";
import { AdminTrafegoHorarios } from "./AdminTrafegoHorarios";

/* ═══════════════════════════════════════════════════════════════════════════
   ABA TRÁFEGO DO ADMIN: O MOTOR DE ANÁLISE (21/10/2026)

   Walter: "analisarmos em um dashboard as métricas do Cria, acessos no link in
   bio, acessos via tráfego no site pra criador e para social media ... cada
   post, saber o que está entregando e o que não, trazer sugestões".

   Tudo sai de UMA RPC (admin_trafego_painel), que junta:
     · Meta Ads por anúncio e dia (preenchido pelo agendamento das 8h e 20h);
     · visitas e cliques da LP (edge site-track, contagem nossa, sem cookie);
     · link na bio do Cria (bio_stats_daily);
     · cadastros com a UTM que o Signup grava;
     · posts orgânicos do @criasocialclub (instagram-sync);
     · a leitura do agendamento (resumo, alertas e sugestões).

   O funil é lido de cima pra baixo, por público, porque é a pergunta que
   decide verba: "o dinheiro do criador está virando cadastro de criador?".

   21/10/2026, segunda volta (Walter: "falta mais dados ali, dashboards ...
   até onde a pessoa acessa, onde clica, quanto tempo fica"): quatro abas
   (Visão geral, Anúncios, Na página, Bio e Instagram), cartões de número com
   o período anterior do mesmo tamanho (admin_trafego_kpis) e a aba "Na
   página" com o comportamento dentro da LP (AdminLpComportamento).
   ═══════════════════════════════════════════════════════════════════════════ */

type Funil = {
  publico: "criador" | "social"; gasto: number; impressoes: number; alcance: number; thruplays: number;
  cliques_link: number; visitas_lp_meta: number; sessoes_site: number; sessoes_meta: number; sessoes_bio: number;
  leram: number; ficaram_30s: number; clicaram_testar: number; cadastros: number; cadastros_meta: number;
  custo_thruplay: number | null; custo_clique: number | null; custo_cadastro: number | null; retencao_100: number | null;
};
type Anuncio = {
  ad_id: string; nome: string; publico: string; campanha: string; status: string | null;
  impressoes: number; alcance: number; gasto: number; thruplays: number; cliques_link: number;
  custo_thruplay: number | null; ctr_link: number | null; taxa_thruplay: number | null; retencao: number | null;
  tempo_medio_s: number | null; frequencia: number | null; ranking_qualidade: string | null; veredito: string;
};
type Analise = {
  id: string; criado_em: string; resumo: string;
  alertas: { nivel?: string; titulo: string; detalhe?: string }[];
  sugestoes: { prioridade?: number; titulo: string; porque?: string; acao?: string }[];
  destaques: { titulo: string; detalhe?: string }[];
  por_anuncio: { ad_id: string; veredito?: string; motivo?: string }[];
};
type Painel = {
  periodo: { ini: string; fim: string; dias: number };
  meta_atualizado_em: string | null;
  funil: Funil[];
  anuncios: Anuncio[];
  serie: { dia: string; gasto: number; impressoes: number; cliques: number; visitas_criador: number; visitas_social: number; bio_views: number }[];
  bio: { slug: string; views: number; clicks: number; origens: { origem: string; views: number }[]; blocos: { titulo: string; kind: string; url: string | null; ativo: boolean; clicks: number }[] };
  site_campanhas: { campanha: string; origem: string; publico: string; sessoes: number; clicaram_testar: number }[];
  ig_posts: { object_id: string; media_type: string; legenda: string; permalink: string; thumbnail_url: string | null; posted_at: string; metrics: Record<string, number> }[];
  ig_conectado: boolean;
  analises: Analise[];
};

type Kpis = { atual: Record<string, number | null>; anterior: Record<string, number | null>; periodo: { ini: string; fim: string; dias: number } };

const ABAS = [
  { id: "geral", txt: "Visão geral", icone: LayoutDashboard },
  { id: "anuncios", txt: "Anúncios", icone: Megaphone },
  { id: "pagina", txt: "Na página", icone: MousePointerClick },
  { id: "horarios", txt: "Dias e horários", icone: CalendarClock },
  { id: "bio", txt: "Bio e Instagram", icone: Instagram },
] as const;
type Aba = (typeof ABAS)[number]["id"];

const sbRpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR");
const brl = (v: number | null | undefined, casas = 2) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });
const pct = (a: number, b: number) => (b > 0 ? `${((100 * a) / b).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—");
const diaBr = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
const haQuanto = (iso: string | null) => {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `há ${h}h` : `há ${Math.round(h / 24)} dias`;
};

const VEREDITO: Record<string, { txt: string; cls: string; dica: string }> = {
  escalar: { txt: "Escalar", cls: "bg-green-100 text-green-800", dica: "Custo por vídeo assistido 20% abaixo da mediana e cliques acima." },
  manter: { txt: "Manter", cls: "bg-sky-100 text-sky-800", dica: "Dentro da média do público." },
  cansando: { txt: "Cansando", cls: "bg-amber-100 text-amber-900", dica: "Mesma pessoa vendo 3,5x ou mais. Hora de criativo novo." },
  pausar: { txt: "Pausar", cls: "bg-red-100 text-red-800", dica: "Custo por vídeo assistido 50% acima da mediana." },
  aprendendo: { txt: "Aprendendo", cls: "bg-muted text-muted-foreground", dica: "Menos de 1.000 impressões: cedo pra julgar." },
  sem_dado: { txt: "Sem dado", cls: "bg-muted text-muted-foreground", dica: "Sem vídeo assistido ainda." },
};
const PUBLICO_ROTULO: Record<string, string> = { criador: "Criador", social: "Social mídia", outro: "Outro" };

function Card({ titulo, icone: Icone, children, acao, className }: { titulo: string; icone: typeof Megaphone; children: React.ReactNode; acao?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="flex items-center gap-2 text-sm font-display font-bold text-foreground"><Icone className="h-4 w-4 text-primary" />{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  );
}

function Degrau({ rotulo, valor, base, dica }: { rotulo: string; valor: number; base?: number; dica?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/60 last:border-0">
      <span className="text-[13px] font-body text-muted-foreground" title={dica}>{rotulo}</span>
      <span className="flex items-baseline gap-2">
        {base != null && <span className="text-[11px] font-body text-muted-foreground">{pct(valor, base)}</span>}
        <span className="text-sm font-display font-bold text-foreground tabular-nums">{n(valor)}</span>
      </span>
    </div>
  );
}

function FunilPublico({ f }: { f: Funil }) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-display font-extrabold text-foreground">{PUBLICO_ROTULO[f.publico]}</p>
        <p className="text-xs font-body text-muted-foreground">gasto <b className="text-foreground">{brl(f.gasto)}</b></p>
      </div>
      <p className="text-[11px] uppercase tracking-wide font-body text-muted-foreground mt-2 mb-1">No anúncio</p>
      <Degrau rotulo="Impressões" valor={f.impressoes} />
      <Degrau rotulo="Alcance" valor={f.alcance} />
      <Degrau rotulo="Viram o vídeo (ThruPlay)" valor={f.thruplays} base={f.impressoes} dica="Assistiu até o fim ou 15s" />
      <Degrau rotulo="Clicaram no link" valor={f.cliques_link} base={f.impressoes} />
      <p className="text-[11px] uppercase tracking-wide font-body text-muted-foreground mt-3 mb-1 flex items-center gap-1"><ArrowDown className="h-3 w-3" />No site</p>
      <Degrau rotulo="Visitas vindas da Meta" valor={f.sessoes_meta} base={f.cliques_link || undefined} dica="Contagem nossa (site-track). Comparar com cliques mostra quanto se perde no carregamento." />
      <Degrau rotulo="Visitas vindas da bio" valor={f.sessoes_bio} />
      <Degrau rotulo="Visitas no total" valor={f.sessoes_site} />
      <Degrau rotulo="Leram metade da página" valor={f.leram} base={f.sessoes_site} />
      <Degrau rotulo="Clicaram em testar" valor={f.clicaram_testar} base={f.sessoes_site} />
      <p className="text-[11px] uppercase tracking-wide font-body text-muted-foreground mt-3 mb-1 flex items-center gap-1"><ArrowDown className="h-3 w-3" />No app</p>
      <Degrau rotulo="Cadastros no período" valor={f.cadastros} />
      <Degrau rotulo="Cadastros com origem Meta" valor={f.cadastros_meta} base={f.clicaram_testar || undefined} />
      <div className="grid grid-cols-3 gap-2 mt-3">
        {[
          { r: "por vídeo visto", v: brl(f.custo_thruplay, 3) },
          { r: "por clique", v: brl(f.custo_clique) },
          { r: "por cadastro", v: brl(f.custo_cadastro) },
        ].map((x) => (
          <div key={x.r} className="rounded-xl bg-muted/60 px-2 py-2 text-center">
            <p className="text-sm font-display font-bold text-foreground">{x.v}</p>
            <p className="text-[10px] font-body text-muted-foreground">{x.r}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const segs = (v: number | null | undefined) => {
  if (v == null) return "—";
  const s = Math.round(v);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`;
};

/* Os números do topo, cada um com o período anterior do mesmo tamanho. */
function PainelKpis({ dias }: { dias: number }) {
  const { data } = useQuery<Kpis>({
    queryKey: ["admin-trafego-kpis", dias],
    queryFn: async () => {
      const { data, error } = await sbRpc("admin_trafego_kpis", { _dias: dias });
      if (error) throw new Error(error.message);
      return data as Kpis;
    },
    staleTime: 2 * 60 * 1000,
  });
  if (!data) return null;
  const a = data.atual, b = data.anterior;
  const cards: { r: string; v: string; k: string; menor?: boolean; dica?: string }[] = [
    { r: "Investido na Meta", v: brl(a.gasto), k: "gasto" },
    { r: "Impressões", v: n(a.impressoes), k: "impressoes" },
    { r: "CTR do link", v: a.ctr != null ? `${a.ctr}%` : "—", k: "ctr", dica: "Cliques no link / impressões" },
    { r: "Visitas no site", v: n(a.visitas), k: "visitas", dica: "Sessões na LP, todas as origens" },
    { r: "Visitas vindas da Meta", v: n(a.visitas_meta), k: "visitas_meta" },
    { r: "Custo por visita", v: brl(a.custo_visita), k: "custo_visita", menor: true, dica: "Gasto / visitas que chegaram da Meta (contagem nossa)" },
    { r: "Clicaram em testar", v: n(a.clicaram_testar), k: "clicaram_testar" },
    { r: "Cadastros", v: n(a.cadastros), k: "cadastros", dica: "Todas as origens" },
    { r: "Cadastros da Meta", v: n(a.cadastros_meta), k: "cadastros_meta" },
    { r: "Custo por cadastro", v: brl(a.custo_cadastro), k: "custo_cadastro", menor: true },
    { r: "Visitas na bio", v: n(a.bio_views), k: "bio_views" },
    { r: "Tempo na página (mediana)", v: segs(a.tempo_mediano), k: "tempo_mediano" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {cards.map((c) => (
        <KpiCard key={c.k} rotulo={c.r} valor={c.v} atual={a[c.k]} anterior={b[c.k]} menorMelhor={c.menor} dica={c.dica} />
      ))}
    </div>
  );
}

export function AdminTrafego() {
  const [dias, setDias] = useState(14);
  const [aba, setAba] = useState<Aba>("geral");
  const { data, isLoading, error, refetch, isFetching } = useQuery<Painel>({
    queryKey: ["admin-trafego", dias],
    queryFn: async () => {
      const { data, error } = await sbRpc("admin_trafego_painel", { _dias: dias });
      if (error) throw new Error(error.message);
      return data as Painel;
    },
    staleTime: 2 * 60 * 1000,
  });

  const ultima = data?.analises?.[0];
  const leituraPorAd = new Map((ultima?.por_anuncio ?? []).map((x) => [x.ad_id, x]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {[7, 14, 30].map((d) => (
            <button key={d} onClick={() => setDias(d)}
              className={cn("rounded-full px-3 py-1.5 text-xs font-body font-semibold border transition-colors",
                dias === d ? "border-primary/50 bg-primary/[0.08] text-primary" : "border-border hover:bg-muted")}>
              {d} dias
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-body text-muted-foreground">Meta atualizada {haQuanto(data?.meta_atualizado_em ?? null)} · roda às 8h e 20h</span>
          <button onClick={() => refetch()} className="inline-flex items-center gap-1.5 text-xs font-body font-medium rounded-lg border border-border px-3 py-1.5 hover:bg-muted">
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} /> Atualizar
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1">
        {ABAS.map((x) => (
          <button key={x.id} onClick={() => setAba(x.id)}
            className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-body font-semibold transition-colors",
              aba === x.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <x.icone className="h-3.5 w-3.5" />{x.txt}
          </button>
        ))}
      </div>

      {aba === "pagina" ? (
        <AdminLpComportamento dias={dias} />
      ) : aba === "horarios" ? (
        <AdminTrafegoHorarios />
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground font-body py-10 text-center">Carregando…</p>
      ) : error || !data ? (
        <div className="rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive font-body">
          Não consegui carregar o painel. {(error as Error)?.message}
        </div>
      ) : (
        <>
          {aba === "geral" && <>
          <PainelKpis dias={dias} />

          {/* LEITURA DO AGENDAMENTO */}
          <Card titulo="Leitura do Claude" icone={Sparkles}
            acao={ultima && <span className="text-xs font-body text-muted-foreground">{new Date(ultima.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}>
            {!ultima ? (
              <p className="text-sm font-body text-muted-foreground">A primeira leitura aparece depois da próxima rodada (8h ou 20h).</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-body text-foreground leading-relaxed whitespace-pre-line">{ultima.resumo}</p>
                {ultima.alertas?.length > 0 && (
                  <div className="space-y-1.5">
                    {ultima.alertas.map((a, i) => (
                      <div key={i} className={cn("flex gap-2 rounded-xl px-3 py-2 text-[13px] font-body", a.nivel === "alto" ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900")}>
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span><b>{a.titulo}</b>{a.detalhe ? ` ${a.detalhe}` : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
                {ultima.sugestoes?.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {[...ultima.sugestoes].sort((a, b) => (a.prioridade ?? 9) - (b.prioridade ?? 9)).map((s, i) => (
                      <div key={i} className="rounded-xl border border-border p-3">
                        <p className="flex items-center gap-1.5 text-[13px] font-display font-bold text-foreground">
                          <Lightbulb className="h-3.5 w-3.5 text-primary" />{s.titulo}
                          {s.prioridade === 1 && <span className="ml-auto text-[10px] rounded-full bg-primary/10 text-primary px-2 py-0.5">fazer já</span>}
                        </p>
                        {s.porque && <p className="text-xs font-body text-muted-foreground mt-1">{s.porque}</p>}
                        {s.acao && <p className="text-xs font-body text-foreground mt-1.5"><b>Ação:</b> {s.acao}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* FUNIL POR PÚBLICO */}
          <Card titulo={`Funil por público · ${diaBr(data.periodo.ini)} a ${diaBr(data.periodo.fim)}`} icone={Megaphone}>
            <div className="grid md:grid-cols-2 gap-3">
              {data.funil.map((f) => <FunilPublico key={f.publico} f={f} />)}
            </div>
          </Card>

          {/* DIA A DIA */}
          <Card titulo="Dia a dia" icone={Globe}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.serie.map((s) => ({ ...s, dia: diaBr(s.dia) }))} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="g" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="v" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="g" dataKey="gasto" name="Gasto (R$)" fill="#F2C21E" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="v" dataKey="visitas_criador" name="Visitas criador" stroke="#CE4A1D" strokeWidth={2} dot={false} />
                  <Line yAxisId="v" dataKey="visitas_social" name="Visitas social" stroke="#2A4BDF" strokeWidth={2} dot={false} />
                  <Line yAxisId="v" dataKey="bio_views" name="Visitas na bio" stroke="#3E9152" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          </>}

          {/* ANÚNCIOS */}
          {aba === "anuncios" && <Card titulo="Cada anúncio" icone={Megaphone}>
            {data.anuncios.length === 0 ? (
              <p className="text-sm font-body text-muted-foreground">Sem números da Meta no período ainda.</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-[12.5px] font-body">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      {["Anúncio", "Veredito", "Gasto", "Impr.", "Vídeo visto", "R$/vídeo", "Retenção", "Cliques", "CTR"].map((h) => (
                        <th key={h} className="px-2 py-2 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.anuncios.map((a) => {
                      const v = VEREDITO[a.veredito] ?? VEREDITO.manter;
                      const leitura = leituraPorAd.get(a.ad_id);
                      return (
                        <tr key={a.ad_id} className="border-t border-border/60 align-top">
                          <td className="px-2 py-2 min-w-[200px]">
                            <p className="font-semibold text-foreground">{a.nome}</p>
                            <p className="text-[11px] text-muted-foreground">{PUBLICO_ROTULO[a.publico] ?? a.publico}{a.status && a.status !== "ACTIVE" ? ` · ${a.status.toLowerCase()}` : ""}</p>
                            {leitura?.motivo && <p className="text-[11px] text-foreground/80 mt-1">{leitura.motivo}</p>}
                          </td>
                          <td className="px-2 py-2"><span title={v.dica} className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", v.cls)}>{v.txt}</span></td>
                          <td className="px-2 py-2 tabular-nums whitespace-nowrap">{brl(a.gasto)}</td>
                          <td className="px-2 py-2 tabular-nums">{n(a.impressoes)}</td>
                          <td className="px-2 py-2 tabular-nums">{n(a.thruplays)}</td>
                          <td className="px-2 py-2 tabular-nums whitespace-nowrap">{brl(a.custo_thruplay, 3)}</td>
                          <td className="px-2 py-2 tabular-nums" title="Dos que viram 25%, quantos chegaram ao fim">{a.retencao != null ? `${a.retencao}%` : "—"}</td>
                          <td className="px-2 py-2 tabular-nums">{n(a.cliques_link)}</td>
                          <td className="px-2 py-2 tabular-nums">{a.ctr_link != null ? `${a.ctr_link}%` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>}

          {aba === "bio" && <>
          <div className="grid lg:grid-cols-2 gap-4">
            {/* LINK NA BIO */}
            <Card titulo="Link na bio · criaclub.bio/criasocialclub" icone={Link2}>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { r: "visitas", v: n(data.bio.views) },
                  { r: "cliques", v: n(data.bio.clicks) },
                  { r: "taxa de clique", v: pct(data.bio.clicks, data.bio.views) },
                ].map((x) => (
                  <div key={x.r} className="rounded-xl bg-muted/60 px-2 py-2 text-center">
                    <p className="text-lg font-display font-extrabold text-foreground">{x.v}</p>
                    <p className="text-[10px] font-body text-muted-foreground">{x.r}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] uppercase tracking-wide font-body text-muted-foreground mb-1">Cliques por bloco</p>
              {data.bio.blocos.map((b) => (
                <Degrau key={b.titulo} rotulo={b.titulo} valor={b.clicks} base={data.bio.views || undefined} />
              ))}
              {data.bio.origens.length > 0 && (
                <p className="text-xs font-body text-muted-foreground mt-3">
                  De onde vieram: {data.bio.origens.map((o) => `${o.origem} ${n(o.views)}`).join(" · ")}
                </p>
              )}
            </Card>

            {/* SITE POR CAMPANHA */}
            <Card titulo="Site por origem" icone={Globe}>
              {data.site_campanhas.length === 0 ? (
                <p className="text-sm font-body text-muted-foreground">As visitas começam a contar depois que a LP nova subir.</p>
              ) : (
                <table className="w-full text-[12.5px] font-body">
                  <thead className="text-muted-foreground"><tr className="text-left">
                    <th className="py-1.5 font-medium">Campanha</th><th className="py-1.5 font-medium">Página</th>
                    <th className="py-1.5 font-medium text-right">Visitas</th><th className="py-1.5 font-medium text-right">Testar</th>
                  </tr></thead>
                  <tbody>
                    {data.site_campanhas.slice(0, 12).map((c, i) => (
                      <tr key={i} className="border-t border-border/60">
                        <td className="py-1.5"><span className="font-semibold text-foreground">{c.campanha}</span> <span className="text-muted-foreground">({c.origem})</span></td>
                        <td className="py-1.5 text-muted-foreground">{PUBLICO_ROTULO[c.publico] ?? c.publico}</td>
                        <td className="py-1.5 text-right tabular-nums">{n(c.sessoes)}</td>
                        <td className="py-1.5 text-right tabular-nums">{n(c.clicaram_testar)} <span className="text-muted-foreground">({pct(c.clicaram_testar, c.sessoes)})</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          {/* INSTAGRAM ORGÂNICO */}
          <Card titulo="Instagram @criasocialclub (orgânico)" icone={Instagram}>
            {!data.ig_conectado ? (
              <p className="text-sm font-body text-muted-foreground">Conecte o Instagram na conta do Cria Social Club pra ver os posts aqui.</p>
            ) : data.ig_posts.length === 0 ? (
              <p className="text-sm font-body text-muted-foreground">Sem posts nos últimos dias.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {data.ig_posts.slice(0, 12).map((p) => {
                  const m = p.metrics ?? {};
                  const alcance = m.reach ?? 0;
                  return (
                    <a key={p.object_id} href={p.permalink} target="_blank" rel="noreferrer" className="rounded-xl border border-border overflow-hidden hover:border-primary/40 transition-colors">
                      {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="w-full aspect-[4/5] object-cover bg-muted" loading="lazy" /> : <div className="w-full aspect-[4/5] bg-muted" />}
                      <div className="p-2 space-y-0.5">
                        <p className="text-[11px] font-body text-muted-foreground">{new Date(p.posted_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · {p.media_type?.toLowerCase()}</p>
                        <p className="text-[12px] font-body text-foreground"><b>{n(alcance)}</b> alcance · {n(m.saved)} salvos · {n(m.shares)} envios</p>
                        <p className="text-[11px] font-body text-muted-foreground">{n(m.likes)} curtidas · {n(m.comments)} coment.{alcance ? ` · ${pct((m.saved ?? 0) + (m.shares ?? 0), alcance)} guardou/enviou` : ""}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </Card>

          </>}

          {aba === "geral" && data.analises.length > 1 && (
            <Card titulo="Leituras anteriores" icone={Sparkles}>
              <div className="space-y-2">
                {data.analises.slice(1).map((a) => (
                  <details key={a.id} className="rounded-xl border border-border px-3 py-2">
                    <summary className="text-[13px] font-body cursor-pointer text-foreground">
                      {new Date(a.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </summary>
                    <p className="text-[13px] font-body text-muted-foreground mt-2 whitespace-pre-line">{a.resumo}</p>
                  </details>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
