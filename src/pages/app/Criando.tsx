import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CoverHeader } from "@/components/shared/CoverHeader";
import { useStatusCovers } from "@/hooks/useStatusCovers";
import { Plus, LayoutDashboard, PenLine, Video, Scissors, Calendar, CheckCircle2, ChevronRight, X, Kanban, Pencil } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAccount } from "@/contexts/AccountContext";
import { supabase } from "@/integrations/supabase/client";
import { PostEditor } from "@/components/kanban/PostEditor";
import { FORMAT_LABELS, STATUS_OPTIONS } from "@/lib/constants";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, parseISO, isWithinInterval } from "date-fns";
import { usePosts, type Post } from "@/hooks/usePosts";
import { toast } from "sonner";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { usePillars } from "@/hooks/usePillars";
import { useTasks } from "@/hooks/useTasks";

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

const STATUS_HEX: Record<string, string> = {
  ideia: "#4DABF7",
  roteiro: "#FFBE0B",
  gravando: "#FF6B6B",
  editando: "#FF69B4",
  agendado: "#7C5CFC",
  publicado: "#20B2AA",
};

const STATUS_COVER: Record<string, [string, string]> = {
  ideia: ["#8B5CF6", "#6D3FD6"], roteiro: ["#3B82F6", "#2563EB"], gravando: ["#7C3AED", "#5B21B6"],
  editando: ["#14B8A6", "#0F766E"], agendado: ["#F59E0B", "#D97706"], publicado: ["#22C55E", "#16A34A"],
};

const COLUMNS = [
  { key: "ideia", label: "Ideia", icon: LayoutDashboard, bg: "bg-muted" },
  { key: "roteiro", label: "Planejamento", icon: PenLine, bg: "bg-primary/5" },
  { key: "gravando", label: "Produzindo", icon: Video, bg: "bg-secondary/10" },
  { key: "editando", label: "Pronto", icon: Scissors, bg: "bg-accent" },
  { key: "agendado", label: "Agendado", icon: Calendar, bg: "bg-primary/10" },
  { key: "publicado", label: "Publicado", icon: CheckCircle2, bg: "bg-secondary/20" },
];
const COLUMN_TOOLTIPS: Record<string, string> = {
  ideia: "Posts que você quer criar mas ainda não começou a produzir.",
  roteiro: "Escreva o roteiro, hook e legenda antes de gravar.",
  gravando: "Em processo de gravação ou criação da mídia.",
  editando: "Arquivo gravado, agora em edição ou finalização.",
  agendado: "Pronto para publicar — com data e hora definidos.",
  publicado: "Já publicado! Use o Histórico para acompanhar resultados.",
};

type ContentBlocks = { tema?: string; roteiro?: string; midia?: string; legenda?: string };

