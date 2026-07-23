import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Sparkles, Link2, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePdfExport } from "@/hooks/usePdfExport";
import { useAuth } from "@/contexts/AuthContext";
import { clientReportInsight } from "@/lib/ai/claude";
import { useCrmClients } from "@/hooks/useCrm";
import { FORMAT_LABELS } from "@/lib/constants";
import type { ExternalClient, ExternalPost } from "@/hooks/useCriaPost";
import {
  computeCrossAnalysis, crossHeadlines, computeAudienceBreakdown, computeStoriesSummary,
  fmtNum, type CrossItem, type AudienceLike, type StoryLike,
} from "@/components/insights/insightsUtils";

const sbRpcR = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
type IgMediaRow = {
  caption: string | null; media_type: string | null; permalink: string | null;
  thumbnail_url: string | null; posted_at: string | null; metrics: Record<string, number> | null;
};
// Retorno da RPC get_client_ig_report (mídias + demografia + stories do cliente).
type IgReport = { media: IgMediaRow[]; audience: AudienceLike[]; stories: StoryLike[] };
const MEDIA_PT: Record<string, string> = { IMAGE: "Imagem", VIDEO: "Vídeo", REELS: "Reels", CAROUSEL_ALBUM: "Carrossel" };
const engOf = (m: Record<string, number> | null) =>
  m ? (Number(m.likes) || 0) + (Number(m.comments) || 0) + (Number(m.saved) || 0) + (Number(m.shares) || 0) : 0;

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export type ReportPeriod = { key: string; label: string; since: Date; until: Date };

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

