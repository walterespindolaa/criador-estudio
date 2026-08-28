import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { hojeBR, parseDateOnly } from "@/lib/date-br";
import { usePdfExport } from "@/hooks/usePdfExport";
import { useCrmClients } from "@/hooks/useCrm";
import { useExternalClients } from "@/hooks/useCriaPost";
import { computeProdStats, useProdutividadePeriodo, type ProdCapture, type ProdPost, type ProdutividadeRaw } from "@/hooks/useProdutividade";
import { FORMAT_LABELS } from "@/lib/constants";
import { nomeExibidoCliente } from "@/lib/cliente-nome";

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

// Ícones desenhados como SVG inline (não lucide) de propósito: o html2canvas do
// PDF fotografa formas simples com segurança, e emoji/glifo de relógio varia de
// fonte pra fonte. Check verde = concluída, relógio dourado = agendada.
const IconeCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" style={{ flexShrink: 0, display: "block" }} aria-label="Concluída">
    <path d="M20 6L9 17l-5-5" fill="none" stroke={C.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconeRelogio = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" style={{ flexShrink: 0, display: "block" }} aria-label="Agendada">
    <circle cx="12" cy="12" r="9" fill="none" stroke={C.gold} strokeWidth="2.5" />
    <path d="M12 7v5l3.2 2" fill="none" stroke={C.gold} strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

// "HH:MM:SS" do banco vira "HH:MM" pra leitura.
const horaCurta = (t: string | null) => (t ? t.slice(0, 5) : null);

// Mesma chave de agrupamento do ranking, pra casar captação com a linha do cliente.
const chaveCaptura = (c: ProdCapture): string | null =>
  c.crm_client_id ? `crm:${c.crm_client_id}` : c.client_name?.trim() ? `nome:${c.client_name.trim().toLowerCase()}` : null;

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

// PANORAMA POR CLIENTE. Pra o gestor bater o olho e ver TUDO que fez de cada
// cliente no período sem abrir o relatório de cada um: quantos posts SAÍRAM
// (publicados, o número que mais importa), o funil resumido (aprovados/aguardando/
// em produção), captações concluídas e tarefas concluídas. É a evolução do antigo
// ranking "Produção por cliente" (mesma chave de agrupamento, mesma unificação de
// cliente via ext→crm), só que aberto por status em vez de um total cego.
//
// Atribuição por status (mesma régua do computeProdStats, pra bater com o topo):
//  - publicados  = approval_status "postado"
//  - aprovados   = "aprovado"
//  - aguardando  = "pendente" + "ajuste_solicitado"
//  - em produção = "em_producao" + null (post recém-criado sem status)
// Tarefas: só concluídas com prazo no período. Captações: não canceladas.
// Cliente sem nada no período fica de fora.
type PanoramaRow = {
  key: string; name: string;
  publicados: number; aprovados: number; aguardando: number; emProducao: number; postsTotal: number;
  captConcluidas: number; captAgendadas: number; tarefas: number;
  peso: number; // volume total, só pra ordenar e desempatar
  postsPublicados: ProdPost[]; // pro detalhe expandível (os posts que saíram)
};
function buildPanorama(
  raw: ProdutividadeRaw | undefined,
  from: string, to: string,
  crmName: Map<string, string>,
  ext: Map<string, { name: string; crm_client_id: string | null }>,
): PanoramaRow[] {
  if (!raw) return [];
  const map = new Map<string, PanoramaRow>();
  const get = (key: string, name: string): PanoramaRow => {
    let row = map.get(key);
    if (!row) {
      row = {
        key, name, publicados: 0, aprovados: 0, aguardando: 0, emProducao: 0, postsTotal: 0,
        captConcluidas: 0, captAgendadas: 0, tarefas: 0, peso: 0, postsPublicados: [],
      };
      map.set(key, row);
    }
    // Quem chegou primeiro pode ter caído no genérico "Cliente"; um nome melhor sobrescreve.
    if (name && name !== "Cliente" && row.name === "Cliente") row.name = name;
    return row;
  };
  for (const p of raw.posts) {
    if (!p.external_client_id) continue;
    const e = ext.get(p.external_client_id);
    // Unifica pelo cliente central quando o vínculo existe (mesmo cliente em tabelas diferentes).
    const key = e?.crm_client_id ? `crm:${e.crm_client_id}` : `ext:${p.external_client_id}`;
    const name = (e?.crm_client_id ? crmName.get(e.crm_client_id) : null) ?? e?.name ?? "Cliente";
    const row = get(key, name);
    row.postsTotal += 1;
    const s = p.approval_status;
    if (s === "postado") { row.publicados += 1; row.postsPublicados.push(p); }
    else if (s === "aprovado") row.aprovados += 1;
    else if (s === "pendente" || s === "ajuste_solicitado") row.aguardando += 1;
    else row.emProducao += 1; // "em_producao" + null
  }
  for (const t of raw.tasks) {
    if (!t.crm_client_id || t.status !== "concluida" || !t.due_date || t.due_date < from || t.due_date > to) continue;
    get(`crm:${t.crm_client_id}`, crmName.get(t.crm_client_id) ?? "Cliente").tarefas += 1;
  }
  for (const c of raw.captures) {
    if (c.status === "cancelada") continue;
    const key = c.crm_client_id ? `crm:${c.crm_client_id}` : c.client_name?.trim() ? `nome:${c.client_name.trim().toLowerCase()}` : null;
    if (!key) continue;
    const name = (c.crm_client_id ? crmName.get(c.crm_client_id) : null) ?? c.client_name?.trim() ?? "Cliente";
    const row = get(key, name);
    if (c.status === "concluida") row.captConcluidas += 1;
    else row.captAgendadas += 1;
  }
  for (const r of map.values()) {
    r.peso = r.postsTotal + r.captConcluidas + r.captAgendadas + r.tarefas;
    r.postsPublicados.sort((a, b) =>
      `${a.scheduled_date} ${a.scheduled_time ?? ""}`.localeCompare(`${b.scheduled_date} ${b.scheduled_time ?? ""}`));
  }
  // Ordena por quem mais PUBLICOU (o que o gestor quer ver primeiro), desempata por
  // volume total e depois alfabético. Mostra todos com produção, não só um top N.
  return Array.from(map.values())
    .filter((r) => r.peso > 0)
    .sort((a, b) => b.publicados - a.publicados || b.peso - a.peso || a.name.localeCompare(b.name, "pt-BR"));
}

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function RelatorioProdutividadeDialog({ open, onOpenChange }: Props) {
  const [modo, setModo] = useState<Modo>("mes");
  const [anchor, setAnchor] = useState<Date>(() => parseDateOnly(hojeBR()));
  const [downloading, setDownloading] = useState(false);
  // Lista geral de captações aberta/fechada e qual cliente do ranking está expandido.
  const [captAberta, setCaptAberta] = useState(false);
  const [clienteAberto, setClienteAberto] = useState<string | null>(null);
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
  // Nome exibido = apelido do gestor quando existir (nomeExibidoCliente), senão o nome do CRM.
  const crmName = useMemo(() => new Map(crmClients.map((c) => [c.id, nomeExibidoCliente(c) || c.name])), [crmClients]);
  const extMap = useMemo(
    () => new Map(extClients.map((e) => [e.id, { name: e.name, crm_client_id: e.crm_client_id ?? null }])),
    [extClients],
  );
  const panorama = useMemo(
    () => buildPanorama(cur.data, per.from, per.to, crmName, extMap),
    [cur.data, per.from, per.to, crmName, extMap],
  );
  // Base da barrinha: quem mais publicou. Se ninguém publicou ainda no período, não desenha barra (seria vazia e mentirosa).
  const maxPublicados = useMemo(() => panorama.reduce((m, r) => Math.max(m, r.publicados), 0), [panorama]);

  // Captações do período em ordem cronológica, sem as canceladas (mesma régua da
  // contagem do ranking). É o detalhe do que já é contado, não métrica nova.
  const capsPeriodo = useMemo(() => {
    const list = (cur.data?.captures ?? []).filter((c) => c.status !== "cancelada");
    return [...list].sort((a, b) =>
      `${a.capture_date} ${a.capture_time ?? ""}`.localeCompare(`${b.capture_date} ${b.capture_time ?? ""}`),
    );
  }, [cur.data]);

  const nomeCaptura = (c: ProdCapture) =>
    (c.crm_client_id ? crmName.get(c.crm_client_id) : null) ?? c.client_name?.trim() ?? "Sem cliente";

  const nav = (dir: -1 | 1) => setAnchor((a) => {
    const n = new Date(a);
    modo === "mes" ? n.setMonth(n.getMonth() + dir) : n.setDate(n.getDate() + dir * 7);
    return n;
  });

  const download = async () => {
    // O PDF é relatório pra guardar: sai sempre com a lista de captações expandida,
    // independente do que está aberto na tela. `downloading` também esconde os
    // controles de expandir/ocultar, que não fazem sentido impressos.
    setDownloading(true);
    setCaptAberta(true);
    // Dois frames pra garantir que o React pintou o estado novo antes da foto.
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
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

  // Uma captação por linha: ícone de status, cliente (ou data, quando a linha já
  // está dentro do detalhe de um cliente), nota e data/hora. `comNome` também
  // decide o data-pdf-block: na lista geral cada linha é ponto seguro de corte de
  // página; dentro da caixinha do cliente não, pra não fatiar o fundo cinza.
  const linhaCaptura = (c: ProdCapture, comNome: boolean) => {
    const hora = horaCurta(c.capture_time);
    const quando = `${ddmm(c.capture_date)}${hora ? ` · ${hora}` : ""}`;
    return (
      <div key={c.id} data-pdf-block={comNome ? true : undefined}
        style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "5px 0", borderBottom: `1px solid ${C.soft}` }}>
        <div style={{ marginTop: 2 }}>{c.status === "concluida" ? <IconeCheck /> : <IconeRelogio />}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: comNome ? 600 : 500, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {comNome ? nomeCaptura(c) : quando}
          </div>
          {c.note?.trim() ? (
            <div style={{ fontSize: 10.5, color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.note.trim()}</div>
          ) : null}
        </div>
        {comNome && <div style={{ fontSize: 11, color: C.sub, whiteSpace: "nowrap", marginTop: 1 }}>{quando}</div>}
      </div>
    );
  };

  // Botão discreto de expandir/ocultar. Some no PDF (downloading) porque controle
  // de tela impresso não faz sentido.
  const botaoLink = (label: string, onClick: () => void) =>
    downloading ? null : (
      <button type="button" onClick={onClick}
        style={{ background: "none", border: 0, padding: "7px 0 2px", cursor: "pointer", fontSize: 11.5, fontWeight: 700, color: C.brand, fontFamily: "inherit" }}>
        {label}
      </button>
    );

  // Número + rótulo num chip pequeno, pro panorama. `hero` = o publicados (o que
  // mais importa), destacado na cor da marca; os outros ficam neutros.
  const chip = (value: number, label: string, hero = false) => (
    <span style={{
      display: "inline-flex", alignItems: "baseline", gap: 4, padding: "3px 8px", borderRadius: 7,
      background: hero ? "#FCE9E1" : C.soft, border: `1px solid ${hero ? "#F6C6B4" : C.line}`,
    }}>
      <b style={{ fontSize: 13, color: hero ? C.brand : C.ink, lineHeight: 1 }}>{nb(value)}</b>
      <span style={{ fontSize: 10, color: hero ? C.brand : C.sub }}>{label}</span>
    </span>
  );

  // Um post publicado por linha (no detalhe do cliente): check verde, título, plataforma e data.
  const linhaPost = (p: ProdPost) => {
    const hora = horaCurta(p.scheduled_time);
    const quando = `${ddmm(p.scheduled_date)}${hora ? ` · ${hora}` : ""}`;
    return (
      <div key={p.id} style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "5px 0", borderBottom: `1px solid ${C.soft}` }}>
        <div style={{ marginTop: 2 }}><IconeCheck /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.title?.trim() || "Post sem título"}
          </div>
          {p.platform?.trim() ? (
            <div style={{ fontSize: 10.5, color: C.sub, textTransform: "capitalize" }}>{p.platform.trim()}</div>
          ) : null}
        </div>
        <div style={{ fontSize: 11, color: C.sub, whiteSpace: "nowrap", marginTop: 1 }}>{quando}</div>
      </div>
    );
  };

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
                  {/* FOTO DE AGORA, não acumulado. O post só tem UM status por
                      vez, então "aguardando aprovação: 3" significa 3 parados
                      nessa etapa NESTE momento; os outros que passaram por lá
                      já viraram aprovados ou publicados e contam nas linhas de
                      baixo. O rótulo antigo ("Enviados pra aprovação") lia como
                      soma do mês e a Gabriela estranhou o 3, com razão. */}
                  {sectionTitle("Posts no período · onde cada um está agora")}
                  {row("Em produção agora", stats.posts.emProducao, d.emProducao)}
                  {row("Aguardando o cliente aprovar", stats.posts.emAprovacao, d.emAprovacao)}
                  {row("Aprovados, faltando publicar", stats.posts.aprovados, d.aprovados)}
                  {row("Publicados", stats.posts.publicados, d.publicados)}
                  {row("Total no fluxo", stats.posts.total, d.postsTotal)}
                </div>

                {/* POR FORMATO. "72 posts" não diz se o mês foi de reels ou de
                    carrossel, e é essa a conversa da reunião com o cliente e do
                    preço do pacote: reels custa tempo de gravação e edição,
                    estático não. Só os formatos que apareceram, do mais
                    produzido pro menos. */}
                {stats.formatos.length > 0 && (
                  <div data-pdf-block style={{ marginTop: 16 }}>
                    {sectionTitle("Por formato")}
                    {stats.formatos.map((f) => (
                      <div key={f.code} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: `1px solid ${C.soft}` }}>
                        <span style={{ fontSize: 12.5, color: C.ink }}>
                          {FORMAT_LABELS[f.code] ?? (f.code === "outros" ? "Sem formato definido" : f.code)}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, whiteSpace: "nowrap" }}>
                          {nb(f.total)}
                          {/* Quantos desses já saíram: o resto ainda está no
                              fluxo, e misturar os dois vira número inflado. */}
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.sub, marginLeft: 6 }}>
                            {f.publicados} publicado{f.publicados === 1 ? "" : "s"}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div data-pdf-block style={{ marginTop: 16 }}>
                  {sectionTitle("Captações")}
                  {row("Agendadas", stats.capt.agendadas, d.captAgendadas)}
                  {row("Concluídas", stats.capt.concluidas, d.captConcluidas)}
                  {stats.capt.canceladas > 0 && row("Canceladas", stats.capt.canceladas)}
                  {/* O detalhe do que foi contado: QUAIS captações, com nome. No PDF sai sempre aberto. */}
                  {capsPeriodo.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: C.sub, padding: "7px 0" }}>Nenhuma captação no período.</div>
                  ) : captAberta ? (
                    <>
                      <div style={{ marginTop: 6 }}>{capsPeriodo.map((c) => linhaCaptura(c, true))}</div>
                      {botaoLink("Ocultar lista", () => setCaptAberta(false))}
                    </>
                  ) : (
                    botaoLink(
                      capsPeriodo.length === 1 ? "Ver a captação do período" : `Ver as ${nb(capsPeriodo.length)} captações do período`,
                      () => setCaptAberta(true),
                    )
                  )}
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

                {panorama.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    {sectionTitle("Panorama por cliente")}
                    <div style={{ fontSize: 10.5, color: C.sub, marginTop: -2, marginBottom: 8, lineHeight: 1.5 }}>
                      Tudo que saiu de cada cliente no período: quantos posts foram publicados, o funil (aprovados,
                      aguardando aprovação, em produção), captações e tarefas concluídas. Toque num cliente pra ver o detalhe.
                    </div>
                    {panorama.map((r) => {
                      const aberto = clienteAberto === r.key;
                      const capsCliente = capsPeriodo.filter((c) => chaveCaptura(c) === r.key);
                      return (
                        <div key={r.key} data-pdf-block style={{ marginBottom: 8, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
                          {/* O card inteiro é clicável: expande os posts publicados e as captações do cliente. */}
                          <button type="button" onClick={() => setClienteAberto(aberto ? null : r.key)}
                            style={{ display: "block", width: "100%", background: "none", border: 0, padding: "10px 12px 11px", margin: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                              <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {/* Setinha some no PDF: impresso não expande nada. */}
                                {!downloading && <span style={{ color: C.sub, fontSize: 9, marginRight: 5 }}>{aberto ? "▼" : "►"}</span>}
                                {r.name}
                              </div>
                              {r.postsTotal > 0 && (
                                <span style={{ fontSize: 10.5, color: C.sub, whiteSpace: "nowrap" }}>{nb(r.postsTotal)} no fluxo</span>
                              )}
                            </div>
                            {/* Os números do cliente, em chips que empilham no celular. Publicados em destaque. */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                              {chip(r.publicados, r.publicados === 1 ? "publicado" : "publicados", true)}
                              {r.aprovados > 0 && chip(r.aprovados, "aprovados")}
                              {r.aguardando > 0 && chip(r.aguardando, "aguardando")}
                              {r.emProducao > 0 && chip(r.emProducao, "em produção")}
                              {r.captConcluidas > 0 && chip(r.captConcluidas, r.captConcluidas === 1 ? "captação" : "captações")}
                              {r.tarefas > 0 && chip(r.tarefas, r.tarefas === 1 ? "tarefa" : "tarefas")}
                            </div>
                            {maxPublicados > 0 && (
                              <div style={{ height: 6, background: C.soft, borderRadius: 99, overflow: "hidden", marginTop: 9 }}>
                                <div style={{ width: `${r.publicados > 0 ? Math.max(4, (r.publicados / maxPublicados) * 100) : 0}%`, height: "100%", background: C.brand }} />
                              </div>
                            )}
                          </button>
                          {aberto && (
                            <div style={{ padding: "2px 12px 10px", borderTop: `1px solid ${C.soft}` }}>
                              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: C.sub, margin: "8px 0 2px" }}>
                                Posts publicados
                              </div>
                              {r.postsPublicados.length === 0 ? (
                                <div style={{ fontSize: 11, color: C.sub, padding: "3px 0 5px" }}>Nenhum post publicado no período.</div>
                              ) : (
                                r.postsPublicados.map((p) => linhaPost(p))
                              )}
                              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: C.sub, margin: "10px 0 2px" }}>
                                Captações no período
                              </div>
                              {capsCliente.length === 0 ? (
                                <div style={{ fontSize: 11, color: C.sub, padding: "3px 0 5px" }}>Nenhuma captação no período.</div>
                              ) : (
                                capsCliente.map((c) => linhaCaptura(c, false))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
