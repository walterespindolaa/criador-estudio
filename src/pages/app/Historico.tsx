import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Archive, Eye, Bookmark, MessageSquare, BarChart3, Calendar, Filter, ChevronDown, ChevronRight, Share2, Users, TrendingUp, Trophy, Clock, StickyNote, GraduationCap } from "lucide-react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { FORMAT_LABELS } from "@/lib/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Post {
  id: string;
  title: string;
  platform: string;
  format: string;
  pillar_id: string | null;
  status: string;
  published_at: string | null;
  scheduled_time: string | null;
  result_views: number | null;
  result_saves: number | null;
  result_comments: number | null;
  result_shares: number | null;
  result_reach: number | null;
  archive_summary: string | null;
  notes: string | null;
  learnings: string | null;
  hook: string | null;
  caption: string | null;
}

interface Pillar {
  id: string;
  name: string;
  color: string;
}

const PERIOD_OPTIONS = [
  { key: "month", label: "Este mês" },
  { key: "3months", label: "3 meses" },
  { key: "year", label: "Este ano" },
  { key: "all", label: "Todos" },
];

interface RankingCard {
  icon: React.ReactNode;
  label: string;
  post: Post | null;
  value: number | null;
  metric: string;
}

const Historico = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [filterPlatform, setFilterPlatform] = useState<string | null>(null);
  const [filterPillar, setFilterPillar] = useState<string | null>(null);
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("posts").select("id, title, platform, format, pillar_id, status, published_at, scheduled_time, result_views, result_saves, result_comments, result_shares, result_reach, archive_summary, notes, learnings, hook, caption").eq("user_id", user.id).eq("status", "publicado").order("published_at", { ascending: false }),
      supabase.from("pillars").select("*").eq("user_id", user.id),
    ]).then(([postsRes, pillarsRes]) => {
      setPosts((postsRes.data as any[]) || []);
      setPillars(pillarsRes.data || []);
      if (postsRes.data?.length) {
        const first = (postsRes.data as any[])[0].published_at;
        if (first) {
          const key = new Date(first).toISOString().slice(0, 7);
          setOpenMonths(new Set([key]));
        }
      }
    });
  }, [user]);

  const filtered = useMemo(() => {
    let result = posts;
    if (filterPlatform) result = result.filter(p => p.platform === filterPlatform);
    if (filterPillar) result = result.filter(p => p.pillar_id === filterPillar);
    if (filterPeriod !== "all") {
      const now = new Date();
      const cutoff = new Date();
      if (filterPeriod === "month") cutoff.setMonth(now.getMonth() - 1);
      else if (filterPeriod === "3months") cutoff.setMonth(now.getMonth() - 3);
      else if (filterPeriod === "year") cutoff.setFullYear(now.getFullYear() - 1);
      result = result.filter(p => p.published_at && new Date(p.published_at) >= cutoff);
    }
    return result;
  }, [posts, filterPlatform, filterPillar, filterPeriod]);

  const grouped = useMemo(() => {
    const map = new Map<string, Post[]>();
    filtered.forEach(p => {
      const key = p.published_at ? new Date(p.published_at).toISOString().slice(0, 7) : "sem-data";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const stats = useMemo(() => {
    const total = posts.length;
    const platformCounts: Record<string, number> = {};
    const monthCounts: Record<string, number> = {};
    posts.forEach(p => {
      platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1;
      if (p.published_at) {
        const m = new Date(p.published_at).toISOString().slice(0, 7);
        monthCounts[m] = (monthCounts[m] || 0) + 1;
      }
    });
    const topPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0];
    const topMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0];
    const months = Object.keys(monthCounts).length || 1;
    return {
      total,
      topPlatform: topPlatform?.[0] || "-",
      topMonth: topMonth ? new Date(topMonth[0] + "-01").toLocaleDateString("pt-BR", { month: "short", year: "numeric" }) : "-",
      avgPerMonth: Math.round(total / months),
    };
  }, [posts]);

  // Ranking
  const rankings: RankingCard[] = useMemo(() => {
    const findTop = (key: keyof Post) => {
      const sorted = posts.filter(p => p[key] != null && (p[key] as number) > 0).sort((a, b) => ((b[key] as number) || 0) - ((a[key] as number) || 0));
      return sorted[0] || null;
    };
    return [
      { icon: <Eye className="h-5 w-5" />, label: "Mais visualizações", post: findTop("result_views"), value: findTop("result_views")?.result_views ?? null, metric: "views" },
      { icon: <Bookmark className="h-5 w-5" />, label: "Mais salvamentos", post: findTop("result_saves"), value: findTop("result_saves")?.result_saves ?? null, metric: "salvos" },
      { icon: <MessageSquare className="h-5 w-5" />, label: "Mais comentários", post: findTop("result_comments"), value: findTop("result_comments")?.result_comments ?? null, metric: "comentários" },
      { icon: <Share2 className="h-5 w-5" />, label: "Mais compartilhamentos", post: findTop("result_shares"), value: findTop("result_shares")?.result_shares ?? null, metric: "shares" },
      { icon: <Users className="h-5 w-5" />, label: "Maior alcance", post: findTop("result_reach"), value: findTop("result_reach")?.result_reach ?? null, metric: "alcance" },
    ];
  }, [posts]);

  // Reels ranking
  const reelsRankings: RankingCard[] = useMemo(() => {
    const reels = posts.filter(p => p.format === "reels" || p.format === "shorts");
    const findTop = (key: keyof Post) => {
      const sorted = reels.filter(p => p[key] != null && (p[key] as number) > 0).sort((a, b) => ((b[key] as number) || 0) - ((a[key] as number) || 0));
      return sorted[0] || null;
    };
    return [
      { icon: <Eye className="h-5 w-5" />, label: "Reels - Views", post: findTop("result_views"), value: findTop("result_views")?.result_views ?? null, metric: "views" },
      { icon: <Bookmark className="h-5 w-5" />, label: "Reels - Salvos", post: findTop("result_saves"), value: findTop("result_saves")?.result_saves ?? null, metric: "salvos" },
      { icon: <MessageSquare className="h-5 w-5" />, label: "Reels - Comentários", post: findTop("result_comments"), value: findTop("result_comments")?.result_comments ?? null, metric: "comentários" },
    ];
  }, [posts]);

  const memoryPost = useMemo(() => {
    const now = new Date();
    const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const weekStart = new Date(lastYear);
    weekStart.setDate(lastYear.getDate() - lastYear.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    return posts.filter(p => {
      if (!p.published_at) return false;
      const d = new Date(p.published_at);
      return d >= weekStart && d <= weekEnd;
    });
  }, [posts]);

  const toggleMonth = (key: string) => {
    setOpenMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const getPillar = (id: string | null) => pillars.find(p => p.id === id);

  const hasAnyMetrics = posts.some(p => p.result_views || p.result_saves || p.result_comments || p.result_shares || p.result_reach);

  return (
    <div className="max-w-5xl pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Histórico</h1>
        <p className="text-muted-foreground font-body mb-6">Tudo que você já publicou. Seu portfólio de consistência.</p>

        {memoryPost.length > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
            <p className="text-sm font-body text-foreground">
              Há um ano você publicou <span className="font-semibold">{memoryPost.length} post{memoryPost.length > 1 ? "s" : ""}</span>. Continue assim! 🎉
            </p>
          </div>
        )}

        {posts.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="bg-card rounded-xl p-4 border border-border">
              <BarChart3 className="h-4 w-4 text-primary mb-1" />
              <p className="text-xl font-display font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground font-body">Total publicados</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              {stats.topPlatform !== "-" && <PlatformIcon platform={stats.topPlatform as any} size="sm" />}
              <p className="text-xl font-display font-bold text-foreground mt-1 capitalize">{stats.topPlatform}</p>
              <p className="text-xs text-muted-foreground font-body">Mais ativa</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <Calendar className="h-4 w-4 text-secondary mb-1" />
              <p className="text-xl font-display font-bold text-foreground capitalize">{stats.topMonth}</p>
              <p className="text-xs text-muted-foreground font-body">Mês mais produtivo</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <BarChart3 className="h-4 w-4 text-secondary mb-1" />
              <p className="text-xl font-display font-bold text-foreground">{stats.avgPerMonth}</p>
              <p className="text-xs text-muted-foreground font-body">Média/mês</p>
            </div>
          </div>
        )}

        <Tabs defaultValue="timeline">
          <TabsList className="bg-card border border-border rounded-xl mb-6">
            <TabsTrigger value="timeline" className="rounded-lg font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Calendar className="h-4 w-4 mr-1" /> Timeline
            </TabsTrigger>
            <TabsTrigger value="ranking" className="rounded-lg font-body data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Trophy className="h-4 w-4 mr-1" /> Ranking
            </TabsTrigger>
          </TabsList>

          {/* TAB: Timeline */}
          <TabsContent value="timeline">
            {/* Filters */}
            {posts.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                <div className="flex gap-1">
                  <button onClick={() => setFilterPlatform(null)}
                    className={`p-2 rounded-xl border transition-colors ${!filterPlatform ? "bg-primary/10 border-primary" : "bg-card border-border"}`}>
                    <Filter className="h-4 w-4" />
                  </button>
                  {(["instagram", "tiktok", "youtube"] as const).map(p => (
                    <button key={p} onClick={() => setFilterPlatform(filterPlatform === p ? null : p)}
                      className={`p-2 rounded-xl border transition-colors ${filterPlatform === p ? "bg-primary/10 border-primary" : "bg-card border-border"}`}>
                      <PlatformIcon platform={p} size="sm" />
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {pillars.map(p => (
                    <button key={p.id} onClick={() => setFilterPillar(filterPillar === p.id ? null : p.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-body border transition-colors ${
                        filterPillar === p.id ? "text-primary-foreground border-transparent" : "bg-card border-border"
                      }`}
                      style={filterPillar === p.id ? { backgroundColor: p.color } : {}}>
                      {p.name}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 ml-auto">
                  {PERIOD_OPTIONS.map(o => (
                    <button key={o.key} onClick={() => setFilterPeriod(o.key)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-body border transition-colors ${
                        filterPeriod === o.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                      }`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {posts.length === 0 ? (
              <div className="bg-card rounded-2xl p-12 shadow-warm border border-border text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <Archive className="h-8 w-8 text-primary" />
                </div>
                <p className="text-lg font-display font-semibold text-foreground mb-2">Seu histórico vai crescer com você</p>
                <p className="text-muted-foreground font-body max-w-sm mx-auto">
                  Quando você publicar seus primeiros conteúdos, eles vão aparecer aqui.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-card rounded-2xl p-8 shadow-warm border border-border text-center">
                <p className="text-muted-foreground font-body">Nenhum post encontrado com esses filtros.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {grouped.map(([monthKey, monthPosts]) => {
                  const isOpen = openMonths.has(monthKey);
                  const monthLabel = monthKey !== "sem-data"
                    ? new Date(monthKey + "-15").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
                    : "Sem data";
                  const monthViews = monthPosts.reduce((sum, p) => sum + (p.result_views || 0), 0);
                  return (
                    <div key={monthKey} className="bg-card rounded-2xl border border-border overflow-hidden">
                      <button
                        onClick={() => toggleMonth(monthKey)}
                        className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <span className="font-display font-semibold text-foreground capitalize">{monthLabel}</span>
                          <span className="text-xs text-muted-foreground font-body bg-muted px-2 py-0.5 rounded-full">
                            {monthPosts.length} post{monthPosts.length > 1 ? "s" : ""}
                          </span>
                        </div>
                        {monthViews > 0 && (
                          <span className="text-xs text-muted-foreground font-body flex items-center gap-1">
                            <Eye className="h-3 w-3" /> {monthViews.toLocaleString("pt-BR")}
                          </span>
                        )}
                      </button>
                      {isOpen && (
                        <div className="border-t border-border divide-y divide-border">
                          {monthPosts.map(post => {
                            const pillar = getPillar(post.pillar_id);
                            const isExpanded = expandedPost === post.id;
                            return (
                              <div key={post.id} className="hover:bg-accent/20 transition-colors">
                                <button
                                  onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                                  className="w-full px-4 py-3 text-left"
                                >
                                  <div className="flex items-start gap-3">
                                    <PlatformIcon platform={post.platform as any} size="sm" className="mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-body font-medium text-sm text-foreground">{post.title}</p>
                                      {post.archive_summary && (
                                        <p className="text-xs text-primary font-body italic mt-0.5">"{post.archive_summary}"</p>
                                      )}
                                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-body">{FORMAT_LABELS[post.format] || post.format}</span>
                                        {pillar && (
                                          <span className="px-1.5 py-0.5 rounded text-xs font-body text-primary-foreground" style={{ backgroundColor: pillar.color }}>
                                            {pillar.name}
                                          </span>
                                        )}
                                        <span className="text-xs text-muted-foreground font-body flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {post.published_at ? new Date(post.published_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }) : "—"}
                                          {post.scheduled_time && ` às ${post.scheduled_time}`}
                                        </span>
                                      </div>
                                    </div>
                                    {/* Metrics summary */}
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-body flex-shrink-0">
                                      {post.result_views != null && <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{post.result_views.toLocaleString("pt-BR")}</span>}
                                      {post.result_saves != null && <span className="flex items-center gap-0.5"><Bookmark className="h-3 w-3" />{post.result_saves}</span>}
                                      {post.result_comments != null && <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{post.result_comments}</span>}
                                      {post.result_shares != null && <span className="flex items-center gap-0.5"><Share2 className="h-3 w-3" />{post.result_shares}</span>}
                                      {post.result_reach != null && <span className="flex items-center gap-0.5"><Users className="h-3 w-3" />{post.result_reach}</span>}
                                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                    </div>
                                  </div>
                                </button>

                                {/* Expanded details */}
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    className="px-4 pb-4 overflow-hidden"
                                  >
                                    <div className="ml-7 grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {/* Metrics grid */}
                                      {(post.result_views != null || post.result_saves != null || post.result_comments != null || post.result_shares != null || post.result_reach != null) && (
                                        <div className="bg-muted/50 rounded-xl p-3 space-y-2">
                                          <p className="text-xs font-body font-semibold text-foreground flex items-center gap-1.5">
                                            <TrendingUp className="h-3.5 w-3.5 text-primary" /> Métricas
                                          </p>
                                          <div className="grid grid-cols-3 gap-2">
                                            {post.result_views != null && (
                                              <div className="text-center">
                                                <p className="text-sm font-bold text-foreground">{post.result_views.toLocaleString("pt-BR")}</p>
                                                <p className="text-[10px] text-muted-foreground">Views</p>
                                              </div>
                                            )}
                                            {post.result_saves != null && (
                                              <div className="text-center">
                                                <p className="text-sm font-bold text-foreground">{post.result_saves.toLocaleString("pt-BR")}</p>
                                                <p className="text-[10px] text-muted-foreground">Salvos</p>
                                              </div>
                                            )}
                                            {post.result_comments != null && (
                                              <div className="text-center">
                                                <p className="text-sm font-bold text-foreground">{post.result_comments.toLocaleString("pt-BR")}</p>
                                                <p className="text-[10px] text-muted-foreground">Comentários</p>
                                              </div>
                                            )}
                                            {post.result_shares != null && (
                                              <div className="text-center">
                                                <p className="text-sm font-bold text-foreground">{post.result_shares.toLocaleString("pt-BR")}</p>
                                                <p className="text-[10px] text-muted-foreground">Shares</p>
                                              </div>
                                            )}
                                            {post.result_reach != null && (
                                              <div className="text-center">
                                                <p className="text-sm font-bold text-foreground">{post.result_reach.toLocaleString("pt-BR")}</p>
                                                <p className="text-[10px] text-muted-foreground">Alcance</p>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Notes + Learnings */}
                                      <div className="space-y-2">
                                        {post.hook && (
                                          <div className="bg-muted/50 rounded-xl p-3">
                                            <p className="text-xs font-body font-semibold text-foreground mb-1">Hook</p>
                                            <p className="text-xs text-muted-foreground font-body italic">"{post.hook}"</p>
                                          </div>
                                        )}
                                        {post.notes && (
                                          <div className="bg-muted/50 rounded-xl p-3">
                                            <p className="text-xs font-body font-semibold text-foreground mb-1 flex items-center gap-1">
                                              <StickyNote className="h-3 w-3" /> Observações
                                            </p>
                                            <p className="text-xs text-muted-foreground font-body">{post.notes}</p>
                                          </div>
                                        )}
                                        {post.learnings && (
                                          <div className="bg-secondary/10 rounded-xl p-3">
                                            <p className="text-xs font-body font-semibold text-secondary mb-1 flex items-center gap-1">
                                              <GraduationCap className="h-3 w-3" /> Aprendizados
                                            </p>
                                            <p className="text-xs text-foreground font-body">{post.learnings}</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB: Ranking */}
          <TabsContent value="ranking">
            {!hasAnyMetrics ? (
              <div className="bg-card rounded-2xl p-12 shadow-warm border border-border text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <Trophy className="h-8 w-8 text-primary" />
                </div>
                <p className="text-lg font-display font-semibold text-foreground mb-2">Ranking em construção</p>
                <p className="text-muted-foreground font-body max-w-sm mx-auto">
                  Registre os resultados dos seus posts para ver o ranking aqui. Adicione views, salvos, comentários e compartilhamentos ao editar cada post.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* General ranking */}
                <div>
                  <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" /> Ranking Geral
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rankings.map((r, i) => (
                      <div key={i} className="bg-card rounded-2xl p-5 border border-border shadow-warm">
                        <div className="flex items-center gap-2 text-primary mb-3">
                          {r.icon}
                          <span className="font-body text-sm font-semibold text-foreground">{r.label}</span>
                        </div>
                        {r.post ? (
                          <>
                            <p className="font-body font-medium text-foreground text-sm mb-1 line-clamp-2">{r.post.title}</p>
                            <div className="flex items-center gap-2 mb-2">
                              <PlatformIcon platform={r.post.platform as any} size="sm" />
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-body">{FORMAT_LABELS[r.post.format] || r.post.format}</span>
                            </div>
                            <p className="text-2xl font-display font-bold text-primary">{r.value?.toLocaleString("pt-BR")}</p>
                            <p className="text-xs text-muted-foreground font-body">{r.metric}</p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground font-body">Sem dados ainda</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reels ranking */}
                <div>
                  <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-secondary" /> Ranking de Reels / Shorts
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {reelsRankings.map((r, i) => (
                      <div key={i} className="bg-card rounded-2xl p-5 border border-border shadow-warm">
                        <div className="flex items-center gap-2 text-secondary mb-3">
                          {r.icon}
                          <span className="font-body text-sm font-semibold text-foreground">{r.label}</span>
                        </div>
                        {r.post ? (
                          <>
                            <p className="font-body font-medium text-foreground text-sm mb-1 line-clamp-2">{r.post.title}</p>
                            <div className="flex items-center gap-2 mb-2">
                              <PlatformIcon platform={r.post.platform as any} size="sm" />
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-body">{FORMAT_LABELS[r.post.format] || r.post.format}</span>
                            </div>
                            <p className="text-2xl font-display font-bold text-secondary">{r.value?.toLocaleString("pt-BR")}</p>
                            <p className="text-xs text-muted-foreground font-body">{r.metric}</p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground font-body">Sem Reels/Shorts com métricas</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default Historico;
