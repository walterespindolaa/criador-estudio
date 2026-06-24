import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { usePdfExport } from "@/hooks/usePdfExport";
import { useAuth } from "@/contexts/AuthContext";
import { clientReportInsight } from "@/lib/ai/claude";
import { FORMAT_LABELS } from "@/lib/constants";
import type { ExternalClient, ExternalPost } from "@/hooks/useCriaPost";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function lastNMonths(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    out.push({ key, label: `${MONTHS[m.getMonth()]} de ${m.getFullYear()}` });
  }
  return out;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ExternalClient;
  posts: ExternalPost[];
  managerName?: string;
};

// Cores fixas (hex) — html2canvas não lê variáveis CSS em oklch.
const C = {
  ink: "#1a1a2e", sub: "#6b7280", line: "#e5e7eb", soft: "#f3f4f6",
  brand: "#8B5CF6", green: "#16a34a", amber: "#d97706", orange: "#ea580c",
};

export function ClientReportDialog({ open, onOpenChange, client, posts, managerName }: Props) {
  const { exportPdf } = usePdfExport();
  const { user } = useAuth();
  const reportRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const months = useMemo(() => lastNMonths(6), []);
  const [monthKey, setMonthKey] = useState(months[0].key);
  const [downloading, setDownloading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Limpa a análise ao trocar de mês (não vale pra outro período).
  useEffect(() => { if (editorRef.current) editorRef.current.innerHTML = ""; }, [monthKey]);

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
  };

  const monthPosts = useMemo(
    () => posts.filter((p) => (p.created_at || "").slice(0, 7) === monthKey),
    [posts, monthKey],
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

  const monthLabel = months.find((m) => m.key === monthKey)?.label ?? "";

  const download = async () => {
    setDownloading(true);
    try {
      await exportPdf(reportRef, `relatorio-${client.name}-${monthKey}`.replace(/\s+/g, "-").toLowerCase());
    } finally {
      setDownloading(false);
    }
  };

  const genAI = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const fmt = Object.entries(stats.byFormat).map(([f, v]) => `${FORMAT_LABELS[f] ?? f}: ${v}`).join(", ") || "-";
      const plat = Object.entries(stats.byPlatform).map(([p, v]) => `${cap(p)}: ${v}`).join(", ") || "-";
      const res = await clientReportInsight({
        cliente: client.name, mes: monthLabel, total: stats.total,
        formatos: fmt, plataformas: plat,
        aprovados: stats.byStatus.aprovado ?? 0, aguardando: stats.byStatus.pendente ?? 0, ajustes: stats.byStatus.ajuste_solicitado ?? 0,
        titulos: monthPosts.map((p) => p.title).slice(0, 20).join("; "),
      }, user?.id);
      if (!res || typeof res.resumo !== "string") throw new Error("formato inesperado");
      const recs = (res.recomendacoes ?? []).map((r) => `<li>${escapeHtml(r)}</li>`).join("");
      const html =
        `<p><strong>Resumo.</strong> ${escapeHtml(res.resumo)}</p>` +
        (recs ? `<p><strong>Recomendações</strong></p><ul>${recs}</ul>` : "");
      if (editorRef.current) editorRef.current.innerHTML = html;
    } catch (e) {
      console.error("Report AI failed", e);
      toast.error("Erro ao gerar a análise.");
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

  const breakdownRow = (label: string, value: number, total: number) => (
    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ width: 90, fontSize: 12, color: C.ink }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: C.soft, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${total ? (value / total) * 100 : 0}%`, height: "100%", background: C.brand }} />
      </div>
      <div style={{ width: 28, textAlign: "right", fontSize: 12, fontWeight: 700, color: C.ink }}>{value}</div>
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
          {months.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMonthKey(m.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-body border transition-colors ${
                monthKey === m.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Barra de formatação (fora do que vira PDF) */}
        <style>{`.report-editor:empty:before{content:attr(data-placeholder);color:#9ca3af;}
.report-editor ul{padding-left:18px;margin:6px 0;} .report-editor li{margin-bottom:4px;} .report-editor p{margin:0 0 8px;}`}</style>
        <div className="mt-3 flex items-center gap-1">
          <span className="text-xs font-body text-muted-foreground mr-1">Formatar análise:</span>
          {([
            ["Negrito", "bold", "B", "font-bold"],
            ["Itálico", "italic", "I", "italic"],
            ["Lista", "insertUnorderedList", "•", ""],
            ["Lista numerada", "insertOrderedList", "1.", ""],
          ] as [string, string, string, string][]).map(([label, cmd, icon, cls]) => (
            <button
              key={cmd}
              type="button"
              title={label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec(cmd)}
              className={`h-8 w-8 rounded-lg border border-border bg-card text-sm text-foreground hover:bg-accent transition-colors ${cls}`}
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

            {/* Análise do mês — editável (Word-like) */}
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: C.sub, marginBottom: 10 }}>Análise do mês</div>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Escreva a análise ou clique em “Gerar análise (IA)”. Você pode formatar com a barra acima."
                className="report-editor"
                style={{ fontSize: 13, color: C.ink, lineHeight: 1.6, outline: "none", minHeight: 48 }}
              />
            </div>

            {/* Espaço pros números reais (Insights) */}
            <div style={{ marginTop: 20, padding: "14px 16px", border: `1px dashed ${C.line}`, borderRadius: 12, background: C.soft }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>Desempenho (alcance, contas alcançadas, engajamento)</div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>Disponível automaticamente quando a integração com o Instagram for ativada.</div>
            </div>

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
