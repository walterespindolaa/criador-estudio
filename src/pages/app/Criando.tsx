import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, LayoutDashboard, PenLine, Video, Scissors, Calendar, CheckCircle2, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PostDrawer } from "@/components/kanban/PostDrawer";
import { FORMAT_LABELS, STATUS_OPTIONS } from "@/lib/constants";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, parseISO, isWithinInterval } from "date-fns";

interface Post {
  id: string; title: string; platform: string; format: string; pillar_id: string | null;
  status: string; hook: string | null; script: string | null; caption: string | null;
  cta: string | null; scheduled_date: string | null; scheduled_time: string | null; published_at: string | null;
  notes: string | null; result_views: number | null; result_saves: number | null;
  result_comments: number | null; archive_summary: string | null; user_id: string;
  created_at?: string | null;
  content_blocks: { tema: string; roteiro: string; midia: string; legenda: string } | null;
}

interface TaskCount { post_id: string; count: number; done: number; }
interface Pillar { id: string; name: string; color: string; }

// ─── Period filter helpers (same as Dashboard) ───
type PeriodKey = "tudo" | "hoje" | "semana" | "quinzenal" | "mes" | "ano" | "personalizado";

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "tudo", label: "Tudo" },
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "quinzenal", label: "Quinzenal" },
  { key: "mes", label: "Mês" },
  { key: "ano", label: "Ano" },
  { key: "personalizado", label: "Personalizado" },
];

function getDateRange(period: PeriodKey, customRange?: { from: Date; to: Date }): { start: Date; end: Date } | null {
  const now = new Date();
  switch (period) {
    case "tudo": return null;
    case "hoje": return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: now };
    case "semana": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "quinzenal": return { start: subDays(now, 14), end: now };
    case "mes": return { start: startOfMonth(now), end: endOfMonth(now) };
    case "ano": return { start: startOfYear(now), end: endOfYear(now) };
    case "personalizado": return customRange ? { start: customRange.from, end: customRange.to } : null;
    default: return null;
  }
}

const COLUMNS = [
  { key: "ideia", label: "Ideia", icon: LayoutDashboard, bg: "bg-muted" },
  { key: "roteiro", label: "Roteiro", icon: PenLine, bg: "bg-primary/5" },
  { key: "gravando", label: "Gravando", icon: Video, bg: "bg-secondary/10" },
  { key: "editando", label: "Editando", icon: Scissors, bg: "bg-accent" },
  { key: "agendado", label: "Agendado", icon: Calendar, bg: "bg-primary/10" },
  { key: "publicado", label: "Publicado", icon: CheckCircle2, bg: "bg-secondary/20" },
];

