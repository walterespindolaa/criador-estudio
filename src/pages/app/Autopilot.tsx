import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Sparkles, Loader2, Check, RefreshCw, Calendar, History, Eye, Wand2, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePillars } from "@/hooks/usePillars";
import { usePosts } from "@/hooks/usePosts";
import { useBrandContext } from "@/hooks/useBrandContext";
import { generateAutopilot, type AutopilotPost } from "@/lib/ai/claude";
import { bestTimes } from "@/lib/bestTimes";
import { FORMAT_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";

const sbFrom = supabase.from.bind(supabase) as unknown as (t: string) => ReturnType<typeof supabase.from>;

type RunRow = { id: string; periodo: string; foco: string | null; qtd: number; posts: AutopilotPost[]; created_at: string };
type Item = AutopilotPost & { selected: boolean; date: string; time: string };

const FOCOS = ["Crescer alcance", "Engajar", "Vender", "Lançamento"];

export default function Autopilot() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { pillars } = usePillars();
  const { posts, createPost } = usePosts();
  const { brandContext, hasBrandContext } = useBrandContext();
  const qc = useQueryClient();

  const [periodo, setPeriodo] = useState<"semana" | "mes">("semana");
  const [qtd, setQtd] = useState(8);
  const [foco, setFoco] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [editingCap, setEditingCap] = useState<Record<number, boolean>>({});
  const [plataforma, setPlataforma] = useState("instagram");
  const [contexto, setContexto] = useState("");
  const [publico, setPublico] = useState("");

  const trialOk = profile?.trial_ends_at ? new Date(profile.trial_ends_at).getTime() > Date.now() : false;
  const isStudio = profile?.plan === "studio" || profile?.role === "admin" || trialOk;

  const { data: runs = [] } = useQuery<RunRow[]>({
    queryKey: ["autopilot-runs", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await sbFrom("autopilot_runs").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return (data as RunRow[]) ?? [];
    },
  });

  const spreadDates = (n: number): string[] => {
    const days = periodo === "mes" ? 30 : 7;
    return Array.from({ length: n }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + 1 + Math.floor((i * days) / Math.max(1, n)));
      return d.toISOString().slice(0, 10);
    });
  };

  const buildItems = (raw: AutopilotPost[]): Item[] => {
    const slot = bestTimes(plataforma, profile?.niche).slots[0] ?? "19:00";
    const dates = spreadDates(raw.length);
    return raw.map((p, i) => ({ ...p, selected: true, date: dates[i], time: slot }));
  };

  const generate = async () => {
    if (loading) return;
    setLoading(true);
    setItems([]);
    try {
      const recentes = posts.slice(0, 15).map((p) => p.title).filter(Boolean).join("; ");
      const res = await generateAutopilot({
        nicho: profile?.niche ?? undefined,
        plataformas: plataforma,
        pilares: pillars.map((p) => p.name).join(", ") || undefined,
        foco: foco || undefined,
        qtd,
        periodo,
        recentes: recentes || undefined,
        contexto: contexto || undefined,
        publico: publico || undefined,
        brandContext: hasBrandContext ? brandContext : undefined,
      }, user?.id);
      if (!res?.posts?.length) throw new Error("vazio");
      setItems(buildItems(res.posts));
    } catch (e) {
      console.error("autopilot generate failed", e);
      const msg = e instanceof Error ? e.message : "";
      toast.error(msg && !/non-2xx/i.test(msg) ? `Erro: ${msg}` : "Não consegui gerar agora. Tenta de novo em instantes.");
    } finally {
      setLoading(false);
    }
  };

  const patch = (i: number, p: Partial<Item>) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  const selectedCount = items.filter((i) => i.selected).length;
  const allSelected = items.length > 0 && selectedCount === items.length;

  const send = async (review: boolean) => {
    const sel = items.filter((i) => i.selected);
    if (!sel.length) { toast.error("Selecione ao menos um post."); return; }
    setSending(true);
    try {
      for (const it of sel) {
        const pillar = pillars.find((p) => p.name.toLowerCase() === (it.pilar || "").toLowerCase());
        await createPost.mutateAsync({
          title: it.titulo,
          caption: it.legenda || null,
          platform: it.plataforma || "instagram",
          format: (it.formato || "reels").toLowerCase(),
          pillar_id: pillar?.id ?? null,
          status: "ideia",
          scheduled_date: it.date || null,
          scheduled_time: it.time || null,
          notes: review ? "⚠️ Revisar — gerado pelo Autopilot" : null,
        });
      }
      await sbFrom("autopilot_runs").insert({ user_id: user!.id, periodo, foco: foco || null, qtd, posts: items });
      qc.invalidateQueries({ queryKey: ["autopilot-runs", user?.id] });
      qc.invalidateQueries({ queryKey: ["posts"] });
      toast.success(`${sel.length} post(s) enviados pro Criando${review ? " — marcados pra revisar" : ""}! 🎬`);
      setItems([]);
    } catch (e) {
      console.error("autopilot send failed", e);
      toast.error("Erro ao enviar os posts.");
    } finally {
      setSending(false);
    }
  };

  const reopen = (run: RunRow) => {
    setPeriodo((run.periodo as "semana" | "mes") ?? "semana");
    setFoco(run.foco ?? "");
    setItems(buildItems(run.posts ?? []));
    toast.message("Cronograma reaberto. Edite e reenvie quando quiser.");
  };

  if (!isStudio) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"><Lock className="h-6 w-6 text-primary" /></div>
        <h1 className="text-2xl font-display font-extrabold text-foreground">Autopilot é do Cria Studio</h1>
        <p className="text-sm font-body text-muted-foreground mt-2">A IA monta sua semana de conteúdo no seu tom, sem repetir o que você já fez. Disponível no plano Studio.</p>
        <Button asChild className="mt-5"><Link to="/app/assinar">Conhecer o Studio</Link></Button>
      </div>
    );
  }

  const gridCols = periodo === "mes"
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pb-24 md:pb-0">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-sm shrink-0">
          <Wand2 className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Autopilot</h1>
          <p className="text-muted-foreground font-body text-sm mt-0.5">A IA monta seu conteúdo usando seu brandbook, histórico e o que performou.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-5 items-start">
        {/* Sidebar de configuração */}
        <aside className="w-full md:w-[300px] md:shrink-0 md:sticky md:top-4 space-y-3">
          <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
            <div>
              <p className="text-[13px] font-body text-muted-foreground mb-1.5">Período</p>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(["semana", "mes"] as const).map((p) => (
                  <button key={p} onClick={() => setPeriodo(p)} className={`flex-1 text-sm py-2.5 ${periodo === p ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{p === "semana" ? "Semana" : "Mês"}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[13px] font-body text-muted-foreground mb-1.5">Quantos posts</p>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {[5, 8, 12].map((n) => (
                  <button key={n} onClick={() => setQtd(n)} className={`flex-1 text-sm py-2.5 ${qtd === n ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{n}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[13px] font-body text-muted-foreground mb-1.5">Plataforma</p>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {[["instagram", "Instagram"], ["tiktok", "TikTok"], ["youtube", "YouTube"]].map(([id, lb]) => (
                  <button key={id} onClick={() => setPlataforma(id)} className={`flex-1 text-[13px] py-2.5 ${plataforma === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{lb}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[13px] font-body text-muted-foreground mb-1.5">Foco (opcional)</p>
              <div className="flex gap-1.5 flex-wrap">
                {FOCOS.map((f) => (
                  <button key={f} onClick={() => setFoco(foco === f ? "" : f)} className={`text-[13px] px-3 py-1.5 rounded-full border transition-colors ${foco === f ? "bg-primary/10 text-primary border-primary/30" : "bg-card border-border text-muted-foreground"}`}>{f}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[13px] font-body text-muted-foreground mb-1.5">Tema/contexto (opcional)</p>
              <textarea value={contexto} onChange={(e) => setContexto(e.target.value)} rows={2} placeholder="Ex.: lançamento do curso, semana de Black Friday…" className="w-full rounded-lg border border-border bg-card p-2.5 text-sm font-body outline-none resize-none focus:ring-1 focus:ring-primary/30" />
            </div>
            <div>
              <p className="text-[13px] font-body text-muted-foreground mb-1.5">Público (opcional)</p>
              <input value={publico} onChange={(e) => setPublico(e.target.value)} placeholder="Ex.: mães empreendedoras 25-40" className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-body outline-none focus:ring-1 focus:ring-primary/30" />
            </div>
            <Button onClick={generate} disabled={loading} className="w-full gap-2">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</> : <><Sparkles className="h-4 w-4" /> Gerar cronograma</>}
            </Button>
            {!hasBrandContext && <p className="text-[11px] text-muted-foreground font-body">Dica: preencha o Brandbook pra IA acertar mais o seu tom.</p>}
          </div>

          {runs.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Histórico</p>
              <div className="space-y-1.5">
                {runs.slice(0, 8).map((r) => (
                  <button key={r.id} onClick={() => reopen(r)} className="w-full text-left flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/50 transition-colors">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-[11px] font-body text-foreground truncate">{r.periodo === "mes" ? "Mês" : "Semana"} · {r.qtd}{r.foco ? ` · ${r.foco}` : ""} · {new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Resultados */}
        <section className="flex-1 min-w-0 w-full">
          {items.length === 0 ? (
            <div className="border border-dashed border-border rounded-2xl py-16 px-6 text-center">
              <Wand2 className="h-7 w-7 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm font-body text-foreground font-medium">Configure ao lado e clique em Gerar</p>
              <p className="text-xs font-body text-muted-foreground mt-1">A IA monta {qtd} posts pro período no seu tom.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <button onClick={() => setItems((prev) => prev.map((it) => ({ ...it, selected: !allSelected })))} className="text-xs font-body text-muted-foreground hover:text-foreground flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> {allSelected ? "Desmarcar todos" : "Selecionar todos"} ({selectedCount}/{items.length})
                </button>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={generate} disabled={loading} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Regenerar</Button>
                  <Button variant="outline" size="sm" onClick={() => send(true)} disabled={sending} className="gap-1.5"><Eye className="h-3.5 w-3.5" /> Revisão</Button>
                  <Button size="sm" onClick={() => send(false)} disabled={sending} className="gap-1.5">{sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Enviar</Button>
                </div>
              </div>

              <div className={`grid ${gridCols} gap-3`}>
                {items.map((it, i) => (
                  <div key={i} className={`bg-card border rounded-xl p-3 flex flex-col transition-colors ${it.selected ? "border-primary/40" : "border-border opacity-60"}`}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <button onClick={() => patch(i, { selected: !it.selected })} aria-label="Selecionar" className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${it.selected ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                        {it.selected && <Check className="h-3 w-3" />}
                      </button>
                      <div className="flex gap-1 flex-wrap justify-end">
                        <span className="text-[11px] font-body px-2 py-0.5 rounded bg-muted text-muted-foreground">{FORMAT_LABELS[(it.formato || "").toLowerCase()] ?? it.formato}</span>
                        {it.pilar && <span className="text-[11px] font-body px-2 py-0.5 rounded bg-primary/10 text-primary">{it.pilar}</span>}
                      </div>
                    </div>
                    <textarea value={it.titulo} onChange={(e) => patch(i, { titulo: e.target.value })} rows={2} className="w-full bg-transparent font-body font-semibold text-[15px] leading-snug text-foreground outline-none resize-none focus:bg-muted/30 rounded p-0.5" />
                    <div className="flex items-center gap-1.5 mt-2">
                      <input type="date" value={it.date} onChange={(e) => patch(i, { date: e.target.value })} className="text-xs rounded border border-border bg-card px-1.5 py-1 flex-1 min-w-0" />
                      <input type="time" value={it.time} onChange={(e) => patch(i, { time: e.target.value })} className="text-xs rounded border border-border bg-card px-1.5 py-1" />
                    </div>
                    {editingCap[i] ? (
                      <textarea value={it.legenda} onChange={(e) => patch(i, { legenda: e.target.value })} onBlur={() => setEditingCap((p) => ({ ...p, [i]: false }))} autoFocus rows={4} className="w-full mt-2 bg-muted/30 rounded-md p-2 text-[13px] leading-relaxed font-body text-foreground outline-none resize-none focus:ring-1 focus:ring-primary/30" />
                    ) : (
                      <button type="button" onClick={() => setEditingCap((p) => ({ ...p, [i]: true }))} className="w-full text-left mt-2 text-[13px] leading-relaxed font-body text-muted-foreground line-clamp-3 hover:text-foreground" title="Clique pra editar a legenda">
                        {it.legenda || "Sem legenda — clique pra escrever"}
                      </button>
                    )}
                    {it.porque && <p className="text-xs font-body text-muted-foreground/80 mt-2.5 line-clamp-2 flex items-start gap-1.5"><Sparkles className="h-3 w-3 mt-0.5 text-primary shrink-0" /> {it.porque}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </motion.div>
  );
}
