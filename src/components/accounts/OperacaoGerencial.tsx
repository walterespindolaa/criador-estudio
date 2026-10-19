import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, MessageSquareQuote, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/AccountContext";
import { parseDateOnly } from "@/lib/date-br";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   VISÃO GERENCIAL DA OPERAÇÃO (Walter, 19/10/2026; mockup aprovado)

   O topo do Relatório da operação pensando em agência: o que foi pro
   parceiro, o que os clientes mais pedem pra ajustar e quem teve mais post.
   Tudo vem do RPC relatorio_operacao. Os ajustes só existem a partir do
   registro (post_ajustes): outubro/2026 foi recuperado dos comentários do
   cliente; antes disso o bloco mostra que não há dado, sem inventar.
   ═══════════════════════════════════════════════════════════════════════════ */

type Etapa = "tema" | "conteudo" | "midia" | "legenda" | "geral";
type ClienteN = { cliente_id: string | null; nome: string | null; cor: string | null; total: number };
type AjusteCliente = ClienteN & { etapas: Partial<Record<Etapa, number>> };
type Peca = { post_id: string; titulo: string | null; cliente: string | null; prazo: string | null; entregue_em: string | null; status: string | null; revisoes: number };
type Parceiro = { parceiro_id: string; nome: string; papel: string | null; pecas: number; entregues: number; no_prazo: number; com_prazo: number; refacoes: number; itens: Peca[] };
type Pedido = { texto: string; em: string; cliente: string | null; etapa: Etapa };
export type RelOperacao = {
  posts_total: number; posts_publicados: number; posts_por_cliente: ClienteN[];
  ajustes_total: number; ajustes_por_etapa: Partial<Record<Etapa, number>>; ajustes_por_cliente: AjusteCliente[];
  rodadas: number; posts_enviados: number; aprovados_total: number; aprovados_de_primeira: number;
  ultimos_pedidos: Pedido[]; parceiros: Parceiro[]; ajustes_desde: string | null;
};

/** Data em que o registro de ajustes passou a valer (outubro recuperado). */
const AJUSTES_DESDE = "2026-10-01";
const ETAPA_ROTULO: Record<Etapa, string> = {
  legenda: "Legenda", midia: "Arte / vídeo", conteudo: "Conteúdo", tema: "Tema", geral: "Sem etapa marcada",
};
const PAPEL: Record<string, string> = { designer: "design", editor_video: "vídeo", copy: "copy", trafego: "tráfego", filmmaker: "captação" };

type RpcSolto = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
const rpc = supabase.rpc.bind(supabase) as unknown as RpcSolto;

function useRelOperacao(owner: string | null | undefined, de: string, ate: string) {
  return useQuery<RelOperacao | null>({
    queryKey: ["relatorio-operacao", owner, de, ate],
    enabled: !!owner,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await rpc("relatorio_operacao", { _owner: owner, _de: de, _ate: ate });
      if (error) throw error;
      return (data as RelOperacao | null) ?? null;
    },
  });
}

const fmt1 = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const dataCurta = (s: string | null) => s ? parseDateOnly(s.slice(0, 10)).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";

function Kpi({ valor, rotulo, nota, ruim }: { valor: string; rotulo: string; nota?: string; ruim?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-2xl font-display font-extrabold tabular-nums leading-tight">{valor}</p>
      <p className="text-[12px] font-body text-muted-foreground">{rotulo}</p>
      {nota && <p className={cn("text-[11px] font-body font-bold mt-1", ruim ? "text-red-500" : "text-emerald-600")}>{nota}</p>}
    </div>
  );
}

