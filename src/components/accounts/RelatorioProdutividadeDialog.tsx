import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { hojeBR, parseDateOnly } from "@/lib/date-br";
import { usePdfExport } from "@/hooks/usePdfExport";
import { useCrmClients } from "@/hooks/useCrm";
import { useExternalClients } from "@/hooks/useCriaPost";
import { computeProdStats, useProdutividadePeriodo, type ProdutividadeRaw } from "@/hooks/useProdutividade";

// ── RELATÓRIO DE PRODUTIVIDADE (da operação, não do cliente) ─────────────────
// "Quanto EU produzi na semana/no mês": posts, captações, tarefas, criações e
// materiais, com comparação contra o período anterior. Mora num botão da Agenda
// de criação porque é de lá que a produção é tocada; o relatório white-label que
// vai PRO cliente é outro (ClientReportDialog) e continua onde estava.
//
// O corpo usa estilo inline com cores fixas (hex) porque o html2canvas do PDF
// não lê variáveis CSS em oklch: o mesmo nó da tela é o nó exportado.

const C = {
  ink: "#1a1a2e", sub: "#6b7280", line: "#e5e7eb", soft: "#f3f4f6",
  brand: "#EA4918", green: "#16a34a", orange: "#ea580c",
  blue: "#0061EE", pink: "#FF77B9", gold: "#CA8A04",
};

// Mesma semântica do relatório do cliente: null = "primeiro período" (sem base de
// comparação honesta); undefined = ainda carregando (não mostra nada).
type Delta = { dir: "up" | "down" | "flat"; pct: number | null; prev: number; diff: number } | null;
function deltaOf(cur: number, prev: number | null): Delta {
  if (prev === null) return null;
  const diff = cur - prev;
  const dir = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  // Sair de 0 pra qualquer coisa não tem percentual honesto.
  const pct = prev === 0 ? null : Math.round((diff / prev) * 100);
  return { dir, pct, prev, diff };
}

const nb = (n: number) => n.toLocaleString("pt-BR");

// Linha de variação embaixo do número grande: seta + percentual + valor anterior.
function DeltaLine({ d }: { d: Delta | undefined }) {
  if (d === undefined) return null;
  if (d === null) return <div style={{ fontSize: 10.5, color: C.sub, marginTop: 5 }}>primeiro período</div>;
  if (d.dir === "flat") return <div style={{ fontSize: 10.5, color: C.sub, marginTop: 5 }}>igual ao anterior ({nb(d.prev)})</div>;
  const up = d.dir === "up";
  return (
    <div style={{ fontSize: 10.5, marginTop: 5, color: up ? C.green : C.orange, fontWeight: 600 }}>
      {up ? "▲" : "▼"} {d.pct !== null ? `${Math.abs(d.pct)}%` : nb(Math.abs(d.diff))}
      <span style={{ color: C.sub, fontWeight: 400 }}> vs {nb(d.prev)}</span>
    </div>
  );
}

// Variação compacta, inline, pras linhas pequenas.
function DeltaInline({ d }: { d: Delta | undefined }) {
  if (d === undefined || d === null || d.dir === "flat") return null;
  const up = d.dir === "up";
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: up ? C.green : C.orange, marginLeft: 6 }}>
      {up ? "▲" : "▼"} {d.pct !== null ? `${Math.abs(d.pct)}%` : nb(Math.abs(d.diff))}
    </span>
  );
}

