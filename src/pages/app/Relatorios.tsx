import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Flame,
  Instagram,
  Layers,
  Lightbulb,
  Link2,
  Loader2,
  Sparkles,
  TrendingDown,
  TrendingUp,
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
import {
  useSocialConnection,
  useMediaInsights,
  useSocialAccountOwner,
  connectInstagram,
  type MediaInsight,
} from "@/hooks/useSocialInsights";
import {
  computeCrossAnalysis,
  crossHeadlines,
  fmtNum,
  formatMediaLabel,
  type CrossItem,
} from "@/components/insights/insightsUtils";
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

// Paleta oficial do Cria (laranja é a --primary). "Sem pilar" usa um cinza neutro.
const CRIA_PALETTE = ["#EA4918", "#0061EE", "#01A652", "#FF77B9", "#FFCF03", "#4B3FA8"];
const NEUTRAL = "#94A3B8";

const FORMAT_COLORS: Record<string, string> = {
  reels: "#EA4918", // laranja (primary)
  carrossel: "#0061EE", // azul
  foto: "#01A652", // verde
  story: "#FF77B9", // rosa
  video: "#4B3FA8", // roxo
  shorts: "#FFCF03", // amarelo
  live: "#0061EE", // azul
};

// Rótulos do formatMediaLabel (plural) -> cor Cria, pros gráficos de performance do IG.
const MEDIA_LABEL_COLORS: Record<string, string> = {
  Reels: "#EA4918",
  Carrosséis: "#0061EE",
  Fotos: "#01A652",
  Stories: "#FF77B9",
  Vídeos: "#4B3FA8",
  Outros: NEUTRAL,
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#EA4918",
  tiktok: "#4B3FA8",
  youtube: "#0061EE",
};

// Lê uma métrica numérica do jsonb de uma mídia do IG.
const mVal = (mi: MediaInsight, k: string) => Number(mi.metrics?.[k] ?? 0);
// Interações totais: usa total_interactions quando vier, senão soma os componentes.
const mInteractions = (mi: MediaInsight) =>
  mVal(mi, "total_interactions") ||
  mVal(mi, "likes") + mVal(mi, "comments") + mVal(mi, "saved") + mVal(mi, "saves") + mVal(mi, "shares");
const mSaved = (mi: MediaInsight) => mVal(mi, "saved") || mVal(mi, "saves");

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
  if (!Number.isFinite(n)) return "-";
  const rounded = Math.round(n);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function mean(nums: number[]) {
  if (nums.length === 0) return 0;
  return nums.reduce((acc, n) => acc + n, 0) / nums.length;
}

// 1.2k / 980, número compacto para views/alcance
function formatCompact(n: number) {
  if (!Number.isFinite(n)) return "-";
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return Math.round(n).toString();
}

