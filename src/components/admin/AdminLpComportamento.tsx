import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ComposedChart, Line,
} from "recharts";
import {
  MousePointerClick, Clock, ScrollText, Smartphone, Lightbulb, Route, TrendingUp, TrendingDown, Minus, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   COMPORTAMENTO NA LP (21/10/2026)

   Walter: "precisamos entender também até onde a pessoa normalmente acessa,
   onde ela clica, o que faz, quanto tempo fica na tela, como melhorar a
   retenção e conversão".

   Fonte: site_leituras (uma linha por visita, montada pelo track.js da LP) e
   os cliques de site_visitas, via RPC admin_lp_comportamento.

   As leituras do card "O que fazer" são regras fixas e explicáveis (cada uma
   diz o número que a disparou). A leitura com contexto vem do agendamento,
   na Visão geral.
   ═══════════════════════════════════════════════════════════════════════════ */

type Resumo = {
  visitas: number; tempo_mediano: number | null; tempo_medio: number | null; rejeicao: number | null;
  scroll_medio: number | null; chegou_fim: number | null; conversao: number | null; converteram: number;
};
type Secao = { id: string; ord: number; chegaram: number; seg_medio: number | null; saidas: number; saidas_sem_converter: number };
type Clique = { alvo: string; secao: string | null; cliques: number; pessoas: number; pos_y: number | null; leva_cadastro: boolean };
type Segmento = { visitas: number; tempo_mediano: number | null; scroll_medio: number | null; rejeicao: number | null; conversao: number | null };
type Comport = {
  pagina: string;
  periodo: { ini: string; fim: string; dias: number };
  paginas: { pagina: string; visitas: number }[];
  resumo: Resumo;
  anterior: Resumo;
  faixas_tempo: { rotulo: string; visitas: number }[];
  rolagem: { marca: number; chegaram: number }[];
  secoes: Secao[];
  cliques: Clique[];
  dispositivos: (Segmento & { dispositivo: string })[];
  origens: (Segmento & { origem: string; campanha: string; conteudo: string })[];
  serie: { dia: string; visitas: number; converteram: number; tempo_mediano: number | null }[];
};

const sbRpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

const PAGINAS: Record<string, string> = {
  "/": "Página do criador",
  "/social-media": "Página da social mídia",
  "/funcionalidades": "Funcionalidades",
};

/* Nome humano de cada <section id> das três páginas. O que não estiver aqui
   aparece pelo id (página nova não quebra nada, só fica menos bonita). */
const SECAO: Record<string, string> = {
  hero: "Topo", dor: "A dor", motor: "Como funciona (passo a passo)", novidades: "Novidades",
  versus: "Cria x jeito antigo", stats: "Números", numeros: "Números", planos: "Planos e preços",
  "gestor-teaser": "Chamada pra social mídia", explorar: "Explorar", telas: "Telas do app",
  func: "Funcionalidades", tudo: "O que vem em cada plano", dispositivos: "Celular e computador",
  faq: "Perguntas frequentes", final: "Chamada final", rodape: "Rodapé",
  agencia: "Agência", semana: "Semana da social mídia", uau: "Momento uau", criakut: "Criakut",
  parceiros: "Parceiros", modulos: "Módulos", "meio-cta": "Chamada do meio", precos: "Preços",
  comparativo: "Comparativo com o mercado", "faq-gestor": "Perguntas frequentes",
};
const nomeSecao = (id: string | null) => (id ? SECAO[id] ?? id : "—");

const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR");
const segs = (v: number | null | undefined) => {
  if (v == null) return "—";
  const s = Math.round(v);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m}min ${r}s` : `${m}min`;
};
const pc = (v: number | null | undefined) => (v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const diaBr = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };

/* ── CARTÃO DE NÚMERO COM VARIAÇÃO ─────────────────────────────────────────
   Compara com o período anterior do mesmo tamanho. `menorMelhor` inverte a
   cor (custo, rejeição). Sem base anterior não inventa porcentagem. */
export function KpiCard({ rotulo, valor, atual, anterior, menorMelhor, dica }: {
  rotulo: string; valor: string; atual: number | null | undefined; anterior: number | null | undefined; menorMelhor?: boolean; dica?: string;
}) {
  let delta: React.ReactNode = <span className="text-muted-foreground">sem base anterior</span>;
  if (atual != null && anterior != null && anterior !== 0) {
    const v = ((atual - anterior) / Math.abs(anterior)) * 100;
    const bom = menorMelhor ? v < 0 : v > 0;
    const Ic = Math.abs(v) < 0.5 ? Minus : v > 0 ? TrendingUp : TrendingDown;
    delta = (
      <span className={cn("inline-flex items-center gap-1 font-semibold", Math.abs(v) < 0.5 ? "text-muted-foreground" : bom ? "text-green-700" : "text-red-700")}>
        <Ic className="h-3 w-3" />{v > 0 ? "+" : ""}{v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
      </span>
    );
  } else if (atual && !anterior) {
    delta = <span className="text-muted-foreground">novo no período</span>;
  }
  return (
    <div className="rounded-2xl border border-border bg-card px-3.5 py-3" title={dica}>
      <p className="text-[11px] font-body text-muted-foreground leading-tight">{rotulo}</p>
      <p className="text-xl font-display font-extrabold text-foreground tabular-nums mt-1">{valor}</p>
      <p className="text-[11px] font-body mt-0.5">{delta}</p>
    </div>
  );
}

function Bloco({ titulo, icone: Icone, children, sub }: { titulo: string; icone: typeof Clock; children: React.ReactNode; sub?: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-display font-bold text-foreground"><Icone className="h-4 w-4 text-primary" />{titulo}</h3>
      {sub && <p className="text-xs font-body text-muted-foreground mt-0.5">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* ── O QUE FAZER: REGRAS ────────────────────────────────────────────────── */
type Leitura = { nivel: "alto" | "medio" | "info"; titulo: string; detalhe: string };
function lerDados(d: Comport): Leitura[] {
  const out: Leitura[] = [];
  const r = d.resumo, total = r.visitas;
  if (!total) return out;
  if (total < 30) out.push({ nivel: "info", titulo: `Amostra pequena: ${total} visitas.`, detalhe: "Leia como tendência. Com 100 ou mais visitas por página as regras abaixo ficam confiáveis." });

  if ((r.rejeicao ?? 0) >= 40) {
    out.push({ nivel: "alto", titulo: `${pc(r.rejeicao)} saem em menos de 5 segundos.`, detalhe: "O topo não está segurando. Confira se o topo mostra exatamente o que o anúncio prometeu (mesma frase, mesma imagem) e se carrega rápido no celular." });
  }
  const meta = d.origens.filter((o) => o.origem === "Anúncio Meta");
  const bio = d.origens.filter((o) => o.origem === "Link na bio");
  const media = (arr: Segmento[], k: keyof Segmento) => {
    const v = arr.reduce((s, x) => s + x.visitas, 0);
    return v ? arr.reduce((s, x) => s + (Number(x[k] ?? 0) * x.visitas), 0) / v : null;
  };
  const rejMeta = media(meta, "rejeicao"), rejBio = media(bio, "rejeicao");
  if (rejMeta != null && rejBio != null && meta.reduce((s, x) => s + x.visitas, 0) >= 15 && rejMeta - rejBio >= 15) {
    out.push({ nivel: "medio", titulo: `Quem vem do anúncio sai mais rápido (${pc(Math.round(rejMeta))} x ${pc(Math.round(rejBio))} da bio).`, detalhe: "Sinal de desalinhamento entre o vídeo e a página. Vale testar a primeira dobra com a mesma promessa do criativo que mais traz visita." });
  }

  // Maior queda entre uma seção e a seguinte.
  const secs = d.secoes.filter((s) => s.id !== "rodape");
  let pior: { de: Secao; para: Secao; queda: number } | null = null;
  for (let i = 1; i < secs.length; i++) {
    const queda = (100 * (secs[i - 1].chegaram - secs[i].chegaram)) / total;
    if (!pior || queda > pior.queda) pior = { de: secs[i - 1], para: secs[i], queda };
  }
  if (pior && pior.queda >= 12) {
    out.push({ nivel: "alto", titulo: `Entre "${nomeSecao(pior.de.id)}" e "${nomeSecao(pior.para.id)}" você perde ${Math.round(pior.queda)}% das visitas.`, detalhe: `É o maior degrau da página. Encurte "${nomeSecao(pior.de.id)}" ou coloque um gancho no fim dela que puxe pra próxima (pergunta, número, print).` });
  }

  const saiMais = [...secs].sort((a, b) => b.saidas_sem_converter - a.saidas_sem_converter)[0];
  if (saiMais && saiMais.saidas_sem_converter >= 3 && saiMais.saidas_sem_converter / total >= 0.15) {
    out.push({ nivel: "medio", titulo: `${Math.round((100 * saiMais.saidas_sem_converter) / total)}% vão embora em "${nomeSecao(saiMais.id)}" sem clicar em testar.`, detalhe: "É onde a pessoa estava quando fechou a aba. Se for uma seção longa, ela cansou ali; se for preço, faltou argumento ou o preço assustou." });
  }

  const preco = d.secoes.find((s) => s.id === "planos" || s.id === "precos");
  if (preco && total >= 10 && preco.chegaram / total < 0.35) {
    out.push({ nivel: "medio", titulo: `Só ${Math.round((100 * preco.chegaram) / total)}% chegam nos preços.`, detalhe: "A maioria decide sem ver quanto custa. Teste um resumo de preço (\"7 dias grátis, depois a partir de R$ X\") perto do topo." });
  }

  const mortos = d.cliques.filter((c) => c.alvo.startsWith("imagem:") && c.pessoas >= 3);
  if (mortos.length) {
    const m = mortos[0];
    out.push({ nivel: "medio", titulo: `${m.pessoas} pessoas clicaram numa imagem que não abre nada.`, detalhe: `"${m.alvo.replace(/^imagem:\s*/, "")}" em "${nomeSecao(m.secao)}". Elas queriam ver de perto: vire link pra tela ou abra em zoom.` });
  }

  const cel = d.dispositivos.find((x) => x.dispositivo === "mobile");
  const pc_ = d.dispositivos.find((x) => x.dispositivo === "desktop");
  if (cel && pc_ && cel.visitas >= 20 && pc_.visitas >= 20 && cel.conversao != null && pc_.conversao != null) {
    if (pc_.conversao >= 2 * Math.max(cel.conversao, 0.1)) out.push({ nivel: "alto", titulo: `No celular converte ${pc(cel.conversao)}, no computador ${pc(pc_.conversao)}.`, detalhe: "Quase todo anúncio cai no celular. Abra a página no celular e procure o que trava: botão escondido, print ilegível, texto longo antes do primeiro botão." });
  }

  const melhor = d.cliques.filter((c) => c.leva_cadastro).sort((a, b) => b.pessoas - a.pessoas)[0];
  if (melhor && melhor.pessoas >= 3) {
    out.push({ nivel: "info", titulo: `O botão que mais leva ao cadastro: "${melhor.alvo}" em "${nomeSecao(melhor.secao)}".`, detalhe: `${melhor.pessoas} pessoas. Use o mesmo texto nos outros botões e repita ele logo depois da seção que mais segura atenção.` });
  }

  const a = d.anterior;
  if (a.visitas >= 20 && r.conversao != null && a.conversao != null && Math.abs(r.conversao - a.conversao) >= 1) {
    const subiu = r.conversao > a.conversao;
    out.push({ nivel: subiu ? "info" : "medio", titulo: `Conversão da página ${subiu ? "subiu" : "caiu"} de ${pc(a.conversao)} pra ${pc(r.conversao)}.`, detalhe: subiu ? "Se mudou algo na página nesse intervalo, essa mudança fica." : "Veja se mudou a página, o anúncio ou a origem das visitas nesse intervalo." });
  }
  return out;
}

export function AdminLpComportamento({ dias }: { dias: number }) {
  const [pagina, setPagina] = useState("/");
  const { data, isLoading, error } = useQuery<Comport>({
    queryKey: ["admin-lp-comportamento", dias, pagina],
    queryFn: async () => {
      const { data, error } = await sbRpc("admin_lp_comportamento", { _dias: dias, _pagina: pagina });
      if (error) throw new Error(error.message);
      return data as Comport;
    },
    staleTime: 2 * 60 * 1000,
  });

  const leituras = useMemo(() => (data ? lerDados(data) : []), [data]);
  const opcoes = useMemo(() => {
    const set = new Map<string, number>(Object.keys(PAGINAS).map((p) => [p, 0]));
    (data?.paginas ?? []).forEach((p) => set.set(p.pagina, p.visitas));
    return [...set.entries()];
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {opcoes.map(([p, v]) => (
          <button key={p} onClick={() => setPagina(p)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-body font-semibold border transition-colors",
              pagina === p ? "border-primary/50 bg-primary/[0.08] text-primary" : "border-border hover:bg-muted")}>
            {PAGINAS[p] ?? p}{v ? <span className="ml-1 opacity-60">{n(v)}</span> : null}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground font-body py-10 text-center">Carregando…</p>
      ) : error || !data ? (
        <div className="rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive font-body">
          Não consegui carregar. {(error as Error)?.message}
        </div>
      ) : !data.resumo.visitas ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-sm font-body text-muted-foreground">
          Nenhuma visita medida nesta página no período. A medição de comportamento (tempo, rolagem, seções e cliques) começou em 21/10/2026, com a LP nova.
        </div>
      ) : (
        <ConteudoComport d={data} leituras={leituras} />
      )}
    </div>
  );
}

function ConteudoComport({ d, leituras }: { d: Comport; leituras: Leitura[] }) {
  const r = d.resumo, a = d.anterior, total = r.visitas;
  const maxSeg = Math.max(1, ...d.secoes.map((s) => s.seg_medio ?? 0));
  const maxSaida = Math.max(1, ...d.secoes.map((s) => s.saidas));

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <KpiCard rotulo="Visitas medidas" valor={n(total)} atual={total} anterior={a.visitas} />
        <KpiCard rotulo="Tempo ativo (mediana)" valor={segs(r.tempo_mediano)} atual={r.tempo_mediano} anterior={a.tempo_mediano}
          dica="Metade das visitas ficou mais que isso, com a aba aberta e mexendo. Aba esquecida não conta." />
        <KpiCard rotulo="Saem em até 5s" valor={pc(r.rejeicao)} atual={r.rejeicao} anterior={a.rejeicao} menorMelhor />
        <KpiCard rotulo="Rolagem média" valor={pc(r.scroll_medio)} atual={r.scroll_medio} anterior={a.scroll_medio}
          dica="Quanto da página, em média, passou pela tela." />
        <KpiCard rotulo="Chegam ao fim" valor={pc(r.chegou_fim)} atual={r.chegou_fim} anterior={a.chegou_fim} />
        <KpiCard rotulo="Clicam em testar/assinar" valor={pc(r.conversao)} atual={r.conversao} anterior={a.conversao}
          dica={`${n(r.converteram)} visitas clicaram num botão que leva ao cadastro ou ao checkout.`} />
      </div>

      {leituras.length > 0 && (
        <Bloco titulo="O que fazer com isso" icone={Lightbulb} sub="Regras fixas sobre os números desta página. Cada uma mostra o número que a disparou.">
          <div className="grid md:grid-cols-2 gap-2">
            {leituras.map((l, i) => (
              <div key={i} className={cn("rounded-xl px-3 py-2.5 text-[13px] font-body",
                l.nivel === "alto" ? "bg-red-50 text-red-950" : l.nivel === "medio" ? "bg-amber-50 text-amber-950" : "bg-muted/60 text-foreground")}>
                <p className="font-semibold flex gap-1.5">{l.nivel !== "info" && <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}{l.titulo}</p>
                <p className="text-xs mt-1 opacity-80">{l.detalhe}</p>
              </div>
            ))}
          </div>
        </Bloco>
      )}

      <Bloco titulo="Até onde as pessoas chegam" icone={Route}
        sub="Cada seção na ordem da página. Barra = quantas visitas viram a seção. Cor = quanto tempo ficaram nela. Saídas = estava nela quando fechou.">
        <div className="space-y-1">
          {d.secoes.map((s) => {
            const p = total ? (100 * s.chegaram) / total : 0;
            const calor = (s.seg_medio ?? 0) / maxSeg;
            return (
              <div key={s.id} className="grid grid-cols-[minmax(0,9.5rem)_1fr_auto] sm:grid-cols-[13rem_1fr_auto] items-center gap-2 py-0.5">
                <span className="text-[12.5px] font-body text-foreground truncate" title={s.id}>{nomeSecao(s.id)}</span>
                <div className="h-6 rounded-md bg-muted/70 overflow-hidden relative">
                  <div className="h-full rounded-md" style={{ width: `${Math.max(p, 1)}%`, background: `hsl(${18 + (1 - calor) * 200} 75% ${62 - calor * 14}%)` }} />
                  <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-body font-semibold text-foreground tabular-nums">{Math.round(p)}%</span>
                </div>
                <span className="text-[11px] font-body text-muted-foreground tabular-nums whitespace-nowrap w-[8.5rem] text-right">
                  {segs(s.seg_medio)} · <span className={cn(s.saidas / maxSaida > 0.6 && s.saidas >= 3 && "text-red-700 font-semibold")}>{n(s.saidas)} saídas</span>
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] font-body text-muted-foreground mt-3">Cor quente = seção que prende (mais segundos parados nela). Fria = passam direto.</p>
      </Bloco>

      <div className="grid lg:grid-cols-2 gap-4">
        <Bloco titulo="Quanto tempo ficam" icone={Clock} sub="Tempo ativo por visita">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.faixas_tempo} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fontSize: 10 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v: number) => [`${v} visitas (${total ? Math.round((100 * v) / total) : 0}%)`, ""]} />
                <Bar dataKey="visitas" fill="#2A4BDF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Bloco>
        <Bloco titulo="Até onde rolam" icone={ScrollText} sub="Visitas que passaram de cada ponto da página">
          <div className="space-y-2 pt-1">
            {d.rolagem.map((x) => {
              const p = total ? (100 * x.chegaram) / total : 0;
              return (
                <div key={x.marca} className="flex items-center gap-3">
                  <span className="w-14 text-[12px] font-body text-muted-foreground">{x.marca === 90 ? "fim" : `${x.marca}%`}</span>
                  <div className="flex-1 h-5 rounded-md bg-muted/70 overflow-hidden"><div className="h-full rounded-md bg-[#CE4A1D]" style={{ width: `${Math.max(p, 1)}%` }} /></div>
                  <span className="w-20 text-right text-[12px] font-body tabular-nums">{Math.round(p)}% · {n(x.chegaram)}</span>
                </div>
              );
            })}
          </div>
        </Bloco>
      </div>

      <Bloco titulo="Onde clicam" icone={MousePointerClick} sub="Todo clique em botão, link ou imagem. Altura = em que ponto da página (0% topo, 100% fim).">
        {d.cliques.length === 0 ? (
          <p className="text-sm font-body text-muted-foreground">Nenhum clique registrado ainda.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[12.5px] font-body">
              <thead className="text-muted-foreground"><tr className="text-left">
                {["Onde clicou", "Seção", "Pessoas", "Cliques", "Altura", "% das visitas"].map((h) => <th key={h} className="px-2 py-1.5 font-medium whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {d.cliques.map((c, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-2 py-1.5 min-w-[180px]">
                      <span className="text-foreground">{c.alvo}</span>
                      {c.leva_cadastro && <span className="ml-1.5 rounded-full bg-green-100 text-green-800 px-1.5 py-0.5 text-[10px] font-semibold">leva ao cadastro</span>}
                      {c.alvo.startsWith("imagem:") && <span className="ml-1.5 rounded-full bg-amber-100 text-amber-900 px-1.5 py-0.5 text-[10px] font-semibold">não é link</span>}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{nomeSecao(c.secao)}</td>
                    <td className="px-2 py-1.5 tabular-nums">{n(c.pessoas)}</td>
                    <td className="px-2 py-1.5 tabular-nums">{n(c.cliques)}</td>
                    <td className="px-2 py-1.5 tabular-nums">{c.pos_y != null ? `${c.pos_y}%` : "—"}</td>
                    <td className="px-2 py-1.5 tabular-nums">{total ? pc(Math.round((1000 * c.pessoas) / total) / 10) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloco>

      <div className="grid lg:grid-cols-2 gap-4">
        <Bloco titulo="Celular x computador" icone={Smartphone}>
          <TabelaSegmento linhas={d.dispositivos.map((x) => ({ ...x, nome: x.dispositivo === "mobile" ? "Celular" : x.dispositivo === "desktop" ? "Computador" : "?" }))} total={total} />
        </Bloco>
        <Bloco titulo="Por origem" icone={Route} sub="Que tipo de visita cada origem traz">
          <TabelaSegmento linhas={d.origens.map((x) => ({ ...x, nome: x.origem, sub: [x.campanha, x.conteudo].filter(Boolean).join(" · ") }))} total={total} />
        </Bloco>
      </div>

      <Bloco titulo="Dia a dia da página" icone={TrendingUp}>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={d.serie.map((s) => ({ ...s, dia: diaBr(s.dia) }))} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="v" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis yAxisId="t" orientation="right" tick={{ fontSize: 11 }} unit="s" />
              <Tooltip />
              <Bar yAxisId="v" dataKey="visitas" name="Visitas" fill="#F2C21E" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="v" dataKey="converteram" name="Clicaram em testar" fill="#3E9152" radius={[4, 4, 0, 0]} />
              <Line yAxisId="t" dataKey="tempo_mediano" name="Tempo mediano (s)" stroke="#2A4BDF" strokeWidth={2} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Bloco>
    </>
  );
}

function TabelaSegmento({ linhas, total }: { linhas: (Segmento & { nome: string; sub?: string })[]; total: number }) {
  if (!linhas.length) return <p className="text-sm font-body text-muted-foreground">Sem dado.</p>;
  return (
    <table className="w-full text-[12.5px] font-body">
      <thead className="text-muted-foreground"><tr className="text-left">
        {["", "Visitas", "Tempo", "Rolagem", "Sai em 5s", "Testar"].map((h) => <th key={h} className="py-1.5 pr-2 font-medium whitespace-nowrap">{h}</th>)}
      </tr></thead>
      <tbody>
        {linhas.slice(0, 10).map((l, i) => (
          <tr key={i} className="border-t border-border/60">
            <td className="py-1.5 pr-2"><span className="font-semibold text-foreground">{l.nome}</span>{l.sub ? <span className="block text-[11px] text-muted-foreground">{l.sub}</span> : null}</td>
            <td className="py-1.5 pr-2 tabular-nums">{n(l.visitas)} <span className="text-muted-foreground">({total ? Math.round((100 * l.visitas) / total) : 0}%)</span></td>
            <td className="py-1.5 pr-2 tabular-nums">{segs(l.tempo_mediano)}</td>
            <td className="py-1.5 pr-2 tabular-nums">{pc(l.scroll_medio)}</td>
            <td className="py-1.5 pr-2 tabular-nums">{pc(l.rejeicao)}</td>
            <td className="py-1.5 pr-2 tabular-nums font-semibold">{pc(l.conversao)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