function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
const ddmm = (iso: string) => parseDateOnly(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

type Modo = "semana" | "mes";

// Período (from/to inclusivos), anterior equivalente e rótulo, a partir da âncora.
// Semana começa no DOMINGO, igual à grade da agenda.
function periodoDe(anchor: Date, modo: Modo) {
  if (modo === "mes") {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const pFirst = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
    const pLast = new Date(anchor.getFullYear(), anchor.getMonth(), 0);
    return {
      from: ymd(first), to: ymd(last), prevFrom: ymd(pFirst), prevTo: ymd(pLast),
      label: first.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      prevLabel: pFirst.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    };
  }
  const start = new Date(anchor); start.setDate(start.getDate() - start.getDay()); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const pStart = new Date(start); pStart.setDate(pStart.getDate() - 7);
  const pEnd = new Date(start); pEnd.setDate(pEnd.getDate() - 1);
  const from = ymd(start); const to = ymd(end);
  return {
    from, to, prevFrom: ymd(pStart), prevTo: ymd(pEnd),
    label: `${ddmm(from)} a ${ddmm(to)}`,
    prevLabel: `${ddmm(ymd(pStart))} a ${ddmm(ymd(pEnd))}`,
  };
}

// Ranking simples de quem consumiu mais produção no período: posts (data agendada)
// + tarefas (prazo no período) + captações (não canceladas). Item sem cliente fica fora.
type RankRow = { key: string; name: string; posts: number; tarefas: number; capts: number; total: number };
function buildRanking(
  raw: ProdutividadeRaw | undefined,
  from: string, to: string,
  crmName: Map<string, string>,
  ext: Map<string, { name: string; crm_client_id: string | null }>,
): RankRow[] {
  if (!raw) return [];
  const map = new Map<string, RankRow>();
  const bump = (key: string, name: string, f: "posts" | "tarefas" | "capts") => {
    const row = map.get(key) ?? { key, name, posts: 0, tarefas: 0, capts: 0, total: 0 };
    row[f] += 1; row.total += 1; map.set(key, row);
  };
  for (const p of raw.posts) {
    if (!p.external_client_id) continue;
    const e = ext.get(p.external_client_id);
    // Unifica pelo cliente central quando o vínculo existe (mesmo cliente em tabelas diferentes).
    const key = e?.crm_client_id ? `crm:${e.crm_client_id}` : `ext:${p.external_client_id}`;
    const name = (e?.crm_client_id ? crmName.get(e.crm_client_id) : null) ?? e?.name ?? "Cliente";
    bump(key, name, "posts");
  }
  for (const t of raw.tasks) {
    if (!t.crm_client_id || !t.due_date || t.due_date < from || t.due_date > to) continue;
    bump(`crm:${t.crm_client_id}`, crmName.get(t.crm_client_id) ?? "Cliente", "tarefas");
  }
  for (const c of raw.captures) {
    if (c.status === "cancelada") continue;
    if (c.crm_client_id) bump(`crm:${c.crm_client_id}`, crmName.get(c.crm_client_id) ?? c.client_name ?? "Cliente", "capts");
    else if (c.client_name?.trim()) bump(`nome:${c.client_name.trim().toLowerCase()}`, c.client_name.trim(), "capts");
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 6);
}

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function RelatorioProdutividadeDialog({ open, onOpenChange }: Props) {
  const [modo, setModo] = useState<Modo>("mes");
  const [anchor, setAnchor] = useState<Date>(() => parseDateOnly(hojeBR()));
  const [downloading, setDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const { exportPdf } = usePdfExport();

  const per = useMemo(() => periodoDe(anchor, modo), [anchor, modo]);
  const cur = useProdutividadePeriodo(per.from, per.to, open);
  const prev = useProdutividadePeriodo(per.prevFrom, per.prevTo, open);

  const stats = useMemo(() => computeProdStats(cur.data, per.from, per.to), [cur.data, per.from, per.to]);
  const prevStats = useMemo(() => computeProdStats(prev.data, per.prevFrom, per.prevTo), [prev.data, per.prevFrom, per.prevTo]);

  // Sem NADA no período anterior, comparar viraria "+100% do zero": mostramos
  // "primeiro período" em vez de percentual mentiroso. undefined = ainda carregando.
  const d = useMemo(() => {
    const base = (n: number): number | null | undefined =>
      prev.isSuccess ? (prevStats.temAlgo ? n : null) : undefined;
    const mk = (curN: number, prevN: number): Delta | undefined => {
      const b = base(prevN);
      return b === undefined ? undefined : deltaOf(curN, b);
    };
    return {
      publicados: mk(stats.posts.publicados, prevStats.posts.publicados),
      captConcluidas: mk(stats.capt.concluidas, prevStats.capt.concluidas),
      tarefasConcluidas: mk(stats.tarefas.concluidas, prevStats.tarefas.concluidas),
      postsTotal: mk(stats.posts.total, prevStats.posts.total),
      aprovados: mk(stats.posts.aprovados, prevStats.posts.aprovados),
      emAprovacao: mk(stats.posts.emAprovacao, prevStats.posts.emAprovacao),
      emProducao: mk(stats.posts.emProducao, prevStats.posts.emProducao),
      captAgendadas: mk(stats.capt.agendadas, prevStats.capt.agendadas),
      tarefasCriadas: mk(stats.tarefas.criadas, prevStats.tarefas.criadas),
      criacoes: mk(stats.criacoes, prevStats.criacoes),
      materiais: mk(stats.materiais.total, prevStats.materiais.total),
    };
  }, [stats, prevStats, prev.isSuccess]);

  const { data: crmClients = [] } = useCrmClients();
  const { clients: extClients } = useExternalClients();
  const crmName = useMemo(() => new Map(crmClients.map((c) => [c.id, c.name])), [crmClients]);
  const extMap = useMemo(
    () => new Map(extClients.map((e) => [e.id, { name: e.name, crm_client_id: e.crm_client_id ?? null }])),
    [extClients],
  );
  const ranking = useMemo(
    () => buildRanking(cur.data, per.from, per.to, crmName, extMap),
    [cur.data, per.from, per.to, crmName, extMap],
  );
  const rankMax = ranking[0]?.total ?? 0;

  const nav = (dir: -1 | 1) => setAnchor((a) => {
    const n = new Date(a);
    modo === "mes" ? n.setMonth(n.getMonth() + dir) : n.setDate(n.getDate() + dir * 7);
    return n;
  });

  const download = async () => {
    setDownloading(true);
    try {
      await exportPdf(reportRef, `produtividade-${modo}-${per.from}`);
    } finally {
      setDownloading(false);
    }
  };

  // Número grande + rótulo + variação (os 3 principais).
  const bigCard = (label: string, value: number, color: string, delta: Delta | undefined) => (
    <div key={label} data-pdf-block style={{ flex: 1, minWidth: 108, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 14px" }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{nb(value)}</div>
      <div style={{ fontSize: 10.5, color: C.sub, marginTop: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <DeltaLine d={delta} />
    </div>
  );

  // Linha compacta: rótulo, valor e variação inline.
  const row = (label: string, value: number, delta?: Delta | undefined) => (
    <div key={label} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: `1px solid ${C.soft}` }}>
      <span style={{ fontSize: 12.5, color: C.ink }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, whiteSpace: "nowrap" }}>
        {nb(value)}<DeltaInline d={delta} />
      </span>
    </div>
  );

  const sectionTitle = (t: string) => (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: C.sub, marginBottom: 6 }}>{t}</div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Relatório de produtividade</DialogTitle>
        </DialogHeader>

        {/* Alternador Semana/Mês + navegação de período, começando no atual. */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {(["semana", "mes"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setModo(v)}
                className={cn("px-3 py-1.5 text-xs font-body font-semibold transition-colors",
                  modo === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {v === "semana" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="Período anterior" onClick={() => nav(-1)}>‹</Button>
            <span className="text-xs font-body text-muted-foreground px-1 capitalize">{per.label}</span>
            <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => setAnchor(parseDateOnly(hojeBR()))}>Atual</Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="Próximo período" onClick={() => nav(1)}>›</Button>
          </div>
        </div>

        {cur.isPending ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div ref={reportRef} style={{ background: "#ffffff", color: C.ink, borderRadius: 12, padding: "18px 16px", fontFamily: "Inter, system-ui, sans-serif" }}>
            {/* Cabeçalho do relatório (sai no PDF também). */}
            <div data-pdf-block style={{ paddingBottom: 12, borderBottom: `2px solid ${C.brand}`, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Produtividade da operação</div>
                <div style={{ fontSize: 11.5, color: C.sub, textTransform: "capitalize" }}>{modo === "mes" ? per.label : `Semana de ${per.label}`}</div>
              </div>
              <div style={{ fontSize: 10.5, color: C.sub }}>vs {modo === "mes" ? per.prevLabel : `semana de ${per.prevLabel}`}</div>
            </div>

            {!stats.temAlgo ? (
              <div style={{ marginTop: 16, padding: "26px 18px", border: `1px dashed ${C.line}`, borderRadius: 12, background: C.soft, textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Nada registrado neste período</div>
                <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>
                  Nenhum post agendado, captação, tarefa, criação ou material caiu {modo === "mes" ? "em" : "na semana de"} {per.label}. Use as setas pra ver outro período.
                </div>
              </div>
            ) : (
              <>
                {/* Os 3 números principais. */}
                <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                  {bigCard("Posts publicados", stats.posts.publicados, C.brand, d.publicados)}
                  {bigCard("Captações concluídas", stats.capt.concluidas, C.pink, d.captConcluidas)}
                  {bigCard("Tarefas concluídas", stats.tarefas.concluidas, C.blue, d.tarefasConcluidas)}
                </div>

                <div data-pdf-block style={{ marginTop: 16 }}>
                  {sectionTitle("Posts no período")}
                  {row("Em produção", stats.posts.emProducao, d.emProducao)}
                  {row("Enviados pra aprovação", stats.posts.emAprovacao, d.emAprovacao)}
                  {row("Aprovados", stats.posts.aprovados, d.aprovados)}
                  {row("Publicados", stats.posts.publicados, d.publicados)}
                  {row("Total no fluxo", stats.posts.total, d.postsTotal)}
                </div>

                <div data-pdf-block style={{ marginTop: 16 }}>
                  {sectionTitle("Captações")}
                  {row("Agendadas", stats.capt.agendadas, d.captAgendadas)}
                  {row("Concluídas", stats.capt.concluidas, d.captConcluidas)}
                  {stats.capt.canceladas > 0 && row("Canceladas", stats.capt.canceladas)}
                </div>

                <div data-pdf-block style={{ marginTop: 16 }}>
                  {sectionTitle("Tarefas")}
                  {row("Criadas no período", stats.tarefas.criadas, d.tarefasCriadas)}
                  {row("Concluídas (pelo prazo)", stats.tarefas.concluidas, d.tarefasConcluidas)}
                </div>

                <div data-pdf-block style={{ marginTop: 16 }}>
                  {sectionTitle("Criações e materiais")}
                  {row("Criações na agenda", stats.criacoes, d.criacoes)}
                  {row("Materiais com prazo", stats.materiais.total, d.materiais)}
                  {stats.materiais.total > 0 && row("Materiais finalizados", stats.materiais.finalizados)}
                </div>

                {ranking.length > 0 && (
                  <div data-pdf-block style={{ marginTop: 16 }}>
                    {sectionTitle("Produção por cliente")}
                    {ranking.map((r) => (
                      <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 110, fontSize: 12, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                        <div style={{ flex: 1, height: 8, background: C.soft, borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ width: `${rankMax > 0 ? Math.max(4, (r.total / rankMax) * 100) : 0}%`, height: "100%", background: C.brand }} />
                        </div>
                        <div style={{ width: 132, textAlign: "right", fontSize: 11, color: C.sub, whiteSpace: "nowrap" }}>
                          <b style={{ color: C.ink, fontSize: 12 }}>{r.total}</b>
                          {" · "}{r.posts}p {r.tarefas}t {r.capts}c
                        </div>
                      </div>
                    ))}
                    <div style={{ fontSize: 10, color: C.sub }}>p = posts, t = tarefas, c = captações</div>
                  </div>
                )}
              </>
            )}

            {/* Como cada número entra no período: melhor dizer do que deixar dúvida. */}
            <div data-pdf-block style={{ marginTop: 16, paddingTop: 10, borderTop: `1px solid ${C.line}`, fontSize: 10, color: C.sub, lineHeight: 1.5 }}>
              Posts contam pela data agendada (post sem data não entra). Tarefas concluídas contam pelo prazo,
              porque não existe registro da data em que foram concluídas. Materiais contam pelo prazo.
            </div>
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={download} disabled={downloading || cur.isPending}>
            {downloading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Gerando…</> : <><Download className="h-4 w-4 mr-1.5" /> Baixar PDF</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