// eng% já vem em pontos percentuais (ex.: 3.4 -> "3,4%")
function formatEngagement(n: number) {
  if (!Number.isFinite(n)) return "-";
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
  const { data: conn, isLoading: connLoading } = useSocialConnection();
  const { data: media = [] } = useMediaInsights();
  // Conectar o Instagram é ação do DONO da conta ativa (gestora conectaria o dela).
  const { isOwnAccount } = useSocialAccountOwner();
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

  // ── DESEMPENHO: lê os dados REAIS do Instagram (useMediaInsights) ──
  // Nada de preencher à mão: alcance/interações vêm direto da API da Meta.
  const igConnected = !!conn;

  // Índice pilar_id -> {name,color} pra cruzar o vínculo IG->CRIA.
  const pillarById = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    pillars.forEach((p) => map.set(p.id, { name: p.name, color: p.color ?? NEUTRAL }));
    return map;
  }, [pillars]);
  const pillarColorByName = useMemo(() => {
    const map = new Map<string, string>();
    pillars.forEach((p) => map.set(p.name, p.color ?? NEUTRAL));
    return map;
  }, [pillars]);

  // Mídia do IG dentro do período selecionado (posted_at é o carimbo real da Meta).
  const periodMedia = useMemo(
    () => media.filter((mi) => mi.posted_at && new Date(mi.posted_at) >= periodStart),
    [media, periodStart]
  );
  const prevMedia = useMemo(
    () =>
      media.filter(
        (mi) =>
          mi.posted_at &&
          new Date(mi.posted_at) >= previousStart &&
          new Date(mi.posted_at) < periodStart
      ),
    [media, previousStart, periodStart]
  );

  // Shape CrossItem pros utils de cruzamento (mesma conta usada na tela de Insights).
  const crossItems = useMemo<CrossItem[]>(
    () =>
      periodMedia.map((mi) => ({
        media_type: mi.media_type,
        posted_at: mi.posted_at,
        reach: mVal(mi, "reach"),
        interactions: mInteractions(mi),
        pillar: mi.posts?.pillar_id ? pillarById.get(mi.posts.pillar_id)?.name ?? null : null,
        hook: mi.posts?.hook ?? null,
      })),
    [periodMedia, pillarById]
  );
  const cross = useMemo(() => computeCrossAnalysis(crossItems), [crossItems]);

  // Só faz leitura de desempenho quando conectado e com alcance/interações reais.
  const hasPerformance = igConnected && cross.hasData;
  // Há posts do IG vinculados a posts do CRIA com pilar? (habilita a leitura por pilar)
  const hasLinkedPillar = crossItems.some((i) => i.pillar);
  // Há mídia do IG vinculada a um post do CRIA no período (independe de ter pilar).
  // Sem isso o card de pilar dizia "vincule seus posts" mesmo com o vínculo JÁ feito:
  // o vínculo existe, mas o post do CRIA está sem pilar (pillar_id nulo), então o
  // cruzamento por pilar não enxergava nada. Aqui separamos "não vinculou" de
  // "vinculou mas sem pilar" pra orientar a ação certa (definir o pilar, não vincular).
  const hasLinkedPosts = periodMedia.some((mi) => !!mi.post_id);
  const linkedWithoutPillar = hasLinkedPosts && !hasLinkedPillar;

  const avgReach = cross.overallAvgReach;
  const prevAvgReach = useMemo(() => {
    const withReach = prevMedia.filter((mi) => mVal(mi, "reach") > 0);
    return mean(withReach.map((mi) => mVal(mi, "reach")));
  }, [prevMedia]);
  // Só há delta REAL quando existe base de comparação (período anterior > 0).
  // Sem base (conta nova / não postou antes) NÃO inventamos "+100%": isso ia
  // parar no relatório white-label entregue ao cliente final como crescimento falso.
  const hasReachBaseline = prevAvgReach > 0;
  const avgReachDelta = hasReachBaseline ? ((avgReach - prevAvgReach) / prevAvgReach) * 100 : 0;

  const avgEngagement = useMemo(() => {
    const withReach = periodMedia.filter((mi) => mVal(mi, "reach") > 0);
    if (withReach.length === 0) return 0;
    return mean(withReach.map((mi) => (mInteractions(mi) / mVal(mi, "reach")) * 100));
  }, [periodMedia]);

  // Engajamento médio do período anterior (pra dizer se subiu/caiu, sem inventar).
  const prevAvgEngagement = useMemo(() => {
    const withReach = prevMedia.filter((mi) => mVal(mi, "reach") > 0);
    if (withReach.length === 0) return 0;
    return mean(withReach.map((mi) => (mInteractions(mi) / mVal(mi, "reach")) * 100));
  }, [prevMedia]);

  // Retenção real dos Reels no período: tempo médio assistido (ms) direto da Meta.
  // Só existe quando o Instagram devolve ig_reels_avg_watch_time; senão fica null.
  const reelsWatch = useMemo(() => {
    const list = periodMedia
      .filter((mi) => mi.media_type === "REELS" || mi.media_type === "VIDEO")
      .map((mi) => mVal(mi, "ig_reels_avg_watch_time"))
      .filter((ms) => ms > 0);
    if (list.length === 0) return null;
    return { count: list.length, avgSec: mean(list) / 1000 };
  }, [periodMedia]);

  // Alcance médio por formato (rótulo plural do IG) com a cor Cria.
  const formatPerf = useMemo(
    () =>
      cross.byFormat.map((g) => ({
        label: g.label,
        avg: g.avgReach,
        count: g.count,
        color: MEDIA_LABEL_COLORS[g.label] ?? NEUTRAL,
      })),
    [cross]
  );
  const topFormatDelta =
    formatPerf.length > 0 && avgReach > 0 ? ((formatPerf[0].avg - avgReach) / avgReach) * 100 : 0;

  // Alcance médio por pilar (só posts vinculados) com a cor do pilar no banco.
  const pillarPerf = useMemo(
    () =>
      cross.byPillar.map((g, i) => ({
        label: g.label,
        avg: g.avgReach,
        count: g.count,
        color: pillarColorByName.get(g.label) ?? CRIA_PALETTE[i % CRIA_PALETTE.length],
      })),
    [cross, pillarColorByName]
  );

  const topWeekday = cross.byWeekday[0] ?? null;

  // Top 3 mídias por alcance (desempate por salvos), clicáveis abrindo o permalink.
  const topPosts = useMemo(() => {
    return [...periodMedia]
      .sort((a, b) => mVal(b, "reach") - mVal(a, "reach") || mSaved(b) - mSaved(a))
      .slice(0, 3)
      .map((mi) => {
        const pillar = mi.posts?.pillar_id ? pillarById.get(mi.posts.pillar_id) : null;
        const formatLabel = formatMediaLabel(mi.media_type);
        const reach = mVal(mi, "reach");
        return {
          id: mi.id,
          title: mi.posts?.title || formatLabel,
          permalink: mi.permalink,
          formatLabel,
          formatColor: MEDIA_LABEL_COLORS[formatLabel] ?? NEUTRAL,
          pillarName: pillar?.name ?? null,
          pillarColor: pillar?.color ?? NEUTRAL,
          reach,
          saved: mSaved(mi),
          eng: reach > 0 ? (mInteractions(mi) / reach) * 100 : 0,
        };
      });
  }, [periodMedia, pillarById]);

  // Constância: posts publicados por semana (dados do CRIA) vs meta/ritmo.
  const weeksInPeriod = Math.max(1, Math.round(periodCfg.days / 7));
  const postsPerWeek = publishedCount / weeksInPeriod;
  const paceAbove = postsPerWeek >= weeklyGoal;

  // Leitura "O que tá indo bem": além das frases de direção dos cruzamentos (formato,
  // engajamento, pilar, dia, período, gancho), cruza com sinais reais que só existem
  // aqui: variação de alcance/engajamento vs período anterior, retenção dos Reels e o
  // post âncora bem acima da média. Nada inventado: se o dado não existe, a frase não sai.
  const goodPoints = useMemo(() => {
    if (!hasPerformance) return [] as string[];
    const out: string[] = [];

    // Alcance médio subindo vs período anterior (comparação honesta, dado real).
    if (prevAvgReach > 0 && avgReachDelta >= 8) {
      out.push(
        `Seu alcance médio subiu ${Math.round(avgReachDelta)}% vs o período anterior (${fmtNum(avgReach)} por post agora). O que você mudou está funcionando, mantenha a linha.`
      );
    }

    // Direcionamentos dos cruzamentos (formato/engajamento/pilar/dia/período/gancho).
    out.push(...crossHeadlines(cross));

    // Retenção dos Reels: tempo médio assistido, o sinal que o algoritmo mais premia.
    if (reelsWatch && reelsWatch.avgSec >= 1) {
      const avg = reelsWatch.avgSec.toFixed(1).replace(".", ",");
      out.push(
        `Seus Reels seguraram ${avg}s de tempo médio assistido em ${reelsWatch.count} ${reelsWatch.count === 1 ? "vídeo" : "vídeos"}. Retenção é o que mais destrava alcance, siga nesse ritmo de edição.`
      );
    }

    // Post âncora: um destaque bem acima da média mostra a fórmula a repetir.
    const top = topPosts[0];
    if (top && avgReach > 0 && top.reach >= avgReach * 1.5) {
      const x = (top.reach / avgReach).toFixed(1).replace(".0", "").replace(".", ",");
      out.push(
        `Seu melhor post alcançou ${fmtNum(top.reach)} (${x}x a sua média) com ${fmtNum(top.saved)} salvos. Destrinche o gancho e o tema dele e repita a fórmula.`
      );
    }

    // Engajamento subindo vs período anterior (audiência mais reativa).
    if (prevAvgEngagement > 0 && avgEngagement > prevAvgEngagement * 1.1) {
      const d = Math.round(((avgEngagement - prevAvgEngagement) / prevAvgEngagement) * 100);
      out.push(
        `Engajamento médio subiu ${d}% vs o período anterior (${formatEngagement(avgEngagement)} por post). Sua audiência está mais reativa ao que você posta.`
      );
    }

    // Teto de 6 pra não virar um paredão no mobile (as mais fortes vêm primeiro).
    return out.slice(0, 6);
  }, [hasPerformance, cross, prevAvgReach, avgReachDelta, avgReach, reelsWatch, topPosts, prevAvgEngagement, avgEngagement]);

  // Leitura "O que dá pra melhorar": vínculo sem pilar, pilar sem post, alcance caindo,
  // formato fraco, constância baixa e ressalva de amostra pequena. Tudo com número real.
  const improvePoints = useMemo(() => {
    if (!hasPerformance) return [] as string[];
    const out: string[] = [];
    // Vinculou posts mas sem pilar definido: orienta a DEFINIR o pilar (não a vincular).
    if (linkedWithoutPillar) {
      out.push(
        `Você já vinculou posts do Instagram, mas eles estão sem pilar definido no CRIA. Defina o pilar de cada um pra descobrir qual tema rende mais.`
      );
    } else if (hasLinkedPillar) {
      // Pilar sem post publicado no período (só quando há vínculos pra afirmar isso).
      const active = new Set(crossItems.filter((i) => i.pillar).map((i) => i.pillar));
      const missing = pillars.filter((p) => !active.has(p.name));
      if (missing.length > 0) {
        const names = missing.slice(0, 2).map((p) => `"${p.name}"`).join(" e ");
        out.push(`Você não publicou nada de ${names} no período. Vale equilibrar os pilares.`);
      }
    }
    // Alcance médio caindo vs período anterior (sinal real de atenção).
    if (prevAvgReach > 0 && avgReachDelta <= -8) {
      out.push(
        `Seu alcance médio caiu ${Math.abs(Math.round(avgReachDelta))}% vs o período anterior (${fmtNum(avgReach)} por post). Reveja tema, gancho e formato dos últimos posts.`
      );
    }
    // Formato com alcance abaixo da média geral.
    if (cross.byFormat.length > 1 && avgReach > 0) {
      const weak = cross.byFormat[cross.byFormat.length - 1];
      if (weak.avgReach > 0 && weak.avgReach < avgReach * 0.75) {
        out.push(
          `${weak.label} vêm rendendo abaixo da média (${fmtNum(weak.avgReach)} de alcance). Repense o tema ou teste outro formato.`
        );
      }
    }
    // Constância abaixo do ritmo.
    if (!paceAbove) {
      const perWeek = postsPerWeek.toFixed(1).replace(".0", "").replace(".", ",");
      out.push(
        `Você publicou ${perWeek}/semana, abaixo do seu ritmo de ${weeklyGoal}. Consistência puxa alcance.`
      );
    }
    // Amostra pequena: honestidade antes de firula (números oscilam com poucos posts).
    if (periodMedia.length > 0 && periodMedia.length < 4) {
      out.push(
        `Só ${periodMedia.length} ${periodMedia.length === 1 ? "post" : "posts"} com alcance no período. A base ainda é pequena, então trate os números como tendência, não veredito.`
      );
    }
    return out;
  }, [hasPerformance, linkedWithoutPillar, hasLinkedPillar, crossItems, pillars, cross, avgReach, prevAvgReach, avgReachDelta, paceAbove, postsPerWeek, weeklyGoal, periodMedia]);

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
        constancia_posts_por_semana: Number(postsPerWeek.toFixed(1)),
        desempenho: hasPerformance
          ? {
              posts_analisados: periodMedia.length,
              alcance_medio: Math.round(avgReach),
              alcance_medio_delta_pct: hasReachBaseline ? Math.round(avgReachDelta) : null,
              engajamento_medio_pct: Number(avgEngagement.toFixed(1)),
              formato_que_mais_rende: formatPerf[0]
                ? { formato: formatPerf[0].label, alcance_medio: Math.round(formatPerf[0].avg) }
                : null,
              pilar_que_mais_alcanca: pillarPerf[0]
                ? { pilar: pillarPerf[0].label, alcance_medio: Math.round(pillarPerf[0].avg) }
                : null,
              melhor_dia: topWeekday
                ? { dia: topWeekday.label, alcance_medio: Math.round(topWeekday.avgReach) }
                : null,
              engajamento_medio_delta_pct:
                prevAvgEngagement > 0
                  ? Math.round(((avgEngagement - prevAvgEngagement) / prevAvgEngagement) * 100)
                  : null,
              retencao_reels_seg: reelsWatch ? Number(reelsWatch.avgSec.toFixed(1)) : null,
              pontos_positivos: goodPoints,
              pontos_de_melhoria: improvePoints,
            }
          : null,
      };

      const raw = await callAIContextBuilder({
        userId: user?.id,
        operation: "cria-chat",
        data: {
          mensagem:
            "Você é a Cria, analista de conteúdo. Olhe os dados abaixo e me dê 2-3 insights curtos e acionáveis. Comente não só a consistência e a distribuição, mas também o que está PERFORMANDO: use o bloco 'desempenho' (dados reais do Instagram: formato que mais rende, pilar que mais alcança, melhor dia, engajamento médio e sua variação vs período anterior, a variação de alcance médio vs período anterior, a retenção média dos Reels em segundos, os pontos_positivos e os pontos_de_melhoria) pra recomendar o que eu deveria priorizar e testar essa semana. Cite números concretos. Se um campo vier null, não fale dele. Se 'desempenho' vier null, foque em consistência e me sugira conectar o Instagram pra ver o desempenho real. Linguagem natural, em português brasileiro, sem markdown.",
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

  // Relatórios liberado pra TODOS os usuários (não só admin): já integramos a Meta e
  // seguimos ajustando essa parte. A trava "Apenas Admin" foi removida de propósito.
  // (Mantido isAdmin no arquivo caso volte a valer pra algum bloco específico.)
  void isAdmin;

  return (
    <div className="pb-20 md:pb-0">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 md:hidden">
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

          <div data-tour="rel-periodo" className="flex items-center gap-0.5 bg-muted/50 rounded-full p-1 flex-wrap">
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
        <div data-tour="rel-metricas" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
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
            gradient="from-violet-500/15 to-pink-400/5"
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

        {/* ─── DESEMPENHO (lê os dados reais do Instagram) ─────────── */}
        <section data-tour="rel-desempenho" className="mb-8">
          {/* Header da seção */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-display font-extrabold text-foreground tracking-tight">
                Desempenho
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-body font-bold uppercase tracking-wider">
                Instagram
              </span>
              {hasPerformance && (
                <span className="text-xs font-body text-muted-foreground">
                  {periodMedia.length} posts no período
                </span>
              )}
            </div>
            {hasPerformance && (
              <p className="text-xs font-body text-muted-foreground">
                alcance médio: <span className="font-semibold text-foreground">{fmtNum(avgReach)}</span>
                {" · "}
                <span
                  className={cn(
                    "font-semibold",
                    !hasReachBaseline
                      ? "text-muted-foreground"
                      : avgReachDelta > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : avgReachDelta < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
                  )}
                >
                  {hasReachBaseline ? formatPercent(avgReachDelta) : "—"}
                </span>{" "}
                vs período anterior · eng.{" "}
                <span className="font-semibold text-foreground">{formatEngagement(avgEngagement)}</span>
              </p>
            )}
          </div>

          {connLoading ? (
            <div className="rounded-2xl bg-card border border-border shadow-warm-sm p-8 text-center">
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin mx-auto" />
            </div>
          ) : !igConnected ? (
            /* Não conectado: convite discreto pra conectar o IG (+ histórico manual). */
            <div className="rounded-2xl bg-card border border-border shadow-warm-sm p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] grid place-items-center shrink-0">
                  <Instagram className="h-6 w-6 text-white" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-display font-semibold text-foreground">
                    {isOwnAccount ? "Conecte seu Instagram pra ver seu desempenho real" : "Instagram ainda não conectado"}
                  </h3>
                  <p className="text-sm font-body text-muted-foreground leading-relaxed mt-0.5">
                    {isOwnAccount
                      ? "Alcance, engajamento, melhores posts e o que dá pra melhorar, direto da sua conta, sem precisar preencher nada à mão."
                      : "Peça pro dono da conta conectar o Instagram dele em Insights. Assim que ele conectar, o desempenho real aparece aqui."}
                  </p>
                </div>
                {isOwnAccount && (
                  <Button
                    onClick={() => connectInstagram()}
                    className="gap-2 shrink-0 bg-gradient-to-r from-[#DD2A7B] to-[#8134AF] text-white hover:opacity-90 w-full sm:w-auto"
                  >
                    <Instagram className="h-4 w-4" /> Conectar Instagram
                  </Button>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => navigate("/app/historico")}
                  className="text-xs font-body text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  Prefere preencher os resultados à mão? Ir pro Histórico
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          ) : !hasPerformance ? (
            /* Conectado, mas sem mídia/alcance ainda (conta nova ou sem sync). */
            <div className="rounded-2xl bg-card border border-border shadow-warm-sm p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-6 w-6 text-foreground/70" strokeWidth={1.75} />
              </div>
              <h3 className="text-base font-display font-semibold text-foreground mb-1.5">
                {conn?.username ? `@${conn.username} conectado` : "Instagram conectado"}
              </h3>
              <p className="text-sm font-body text-muted-foreground leading-relaxed max-w-md mx-auto mb-5">
                Seu desempenho aparece aqui conforme acompanhamos sua conta. Assim que houver posts com
                alcance no período, mostramos o que mais rende.
              </p>
              <Button variant="secondary" size="sm" onClick={() => navigate("/app/insights")}>
                <ArrowRight className="h-3.5 w-3.5 mr-1.5" /> Ver Insights
              </Button>
            </div>
          ) : (
            <>
              {/* Winner cards (formato/pilar/dia campeão, dados reais do IG) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-4">
                <WinnerCard
                  icon={<Flame className="h-4 w-4 text-white" strokeWidth={1.75} />}
                  iconBg="bg-gradient-to-br from-primary to-rose-500"
                  label="Formato que mais rende"
                  value={formatPerf[0]?.label ?? "-"}
                  valueColor={formatPerf[0]?.color}
                  sub={`${fmtNum(formatPerf[0]?.avg ?? 0)} de alcance médio`}
                  delta={topFormatDelta}
                  deltaLabel="vs média geral"
                />
                <WinnerCard
                  icon={<Layers className="h-4 w-4 text-white" strokeWidth={1.75} />}
                  iconBg="bg-gradient-to-br from-[#4B3FA8] to-[#0061EE]"
                  label={
                    hasLinkedPillar
                      ? "Pilar que mais alcança"
                      : linkedWithoutPillar
                        ? "Pilar (defina no post)"
                        : "Pilar (vincule pra ver)"
                  }
                  value={hasLinkedPillar ? pillarPerf[0]?.label ?? "-" : "—"}
                  valueColor={hasLinkedPillar ? pillarPerf[0]?.color : undefined}
                  sub={
                    hasLinkedPillar
                      ? `${fmtNum(pillarPerf[0]?.avg ?? 0)} de alcance médio`
                      : linkedWithoutPillar
                        ? "Defina o pilar dos posts vinculados"
                        : "Vincule seus posts do IG"
                  }
                />
                <WinnerCard
                  icon={<CalendarDays className="h-4 w-4 text-white" strokeWidth={1.75} />}
                  iconBg="bg-gradient-to-br from-[#0061EE] to-[#01A652]"
                  label="Melhor dia pra publicar"
                  value={topWeekday?.label ?? "-"}
                  sub={`${fmtNum(topWeekday?.avgReach ?? 0)} de alcance médio`}
                />
              </div>

              {/* Leitura: o que tá indo bem x o que dá pra melhorar */}
              {(goodPoints.length > 0 || improvePoints.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                  {goodPoints.length > 0 && (
                    <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
                        <p className="text-sm font-display font-bold text-foreground">O que tá indo bem</p>
                      </div>
                      <ul className="space-y-2 text-[13px] font-body text-foreground/90">
                        {goodPoints.map((h, i) => (
                          <li key={i} className="flex gap-2">
                            <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5 dark:text-emerald-400" />
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {improvePoints.length > 0 && (
                    <div className="rounded-2xl border border-amber-200/60 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" strokeWidth={2} />
                        <p className="text-sm font-display font-bold text-foreground">O que dá pra melhorar</p>
                      </div>
                      <ul className="space-y-2 text-[13px] font-body text-foreground/90">
                        {improvePoints.map((h, i) => (
                          <li key={i} className="flex gap-2">
                            <ArrowRight className="h-4 w-4 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400" />
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Alcance médio por formato + Top posts */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.25fr] gap-4">
                <ChartCard title="Alcance médio por formato" subtitle="Onde está o resultado, não só o volume">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={formatPerf} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v: number) => fmtNum(v)} />
                      <YAxis dataKey="label" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={70} />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                        formatter={(value: number) => [`${fmtNum(value)} de alcance médio`, "Média"]}
                      />
                      <Bar dataKey="avg" radius={[0, 6, 6, 0]}>
                        {formatPerf.map((row) => (
                          <Cell key={row.label} fill={row.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Seus posts que mais performaram" subtitle="Top 3 por alcance · toque pra abrir no Instagram">
                  <div className="space-y-2">
                    {topPosts.map((p, i) => {
                      const Row = p.permalink ? "a" : "div";
                      return (
                        <Row
                          key={p.id}
                          {...(p.permalink
                            ? { href: p.permalink, target: "_blank", rel: "noreferrer" }
                            : {})}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3",
                            p.permalink && "hover:bg-muted/60 transition-colors cursor-pointer"
                          )}
                        >
                          <span className="shrink-0 w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center text-sm font-display font-extrabold text-foreground/70">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-body font-semibold text-foreground truncate flex items-center gap-1">
                              {p.title || "Sem título"}
                              {p.permalink && <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />}
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
                              <p className="text-sm font-display font-bold text-foreground leading-none">{fmtNum(p.reach)}</p>
                              <p className="text-[9px] uppercase tracking-wider font-body text-muted-foreground mt-0.5">alcance</p>
                            </div>
                            <div>
                              <p className="text-sm font-display font-bold text-foreground leading-none">{fmtNum(p.saved)}</p>
                              <p className="text-[9px] uppercase tracking-wider font-body text-muted-foreground mt-0.5">salvos</p>
                            </div>
                            <div>
                              <p className="text-sm font-display font-bold text-primary leading-none">{formatEngagement(p.eng)}</p>
                              <p className="text-[9px] uppercase tracking-wider font-body text-muted-foreground mt-0.5">eng.</p>
                            </div>
                          </div>
                        </Row>
                      );
                    })}
                  </div>
                </ChartCard>
              </div>

              {/* Alcance médio por pilar (só posts vinculados) OU aviso pra vincular */}
              {hasLinkedPillar ? (
                <ChartCard title="Alcance médio por pilar" subtitle="Qual tema rende mais (posts vinculados ao CRIA)" className="mt-4">
                  <ResponsiveContainer width="100%" height={Math.max(140, pillarPerf.length * 46)}>
                    <BarChart data={pillarPerf} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v: number) => fmtNum(v)} />
                      <YAxis dataKey="label" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={90} />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                        formatter={(value: number) => [`${fmtNum(value)} de alcance médio`, "Média"]}
                      />
                      <Bar dataKey="avg" radius={[0, 6, 6, 0]}>
                        {pillarPerf.map((row) => (
                          <Cell key={row.label} fill={row.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              ) : (
                <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-4">
                  <Link2 className="h-5 w-5 text-muted-foreground shrink-0" />
                  <p className="flex-1 text-[13px] font-body text-muted-foreground">
                    {linkedWithoutPillar
                      ? "Seus posts vinculados ainda estão sem pilar definido. Defina o pilar de cada post pra ver o alcance médio por pilar e o tema que mais rende."
                      : "Vincule seus posts do Instagram aos do CRIA pra ver o alcance médio por pilar e o tema que mais rende."}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(linkedWithoutPillar ? "/app/criando" : "/app/insights")}
                    className="shrink-0"
                  >
                    {linkedWithoutPillar ? "Definir pilar dos posts" : "Vincular nos Insights"}
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Constância: leitura do ritmo vs meta semanal */}
        {publishedCount > 0 && (
          <div
            className={cn(
              "mb-4 flex items-start gap-3 rounded-2xl border p-4",
              paceAbove
                ? "border-emerald-200/60 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10"
                : "border-amber-200/60 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10"
            )}
          >
            {paceAbove ? (
              <TrendingUp className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5 dark:text-emerald-400" strokeWidth={2} />
            ) : (
              <TrendingDown className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400" strokeWidth={2} />
            )}
            <p className="text-[13px] font-body text-foreground/90 leading-snug">
              Você publicou{" "}
              <span className="font-semibold text-foreground">
                {postsPerWeek.toFixed(1).replace(".0", "").replace(".", ",")}/semana
              </span>{" "}
              no período,{" "}
              {paceAbove ? (
                <>
                  no seu ritmo ou acima da meta de {weeklyGoal} por semana. Constância mantida, segue firme.
                </>
              ) : (
                <>
                  abaixo do seu ritmo de {weeklyGoal} por semana. Consistência puxa alcance, vale ajustar o
                  calendário.
                </>
              )}{" "}
              Você bateu a meta em {weeksData.filter((w) => w.total >= weeklyGoal).length} de {weeksData.length}{" "}
              {weeksData.length === 1 ? "semana" : "semanas"} ({consistency}%).
            </p>
          </div>
        )}

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
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-pink-400 flex items-center justify-center">
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
