import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Archive, Eye, Bookmark, MessageSquare, BarChart3, Calendar, Filter, ChevronDown, ChevronRight } from "lucide-react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { FORMAT_LABELS } from "@/lib/constants";

interface Post {
  id: string;
  title: string;
  platform: string;
  format: string;
  pillar_id: string | null;
  published_at: string | null;
  result_views: number | null;
  result_saves: number | null;
  result_comments: number | null;
  archive_summary: string | null;
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

const Historico = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [filterPlatform, setFilterPlatform] = useState<string | null>(null);
  const [filterPillar, setFilterPillar] = useState<string | null>(null);
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("posts").select("*").eq("user_id", user.id).eq("status", "publicado").order("published_at", { ascending: false }),
      supabase.from("pillars").select("*").eq("user_id", user.id),
    ]).then(([postsRes, pillarsRes]) => {
      setPosts(postsRes.data || []);
      setPillars(pillarsRes.data || []);
      // Auto-open first month
      if (postsRes.data?.length) {
        const first = postsRes.data[0].published_at;
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
      let cutoff = new Date();
      if (filterPeriod === "month") cutoff.setMonth(now.getMonth() - 1);
      else if (filterPeriod === "3months") cutoff.setMonth(now.getMonth() - 3);
      else if (filterPeriod === "year") cutoff.setFullYear(now.getFullYear() - 1);
      result = result.filter(p => p.published_at && new Date(p.published_at) >= cutoff);
    }
    return result;
  }, [posts, filterPlatform, filterPillar, filterPeriod]);

  // Group by month
  const grouped = useMemo(() => {
    const map = new Map<string, Post[]>();
    filtered.forEach(p => {
      const key = p.published_at ? new Date(p.published_at).toISOString().slice(0, 7) : "sem-data";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return Array.from(map.entries());
  }, [filtered]);

  // Stats
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

  // Memory feature
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

  return (
    <div className="max-w-4xl pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Histórico</h1>
        <p className="text-muted-foreground font-body mb-6">Tudo que você já publicou. Seu portfólio de consistência.</p>

        {/* Memory banner */}
        {memoryPost.length > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
            <p className="text-sm font-body text-foreground">
              Há um ano você publicou <span className="font-semibold">{memoryPost.length} post{memoryPost.length > 1 ? "s" : ""}</span>. Continue assim! 🎉
            </p>
          </div>
        )}

        {/* Stat cards */}
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

        {/* Filters */}
        {posts.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {/* Platform filter */}
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
            {/* Pillar filter */}
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
            {/* Period filter */}
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

        {/* Posts grouped by month */}
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
                  </button>
                  {isOpen && (
                    <div className="border-t border-border divide-y divide-border">
                      {monthPosts.map(post => {
                        const pillar = getPillar(post.pillar_id);
                        return (
                          <div key={post.id} className="px-4 py-3 hover:bg-accent/20 transition-colors">
                            <div className="flex items-start gap-3">
                              <PlatformIcon platform={post.platform as any} size="sm" className="mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-body font-medium text-sm text-foreground">{post.title}</p>
                                {post.archive_summary && (
                                  <p className="text-xs text-primary font-body italic mt-0.5">"{post.archive_summary}"</p>
                                )}
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-body">{FORMAT_LABELS[post.format] || post.format}</span>
                                  {pillar && (
                                    <span className="px-1.5 py-0.5 rounded text-xs font-body text-primary-foreground" style={{ backgroundColor: pillar.color }}>
                                      {pillar.name}
                                    </span>
                                  )}
                                  <span className="text-xs text-muted-foreground font-body">
                                    {post.published_at ? new Date(post.published_at).toLocaleDateString("pt-BR") : "—"}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground font-body flex-shrink-0">
                                {post.result_views != null && <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{post.result_views}</span>}
                                {post.result_saves != null && <span className="flex items-center gap-0.5"><Bookmark className="h-3 w-3" />{post.result_saves}</span>}
                                {post.result_comments != null && <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{post.result_comments}</span>}
                              </div>
                            </div>
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
      </motion.div>
    </div>
  );
};

export default Historico;
