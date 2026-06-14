import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bookmark,
  CalendarDays,
  Flame,
  Lightbulb,
  Loader2,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { usePosts } from "@/hooks/usePosts";
import { usePillars } from "@/hooks/usePillars";
import { useIdeas } from "@/hooks/useIdeas";
import { cn } from "@/lib/utils";
import { FORMAT_LABELS, FORMATS, PLATFORMS } from "@/lib/constants";
import { BestTimeToPost } from "@/components/insights/BestTimeToPost";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { callAIContextBuilder } from "@/lib/ai/claude";
import { toast } from "sonner";

type PeriodKey = "7" | "30" | "90" | "year";

const PERIOD_OPTIONS: { key: PeriodKey; label: string; days: number }[] = [
  { key: "7", label: "Últimos 7 dias", days: 7 },
  { key: "30", label: "30 dias", days: 30 },
  { key: "90", label: "90 dias", days: 90 },
  { key: "year", label: "Este ano", days: 365 },
];

const FORMAT_COLORS: Record<string, string> = {
  reels: "#FF6B6B",
  carrossel: "#7C5CFC",
  foto: "#FFBE0B",
  story: "#FF69B4",
  video: "#4DABF7",
  shorts: "#20B2AA",
  live: "#22C55E",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  tiktok: "#000000",
  youtube: "#FF0000",
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function isoDay(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfWeekIso(d: Date) {
  const day = (d.getDay() + 6) % 7;
  const out = new Date(d);
  out.setDate(d.getDate() - day);
  out.setHours(0, 0, 0, 0);
  return out;
}

function formatPercent(n: number) {
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function mean(nums: number[]) {
  if (nums.length === 0) return 0;
  return nums.reduce((acc, n) => acc + n, 0) / nums.length;
}

// 1.2k / 980 — número compacto para views/alcance
function formatCompact(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return Math.round(n).toString();
}

// eng% já vem em pontos percentuais (ex.: 3.4 -> "3,4%")
function formatEngagement(n: number) {
  if (!Number.isFinite(n)) return "—";
  const rounded = n >= 10 ? Math.round(n).toString() : n.toFixed(1);
  return `${rounded.replace(".", ",")}%`;
}

const Relatorios = () => {
  const { user } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  // niche e weekly_goal são da CONTA ATIVA (relatório/IA são sobre ela);
  // profile.role (isAdmin) continua da SESSÃO.
  const { profile: activeProfile } = useActiveProfile();
  const { posts, isLoading: postsLoading } = usePosts();
  const { pillars } = usePillars();
  const { ideas } = useIdeas();
  const navigate = useNavigate();

  const [period, setPeriod] = useState<PeriodKey>("30");
  const [insight, setInsight] = useState<string>("");
  const [insightLoading, setInsightLoading] = useState(false);

  const isAdmin = profile?.role === "admin";

  const periodCfg = PERIOD_OPTIONS.find((p) => p.key === period) ?? PERIOD_OPTIONS[1];

  const now = useMemo(() => new Date(), []);
  const periodStart = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - periodCfg.days);
    return d;
  }, [now, periodCfg]);
  const previousStart = useMemo(() => {
    const d = new Date(periodStart);
    d.setDate(d.getDate() - periodCfg.days);
    return d;
  }, [periodStart, periodCfg]);

  const periodPosts = useMemo(
    () => posts.filter((p) => p.published_at && new Date(p.published_at) >= periodStart),
    [posts, periodStart]
  );
  const previousPosts = useMemo(
    () =>
      posts.filter(
        (p) =>
          p.published_at &&
          new Date(p.published_at) >= previousStart &&
          new Date(p.published_at) < periodStart
      ),
    [posts, previousStart, periodStart]
  );

  const publishedCount = periodPosts.length;
  const previousPublishedCount = previousPosts.length;
  const publishedDelta = previousPublishedCount === 0
    ? publishedCount > 0
      ? 100
      : 0
    : ((publishedCount - previousPublishedCount) / previousPublishedCount) * 100;

  const inCreationCount = useMemo(
    () => posts.filter((p) => p.status && p.status !== "publicado").length,
    [posts]
  );
  const ideasCount = ideas.length;

  const weeklyGoal = activeProfile?.weekly_goal ?? 3;

  const weeksData = useMemo(() => {
    type WeekRow = { week: string; total: number; [pillarKey: string]: string | number };
    const buckets = new Map<string, WeekRow>();
    periodPosts.forEach((post) => {
      if (!post.published_at) return;
      const d = new Date(post.published_at);
      const weekStart = startOfWeekIso(d);
      const key = isoDay(weekStart);
      const label = `${pad(weekStart.getDate())}/${pad(weekStart.getMonth() + 1)}`;
      const row: WeekRow = buckets.get(key) ?? { week: label, total: 0 };
      const pillarKey = post.pillar_id ?? "sem-pilar";
      const prev = typeof row[pillarKey] === "number" ? (row[pillarKey] as number) : 0;
      row[pillarKey] = prev + 1;
      row.total = row.total + 1;
      buckets.set(key, row);
    });
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, row]) => row);
  }, [periodPosts]);

  const consistency = useMemo(() => {
    if (weeksData.length === 0) return 0;
    const hitWeeks = weeksData.filter((w) => w.total >= weeklyGoal).length;
    return Math.round((hitWeeks / weeksData.length) * 100);
  }, [weeksData, weeklyGoal]);

  const pillarDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    periodPosts.forEach((post) => {
      const key = post.pillar_id ?? "sem-pilar";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([id, value]) => {
        const pillar = pillars.find((p) => p.id === id);
        return {
          id,
          name: pillar?.name ?? "Sem pilar",
          color: pillar?.color ?? "#94A3B8",
          value,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [periodPosts, pillars]);

  const formatDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    periodPosts.forEach((post) => {
      counts.set(post.format, (counts.get(post.format) ?? 0) + 1);
    });
    const sorted = FORMATS.map((f) => ({
      format: f,
      label: FORMAT_LABELS[f] || f,
      value: counts.get(f) ?? 0,
      color: FORMAT_COLORS[f] ?? "#94A3B8",
    })).filter((row) => row.value > 0);
    return sorted.sort((a, b) => b.value - a.value);
  }, [periodPosts]);

  const platformDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    periodPosts.forEach((post) => {
      counts.set(post.platform, (counts.get(post.platform) ?? 0) + 1);
    });
    return PLATFORMS.map((p) => ({
      platform: p,
      label: PLATFORM_LABELS[p] ?? p,
      value: counts.get(p) ?? 0,
      color: PLATFORM_COLORS[p] ?? "#94A3B8",
    }));
  }, [periodPosts]);

  const streak = useMemo(() => {
    if (posts.length === 0) return { current: 0, longest: 0 };
    const publishedWeeks = new Set<string>();
    posts.forEach((p) => {
      if (!p.published_at || p.status !== "publicado") return;
      publishedWeeks.add(isoDay(startOfWeekIso(new Date(p.published_at))));
    });

    const sortedWeeks = Array.from(publishedWeeks).sort();
    if (sortedWeeks.length === 0) return { current: 0, longest: 0 };

    let longest = 1;
    let run = 1;
    for (let i = 1; i < sortedWeeks.length; i++) {
      const prev = new Date(sortedWeeks[i - 1] + "T12:00:00");
      const curr = new Date(sortedWeeks[i] + "T12:00:00");
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 7) {
        run += 1;
        longest = Math.max(longest, run);
      } else {
        run = 1;
      }
    }

    const thisWeek = isoDay(startOfWeekIso(now));
    let current = 0;
    const cursor = startOfWeekIso(now);
    while (publishedWeeks.has(isoDay(cursor))) {
      current += 1;
      cursor.setDate(cursor.getDate() - 7);
    }
    if (!publishedWeeks.has(thisWeek)) {
      // streak rolls if last published week was last week
      const lastWeek = new Date(now);
      lastWeek.setDate(lastWeek.getDate() - 7);
      if (publishedWeeks.has(isoDay(startOfWeekIso(lastWeek)))) {
        // already counted by while loop starting at thisWeek? no, thisWeek not in set so loop ran 0 times.
        // Start over from lastWeek.
        const c = startOfWeekIso(lastWeek);
        while (publishedWeeks.has(isoDay(c))) {
          current += 1;
          c.setDate(c.getDate() - 7);
        }
      }
    }

    return { current, longest };
  }, [posts, now]);

  // ── DESEMPENHO: lê as métricas reais já gravadas em posts.result_* ──
  // Só posts publicados que tenham pelo menos result_views preenchido.
  const performancePosts = useMemo(
    () => periodPosts.filter((p) => p.status === "publicado" && p.result_views != null),
    [periodPosts]
  );
  const prevPerformancePosts = useMemo(
    () => previousPosts.filter((p) => p.status === "publicado" && p.result_views != null),
    [previousPosts]
  );

  const avgViews = useMemo(
    () => mean(performancePosts.map((p) => p.result_views ?? 0)),
    [performancePosts]
  );
  const prevAvgViews = useMemo(
    () => mean(prevPerformancePosts.map((p) => p.result_views ?? 0)),
    [prevPerformancePosts]
  );
  const avgViewsDelta =
    prevAvgViews === 0 ? (avgViews > 0 ? 100 : 0) : ((avgViews - prevAvgViews) / prevAvgViews) * 100;

  // Média de views por formato (desc) — topo = "Formato que mais rende"
  const byFormat = useMemo(() => {
    const groups = new Map<string, number[]>();
    performancePosts.forEach((p) => {
      const arr = groups.get(p.format) ?? [];
      arr.push(p.result_views ?? 0);
      groups.set(p.format, arr);
    });
    return Array.from(groups.entries())
      .map(([format, vals]) => ({
        format,
        label: FORMAT_LABELS[format] || format,
        color: FORMAT_COLORS[format] ?? "#94A3B8",
        avg: mean(vals),
        count: vals.length,
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [performancePosts]);

  const topFormatDelta =
    byFormat.length > 0 && avgViews > 0 ? ((byFormat[0].avg - avgViews) / avgViews) * 100 : 0;

  // Média de saves por pilar (desc) — topo = "Pilar que gera saves"
  const byPillar = useMemo(() => {
    const groups = new Map<string, number[]>();
    performancePosts.forEach((p) => {
      const key = p.pillar_id ?? "sem-pilar";
      const arr = groups.get(key) ?? [];
      arr.push(p.result_saves ?? 0);
      groups.set(key, arr);
    });
    return Array.from(groups.entries())
      .map(([id, vals]) => {
        const pillar = pillars.find((pl) => pl.id === id);
        return {
          id,
          name: pillar?.name ?? "Sem pilar",
          color: pillar?.color ?? "#94A3B8",
          avg: mean(vals),
          count: vals.length,
        };
      })
      .sort((a, b) => b.avg - a.avg);
  }, [performancePosts, pillars]);

  // Média de views por dia da semana (desc) — topo = "Melhor dia (por resultado)"
  const byWeekday = useMemo(() => {
    const groups = new Map<number, number[]>();
    performancePosts.forEach((p) => {
      if (!p.published_at) return;
      const day = new Date(p.published_at).getDay();
      const arr = groups.get(day) ?? [];
      arr.push(p.result_views ?? 0);
      groups.set(day, arr);
    });
    return Array.from(groups.entries())
      .map(([day, vals]) => ({ day, label: WEEKDAY_LABELS[day], avg: mean(vals), count: vals.length }))
      .sort((a, b) => b.avg - a.avg);
  }, [performancePosts]);

  // eng% por post = (saves + comments) / (reach ?? views)
  const postEngagement = (p: (typeof performancePosts)[number]) => {
    const views = p.result_views ?? 0;
    const denom = p.result_reach ?? views;
    if (denom <= 0) return 0;
    return (((p.result_saves ?? 0) + (p.result_comments ?? 0)) / denom) * 100;
  };

  // Top 3 por views
  const topPosts = useMemo(() => {
    return [...performancePosts]
      .sort((a, b) => (b.result_views ?? 0) - (a.result_views ?? 0))
      .slice(0, 3)
      .map((p) => {
        const pillar = pillars.find((pl) => pl.id === p.pillar_id);
        return {
          id: p.id,
          title: p.title,
          formatLabel: FORMAT_LABELS[p.format] || p.format,
          formatColor: FORMAT_COLORS[p.format] ?? "#94A3B8",
          pillarName: pillar?.name ?? null,
          pillarColor: pillar?.color ?? "#94A3B8",
          views: p.result_views ?? 0,
          saves: p.result_saves ?? 0,
          eng: postEngagement(p),
        };
      });
  }, [performancePosts, pillars]);

  const avgEngagement = useMemo(
    () => mean(performancePosts.map(postEngagement)),
    [performancePosts]
  );

  const hasPerformance = performancePosts.length >= 3;

  const handleGenerateInsight = async () => {
    if (insightLoading) return;
    setInsightLoading(true);
    setInsight("");
    try {
      const summary = {
        periodo: periodCfg.label,
        posts_publicados: publishedCount,
        posts_em_criacao: inCreationCount,
        ideias_no_banco: ideasCount,
        consistencia_pct: consistency,
        meta_semanal: weeklyGoal,
        distribuicao_formato: formatDistribution.map((f) => ({ formato: f.label, qtd: f.value })),
        distribuicao_pilar: pillarDistribution.map((p) => ({ pilar: p.name, qtd: p.value })),
        distribuicao_plataforma: platformDistribution
          .filter((p) => p.value > 0)
          .map((p) => ({ plataforma: p.label, qtd: p.value })),
        streak_semanas: streak.current,
        streak_maior: streak.longest,
        nicho: activeProfile?.niche,
        desempenho: hasPerformance
          ? {
              posts_com_resultados: performancePosts.length,
              views_medios: Math.round(avgViews),
              views_medios_delta_pct: Math.round(avgViewsDelta),
              formato_que_mais_rende: byFormat[0]
                ? { formato: byFormat[0].label, views_medios: Math.round(byFormat[0].avg) }
                : null,
              pilar_que_gera_saves: byPillar[0]
                ? { pilar: byPillar[0].name, saves_medios: Math.round(byPillar[0].avg) }
                : null,
              melhor_dia: byWeekday[0]
                ? { dia: byWeekday[0].label, views_medios: Math.round(byWeekday[0].avg) }
                : null,
              engajamento_medio_pct: Number(avgEngagement.toFixed(1)),
            }
          : null,
      };

      const raw = await callAIContextBuilder({
        userId: user?.id,
        operation: "cria-chat",
        data: {
          mensagem:
            "Você é a Cria, analista de conteúdo. Olhe os dados abaixo e me dê 2-3 insights curtos e acionáveis. Comente não só a consistência e a distribuição, mas também o que está PERFORMANDO: use o bloco 'desempenho' (formato que mais rende, pilar que gera saves, melhor dia, engajamento médio e a variação de views médios vs período anterior) pra recomendar o que eu deveria priorizar e testar essa semana. Se 'desempenho' vier null, foque em consistência e peça pra eu preencher os resultados dos posts. Linguagem natural, em português brasileiro, sem markdown.",
          nicho: activeProfile?.niche,
          analise: summary,
        },
      });
      const text =
        typeof raw === "string" ? raw.replace(/```\w*\n?|\n?```/g, "").trim() : String(raw ?? "");
      setInsight(text || "Não consegui gerar insights agora. Tenta de novo daqui a pouco.");
    } catch (e) {
      console.error("Insight failed", e);
      toast.error("Não consegui gerar o insight agora.");
    } finally {
      setInsightLoading(false);
    }
  };

  if (profileLoading || (postsLoading && posts.length === 0)) {
    return (
      <div className="pb-20 md:pb-0">
        <PageSkeleton />
      </div>
    );
  }

  if (!isAdmin) {
    const bullets = [
      "Alcance e impressões por post",
      "Taxa de engajamento por formato",
      "Crescimento de seguidores",
      "Melhores horários para publicar",
      "Comparativo entre plataformas",
    ];
    return (
      <div className="pb-20 md:pb-0">
        <div className="max-w-lg mx-auto mt-16 rounded-2xl bg-card border border-border shadow-warm p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-5">
            <BarChart3 className="h-7 w-7 text-foreground/70" strokeWidth={1.75} />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-body font-semibold mb-4">
            🔒 Acesso Restrito · Apenas Admin
          </span>

          <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight mb-2">
            Relatórios de Performance
          </h1>
          <p className="text-sm font-body text-muted-foreground leading-relaxed mb-6">
            Conecte suas redes sociais e acesse dados reais de alcance, impressões e engajamento via API.
          </p>

          <div className="bg-muted/40 rounded-xl p-4 text-left mb-6">
            <ul className="space-y-2">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm font-body text-foreground/85">
                  <Sparkles className="h-3 w-3 text-primary mt-1 shrink-0" strokeWidth={2} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs font-body text-muted-foreground mb-5">
            Acesso disponível para administradores do sistema.
          </p>

          <Button variant="ghost" size="sm" onClick={() => navigate("/app")}>
            ← Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm shrink-0">
              <BarChart3 className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">
                Seus Relatórios
              </h1>
              <p className="text-sm text-muted-foreground font-body mt-0.5">
                Acompanhe sua evolução como criador.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 bg-muted/50 rounded-full p-1 flex-wrap">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPeriod(opt.key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all",
                  period === opt.key
                    ? "bg-card text-foreground shadow-warm-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <MetricCard
            label="Posts publicados"
            value={publishedCount}
            delta={publishedDelta}
            gradient="from-emerald-500/15 to-teal-500/5"
            iconBg="bg-emerald-500"
          />
          <MetricCard
            label="Em criação"
            value={inCreationCount}
            gradient="from-blue-500/15 to-sky-500/5"
            iconBg="bg-blue-500"
          />
          <MetricCard
            label="Ideias no banco"
            value={ideasCount}
            gradient="from-violet-500/15 to-purple-500/5"
            iconBg="bg-violet-500"
          />
          <MetricCard
            label="Consistência"
            value={`${consistency}%`}
            subLabel={`${weeksData.filter((w) => w.total >= weeklyGoal).length}/${weeksData.length} semanas`}
            gradient="from-amber-500/15 to-orange-500/5"
            iconBg="bg-amber-500"
          />
        </div>

        {/* ─── DESEMPENHO (lê posts.result_*) ─────────── */}
        <section className="mb-8">
          {/* Header da seção */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-display font-extrabold text-foreground tracking-tight">
                Desempenho
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-body font-bold uppercase tracking-wider">
                Novo
              </span>
              {hasPerformance && (
                <span className="text-xs font-body text-muted-foreground">
                  {performancePosts.length} posts com resultados
                </span>
              )}
            </div>
            {hasPerformance && (
              <p className="text-xs font-body text-muted-foreground">
                views médios: <span className="font-semibold text-foreground">{formatCompact(avgViews)}</span>
                {" · "}
                <span
                  className={cn(
                    "font-semibold",
                    avgViewsDelta > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : avgViewsDelta < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground"
                  )}
                >
                  {formatPercent(avgViewsDelta)}
                </span>{" "}
                vs período anterior
              </p>
            )}
          </div>

          {!hasPerformance ? (
            /* Estado vazio — menos de 3 posts com result_views */
            <div className="rounded-2xl bg-card border border-border shadow-warm-sm p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                <Trophy className="h-6 w-6 text-foreground/70" strokeWidth={1.75} />
              </div>
              <h3 className="text-base font-display font-semibold text-foreground mb-1.5">
                Desbloqueie o Desempenho
              </h3>
              <p className="text-sm font-body text-muted-foreground leading-relaxed max-w-md mx-auto mb-5">
                Preencha os resultados dos seus posts publicados (views, salvos, alcance…) pra
                desbloquear o Desempenho e ver o que mais rende.
              </p>
              <Button variant="secondary" size="sm" onClick={() => navigate("/app/historico")}>
                <ArrowRight className="h-3.5 w-3.5 mr-1.5" /> Ir pro Histórico
              </Button>
            </div>
          ) : (
            <>
              {/* Winner cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-4">
                <WinnerCard
                  icon={<Flame className="h-4 w-4 text-white" strokeWidth={1.75} />}
                  iconBg="bg-gradient-to-br from-rose-500 to-red-500"
                  label="Formato que mais rende"
                  value={byFormat[0]?.label ?? "—"}
                  sub={`${formatCompact(byFormat[0]?.avg ?? 0)} views médios`}
                  delta={topFormatDelta}
                  deltaLabel="vs média geral"
                />
                <WinnerCard
                  icon={<Bookmark className="h-4 w-4 text-white" strokeWidth={1.75} />}
                  iconBg="bg-gradient-to-br from-violet-500 to-purple-600"
                  label="Pilar que gera saves"
                  value={byPillar[0]?.name ?? "—"}
                  valueColor={byPillar[0]?.color}
                  sub={`${formatCompact(byPillar[0]?.avg ?? 0)} salvos médios`}
                />
                <WinnerCard
                  icon={<CalendarDays className="h-4 w-4 text-white" strokeWidth={1.75} />}
                  iconBg="bg-gradient-to-br from-sky-500 to-blue-600"
                  label="Melhor dia (por resultado)"
                  value={byWeekday[0]?.label ?? "—"}
                  sub={`${formatCompact(byWeekday[0]?.avg ?? 0)} views médios`}
                />
              </div>

              {/* Views por formato + Top posts */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.25fr] gap-4">
                <ChartCard title="Média de views por formato" subtitle="O que mais entrega resultado">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={byFormat} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis dataKey="label" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={70} />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                        formatter={(value: number) => [`${Math.round(value)} views médios`, "Média"]}
                      />
                      <Bar dataKey="avg" radius={[0, 6, 6, 0]}>
                        {byFormat.map((row) => (
                          <Cell key={row.format} fill={row.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Seus posts que mais performaram" subtitle="Top 3 por visualizações">
                  <div className="space-y-2">
                    {topPosts.map((p, i) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3"
                      >
                        <span className="shrink-0 w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center text-sm font-display font-extrabold text-foreground/70">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-body font-semibold text-foreground truncate">
                            {p.title || "Sem título"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-body font-medium text-white"
                              style={{ backgroundColor: p.formatColor }}
                            >
                              {p.formatLabel}
                            </span>
                            {p.pillarName && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-body font-medium text-white"
                                style={{ backgroundColor: p.pillarColor }}
                              >
                                {p.pillarName}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-3 text-right">
                          <div>
                            <p className="text-sm font-display font-bold text-foreground leading-none">{formatCompact(p.views)}</p>
                            <p className="text-[9px] uppercase tracking-wider font-body text-muted-foreground mt-0.5">views</p>
                          </div>
                          <div>
                            <p className="text-sm font-display font-bold text-foreground leading-none">{formatCompact(p.saves)}</p>
                            <p className="text-[9px] uppercase tracking-wider font-body text-muted-foreground mt-0.5">salvos</p>
                          </div>
                          <div>
                            <p className="text-sm font-display font-bold text-primary leading-none">{formatEngagement(p.eng)}</p>
                            <p className="text-[9px] uppercase tracking-wider font-body text-muted-foreground mt-0.5">eng.</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ChartCard>
              </div>
            </>
          )}
        </section>

        {/* Posts por semana */}
        <ChartCard title="Posts por semana" subtitle="Distribuição por pilar de conteúdo">
          {weeksData.length === 0 ? (
            <EmptyChart message="Nenhum post publicado no período." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weeksData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                />
                {pillarDistribution.map((p) => (
                  <Bar key={p.id} dataKey={p.id} stackId="pillars" fill={p.color} name={p.name} radius={[6, 6, 0, 0]} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Grids: pilar, formato, plataforma */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          <ChartCard title="Distribuição por pilar" subtitle="Onde está seu volume de conteúdo">
            {pillarDistribution.length === 0 ? (
              <EmptyChart message="Sem posts no período." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pillarDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                  >
                    {pillarDistribution.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    formatter={(value: number, name: string) => [`${value} posts`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Distribuição por formato" subtitle="Reels, carrossel, foto...">
            {formatDistribution.length === 0 ? (
              <EmptyChart message="Sem posts no período." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={formatDistribution} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis dataKey="label" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={70} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {formatDistribution.map((row) => (
                      <Cell key={row.format} fill={row.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* Plataforma */}
        <ChartCard title="Distribuição por plataforma" subtitle="Onde você posta mais" className="mt-6">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={platformDistribution} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {platformDistribution.map((row) => (
                  <Cell key={row.platform} fill={row.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Streak + BestTime + AI insight */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
          {/* Streak */}
          <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-500/10 dark:to-red-500/5 rounded-xl border border-orange-200/40 dark:border-orange-500/20 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                <Flame className="h-4 w-4 text-white" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="text-sm font-display font-semibold text-foreground">Streak de publicação</h3>
                <p className="text-[10px] text-muted-foreground font-body">Semanas consecutivas</p>
              </div>
            </div>
            <p className="text-3xl font-display font-extrabold text-orange-700 dark:text-orange-400">
              {streak.current}{" "}
              <span className="text-sm font-body font-medium text-muted-foreground">
                {streak.current === 1 ? "semana" : "semanas"}
              </span>
            </p>
            <p className="text-xs font-body text-foreground/70 mt-2 leading-relaxed">
              {streak.current > 0
                ? `Você está publicando há ${streak.current} ${streak.current === 1 ? "semana" : "semanas"} consecutivas!`
                : "Comece sua sequência publicando essa semana."}
            </p>
            {streak.longest > 0 && (
              <p className="text-[11px] text-muted-foreground font-body mt-1.5">
                Recorde: {streak.longest} {streak.longest === 1 ? "semana" : "semanas"}
              </p>
            )}
          </div>

          {/* Best time */}
          <BestTimeToPost posts={posts} />

          {/* AI Insight */}
          <div className="bg-gradient-to-br from-primary/10 via-purple-500/5 to-pink-500/10 rounded-xl border border-primary/15 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="text-sm font-display font-semibold text-foreground">Insight da cria</h3>
                <p className="text-[10px] text-muted-foreground font-body">Análise dos seus dados</p>
              </div>
            </div>

            {insight ? (
              <p className="text-sm font-body text-foreground/85 leading-relaxed whitespace-pre-line mb-3">
                {insight}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground font-body mb-3">
                Toque abaixo para que a Cria analise seus números e sugira o próximo passo.
              </p>
            )}

            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={handleGenerateInsight}
              disabled={insightLoading}
            >
              {insightLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Analisando...
                </>
              ) : insight ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Gerar outro insight
                </>
              ) : (
                <>
                  <Lightbulb className="h-3.5 w-3.5 mr-1.5" /> Gerar insight
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

type MetricCardProps = {
  label: string;
  value: number | string;
  delta?: number;
  subLabel?: string;
  gradient: string;
  iconBg: string;
};

function MetricCard({ label, value, delta, subLabel, gradient, iconBg }: MetricCardProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border/50 p-4 bg-gradient-to-br", gradient)}>
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-2 shadow-sm", iconBg)}>
        <BarChart3 className="h-4 w-4 text-white" strokeWidth={1.75} />
      </div>
      <p className="text-2xl font-display font-extrabold text-foreground tracking-tight">{value}</p>
      <div className="flex items-center justify-between mt-1">
        <p className="text-[10px] uppercase tracking-wider font-body font-semibold text-muted-foreground">{label}</p>
        {typeof delta === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[10px] font-body font-semibold px-1.5 py-0.5 rounded-full",
              delta > 0 ? "bg-emerald-100 text-emerald-700" : delta < 0 ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"
            )}
          >
            {delta > 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : delta < 0 ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <ArrowRight className="h-3 w-3" />
            )}
            {formatPercent(delta)}
          </span>
        )}
      </div>
      {subLabel && <p className="text-[10px] text-muted-foreground font-body mt-0.5">{subLabel}</p>}
    </div>
  );
}

type WinnerCardProps = {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  valueColor?: string;
  sub: string;
  delta?: number;
  deltaLabel?: string;
};

function WinnerCard({ icon, iconBg, label, value, valueColor, sub, delta, deltaLabel }: WinnerCardProps) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-warm-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
          {icon}
        </div>
        <p className="text-[10px] uppercase tracking-wider font-body font-semibold text-muted-foreground">
          {label}
        </p>
      </div>
      <p
        className="text-xl font-display font-extrabold text-foreground tracking-tight truncate"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </p>
      <div className="flex items-center justify-between gap-2 mt-1">
        <p className="text-[11px] font-body text-muted-foreground">{sub}</p>
        {typeof delta === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[10px] font-body font-semibold px-1.5 py-0.5 rounded-full shrink-0",
              delta > 0 ? "bg-emerald-100 text-emerald-700" : delta < 0 ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"
            )}
            title={deltaLabel}
          >
            {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
            {formatPercent(delta)}
          </span>
        )}
      </div>
    </div>
  );
}

type ChartCardProps = {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
};

function ChartCard({ title, subtitle, className, children }: ChartCardProps) {
  return (
    <div className={cn("bg-card rounded-xl border border-border p-5 shadow-warm-sm", className)}>
      <div className="mb-4">
        <h3 className="text-sm font-display font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground font-body mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-center px-6">
      <p className="text-sm text-muted-foreground font-body">{message}</p>
    </div>
  );
}

export default Relatorios;