function Barra({ rotulo, valor, max, extra, cor }: { rotulo: string; valor: number; max: number; extra?: string; cor?: string | null }) {
  const w = max > 0 ? Math.round((valor / max) * 100) : 0;
  return (
    <div className="grid grid-cols-[minmax(0,130px),1fr,auto] items-center gap-3 py-1.5 text-[13px] font-body">
      <span className="truncate flex items-center gap-1.5">
        {cor && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cor }} />}
        {rotulo}
      </span>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${w}%` }} /></div>
      <span className="text-right tabular-nums font-bold whitespace-nowrap">{valor}{extra && <span className="ml-1 text-[11px] font-normal text-muted-foreground">{extra}</span>}</span>
    </div>
  );
}

function Cartao({ titulo, desc, children, className }: { titulo: string; desc?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <p className="font-display font-extrabold text-[15px] text-foreground">{titulo}</p>
      {desc && <p className="text-[12px] font-body text-muted-foreground mb-3">{desc}</p>}
      {children}
    </div>
  );
}

export function OperacaoGerencial({ from, to, pFrom, pTo }: { from: string; to: string; pFrom: string; pTo: string }) {
  const { agencyOwnerId } = useActiveAccount();
  const atualQ = useRelOperacao(agencyOwnerId, from, to);
  const antQ = useRelOperacao(agencyOwnerId, pFrom, pTo);
  const r = atualQ.data;
  const a = antQ.data;
  const [aberto, setAberto] = useState<string | null>(null);

  const temAjustes = to >= AJUSTES_DESDE;
  const antTemAjustes = pTo >= AJUSTES_DESDE;
  const parcial = temAjustes && from < AJUSTES_DESDE;

  const etapas = useMemo(() => {
    const e = r?.ajustes_por_etapa ?? {};
    return (Object.keys(e) as Etapa[]).map((k) => ({ k, n: e[k] ?? 0 })).sort((x, y) => y.n - x.n);
  }, [r]);

  // Gargalo: a etapa (de verdade, não "sem etapa") que mais puxa ajuste e os
  // dois clientes que mais pedem nela.
  const gargalo = useMemo(() => {
    if (!r || r.ajustes_total < 3) return null;
    const top = etapas.find((e) => e.k !== "geral");
    if (!top || top.n < 2) return null;
    const porCliente = (r.ajustes_por_cliente ?? [])
      .map((c) => ({ nome: c.nome ?? "Sem cliente", n: c.etapas?.[top.k] ?? 0 }))
      .filter((c) => c.n > 0).sort((x, y) => y.n - x.n).slice(0, 2);
    const somaTop2 = porCliente.reduce((s, c) => s + c.n, 0);
    return { etapa: ETAPA_ROTULO[top.k].toLowerCase(), pct: Math.round((top.n / r.ajustes_total) * 100), n: top.n, clientes: porCliente, somaTop2 };
  }, [r, etapas]);

  if (atualQ.isError) {
    // Parceiro também abre este relatório, mas a visão da operação é de quem
    // gerencia a conta (o RPC barra com 42501): aí só explica, sem erro.
    const semAcesso = (atualQ.error as { code?: string } | null)?.code === "42501";
    return <p className="text-sm font-body text-muted-foreground">{semAcesso ? "Esta parte é só pra quem gerencia a conta." : "Não consegui carregar a visão gerencial agora."}</p>;
  }
  if (!r) return <div className="h-40 rounded-2xl border border-border bg-card animate-pulse" />;

  const pctDelta = (atual: number, ant: number | undefined) => {
    if (ant === undefined || ant === 0) return undefined;
    const p = Math.round(((atual - ant) / ant) * 100);
    return { txt: `${p > 0 ? "+" : ""}${p}% vs anterior`, ruim: p < 0 };
  };
  const dPosts = pctDelta(r.posts_total, a?.posts_total);
  const totalParceiro = r.parceiros.reduce((s, p) => s + p.pecas, 0);
  const rodadasPorPost = r.posts_enviados > 0 ? r.rodadas / r.posts_enviados : 0;
  const rodadasAnt = a && a.posts_enviados > 0 && antTemAjustes ? a.rodadas / a.posts_enviados : undefined;
  const primeira = r.aprovados_total > 0 ? Math.round((r.aprovados_de_primeira / r.aprovados_total) * 100) : null;
  const primeiraAnt = a && a.aprovados_total > 0 && antTemAjustes ? Math.round((a.aprovados_de_primeira / a.aprovados_total) * 100) : undefined;
  const maxEtapa = etapas[0]?.n ?? 0;
  const antPorCliente = new Map((a?.posts_por_cliente ?? []).map((c) => [c.cliente_id ?? "", c.total]));
  const topClientes = r.posts_por_cliente.slice(0, 6);
  const restoClientes = r.posts_por_cliente.slice(6);
  const maxPosts = topClientes[0]?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi valor={String(r.posts_total)} rotulo="posts no período" nota={dPosts?.txt} ruim={dPosts?.ruim} />
        <Kpi valor={String(totalParceiro)} rotulo="foram pro parceiro"
          nota={r.posts_total > 0 && totalParceiro > 0 ? `${Math.round((totalParceiro / r.posts_total) * 100)}% da produção` : undefined} />
        <Kpi valor={temAjustes ? fmt1(rodadasPorPost) : "sem dado"} rotulo="rodadas de ajuste por post enviado"
          nota={temAjustes && rodadasAnt !== undefined ? `${rodadasPorPost - rodadasAnt > 0 ? "+" : ""}${fmt1(rodadasPorPost - rodadasAnt)} vs anterior` : undefined}
          ruim={rodadasAnt !== undefined && rodadasPorPost > rodadasAnt} />
        <Kpi valor={temAjustes && primeira !== null ? `${primeira}%` : "sem dado"} rotulo="aprovados de primeira"
          nota={primeira !== null && primeiraAnt !== undefined ? `${primeira - primeiraAnt > 0 ? "+" : ""}${primeira - primeiraAnt} pontos` : undefined}
          ruim={primeira !== null && primeiraAnt !== undefined && primeira < primeiraAnt} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] gap-4">
        <Cartao titulo="O que os clientes mais pedem pra ajustar"
          desc={temAjustes ? `Cada pedido de ajuste do link de aprovação, por parte do post. ${r.ajustes_total} ${r.ajustes_total === 1 ? "pedido" : "pedidos"} no período.` : undefined}>
          {!temAjustes ? (
            <p className="text-[13px] font-body text-muted-foreground">Os ajustes começaram a ser registrados em outubro de 2026. Escolha um período a partir daí.</p>
          ) : r.ajustes_total === 0 ? (
            <p className="text-[13px] font-body text-muted-foreground">Nenhum pedido de ajuste no período.</p>
          ) : (
            <>
              {etapas.map((e) => (
                <Barra key={e.k} rotulo={ETAPA_ROTULO[e.k]} valor={e.n} max={maxEtapa}
                  extra={`${Math.round((e.n / r.ajustes_total) * 100)}%`} />
              ))}
              {gargalo && (
                <div className="mt-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-[12.5px] font-body leading-relaxed flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong>Onde está o gargalo:</strong> {gargalo.etapa} puxa {gargalo.pct}% dos ajustes
                    {gargalo.clientes.length > 0 && <>, e {gargalo.somaTop2} dos {gargalo.n} vieram de {gargalo.clientes.map((c) => c.nome).join(" e ")}</>}.
                  </span>
                </div>
              )}
              {r.ultimos_pedidos.length > 0 && (
                <div className="mt-3">
                  <p className="text-[12px] font-body text-muted-foreground mb-1 flex items-center gap-1.5"><MessageSquareQuote className="h-3.5 w-3.5" /> Últimos pedidos (o que o cliente escreveu)</p>
                  {r.ultimos_pedidos.map((p, i) => (
                    <p key={i} className="text-[12.5px] font-body text-foreground/80 border-l-2 border-border pl-2.5 my-1.5">
                      "{p.texto}" <span className="text-muted-foreground">· {p.cliente ?? "Sem cliente"} · {ETAPA_ROTULO[p.etapa] ?? "Sem etapa marcada"}</span>
                    </p>
                  ))}
                </div>
              )}
              {(parcial || etapas.some((e) => e.k === "geral")) && (
                <p className="text-[11px] font-body text-muted-foreground mt-2">
                  {parcial && "Antes de outubro de 2026 não há registro de ajuste. "}
                  {etapas.some((e) => e.k === "geral") && "\"Sem etapa marcada\" é pedido feito no post inteiro (aprovação rápida) ou recuperado dos comentários de outubro."}
                </p>
              )}
            </>
          )}
        </Cartao>

        <Cartao titulo="Ajustes por cliente" desc="Quem mais pede ajuste, e em quê.">
          {!temAjustes || r.ajustes_por_cliente.length === 0 ? (
            <p className="text-[13px] font-body text-muted-foreground">{temAjustes ? "Nenhum cliente pediu ajuste no período." : "Sem registro de ajuste nesse período."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] font-body">
                <thead><tr className="text-[11px] text-muted-foreground text-left border-b border-border">
                  <th className="py-1.5 font-semibold">Cliente</th><th className="py-1.5 font-semibold text-right">Posts</th>
                  <th className="py-1.5 font-semibold text-right">Ajustes</th><th className="py-1.5 font-semibold pl-3">Mais pedido</th>
                </tr></thead>
                <tbody>
                  {r.ajustes_por_cliente.slice(0, 8).map((c) => {
                    const posts = r.posts_por_cliente.find((p) => p.cliente_id === c.cliente_id)?.total ?? 0;
                    const top = (Object.entries(c.etapas ?? {}) as [Etapa, number][]).sort((x, y) => y[1] - x[1])[0];
                    return (
                      <tr key={c.cliente_id ?? "sem"} className="border-b border-border/60 last:border-0">
                        <td className="py-2"><span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.cor ?? "#9CA3AF" }} />{c.nome ?? "Sem cliente"}</span></td>
                        <td className="py-2 text-right tabular-nums font-bold">{posts}</td>
                        <td className="py-2 text-right tabular-nums font-bold">{c.total}</td>
                        <td className="py-2 pl-3">{top && <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5 bg-amber-100 text-amber-800">{ETAPA_ROTULO[top[0]]}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Cartao>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] gap-4">
        <Cartao titulo="Posts por cliente" desc="Posts do período por cliente, comparado com o período anterior.">
          {topClientes.length === 0 ? (
            <p className="text-[13px] font-body text-muted-foreground">Nenhum post de cliente no período.</p>
          ) : (
            <>
              {topClientes.map((c) => {
                const ant = antPorCliente.get(c.cliente_id ?? "") ?? 0;
                const d = c.total - ant;
                return <Barra key={c.cliente_id ?? "sem"} rotulo={c.nome ?? "Sem cliente"} cor={c.cor} valor={c.total} max={maxPosts}
                  extra={d === 0 ? "=" : `${d > 0 ? "+" : ""}${d}`} />;
              })}
              {restoClientes.length > 0 && (
                <p className="text-[12px] font-body text-muted-foreground mt-1">
                  + {restoClientes.length} {restoClientes.length === 1 ? "cliente" : "clientes"} com {restoClientes.reduce((s, c) => s + c.total, 0)} posts
                </p>
              )}
            </>
          )}
        </Cartao>

        <Cartao titulo="Produção com parceiros" desc="O que foi pro parceiro e como voltou. Toque no nome pra ver as peças.">
          {r.parceiros.length === 0 ? (
            <p className="text-[13px] font-body text-muted-foreground">Nenhuma peça enviada pra parceiro no período.</p>
          ) : (
            <div className="divide-y divide-border/60">
              <div className="grid grid-cols-[1fr,52px,64px,64px] gap-2 text-[11px] font-body font-semibold text-muted-foreground pb-1.5">
                <span>Parceiro</span><span className="text-right">Peças</span><span className="text-right">No prazo</span><span className="text-right">Refação</span>
              </div>
              {r.parceiros.map((p) => {
                const open = aberto === p.parceiro_id;
                return (
                  <div key={p.parceiro_id}>
                    <button type="button" onClick={() => setAberto(open ? null : p.parceiro_id)}
                      className="w-full grid grid-cols-[1fr,52px,64px,64px] gap-2 items-center py-2 text-[13px] font-body text-left hover:bg-muted/40 rounded-lg">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                        <span className="truncate">{p.nome}{p.papel && PAPEL[p.papel] ? ` (${PAPEL[p.papel]})` : ""}</span>
                      </span>
                      <span className="text-right tabular-nums font-bold">{p.pecas}</span>
                      <span className="text-right tabular-nums font-bold" title={`${p.com_prazo} entregues com prazo`}>{p.com_prazo > 0 ? `${p.no_prazo}/${p.com_prazo}` : "-"}</span>
                      <span className="text-right tabular-nums font-bold">{p.refacoes}</span>
                    </button>
                    {open && (
                      <ul className="pb-2 pl-5 space-y-1">
                        {p.itens.map((it) => (
                          <li key={it.post_id} className="text-[12px] font-body text-muted-foreground flex flex-wrap gap-x-2">
                            <span className="text-foreground font-medium">{it.titulo || "Sem título"}</span>
                            <span>· {it.cliente ?? "Sem cliente"}</span>
                            {it.entregue_em ? <span>· entregue {dataCurta(it.entregue_em)}</span> : <span>· {it.status === "em_producao" ? "em produção" : "aguardando"}</span>}
                            {it.prazo && <span>· prazo {dataCurta(it.prazo)}</span>}
                            {it.revisoes > 0 && <span>· {it.revisoes} {it.revisoes === 1 ? "volta" : "voltas"}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Cartao>
      </div>
    </div>
  );
}