const Criando = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [taskCounts, setTaskCounts] = useState<TaskCount[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [draggedPost, setDraggedPost] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // Filters
  const [period, setPeriod] = useState<PeriodKey>(() => {
    return (localStorage.getItem("criando-period") as PeriodKey) || "semana";
  });
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | undefined>();
  const [filterPlatform, setFilterPlatform] = useState<string | null>(null);
  const [filterPillar, setFilterPillar] = useState<string | null>(null);

  const handlePeriodChange = (p: PeriodKey) => {
    setPeriod(p);
    localStorage.setItem("criando-period", p);
  };

  const dateRange = useMemo(() => getDateRange(period, customRange), [period, customRange]);

  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      if (filterPlatform && post.platform !== filterPlatform) return false;
      if (filterPillar && post.pillar_id !== filterPillar) return false;
      if (dateRange) {
        const postDate = post.scheduled_date || post.created_at?.split("T")[0];
        if (!postDate) return period === "tudo";
        try {
          const d = parseISO(postDate);
          if (!isWithinInterval(d, { start: dateRange.start, end: dateRange.end })) return false;
        } catch { return false; }
      }
      return true;
    });
  }, [posts, filterPlatform, filterPillar, dateRange, period]);

  const fetchData = async () => {
    if (!user) return;
    const [postsRes, pillarsRes, tasksRes] = await Promise.all([
      supabase.from("posts").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("pillars").select("*").eq("user_id", user.id).order("position"),
      supabase.from("tasks").select("id, post_id, status").eq("user_id", user.id).not("post_id", "is", null),
    ]);
    setPosts((postsRes.data as any[]) || []);
    setPillars(pillarsRes.data || []);
    const tasksData = (tasksRes.data as any[]) || [];
    const counts: Record<string, { count: number; done: number }> = {};
    tasksData.forEach((t: any) => {
      if (!t.post_id) return;
      if (!counts[t.post_id]) counts[t.post_id] = { count: 0, done: 0 };
      counts[t.post_id].count++;
      if (t.status === "concluida") counts[t.post_id].done++;
    });
    setTaskCounts(Object.entries(counts).map(([post_id, v]) => ({ post_id, ...v })));
  };

  useEffect(() => { fetchData(); }, [user]);

  const openNew = () => { setSelectedPost(null); setDrawerOpen(true); };
  const openEdit = (post: Post) => { setSelectedPost(post); setDrawerOpen(true); };

  const handleDrop = async (newStatus: string) => {
    setDragOverCol(null);
    if (!draggedPost || !user) return;
    const updates: any = { status: newStatus };
    if (newStatus === "publicado") {
      updates.published_at = new Date().toISOString();
      const { fireConfetti } = await import("@/lib/confetti");
      fireConfetti();
      await supabase.from("audit_log").insert({ user_id: user.id, action: "post_published", entity_type: "post", entity_id: draggedPost });
    }
    await supabase.from("posts").update(updates).eq("id", draggedPost);
    setDraggedPost(null);
    fetchData();
  };

  const handleMovePost = async (postId: string, newStatus: string) => {
    if (!user) return;
    const updates: any = { status: newStatus };
    if (newStatus === "publicado") {
      updates.published_at = new Date().toISOString();
      const { fireConfetti } = await import("@/lib/confetti");
      fireConfetti();
      await supabase.from("audit_log").insert({ user_id: user.id, action: "post_published", entity_type: "post", entity_id: postId });
    }
    await supabase.from("posts").update(updates).eq("id", postId);
    fetchData();
  };

  const getPillar = (id: string | null) => pillars.find(p => p.id === id);

  const hasActiveFilters = filterPlatform || filterPillar || period !== "semana";

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Estou Criando</h1>
            <p className="text-muted-foreground font-body mt-1">Seu pipeline de criação. Arraste entre colunas.</p>
          </div>
          <Button variant="hero" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Post</Button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {/* Period */}
          <div className="flex items-center gap-1 bg-card rounded-xl border border-border p-1">
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.key} onClick={() => handlePeriodChange(opt.key)}
                className={`px-3 py-1 rounded-lg text-xs font-body transition-colors ${
                  period === opt.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Platform */}
          <div className="flex items-center gap-1">
            <button onClick={() => setFilterPlatform(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-body border transition-colors ${!filterPlatform ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
              Todas
            </button>
            {(["instagram", "tiktok", "youtube"] as const).map(p => (
              <button key={p} onClick={() => setFilterPlatform(filterPlatform === p ? null : p)}
                className={`px-2 py-1.5 rounded-xl border transition-colors flex items-center gap-1 ${filterPlatform === p ? "bg-primary/10 border-primary" : "bg-card border-border"}`}>
                <PlatformIcon platform={p} size="sm" />
              </button>
            ))}
          </div>

          {/* Pillar */}
          {pillars.length > 0 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setFilterPillar(null)}
                className={`px-3 py-1 rounded-xl text-xs font-body border transition-colors ${!filterPillar ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
                Pilares
              </button>
              {pillars.map(p => (
                <button key={p.id} onClick={() => setFilterPillar(filterPillar === p.id ? null : p.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-body border transition-colors ${filterPillar === p.id ? "text-primary-foreground border-transparent" : "bg-card border-border"}`}
                  style={filterPillar === p.id ? { backgroundColor: p.color } : {}}>
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Custom date range */}
        {period === "personalizado" && (
          <div className="flex items-center gap-2 mb-4">
            <Input type="date" value={customRange?.from?.toISOString().split("T")[0] || ""}
              onChange={e => setCustomRange(prev => ({ from: new Date(e.target.value), to: prev?.to || new Date() }))}
              className="rounded-xl text-xs h-8 w-36" />
            <span className="text-muted-foreground text-xs">até</span>
            <Input type="date" value={customRange?.to?.toISOString().split("T")[0] || ""}
              onChange={e => setCustomRange(prev => ({ from: prev?.from || new Date(), to: new Date(e.target.value) }))}
              className="rounded-xl text-xs h-8 w-36" />
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4 text-xs font-body text-muted-foreground">
          <span>{filteredPosts.length} posts no período</span>
          <span>·</span>
          <span>{filteredPosts.filter(p => p.status === "publicado").length} publicados</span>
          <span>·</span>
          <span>{filteredPosts.filter(p => p.scheduled_date).length} agendados</span>
          {hasActiveFilters && (
            <button onClick={() => { setFilterPlatform(null); setFilterPillar(null); handlePeriodChange("semana"); }}
              className="ml-2 text-primary hover:underline flex items-center gap-1">
              <X className="h-3 w-3" /> Limpar filtros
            </button>
          )}
        </div>

        {/* Kanban */}
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-none">
          {COLUMNS.map(col => {
            const colPosts = filteredPosts.filter(p => p.status === col.key);
            const isPublished = col.key === "publicado";
            const isDragOver = dragOverCol === col.key;
            return (
              <div key={col.key} className={`min-w-[280px] sm:min-w-[200px] flex-shrink-0 sm:flex-1 snap-start ${isPublished ? "border-l-2 border-dashed border-border pl-4" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }} onDragLeave={() => setDragOverCol(null)} onDrop={() => handleDrop(col.key)}>
                <div className={`${col.bg} rounded-xl px-3 py-2 mb-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-1.5">
                    <col.icon className="h-3.5 w-3.5 text-foreground/70" />
                    <h3 className="font-body font-semibold text-xs text-foreground">{col.label}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground font-body bg-background/60 px-1.5 py-0.5 rounded-full">{colPosts.length}</span>
                </div>
                <div className={`space-y-3 min-h-[200px] rounded-xl transition-all ${isDragOver ? "ring-2 ring-primary bg-primary/5" : ""}`}>
                  {colPosts.map(post => {
                    const pillar = getPillar(post.pillar_id);
                    const tc = taskCounts.find(t => t.post_id === post.id);
                    const allDone = tc && tc.count > 0 && tc.done === tc.count;
                    const pendingTasks = tc ? tc.count - tc.done : 0;
                    return (
                      <motion.div key={post.id} layout draggable onDragStart={() => setDraggedPost(post.id)} onClick={() => openEdit(post)}
                        className={`bg-card rounded-xl p-4 shadow-warm border border-border cursor-grab active:cursor-grabbing hover:shadow-warm-lg transition-all ${isPublished ? "opacity-70" : ""}`}>
                        <p className="font-body font-medium text-sm text-foreground mb-2 leading-snug line-clamp-2">{post.title}</p>
                        {post.content_blocks && (
                          <div className="flex gap-1 mb-2">
                            {(["tema", "roteiro", "midia", "legenda"] as const).map(k => (
                              <span key={k} className={`w-2 h-2 rounded-full ${(post.content_blocks as any)?.[k] === "feito" ? "bg-secondary" : "bg-muted-foreground/30"}`} />
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <PlatformIcon platform={post.platform as any} size="sm" />
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-body">{FORMAT_LABELS[post.format] || post.format}</span>
                          {pillar && <span className="px-1.5 py-0.5 rounded text-xs font-body text-primary-foreground" style={{ backgroundColor: pillar.color }}>{pillar.name}</span>}
                          {isPublished && <span className="px-1.5 py-0.5 rounded text-xs font-body bg-secondary text-secondary-foreground">Publicado</span>}
                        </div>
                        {post.scheduled_date && <p className="text-xs text-muted-foreground font-body mt-2 flex items-center gap-1"><Calendar className="h-3 w-3" /> {post.scheduled_date}{post.scheduled_time ? ` às ${post.scheduled_time}` : ""}</p>}
                        {tc && tc.count > 0 && (
                          <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-body font-semibold px-1.5 py-0.5 rounded ${allDone ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground"}`}>
                            {allDone ? "✓" : `${pendingTasks} tarefa${pendingTasks !== 1 ? "s" : ""}`}
                          </span>
                        )}
                        <div className="mt-2 md:hidden" onClick={(e) => e.stopPropagation()}>
                          <Select value={post.status} onValueChange={(val) => handleMovePost(post.id, val)}>
                            <SelectTrigger className="h-7 text-xs rounded-lg"><span className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /> Mover</span></SelectTrigger>
                            <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </motion.div>
                    );
                  })}
                  {colPosts.length === 0 && (
                    <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${isDragOver ? "border-primary" : "border-border"}`}>
                      <p className="text-xs text-muted-foreground font-body">Arraste pra cá</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
      <PostDrawer open={drawerOpen} onOpenChange={setDrawerOpen} post={selectedPost} pillars={pillars} userId={user?.id || ""} onSaved={fetchData} />
    </div>
  );
};

export default Criando;