const Criando = () => {
  const { user } = useAuth();
  const { activeAccountId } = useActiveAccount();
  const { posts, updatePost, deletePost, isLoading: postsLoading } = usePosts();
  const { pillars } = usePillars();
  const { tasks } = useTasks();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [draggedPost, setDraggedPost] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const { byStatus, saveCover, resetCover, isSaving } = useStatusCovers();
  const [editing, setEditing] = useState<string | null>(null);
  const [editType, setEditType] = useState<"gradient" | "solid">("gradient");
  const [editFrom, setEditFrom] = useState("#8B5CF6");
  const [editTo, setEditTo] = useState("#6D3FD6");
  const [editLabel, setEditLabel] = useState("");

  const openEditCover = (statusKey: string) => {
    const saved = byStatus[statusKey];
    const [defFrom, defTo] = STATUS_COVER[statusKey];
    setEditType(saved?.cover_type === "solid" ? "solid" : "gradient");
    setEditFrom(saved?.cover_from || defFrom);
    setEditTo(saved?.cover_to || defTo);
    setEditLabel(saved?.label || "");
    setEditing(statusKey);
  };

  const editColumn = editing ? COLUMNS.find(c => c.key === editing) : null;

  const [activeCol, setActiveCol] = useState(0);
  const sx = useRef(0), sy = useRef(0), sw = useRef(false);
  const onTouchStart = (e: React.TouchEvent) => { sx.current = e.touches[0].clientX; sy.current = e.touches[0].clientY; sw.current = false; };
  const onTouchMove = (e: React.TouchEvent) => { if (Math.abs(e.touches[0].clientX - sx.current) > Math.abs(e.touches[0].clientY - sy.current) + 6) sw.current = true; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!sw.current) return; const dx = e.changedTouches[0].clientX - sx.current;
    if (dx < -40) setActiveCol(c => Math.min(COLUMNS.length - 1, c + 1)); else if (dx > 40) setActiveCol(c => Math.max(0, c - 1));
  };

  const [period, setPeriod] = useState<PeriodKey>(() => {
    return (localStorage.getItem("criando-period") as PeriodKey) || "tudo";
  });
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | undefined>();
  const [filterPlatform, setFilterPlatform] = useState<string | null>(null);
  const [filterPillar, setFilterPillar] = useState<string | null>(null);
  const [filterWeek, setFilterWeek] = useState<number | null>(null);

  const handlePeriodChange = (p: PeriodKey) => {
    setPeriod(p);
    localStorage.setItem("criando-period", p);
  };

  const dateRange = useMemo(() => getDateRange(period, customRange), [period, customRange]);

  const taskCounts = useMemo(() => {
    const counts = new Map<string, { count: number; done: number }>();
    tasks.forEach(t => {
      if (!t.post_id) return;
      const cur = counts.get(t.post_id) ?? { count: 0, done: 0 };
      cur.count += 1;
      if (t.status === "concluida") cur.done += 1;
      counts.set(t.post_id, cur);
    });
    return counts;
  }, [tasks]);

  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      if (filterPlatform && post.platform !== filterPlatform) return false;
      if (filterPillar && post.pillar_id !== filterPillar) return false;
      if (filterWeek != null && post.week_number !== filterWeek) return false;
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
  }, [posts, filterPlatform, filterPillar, filterWeek, dateRange, period]);

  const openNew = () => { setSelectedPost(null); setDrawerOpen(true); };
  const openEdit = (post: Post) => { setSelectedPost(post); setDrawerOpen(true); };

  const movePostStatus = async (postId: string, newStatus: string) => {
    if (!user) return;
    const updates: { status: string; published_at?: string } = { status: newStatus };
    if (newStatus === "publicado") {
      updates.published_at = new Date().toISOString();
      const { fireConfetti } = await import("@/lib/confetti");
      fireConfetti();
      await supabase.from("audit_log").insert({
        user_id: user.id,
        action: "post_published",
        entity_type: "post",
        entity_id: postId,
      });
    }
    await updatePost.mutateAsync({ id: postId, updates });
  };

  const handleDrop = async (newStatus: string) => {
    setDragOverCol(null);
    if (!draggedPost) return;
    const id = draggedPost;
    setDraggedPost(null);
    await movePostStatus(id, newStatus);
  };

  const getPillar = (id: string | null) => pillars.find(p => p.id === id);

  const hasActiveFilters = filterPlatform || filterPillar || filterWeek != null || period !== "tudo";

  if (postsLoading && posts.length === 0) {
    return (
      <div className="pb-20 md:pb-0">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-sm shrink-0">
              <Kanban className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Estou Criando</h1>
              <p className="text-muted-foreground font-body mt-0.5 text-sm hidden sm:block">Seu pipeline de criação. Arraste entre colunas.</p>
            </div>
          </div>
          <Button variant="hero" size="sm" onClick={openNew} className="shrink-0"><Plus className="h-4 w-4 mr-1" /> Novo Post</Button>
        </div>

        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 mb-4">
          <div className="flex items-center gap-3 min-w-max">
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

            <div className="flex items-center gap-2 flex-wrap">
              {pillars.length > 0 && (
                <Select
                  value={filterPillar ?? "all"}
                  onValueChange={(v) => setFilterPillar(v === "all" ? null : v)}
                >
                  <SelectTrigger className="w-[180px] h-9 rounded-xl text-xs font-body bg-card">
                    <SelectValue placeholder="Todos os pilares" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="font-body">Todos os pilares</span>
                    </SelectItem>
                    {pillars.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2 font-body">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: p.color }}
                          />
                          {p.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {posts.some((p) => p.week_number != null) && (
                <Select
                  value={filterWeek == null ? "all" : String(filterWeek)}
                  onValueChange={(v) => setFilterWeek(v === "all" ? null : Number(v))}
                >
                  <SelectTrigger className="w-[160px] h-9 rounded-xl text-xs font-body bg-card">
                    <SelectValue placeholder="Todas as semanas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="font-body">Todas as semanas</span>
                    </SelectItem>
                    {Array.from(
                      new Set(posts.map((p) => p.week_number).filter((n): n is number => n != null))
                    )
                      .sort((a, b) => a - b)
                      .map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          <span className="font-body">Semana {n}</span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

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

        <div className="flex items-center gap-4 mb-4 text-xs font-body text-muted-foreground">
          <span>{filteredPosts.length} posts no período</span>
          <span>·</span>
          <span>{filteredPosts.filter(p => p.status === "publicado").length} publicados</span>
          <span>·</span>
          <span>{filteredPosts.filter(p => p.scheduled_date).length} agendados</span>
          {hasActiveFilters && (
            <button onClick={() => { setFilterPlatform(null); setFilterPillar(null); setFilterWeek(null); handlePeriodChange("tudo"); }}
              className="ml-2 text-primary hover:underline flex items-center gap-1">
              <X className="h-3 w-3" /> Limpar filtros
            </button>
          )}
        </div>

        <div className="hidden md:flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-proximity kanban-scroll">
          {COLUMNS.map(col => {
            const colPosts = filteredPosts.filter(p => p.status === col.key);
            const isPublished = col.key === "publicado";
            const isAfterIdeia = col.key === "roteiro";
            const showDividerBefore = isPublished || isAfterIdeia;
            const isDragOver = dragOverCol === col.key;
            return (
              <div key={col.key} className={`w-[85vw] max-w-[320px] sm:w-auto sm:max-w-none sm:min-w-[200px] flex-shrink-0 sm:flex-1 snap-start ${showDividerBefore ? "border-l-2 border-dashed border-border pl-4" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }} onDragLeave={() => setDragOverCol(null)} onDrop={() => handleDrop(col.key)}>
                <div className={`${col.bg} rounded-xl px-3 py-2 mb-3 flex items-center justify-between`}>
                <div className="flex items-center gap-1.5">
                    <col.icon className="h-3.5 w-3.5 text-foreground/70" />
                    <h3 className="font-body font-semibold text-xs text-foreground">{col.label}</h3>
                    {COLUMN_TOOLTIPS[col.key] && <InfoTooltip text={COLUMN_TOOLTIPS[col.key]} side="bottom" />}
                  </div>
                  <span className="text-xs text-muted-foreground font-body bg-background/60 px-1.5 py-0.5 rounded-full">{colPosts.length}</span>
                </div>
                <div className={`space-y-3 min-h-[200px] rounded-xl transition-all ${isDragOver ? "ring-2 ring-primary bg-primary/5" : ""}`}>
                  {colPosts.map(post => {
                    const pillar = getPillar(post.pillar_id);
                    const tc = taskCounts.get(post.id);
                    const approvalStatus = (post as unknown as { approval_status?: string | null }).approval_status ?? null;
                    const showApprovalBadge = post.status === "editando" && approvalStatus !== "aprovado";
                    const allDone = tc && tc.count > 0 && tc.done === tc.count;
                    const pendingTasks = tc ? tc.count - tc.done : 0;
                    const blocks = (post.content_blocks ?? null) as ContentBlocks | null;
                    return (
                      <motion.div key={post.id} layout draggable onDragStart={() => setDraggedPost(post.id)} onClick={() => openEdit(post)}
                        style={{ borderLeftColor: STATUS_HEX[post.status ?? "ideia"] ?? "transparent", borderLeftWidth: 4 }}
                        className={`group relative bg-card rounded-xl p-4 shadow-warm-sm border border-border cursor-grab active:cursor-grabbing hover:shadow-warm-md hover:scale-[1.01] transition-all duration-200 ${isPublished ? "opacity-70" : ""}`}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({ id: post.id, title: post.title });
                          }}
                          className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive/80 hover:bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity z-10"
                          aria-label="Excluir post"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <p className="font-body font-medium text-sm text-foreground mb-2 leading-snug line-clamp-2 pr-7">
                          {showApprovalBadge && (
                            <span
                              className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-yellow-400 text-yellow-950 text-[10px] font-bold mr-1 align-middle"
                              title="Aguardando aprovação do cliente"
                              aria-label="Aguardando aprovação do cliente"
                            >!</span>
                          )}
                          {post.title}
                        </p>
                        {blocks && (
                          <div className="flex gap-1 mb-2">
                            {(["tema", "roteiro", "midia", "legenda"] as const).map(k => (
                              <span key={k} className={`w-2 h-2 rounded-full ${blocks[k] === "feito" ? "bg-secondary" : "bg-muted-foreground/30"}`} />
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <PlatformIcon platform={post.platform} size="sm" />
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-body">{FORMAT_LABELS[post.format] || post.format}</span>
                          {pillar && <span className="px-1.5 py-0.5 rounded text-xs font-body text-primary-foreground" style={{ backgroundColor: pillar.color }}>{pillar.name}</span>}
                          {post.week_number != null && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-body bg-muted text-muted-foreground border border-border">
                              S{post.week_number}
                            </span>
                          )}
                          {isPublished && <span className="px-1.5 py-0.5 rounded text-xs font-body bg-secondary text-secondary-foreground">Publicado</span>}
                        </div>
                        {post.scheduled_date && <p className="text-xs text-muted-foreground font-body mt-2 flex items-center gap-1"><Calendar className="h-3 w-3" /> {post.scheduled_date}{post.scheduled_time ? ` às ${post.scheduled_time}` : ""}</p>}
                        {tc && tc.count > 0 && (
                          <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-body font-semibold px-1.5 py-0.5 rounded ${allDone ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground"}`}>
                            {allDone ? "✓" : `${pendingTasks} tarefa${pendingTasks !== 1 ? "s" : ""}`}
                          </span>
                        )}
                        <div className="mt-2 md:hidden" onClick={(e) => e.stopPropagation()}>
                          <Select value={post.status ?? "ideia"} onValueChange={(val) => movePostStatus(post.id, val)}>
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

        <div className="md:hidden">
          <div className="overflow-hidden -mx-4 px-4">
            <div className="flex transition-transform duration-[420ms]"
                 style={{ transform: `translateX(-${activeCol * 100}%)`, transitionTimingFunction: 'cubic-bezier(.22,.61,.36,1)' }}
                 onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
              {COLUMNS.map(col => {
                const colPosts = filteredPosts.filter(p => p.status === col.key);
                const isPublished = col.key === "publicado";
                const saved = byStatus[col.key];
                const [defFrom, defTo] = STATUS_COVER[col.key];
                const from = saved?.cover_from || defFrom;
                const to = saved?.cover_type === "solid" ? (saved?.cover_from || defFrom) : (saved?.cover_to || defTo);
                const title = saved?.label || col.label;
                return (
                  <div key={col.key} className="min-w-full pr-1">
                    <div className="relative">
                      <CoverHeader label="Status" title={title} count={colPosts.length} from={from} to={to} />
                      <button onClick={() => openEditCover(col.key)} className="absolute top-2.5 right-12 z-10 h-7 w-7 rounded-full bg-white/15 backdrop-blur flex items-center justify-center" aria-label="Editar capa">
                        <Pencil className="h-3.5 w-3.5 text-white/90" />
                      </button>
                    </div>
                    <div className="flex flex-col gap-2.5 mt-3">
                      {colPosts.map(post => {
                        const pillar = getPillar(post.pillar_id);
                        const tc = taskCounts.get(post.id);
                        const approvalStatus = (post as unknown as { approval_status?: string | null }).approval_status ?? null;
                        const showApprovalBadge = post.status === "editando" && approvalStatus !== "aprovado";
                        const allDone = tc && tc.count > 0 && tc.done === tc.count;
                        const pendingTasks = tc ? tc.count - tc.done : 0;
                        const blocks = (post.content_blocks ?? null) as ContentBlocks | null;
                        return (
                          <motion.div key={post.id} layout onClick={() => openEdit(post)}
                            style={{ borderLeftColor: STATUS_HEX[post.status ?? "ideia"] ?? "transparent", borderLeftWidth: 4 }}
                            className={`group relative bg-card rounded-xl p-4 shadow-warm-sm border border-border cursor-pointer hover:shadow-warm-md transition-all duration-200 ${isPublished ? "opacity-70" : ""}`}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget({ id: post.id, title: post.title });
                              }}
                              className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive/80 hover:bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity z-10"
                              aria-label="Excluir post"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <p className="font-body font-medium text-sm text-foreground mb-2 leading-snug line-clamp-2 pr-7">
                              {showApprovalBadge && (
                                <span
                                  className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-yellow-400 text-yellow-950 text-[10px] font-bold mr-1 align-middle"
                                  title="Aguardando aprovação do cliente"
                                  aria-label="Aguardando aprovação do cliente"
                                >!</span>
                              )}
                              {post.title}
                            </p>
                            {blocks && (
                              <div className="flex gap-1 mb-2">
                                {(["tema", "roteiro", "midia", "legenda"] as const).map(k => (
                                  <span key={k} className={`w-2 h-2 rounded-full ${blocks[k] === "feito" ? "bg-secondary" : "bg-muted-foreground/30"}`} />
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <PlatformIcon platform={post.platform} size="sm" />
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-body">{FORMAT_LABELS[post.format] || post.format}</span>
                              {pillar && <span className="px-1.5 py-0.5 rounded text-xs font-body text-primary-foreground" style={{ backgroundColor: pillar.color }}>{pillar.name}</span>}
                              {post.week_number != null && (
                                <span className="px-1.5 py-0.5 rounded text-xs font-body bg-muted text-muted-foreground border border-border">
                                  S{post.week_number}
                                </span>
                              )}
                              {isPublished && <span className="px-1.5 py-0.5 rounded text-xs font-body bg-secondary text-secondary-foreground">Publicado</span>}
                            </div>
                            {post.scheduled_date && <p className="text-xs text-muted-foreground font-body mt-2 flex items-center gap-1"><Calendar className="h-3 w-3" /> {post.scheduled_date}{post.scheduled_time ? ` às ${post.scheduled_time}` : ""}</p>}
                            {tc && tc.count > 0 && (
                              <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-body font-semibold px-1.5 py-0.5 rounded ${allDone ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground"}`}>
                                {allDone ? "✓" : `${pendingTasks} tarefa${pendingTasks !== 1 ? "s" : ""}`}
                              </span>
                            )}
                            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                              <Select value={post.status ?? "ideia"} onValueChange={(val) => movePostStatus(post.id, val)}>
                                <SelectTrigger className="h-7 text-xs rounded-lg"><span className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /> Mover</span></SelectTrigger>
                                <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          </motion.div>
                        );
                      })}
                      <button onClick={openNew}
                        className="border-[1.5px] border-dashed border-border rounded-2xl py-3 text-sm font-body text-muted-foreground">
                        + Adicionar card
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-center gap-1.5 mt-3">
            {COLUMNS.map((c, i) => (
              <button key={c.key} onClick={() => setActiveCol(i)} aria-label={c.label}
                className={cn("h-1.5 rounded-full transition-all", i === activeCol ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/25")} />
            ))}
          </div>
        </div>
      </motion.div>
      <PostEditor open={drawerOpen} onOpenChange={setDrawerOpen} post={selectedPost} pillars={pillars} userId={activeAccountId || user?.id || ""} onSaved={() => { /* invalidations */ }} />

      <Sheet open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">Editar capa{editColumn ? ` — ${editColumn.label}` : ""}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <CoverHeader
              label="Status"
              title={editLabel || editColumn?.label || ""}
              from={editFrom}
              to={editType === "gradient" ? editTo : editFrom}
            />

            <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
              {([["gradient", "Gradiente"], ["solid", "Cor única"]] as const).map(([t, lbl]) => (
                <button key={t} onClick={() => setEditType(t)}
                  className={cn("flex-1 py-1.5 rounded-lg text-xs font-body transition-colors", editType === t ? "bg-card text-foreground shadow-warm-sm font-semibold" : "text-muted-foreground")}>
                  {lbl}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                <input type="color" value={editFrom} onChange={(e) => setEditFrom(e.target.value)} className="h-9 w-12 rounded-lg border border-border bg-transparent cursor-pointer" />
                {editType === "gradient" ? "Cor inicial" : "Cor"}
              </label>
              {editType === "gradient" && (
                <label className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                  <input type="color" value={editTo} onChange={(e) => setEditTo(e.target.value)} className="h-9 w-12 rounded-lg border border-border bg-transparent cursor-pointer" />
                  Cor final
                </label>
              )}
            </div>

            <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
              placeholder={editColumn?.label || "Nome do status"} className="rounded-xl font-body" />

            <div className="flex items-center gap-2 pt-1">
              <Button variant="outline" className="flex-1 font-body" onClick={() => { if (editing) resetCover(editing); setEditing(null); }}>
                Restaurar padrão
              </Button>
              <Button variant="hero" className="flex-1 font-body" disabled={isSaving}
                onClick={() => {
                  if (!editing) return;
                  saveCover({
                    status_key: editing,
                    cover_type: editType,
                    cover_from: editFrom,
                    cover_to: editType === "gradient" ? editTo : null,
                    label: editLabel || null,
                  });
                  setEditing(null);
                }}>
                Salvar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir post?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              {deleteTarget ? `"${deleteTarget.title}" será removido permanentemente. Essa ação não pode ser desfeita.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-body"
              onClick={() => {
                if (!deleteTarget) return;
                deletePost.mutate(deleteTarget.id, {
                  onSuccess: () => toast.success("Post excluído"),
                  onError: () => toast.error("Erro ao excluir post."),
                });
                setDeleteTarget(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Criando;