// Presets rápidos + últimos meses fechados. `until` é sempre exclusivo.
function buildPeriods(): ReportPeriod[] {
  const now = new Date();
  const tomorrow = startOfDay(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d7 = startOfDay(now);
  d7.setDate(d7.getDate() - 6);
  const d30 = startOfDay(now);
  d30.setDate(d30.getDate() - 29);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const out: ReportPeriod[] = [
    { key: "7d", label: "Últimos 7 dias", since: d7, until: tomorrow },
    { key: "30d", label: "Últimos 30 dias", since: d30, until: tomorrow },
    { key: "mes-passado", label: `${MONTHS[lastMonth.getMonth()]} de ${lastMonth.getFullYear()}`, since: lastMonth, until: thisMonth },
    { key: "este-mes", label: `Este mês (${MONTHS[thisMonth.getMonth()]})`, since: thisMonth, until: nextMonth },
  ];
  for (let i = 2; i <= 6; i++) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`,
      label: `${MONTHS[m.getMonth()]} de ${m.getFullYear()}`,
      since: m,
      until: new Date(m.getFullYear(), m.getMonth() + 1, 1),
    });
  }
  return out;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ExternalClient;
  posts: ExternalPost[];
  managerName?: string;
  // Preset vindo do "Relatório rápido" ("7d" | "30d" | "mes-passado" | "este-mes").
  initialPeriodKey?: string;
};

// Cores fixas (hex), html2canvas não lê variáveis CSS em oklch.
const C = {
  ink: "#1a1a2e", sub: "#6b7280", line: "#e5e7eb", soft: "#f3f4f6",
  brand: "#EA4918", green: "#16a34a", amber: "#d97706", orange: "#ea580c",
};

export function ClientReportDialog({ open, onOpenChange, client, posts, managerName, initialPeriodKey }: Props) {
  const { exportPdf, exportPdfBlob } = usePdfExport();
  const { user } = useAuth();
  const { data: crmClients = [] } = useCrmClients();
  const linked = useMemo(
    () => (client.crm_client_id ? crmClients.find((c) => c.id === client.crm_client_id) ?? null : null),
    [crmClients, client.crm_client_id],
  );
  const reportRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const periods = useMemo(buildPeriods, []);
  const [periodKey, setPeriodKey] = useState(initialPeriodKey ?? "este-mes");
  const [downloading, setDownloading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState<"link" | "wa" | "mail" | null>(null);

  const period = useMemo(
    () => periods.find((p) => p.key === periodKey) ?? periods.find((p) => p.key === "este-mes") ?? periods[0],
    [periods, periodKey],
  );

  // Relatório rápido: reabre já no preset escolhido pela gestora.
  useEffect(() => { if (open && initialPeriodKey) setPeriodKey(initialPeriodKey); }, [open, initialPeriodKey]);

  // Limpa a análise e o link publicado ao trocar de período (não valem pra outro recorte).
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = "";
    setShareUrl(null);
  }, [periodKey]);

  const [active, setActive] = useState<Record<string, boolean>>({});

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const updateActive = () => {
    try {
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
        insertOrderedList: document.queryCommandState("insertOrderedList"),
      });
    } catch { /* noop */ }
  };

  const exec = (cmd: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false);
    updateActive();
  };

  const monthPosts = useMemo(
    () => posts.filter((p) => {
      if (!p.created_at) return false;
      const t = new Date(p.created_at);
      return t >= period.since && t < period.until;
    }),
    [posts, period],
  );

  const stats = useMemo(() => {
    const byFormat: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};
    const byStatus: Record<string, number> = { aprovado: 0, pendente: 0, ajuste_solicitado: 0 };
    for (const p of monthPosts) {
      byFormat[p.format] = (byFormat[p.format] ?? 0) + 1;
      byPlatform[p.platform] = (byPlatform[p.platform] ?? 0) + 1;
      const s = p.approval_status ?? "pendente";
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }
    return { total: monthPosts.length, byFormat, byPlatform, byStatus };
  }, [monthPosts]);

  const monthLabel = period.label;

  // Métricas reais do Instagram do PRÓPRIO CLIENTE (conta que ele conectou).
  // Lidas via RPC segura (a gestora não conecta nada; só lê o que o cliente conectou).
  const monthRange = useMemo(() => ({
    since: period.since.toISOString(),
    until: period.until.toISOString(),
  }), [period]);
  // Bundle do IG do cliente: mídias do período + demografia de audiência (snapshot
  // atual) + stories do período. Uma única RPC segura (get_client_ig_report) que
  // reaproveita a checagem de gestor do get_client_ig_media.
  const { data: igReport } = useQuery<IgReport>({
    queryKey: ["report-ig-data", client.crm_client_id, period.key],
    enabled: open && !!client.crm_client_id,
    queryFn: async () => {
      const { data, error } = await sbRpcR("get_client_ig_report", {
        _crm_client_id: client.crm_client_id,
        _since: monthRange.since,
        _until: monthRange.until,
      });
      if (error) throw error;
      const d = (data as Partial<IgReport> | null) ?? {};
      return { media: d.media ?? [], audience: d.audience ?? [], stories: d.stories ?? [] };
    },
  });
  const igMedia = useMemo<IgMediaRow[]>(() => igReport?.media ?? [], [igReport]);
  const audience = useMemo(() => computeAudienceBreakdown(igReport?.audience), [igReport]);
  const stories = useMemo(() => computeStoriesSummary(igReport?.stories), [igReport]);
  const perf = useMemo(() => {
    const sum = (k: string) => igMedia.reduce((a, r) => a + (Number(r.metrics?.[k]) || 0), 0);
    const views = igMedia.reduce((a, r) => a + (Number(r.metrics?.views ?? r.metrics?.plays) || 0), 0);
    return {
      has: igMedia.length > 0,
      posts: igMedia.length,
      reach: sum("reach"), likes: sum("likes"), comments: sum("comments"), saved: sum("saved"), views,
      interactions: sum("total_interactions") || (sum("likes") + sum("comments") + sum("saved") + sum("shares")),
    };
  }, [igMedia]);

  // Ranking por engajamento (desempate por alcance) + melhor horário (hora do top post).
  const ranking = useMemo(
    () => [...igMedia].sort((a, b) =>
      (engOf(b.metrics) - engOf(a.metrics)) || ((Number(b.metrics?.reach) || 0) - (Number(a.metrics?.reach) || 0))
    ).slice(0, 5),
    [igMedia],
  );
  const bestHour = useMemo(() => {
    const top = ranking[0];
    if (!top?.posted_at) return null;
    const d = new Date(top.posted_at);
    return `${String(d.getHours()).padStart(2, "0")}h`;
  }, [ranking]);
  const dtFmt = (s: string | null) =>
    s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

  // Cruzamentos pro cliente entender o direcionamento: formato, dia e horário que
  // mais renderam (pilar/hook não vêm nessa RPC, então saem naturalmente).
  const cross = useMemo(() => {
    const items: CrossItem[] = igMedia.map((r) => ({
      media_type: r.media_type,
      posted_at: r.posted_at,
      reach: Number(r.metrics?.reach) || 0,
      interactions: engOf(r.metrics),
      pillar: null,
      hook: null,
    }));
    return computeCrossAnalysis(items);
  }, [igMedia]);
  const crossHl = useMemo(() => crossHeadlines(cross), [cross]);

  // Destaque de Reels por tempo médio assistido (retenção).
  const topReels = useMemo(() =>
    igMedia
      .filter((r) => r.media_type === "REELS" || r.media_type === "VIDEO")
      .map((r) => ({ r, watch: Number(r.metrics?.ig_reels_avg_watch_time) || 0, views: Number(r.metrics?.views ?? r.metrics?.plays) || 0 }))
      .filter((x) => x.watch > 0 || x.views > 0)
      .sort((a, b) => b.watch - a.watch || b.views - a.views)
      .slice(0, 3),
  [igMedia]);
  const fmtWatch = (ms: number) => {
    if (ms <= 0) return "-";
    const sec = ms / 1000;
    if (sec < 60) return `${sec.toFixed(1).replace(".", ",")}s`;
    return `${Math.floor(sec / 60)}m ${String(Math.round(sec % 60)).padStart(2, "0")}s`;
  };

  const download = async () => {
    setDownloading(true);
    try {
      await exportPdf(reportRef, `relatorio-${client.name}-${period.key}`.replace(/\s+/g, "-").toLowerCase());
    } finally {
      setDownloading(false);
    }
  };

  // ── Compartilhamento: publica o PDF no Storage e vira um link público ──
  const shareText = (url: string) =>
    `Olá! O relatório de ${period.label} de ${client.name} está pronto: ${url}`;

  const ensureShareLink = async (): Promise<string | null> => {
    if (shareUrl) return shareUrl;
    if (!user) { toast.error("Sessão expirada, entre de novo pra compartilhar."); return null; }
    const blob = await exportPdfBlob(reportRef);
    if (!blob) { toast.error("Não consegui gerar o PDF do relatório."); return null; }
    const slug = client.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "cliente";
    const path = `${user.id}/relatorio-${slug}-${period.key}-${Date.now()}.pdf`;
    // Bucket PRIVADO + link assinado com validade de 30 dias. URL pública em
    // bucket aberto deixava relatório financeiro de cliente acessível a quem
    // chutasse o caminho; link assinado expira e não é adivinhável.
    const { error } = await supabase.storage.from("relatorios")
      .upload(path, blob, { upsert: true, contentType: "application/pdf" });
    if (!error) {
      const { data, error: signErr } = await supabase.storage.from("relatorios")
        .createSignedUrl(path, 60 * 60 * 24 * 30);
      if (!signErr && data?.signedUrl) {
        setShareUrl(data.signedUrl);
        return data.signedUrl;
      }
    }
    toast.error("Não consegui publicar o link. Baixe o PDF e envie manualmente.");
    return null;
  };

  const copyShareLink = async () => {
    if (sharing) return;
    setSharing("link");
    try {
      const url = await ensureShareLink();
      if (!url) return;
      try { await navigator.clipboard.writeText(url); toast.success("Link do relatório copiado!"); }
      catch { toast.message(url); }
    } finally { setSharing(null); }
  };

  // Telefone da ficha do cliente (cadastro central), normalizado pro wa.me.
  const waPhone = useMemo(() => {
    const digits = (linked?.phone ?? "").replace(/\D/g, "");
    if (!digits) return null;
    return digits.length <= 11 ? `55${digits}` : digits;
  }, [linked?.phone]);

  const sendWhatsApp = async () => {
    if (sharing) return;
    setSharing("wa");
    // Abre a aba ainda no clique; depois do await o navegador bloquearia o popup.
    const win = window.open("about:blank", "_blank");
    try {
      const url = await ensureShareLink();
      if (!url) { win?.close(); return; }
      const wa = `https://wa.me/${waPhone ?? ""}?text=${encodeURIComponent(shareText(url))}`;
      if (win) win.location.href = wa;
      else window.open(wa, "_blank");
    } finally { setSharing(null); }
  };

  const sendEmail = async () => {
    if (sharing) return;
    setSharing("mail");
    try {
      const url = await ensureShareLink();
      if (!url) return;
      const subject = encodeURIComponent(`Relatório de ${period.label} - ${client.name}`);
      const body = encodeURIComponent(shareText(url));
      window.location.href = `mailto:${linked?.email ?? ""}?subject=${subject}&body=${body}`;
    } finally { setSharing(null); }
  };

  const genAI = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const fmt = Object.entries(stats.byFormat).map(([f, v]) => `${FORMAT_LABELS[f] ?? f}: ${v}`).join(", ") || "-";
      const plat = Object.entries(stats.byPlatform).map(([p, v]) => `${cap(p)}: ${v}`).join(", ") || "-";
      const persona = linked?.persona
        ? Object.entries(linked.persona).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("; ").slice(0, 400)
        : undefined;
      // Destaques: top 3 por engajamento, com formato, horário e números, pra IA comentar.
      const igDestaques = ranking
        .slice(0, 3)
        .map((r) => `${MEDIA_PT[r.media_type ?? ""] ?? r.media_type ?? "post"} (${dtFmt(r.posted_at)}): ${Number(r.metrics?.reach) || 0} alcance, ${engOf(r.metrics)} interações`)
        .join("; ");
      const res = await clientReportInsight({
        cliente: client.name, mes: monthLabel, total: stats.total,
        formatos: fmt, plataformas: plat,
        aprovados: stats.byStatus.aprovado ?? 0, aguardando: stats.byStatus.pendente ?? 0, ajustes: stats.byStatus.ajuste_solicitado ?? 0,
        titulos: monthPosts.map((p) => p.title).slice(0, 20).join("; "),
        segmento: linked?.segment ?? undefined,
        servicos: linked?.services?.length ? linked.services.join(", ") : undefined,
        persona,
        igPosts: perf.posts, igReach: perf.reach, igViews: perf.views, igLikes: perf.likes,
        igComments: perf.comments, igInteractions: perf.interactions, igDestaques: igDestaques || undefined,
      }, user?.id);
      if (!res || typeof res.resumo !== "string") throw new Error("formato inesperado");
      const recs = (res.recomendacoes ?? []).map((r) => `<li>${escapeHtml(r)}</li>`).join("");
      const html =
        `<p><strong>Resumo.</strong> ${escapeHtml(res.resumo)}</p>` +
        (recs ? `<p><strong>Recomendações</strong></p><ul>${recs}</ul>` : "");
      if (editorRef.current) editorRef.current.innerHTML = html;
    } catch (e) {
      console.error("Report AI failed", e);
      const msg = e instanceof Error ? e.message : "";
      // Fallback: gera um resumo automático com os números pra não travar o relatório.
      const fmtList = Object.entries(stats.byFormat).map(([f, v]) => `${FORMAT_LABELS[f] ?? f} (${v})`).join(", ");
      const aprov = stats.byStatus.aprovado ?? 0;
      const fallback =
        `<p><strong>Resumo.</strong> No período (${escapeHtml(monthLabel)}), foram produzidos ${stats.total} post(s) para ${escapeHtml(client.name)}` +
        (fmtList ? `, ${escapeHtml(fmtList)}` : "") +
        `. ${aprov} aprovado(s) pelo cliente.</p>` +
        `<p><strong>Recomendações</strong></p><ul><li>Manter a constância de publicações no próximo mês.</li><li>Priorizar os formatos com melhor desempenho.</li></ul>`;
      if (editorRef.current) editorRef.current.innerHTML = fallback;
      toast.message(
        msg && !/non-2xx/i.test(msg) ? `IA indisponível (${msg}). Gerei um resumo automático, você pode editar.` : "IA indisponível agora. Gerei um resumo automático, você pode editar.",
      );
    } finally {
      setAiLoading(false);
    }
  };

  const statCard = (label: string, value: string | number, color = C.ink) => (
    <div style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.sub, marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );

  // Barra de alcance médio (cruzamentos) com o valor absoluto e a contagem.
  const crossRow = (label: string, avgReach: number, count: number, max: number) => (
    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ width: 96, fontSize: 12, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: C.soft, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${max > 0 ? Math.max(4, (avgReach / max) * 100) : 0}%`, height: "100%", background: C.brand }} />
      </div>
      <div style={{ width: 88, textAlign: "right", fontSize: 12, color: C.ink }}>
        <b>{fmtNum(avgReach)}</b> <span style={{ color: C.sub }}>· {count}</span>
      </div>
    </div>
  );

  const breakdownRow = (label: string, value: number, total: number) => (
    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ width: 90, fontSize: 12, color: C.ink }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: C.soft, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${total ? (value / total) * 100 : 0}%`, height: "100%", background: C.brand }} />
      </div>
      <div style={{ width: 28, textAlign: "right", fontSize: 12, fontWeight: 700, color: C.ink }}>{value}</div>
    </div>
  );

  // Barra de demografia (audiência): rótulo + barra proporcional ao percentual.
  const audienceBar = (label: string, pct: number) => (
    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ width: 100, fontSize: 12, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: C.soft, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct > 0 ? Math.max(4, pct) : 0}%`, height: "100%", background: C.brand }} />
      </div>
      <div style={{ width: 44, textAlign: "right", fontSize: 12, fontWeight: 700, color: C.ink }}>{Math.round(pct)}%</div>
    </div>
  );

  const audienceCol = (title: string, items: { label: string; pct: number }[]) => (
    <div style={{ flex: 1, minWidth: 220 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{title}</div>
      {items.map((it) => audienceBar(it.label, it.pct))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Relatório do cliente</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-body text-muted-foreground">Período:</span>
          {periods.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setPeriodKey(m.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-body border transition-colors ${
                periodKey === m.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <p className="mt-2 text-[11px] font-body text-muted-foreground">
          {linked
            ? "✨ A análise da IA vai usar a persona e o segmento do cadastro central deste cliente."
            : "Dica: vincule este cliente ao cadastro central (no cadastro do Cria Post) pra uma análise mais rica."}
        </p>

        {/* Barra de formatação (fora do que vira PDF) */}
        <style>{`.report-editor:empty:before{content:attr(data-placeholder);color:#9ca3af;}
.report-editor ul{list-style:disc;padding-left:22px;margin:6px 0;} .report-editor ol{list-style:decimal;padding-left:22px;margin:6px 0;} .report-editor li{margin-bottom:4px;} .report-editor p{margin:0 0 8px;}`}</style>
        <div className="mt-3 flex items-center gap-1">
          <span className="text-xs font-body text-muted-foreground mr-1">Formatar análise:</span>
          {([
            ["Negrito", "bold", "B", "font-bold"],
            ["Itálico", "italic", "I", "italic"],
            ["Lista com marcadores", "insertUnorderedList", "•", ""],
            ["Lista numerada", "insertOrderedList", "1.", ""],
          ] as [string, string, string, string][]).map(([label, cmd, icon, cls]) => (
            <button
              key={cmd}
              type="button"
              title={label}
              aria-pressed={!!active[cmd]}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec(cmd)}
              className={`h-8 w-8 rounded-lg border text-sm transition-colors ${cls} ${
                active[cmd]
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-accent"
              }`}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* Preview = o próprio elemento exportado */}
        <div className="mt-3 border border-border rounded-xl overflow-hidden bg-white">
          <div ref={reportRef} style={{ width: "100%", background: "#ffffff", padding: 32, fontFamily: "Inter, system-ui, sans-serif", color: C.ink }}>
            {/* Cabeçalho branded */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 18, borderBottom: `2px solid ${C.brand}` }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: C.soft, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                {client.logo_url
                  ? <img src={client.logo_url} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontWeight: 800, fontSize: 22, color: C.brand }}>{client.name.charAt(0).toUpperCase()}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{client.name}</div>
                {client.instagram_handle && (
                  <div style={{ fontSize: 13, color: C.sub }}>@{client.instagram_handle.replace(/^@/, "")}</div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: C.sub, textTransform: "uppercase", letterSpacing: 0.5 }}>Relatório de conteúdo</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{monthLabel}</div>
              </div>
            </div>

            {/* Resumo */}
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              {statCard("Posts no mês", stats.total)}
              {statCard("Aprovados", stats.byStatus.aprovado ?? 0, C.green)}
              {statCard("Aguardando", stats.byStatus.pendente ?? 0, C.amber)}
              {statCard("Ajustes", stats.byStatus.ajuste_solicitado ?? 0, C.orange)}
            </div>

            {/* Breakdown */}
            <div style={{ display: "flex", gap: 24, marginTop: 24 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: C.sub, marginBottom: 10 }}>Por formato</div>
                {Object.keys(stats.byFormat).length === 0
                  ? <div style={{ fontSize: 12, color: C.sub }}>Sem posts no período.</div>
                  : Object.entries(stats.byFormat).sort((a, b) => b[1] - a[1]).map(([f, v]) => breakdownRow(FORMAT_LABELS[f] ?? cap(f), v, stats.total))}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: C.sub, marginBottom: 10 }}>Por plataforma</div>
                {Object.keys(stats.byPlatform).length === 0
                  ? <div style={{ fontSize: 12, color: C.sub }}>Sem posts no período.</div>
                  : Object.entries(stats.byPlatform).sort((a, b) => b[1] - a[1]).map(([p, v]) => breakdownRow(cap(p), v, stats.total))}
              </div>
            </div>

            {/* Lista de posts */}
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: C.sub, marginBottom: 10 }}>Posts entregues</div>
              {monthPosts.length === 0 ? (
                <div style={{ fontSize: 12, color: C.sub }}>Nenhum post nesse período.</div>
              ) : (
                <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
                  {monthPosts.map((p, i) => {
                    const st = p.approval_status === "aprovado" ? { t: "Aprovado", c: C.green }
                      : p.approval_status === "ajuste_solicitado" ? { t: "Ajuste", c: C.orange }
                      : { t: "Aguardando", c: C.amber };
                    return (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{p.title}</div>
                          <div style={{ fontSize: 11, color: C.sub }}>{FORMAT_LABELS[p.format] ?? cap(p.format)} · {cap(p.platform)}</div>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: st.c, whiteSpace: "nowrap" }}>{st.t}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Análise do mês, editável (Word-like) */}
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: C.sub, marginBottom: 10 }}>Análise do mês</div>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onKeyUp={updateActive}
                onMouseUp={updateActive}
                onFocus={updateActive}
                data-placeholder="Escreva a análise ou clique em “Gerar análise (IA)”. Você pode formatar com a barra acima."
                className="report-editor"
                style={{ fontSize: 13, color: C.ink, lineHeight: 1.6, outline: "none", minHeight: 48 }}
              />
            </div>

            {/* Desempenho, números reais do Instagram quando os posts estão vinculados */}
            {perf.has ? (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: C.sub, marginBottom: 10 }}>
                  Desempenho no Instagram ({perf.posts} post{perf.posts === 1 ? "" : "s"})
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {statCard("Alcance", perf.reach.toLocaleString("pt-BR"))}
                  {statCard("Visualizações", perf.views.toLocaleString("pt-BR"))}
                  {statCard("Curtidas", perf.likes.toLocaleString("pt-BR"))}
                  {statCard("Comentários", perf.comments.toLocaleString("pt-BR"))}
                  {statCard("Interações", perf.interactions.toLocaleString("pt-BR"))}
                </div>

                {ranking.length > 0 && (
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
                      Ranking de posts{bestHour ? ` · top post publicado às ${bestHour}` : ""}
                    </div>
                    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
                      {ranking.map((r, i) => {
                        const views = Number(r.metrics?.views ?? r.metrics?.plays) || 0;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
                            <div style={{ width: 20, fontSize: 13, fontWeight: 800, color: C.brand, textAlign: "center" }}>{i + 1}</div>
                            <div style={{ width: 44, height: 44, borderRadius: 8, background: C.soft, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {r.thumbnail_url
                                ? <img src={r.thumbnail_url} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <span style={{ fontSize: 9, color: C.sub }}>{MEDIA_PT[r.media_type ?? ""] ?? "post"}</span>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>
                                {MEDIA_PT[r.media_type ?? ""] ?? r.media_type ?? "Post"} · {dtFmt(r.posted_at)}
                              </div>
                              <div style={{ fontSize: 11, color: C.sub }}>
                                {(Number(r.metrics?.reach) || 0).toLocaleString("pt-BR")} alcance · {(Number(r.metrics?.likes) || 0).toLocaleString("pt-BR")} curtidas · {(Number(r.metrics?.comments) || 0).toLocaleString("pt-BR")} coment.{views ? ` · ${views.toLocaleString("pt-BR")} views` : ""}
                              </div>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.brand, whiteSpace: "nowrap" }}>{engOf(r.metrics)} interações</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Direcionamento: conclusões pro cliente entender o que rende mais */}
                {crossHl.length > 0 && (
                  <div style={{ marginTop: 18, padding: "14px 16px", border: `1px solid ${C.line}`, borderRadius: 12, background: C.soft }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Direcionamento do período</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {crossHl.map((h, i) => (
                        <li key={i} style={{ fontSize: 12, color: C.ink, marginBottom: 5, lineHeight: 1.5 }}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Cruzamentos: alcance médio por formato, dia e horário */}
                {cross.hasData && (
                  <div style={{ display: "flex", gap: 24, marginTop: 18, flexWrap: "wrap" }}>
                    {cross.byFormat.length > 0 && (
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Alcance médio por formato</div>
                        {(() => { const mx = Math.max(...cross.byFormat.map((r) => r.avgReach), 0); return cross.byFormat.map((r) => crossRow(r.label, r.avgReach, r.count, mx)); })()}
                      </div>
                    )}
                    {cross.byWeekday.length > 1 && (
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Alcance médio por dia</div>
                        {(() => { const mx = Math.max(...cross.byWeekday.map((r) => r.avgReach), 0); return cross.byWeekday.map((r) => crossRow(r.label, r.avgReach, r.count, mx)); })()}
                      </div>
                    )}
                    {cross.byTime.length > 1 && (
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Alcance médio por período</div>
                        {(() => { const mx = Math.max(...cross.byTime.map((r) => r.avgReach), 0); return cross.byTime.map((r) => crossRow(r.label, r.avgReach, r.count, mx)); })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Destaque de Reels por tempo médio assistido (retenção) */}
                {topReels.length > 0 && (
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Reels com mais retenção (tempo médio assistido)</div>
                    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
                      {topReels.map(({ r, watch, views }, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
                          <div style={{ width: 20, fontSize: 13, fontWeight: 800, color: C.brand, textAlign: "center" }}>{i + 1}</div>
                          <div style={{ width: 44, height: 44, borderRadius: 8, background: C.soft, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {r.thumbnail_url
                              ? <img src={r.thumbnail_url} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <span style={{ fontSize: 9, color: C.sub }}>Reels</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{r.caption ? r.caption.slice(0, 60) : "Reels"}</div>
                            <div style={{ fontSize: 11, color: C.sub }}>{fmtWatch(watch)} assistidos em média{views ? ` · ${fmtNum(views)} views` : ""}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ marginTop: 20, padding: "14px 16px", border: `1px dashed ${C.line}`, borderRadius: 12, background: C.soft }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>Desempenho (alcance, visualizações, engajamento)</div>
                <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>Aparece automaticamente quando o cliente conectar o Instagram na conta CRIA dele e tiver posts no período.</div>
              </div>
            )}

            {/* Perfil de audiência: faixa etária, gênero, top cidades, top países */}
            {audience.hasData && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: C.sub, marginBottom: 10 }}>
                  Perfil de audiência{audience.source === "engaged" ? " (com base nos engajados)" : ""}
                </div>
                {(audience.age.length > 0 || audience.gender.length > 0) && (
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    {audience.age.length > 0 && audienceCol("Faixa etária", audience.age)}
                    {audience.gender.length > 0 && audienceCol("Gênero", audience.gender)}
                  </div>
                )}
                {(audience.city.length > 0 || audience.country.length > 0) && (
                  <div style={{ display: "flex", gap: 24, marginTop: 14, flexWrap: "wrap" }}>
                    {audience.city.length > 0 && audienceCol("Principais cidades", audience.city)}
                    {audience.country.length > 0 && audienceCol("Principais países", audience.country)}
                  </div>
                )}
              </div>
            )}

            {/* Stories: alcance, alcance médio, respostas, taxa de resposta, navegação */}
            {stories.hasData && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: C.sub, marginBottom: 10 }}>
                  Stories ({stories.count} no período)
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {statCard("Alcance", stories.reach.toLocaleString("pt-BR"))}
                  {statCard("Alcance médio", stories.avgReach.toLocaleString("pt-BR"))}
                  {statCard("Respostas", stories.replies.toLocaleString("pt-BR"))}
                  {statCard("Taxa de resposta", `${stories.replyRate.toFixed(1).replace(".", ",")}%`)}
                  {stories.navigation > 0 && statCard("Navegação", stories.navigation.toLocaleString("pt-BR"))}
                </div>
              </div>
            )}

            {/* Rodapé branded (white-label) */}
            <div style={{ marginTop: 22, paddingTop: 14, borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 11, color: C.sub }}>
                {managerName ? `Preparado por ${managerName}` : "Relatório de gestão de conteúdo"}
              </div>
              <div style={{ fontSize: 11, color: C.sub }}>
                Gerado em {new Date().toLocaleDateString("pt-BR")}
              </div>
            </div>
          </div>
        </div>

        {/* Compartilhar: link público do PDF + WhatsApp + e-mail */}
        <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-3 sm:p-4">
          <p className="text-xs font-body font-semibold text-foreground">Compartilhar com o cliente</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyShareLink} disabled={sharing !== null}>
              {sharing === "link" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5 mr-1.5" />} Copiar link
            </Button>
            <Button variant="outline" size="sm" onClick={sendWhatsApp} disabled={sharing !== null}>
              {sharing === "wa" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5 mr-1.5" />} Enviar por WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={sendEmail} disabled={sharing !== null}>
              {sharing === "mail" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Mail className="h-3.5 w-3.5 mr-1.5" />} Enviar por e-mail
            </Button>
          </div>
          <p className="text-[11px] font-body text-muted-foreground mt-2">
            O link publica o PDF deste período pra você mandar direto.
            {!waPhone && " Dica: cadastre o telefone na ficha do cliente pro WhatsApp abrir já na conversa dele."}
          </p>
        </div>

        <DialogFooter className="mt-4 sm:justify-between">
          <Button variant="outline" onClick={genAI} disabled={aiLoading} className="mr-auto">
            {aiLoading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Analisando…</> : <><Sparkles className="h-4 w-4 mr-1.5" /> Gerar análise (IA)</>}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button onClick={download} disabled={downloading}>
              {downloading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Gerando…</> : <><Download className="h-4 w-4 mr-1.5" /> Baixar PDF</>}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
