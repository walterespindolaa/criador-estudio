import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useT } from "@/lib/i18n";
import {
  Instagram, Users, Eye, Zap, UserPlus, RefreshCw, Unplug, Link2, Unlink, Bookmark, Heart, Play, Image as ImageIcon, Images, Sparkles, Info, TrendingUp, BarChart3, Search, AlertTriangle,
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, Cell, ReferenceLine, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { insightsReading, type InsightsReading } from "@/lib/ai/claude";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useSocialConnection, useDailyMetrics, useMediaInsights, useSyncInstagram, useDisconnectInstagram, useLinkMediaToPost,
  useAudienceDemographics, useStories, useSocialAccountOwner, connectInstagram, estadoConexaoIg, totaisConta30d, type MediaInsight,
} from "@/hooks/useSocialInsights";
import { useActiveAccount } from "@/contexts/AccountContext";
import { usePillars } from "@/hooks/usePillars";
import { AudienceBreakdown } from "@/components/insights/AudienceBreakdown";
import { StoriesSummary } from "@/components/insights/StoriesSummary";
import { RankingGanchos } from "@/components/insights/RankingGanchos";
import { SeguidoresPorPost } from "@/components/insights/SeguidoresPorPost";
import { TabelaPosts } from "@/components/insights/TabelaPosts";
import type { MidiaIg } from "@/components/insights/ganchos";
import { ContentCrossAnalysis } from "@/components/insights/ContentCrossAnalysis";
import { SugestoesVinculo } from "@/components/insights/SugestoesVinculo";
import { CARD, MAO, SecaoTitulo, SeloIA, Pilula } from "@/components/insights/estiloCria";
import { computeFollowersDelta, formatMediaLabel, interacoesDe, type CrossItem } from "@/components/insights/insightsUtils";
import { STATUS_OPTIONS, FORMAT_LABELS } from "@/lib/constants";
// Cor por formato (mesma fonte única do kanban/calendário do Cria Post).
import { formatColorVars, FORMAT_TEXT_CLASS } from "@/lib/format-colors";
import { getStatusClasses } from "@/lib/statusColors";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

const fmt = (n: number | null | undefined) =>
  n == null ? "-" : n >= 1000 ? `${(n / 1000).toFixed(1).replace(".0", "")}k` : String(n);
const m = (mi: MediaInsight, k: string) => Number(mi.metrics?.[k] ?? 0);
const MEDIA_ICON = (t: string | null) => (t === "VIDEO" || t === "REELS" ? Play : t === "CAROUSEL_ALBUM" ? Images : ImageIcon);
const MEDIA_KEY: Record<string, string> = { IMAGE: "insights.typeImage", VIDEO: "insights.typeReels", REELS: "insights.typeReels", CAROUSEL_ALBUM: "insights.typeCarousel" };
const fmtTypeWith = (tr: (k: string) => string) => (mt: string | null) => (mt ? (MEDIA_KEY[mt] ? tr(MEDIA_KEY[mt]) : mt) : "-");
const isVideo = (t: string | null) => t === "VIDEO" || t === "REELS";

export default function Insights() {
  const t = useT();
  const fmtType = fmtTypeWith(t);
  const { data: conn, isLoading } = useSocialConnection();
  const { data: daily = [] } = useDailyMetrics(30);
  const { data: media = [] } = useMediaInsights();
  const { data: audience = [] } = useAudienceDemographics();
  const { data: stories = [] } = useStories();
  const { pillars } = usePillars();
  const sync = useSyncInstagram();
  const disconnect = useDisconnectInstagram();
  const link = useLinkMediaToPost();
  const { user } = useAuth();
  // Conectar/atualizar/desconectar são ações do DONO da conta ativa. Uma gestora
  // dentro da conta de um criador só visualiza (e vincula posts): se ela clicasse
  // em "Conectar", o OAuth gravaria o Instagram DELA nesta tela.
  const { isOwnAccount, ownerId, contaParaConectar, podeAtualizar } = useSocialAccountOwner();
  const [linkFor, setLinkFor] = useState<MediaInsight | null>(null);
  const [aiRead, setAiRead] = useState<InsightsReading | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  // Quantos posts renderizar na lista (evita floodar a página com centenas de uma vez).
  const [postsToShow, setPostsToShow] = useState<number>(20);

  // Retorno do OAuth do Instagram: a edge redireciona pra ca com ?ig=connected
  // ou ?ig=error&m=<motivo>. Sem tratar isso, o usuario reconectava e "nada
  // acontecia" (nem via o erro). Aqui: no sucesso, atualiza conexao + dispara um
  // sync na hora; no erro, mostra o motivo real; e limpa a URL nos dois casos.
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  useEffect(() => {
    const ig = searchParams.get("ig");
    if (!ig) return;
    if (ig === "connected") {
      toast.success("Instagram conectado! Puxando seus dados...");
      ["social-connection", "social-daily", "social-media-insights", "social-audience", "social-stories"]
        .forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      supabase.functions.invoke("instagram-sync").then(() => {
        ["social-connection", "social-daily", "social-media-insights", "social-audience", "social-stories"]
          .forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      }).catch(() => { /* o sync tambem roda por cron; segue */ });
    } else if (ig === "error") {
      const motivo = searchParams.get("m") ?? "";
      // Traduz o código técnico numa instrução que a pessoa consegue seguir. Antes
      // aparecia "token_exchange_long" cru na tela, que não ajuda ninguém a resolver.
      let msg = "Não consegui conectar o Instagram. Tente de novo.";
      if (motivo.startsWith("token_exchange_long") || motivo === "token_exchange") {
        msg = "Não consegui concluir a conexão. Isso costuma acontecer quando a conta do Instagram não é Profissional. No Instagram: Configurações, Tipo de conta e ferramentas, Mudar para conta profissional (Comercial ou Criador). Depois tente de novo.";
      } else if (motivo === "account_fetch") {
        msg = "Conectou, mas não consegui ler os dados da conta. Confirme que ela é Profissional (Comercial ou Criador) e tente de novo.";
      } else if (motivo === "state_expired" || motivo === "invalid_state") {
        msg = "A tentativa de conexão expirou. Volte aqui e clique em Conectar Instagram de novo.";
      } else if (motivo === "missing_code" || motivo === "access_denied") {
        msg = "A autorização foi cancelada no Instagram. Clique em Conectar Instagram e conclua os passos até o fim.";
      } else if (motivo.startsWith("conta_de_outro_cliente")) {
        const quem = motivo.split(":")[1]?.trim() || "Esse Instagram";
        msg = `${quem} já está conectado a um cliente seu no Cria, então não liguei no seu perfil. Entre no Instagram com a sua conta e conecte de novo.`;
      } else if (motivo === "save_failed") {
        msg = "Autorizei no Instagram, mas falhei ao salvar a conexão. Tente de novo em instantes.";
      } else if (motivo) {
        msg = `Não consegui conectar o Instagram: ${motivo}. Tente de novo.`;
      }
      toast.error(msg, { duration: 12000 });
    }
    const next = new URLSearchParams(searchParams);
    next.delete("ig"); next.delete("m");
    setSearchParams(next, { replace: true });
  }, [searchParams, qc, setSearchParams]);

  const genReading = async () => {
    if (aiLoading || media.length === 0) return;
    setAiLoading(true);
    try {
      // A leitura diz "30 dias": usa só os posts do período (antes ia o
      // histórico inteiro e a IA comparava coisas de meses diferentes).
      const desde = Date.now() - 30 * 86400000;
      const doMes = media.filter((mi) => mi.posted_at && new Date(mi.posted_at).getTime() >= desde);
      const base = doMes.length ? doMes : media;
      const fmtAvg: Record<string, { sum: number; n: number }> = {};
      base.forEach((mi) => {
        const t = formatMediaLabel(mi.media_type);
        fmtAvg[t] = fmtAvg[t] || { sum: 0, n: 0 };
        fmtAvg[t].sum += m(mi, "reach"); fmtAvg[t].n += 1;
      });
      const fmts = Object.entries(fmtAvg).map(([t, v]) => ({ t, avg: v.n ? v.sum / v.n : 0 })).sort((a, b) => b.avg - a.avg);
      const byReachL = [...base].sort((a, b) => m(b, "reach") - m(a, "reach"));
      const bySavedL = [...base].sort((a, b) => (m(b, "saved") + m(b, "saves")) - (m(a, "saved") + m(a, "saves")));
      const res = await insightsReading({
        periodo: "30 dias",
        followers: kpis?.followers ?? null,
        followersDelta: kpis?.followersDelta ?? 0,
        reach: kpis?.reach ?? 0,
        interactions: kpis?.interactions ?? 0,
        profileViews: kpis?.profileViews ?? null,
        mediaCount: doMes.length,
        bestFormat: fmts[0] ? `${fmtType(fmts[0].t)} (${Math.round(fmts[0].avg)} alcance médio)` : undefined,
        worstFormat: fmts.length > 1 ? `${fmtType(fmts[fmts.length - 1].t)} (${Math.round(fmts[fmts.length - 1].avg)} alcance médio)` : undefined,
        topPost: byReachL[0]?.caption ? `${byReachL[0].caption.slice(0, 60)}, ${m(byReachL[0], "reach")} alcance` : undefined,
        topSaved: bySavedL[0]?.caption ? `${bySavedL[0].caption.slice(0, 60)}, ${m(bySavedL[0], "saved") + m(bySavedL[0], "saves")} salvos` : undefined,
      }, user?.id);
      if (res?.leituras?.length) setAiRead(res);
      else throw new Error("formato inesperado");
    } catch (e) {
      console.error("insights-reading failed", e);
      toast.error(t("insights.aiError"));
    } finally {
      setAiLoading(false);
    }
  };

  const kpis = useMemo(() => {
    const last = daily[daily.length - 1];
    // Alcance e interações dos posts dos ÚLTIMOS 30 DIAS (o card diz "30 dias";
    // antes somava todo o histórico carregado, até 200 posts).
    const desde = Date.now() - 30 * 86400000;
    const doMes = media.filter((mi) => mi.posted_at && new Date(mi.posted_at).getTime() >= desde);
    const reach = doMes.reduce((a, mi) => a + m(mi, "reach"), 0);
    const interactions = doMes.reduce((a, mi) => a + m(mi, "likes") + m(mi, "comments") + m(mi, "saved") + m(mi, "shares"), 0);
    if (!last && media.length === 0) return null;
    // Variação de seguidores só quando a série cobre ~30 dias de verdade (evita "+N" falso).
    const fd = computeFollowersDelta(daily);
    return {
      followers: last?.followers ?? null,
      followersDelta: fd.delta,
      hasFollowersWindow: fd.hasWindow,
      reach, interactions, profileViews: totaisConta30d(daily).profileViews,
    };
  }, [daily, media]);

  // Cruzamentos: mapeia cada mídia pro shape do ContentCrossAnalysis, puxando pilar,
  // formato e hook do post do CRIA vinculado (quando houver).
  const crossItems = useMemo<CrossItem[]>(() => {
    const pillarById: Record<string, string> = {};
    pillars.forEach((p) => { pillarById[p.id] = p.name; });
    return media.map((mi) => ({
      media_type: mi.media_type,
      posted_at: mi.posted_at,
      reach: m(mi, "reach"),
      interactions: interacoesDe(mi.metrics as Record<string, number> | null),
      pillar: mi.posts?.pillar_id ? (pillarById[mi.posts.pillar_id] ?? null) : null,
      hook: mi.posts?.hook ?? null,
    }));
  }, [media, pillars]);

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">{t("insights.loading")}</div>;

  // ---- Desconectado ----
  if (!conn) {
    return (
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-6 md:hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-400 flex items-center justify-center shadow-sm shrink-0">
            <Instagram className="h-5 w-5 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Insights</h1>
            <p className="text-muted-foreground font-body mt-0.5 text-sm">{t("insights.subtitle")}</p>
          </div>
        </div>
        <div data-tour="insights-conta" className="bg-card border border-border rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] grid place-items-center shrink-0">
            <Instagram className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-bold text-foreground">{t("insights.connectTitle")}</h3>
            <p className="text-sm text-muted-foreground font-body mt-1">
              {isOwnAccount
                ? t("insights.connectDesc", { business: t("insights.business"), creator: t("insights.creator") })
                : "Esta conta ainda não tem Instagram conectado. Por segurança, a conexão só pode ser feita pelo dono da conta: peça pra ele conectar o Instagram em Insights. Assim que ele conectar, os números aparecem aqui pra você."}
            </p>
          </div>
          {isOwnAccount && (
            <Button onClick={() => connectInstagram(null, null, contaParaConectar)} className="gap-2 shrink-0 bg-gradient-to-r from-[#DD2A7B] to-[#8134AF] text-white hover:opacity-90">
              <Instagram className="h-4 w-4" /> {t("insights.connectCta")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ---- Conectado ----
  const lastSync = conn.updated_at ? new Date(conn.updated_at).toLocaleString("pt-BR") : "-";
  const followerSeries = daily.filter((d) => d.followers != null).map((d) => ({ date: d.date.slice(5), v: d.followers ?? 0 }));
  // Alcance por dia: sexta e sábado em azul, dia que estourou (1,6x a média ou
  // mais) em laranja, e a linha tracejada da média do período.
  const reachBase = daily.filter((d) => d.reach != null);
  const mediaAlcance = reachBase.length ? reachBase.reduce((a, d) => a + (d.reach ?? 0), 0) / reachBase.length : 0;
  const reachSeries = reachBase.map((d) => {
    const dow = new Date(`${d.date}T12:00:00`).getDay();
    const v = d.reach ?? 0;
    return { date: d.date.slice(5), v, fds: dow === 5 || dow === 6, pico: mediaAlcance > 0 && v >= mediaAlcance * 1.6 };
  });

  // Drivers (proxies honestos a partir do que a API entrega)
  const byReach = [...media].sort((a, b) => m(b, "reach") - m(a, "reach"));
  const bySaves = [...media].sort((a, b) => (m(b, "saved") + m(b, "saves")) - (m(a, "saved") + m(a, "saves")));
  const fmtAvgReach: Record<string, { sum: number; n: number }> = {};
  media.forEach((mi) => {
    const t = mi.media_type ?? "-";
    fmtAvgReach[t] = fmtAvgReach[t] || { sum: 0, n: 0 };
    fmtAvgReach[t].sum += m(mi, "reach"); fmtAvgReach[t].n += 1;
  });
  const bestFormat = Object.entries(fmtAvgReach).map(([t, v]) => ({ t, avg: v.n ? v.sum / v.n : 0 })).sort((a, b) => b.avg - a.avg)[0];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex items-center gap-3 mb-6 md:hidden">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-400 flex items-center justify-center shadow-sm shrink-0">
          <Instagram className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-3xl font-display font-extrabold text-foreground tracking-tight">Insights</h1>
          <p className="mt-0.5 text-[19px] leading-none text-[#0061EE]" style={MAO}>{t("insights.subtitle")}</p>
        </div>
      </div>

      {/* barra da conta */}
      <div data-tour="insights-conta" className={`${CARD} px-4 py-3 flex items-center gap-3 flex-wrap`}>
        {/* Foto no anel de stories; sem foto, a inicial. */}
        <div className="w-12 h-12 rounded-full p-[3px] shrink-0" style={{ background: "conic-gradient(#FFCF03,#EA4918,#FF77B9,#0061EE,#FFCF03)" }}>
          <div className="w-full h-full rounded-full border-[2.5px] border-card bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] grid place-items-center text-white font-bold overflow-hidden">
            {conn.profile_picture_url
              ? <img src={conn.profile_picture_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              : (conn.username ?? "?").charAt(0).toUpperCase()}
          </div>
        </div>
        <div className="min-w-0">
          <p className="font-display font-extrabold text-[17px] leading-tight">{conn.username ? `@${conn.username}` : t("insights.connectedAccount")}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full border border-foreground ${estadoConexaoIg(conn).reconectar ? "bg-amber-500" : "bg-[#00A652]"}`} />
            {estadoConexaoIg(conn).reconectar ? "Conexão vencida" : t("insights.connected")}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">{t("insights.lastUpdate", { when: lastSync })}</span>
          {/* Atualizar vale pra conta aberta (a edge confere o acesso e usa o token
              salvo NELA). Desconectar é só do dono (ou do Meu perfil). */}
          {podeAtualizar && (
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full border-2 border-foreground shadow-[0_2px_0_hsl(var(--foreground))] font-bold" onClick={() => sync.mutate()} disabled={sync.isPending}>
              <RefreshCw className={`h-3.5 w-3.5 ${sync.isPending ? "animate-spin" : ""}`} /> {t("insights.refresh")}
            </Button>
          )}
          {isOwnAccount && (
            <>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground rounded-full" onClick={() => disconnect.mutate()}>
                <Unplug className="h-3.5 w-3.5" /> {t("insights.disconnect")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* CONEXÃO VENCIDA (ciclo 2 do plano de publicar). Antes o token morria
          em silêncio: a tela seguia "Conectado" com número parado. Só quem é
          dono consegue reconectar (o login grava a conexão em nome de quem
          clica); a gestora vê o aviso pra combinar com o dono. */}
      {estadoConexaoIg(conn).reconectar && (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-amber-500 bg-amber-50 px-4 py-3 flex items-start gap-2.5 flex-wrap">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[13px] font-body text-amber-900 leading-snug flex-1 min-w-[200px]">
            <p className="font-bold">A conexão com o Instagram venceu.</p>
            <p className="mt-0.5">
              {isOwnAccount
                ? "Os números pararam de atualizar. Reconecte pra voltar a puxar os dados (leva 1 minuto, é só aceitar de novo na tela do Instagram)."
                : "Os números pararam de atualizar. Quem é dono desta conta precisa entrar no Cria e reconectar o Instagram."}
            </p>
          </div>
          {isOwnAccount && (
            <Button size="sm" onClick={() => connectInstagram(null, null, contaParaConectar)} className="w-full sm:w-auto h-11 sm:h-9 rounded-full shrink-0 bg-[#EA4918] hover:bg-[#EA4918]/90 text-white border-2 border-foreground font-bold">
              Reconectar
            </Button>
          )}
        </div>
      )}

      {/* Aviso de conta NÃO profissional: o Instagram só devolve seguidores, alcance e
          insights pra contas Comercial/Criador. Se a conta for pessoal, tudo fica "-" e
          antes não havia pista nenhuma do porquê. Só mostra quando o account_type já
          veio do sync e não é profissional (não incomoda conta nova/pro sem dado ainda). */}
      {conn.account_type && !["BUSINESS", "CREATOR", "MEDIA_CREATOR"].includes((conn.account_type || "").toUpperCase()) && (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-amber-500 bg-amber-50 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[13px] font-body text-amber-900 leading-snug">
            <p className="font-bold">Sua conta do Instagram é pessoal.</p>
            <p className="mt-0.5">O Instagram só libera seguidores, alcance e insights pra contas Profissionais (Comercial ou Criador de conteúdo). No app do Instagram: Configurações, Tipo de conta e ferramentas, Mudar para conta profissional. Depois volte aqui e toque em Atualizar.</p>
          </div>
        </div>
      )}

      {/* Frase da Cria IA: só existe depois que a pessoa gera a leitura (botão no fim
          da página). Sem leitura, o post-it não aparece (não inventa frase). */}
      {aiRead?.leituras?.[0] && (
        <div className="mt-4 rounded-[20px] border-2 border-foreground bg-[#FFE46B] px-5 py-3.5 shadow-[2px_2px_0_hsl(var(--foreground))]">
          <div className="flex items-center gap-2"><SeloIA /><span className="text-[11px] font-extrabold uppercase tracking-wider text-[#1D1B18]/70">a leitura do seu mês</span></div>
          <p className="mt-1.5 text-[22px] sm:text-[25px] leading-[1.1] text-[#1D1B18]" style={MAO}>{aiRead.leituras[0]}</p>
        </div>
      )}

      {/* KPIs: fichas coloridas, variação em chip e minicurva dos 30 dias quando
          há série diária daquele número. */}
      <div id="ins-resumo" data-tour="insights-kpis" className="scroll-mt-32 md:scroll-mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4">
        <Kpi icon={Users} bg="bg-card" label={t("insights.kpiFollowers")} value={fmt(kpis?.followers)} serie={followerSeries.map((d) => d.v)} delta={kpis?.hasFollowersWindow && kpis.followersDelta != null ? `${kpis.followersDelta >= 0 ? "▲ +" : "▼ "}${Math.abs(kpis.followersDelta)} em 30 dias` : undefined} up={(kpis?.followersDelta ?? 0) >= 0} />
        <Kpi icon={Eye} bg="bg-[#C9DAFF]" label={t("insights.kpiReach")} value={fmt(kpis?.reach)} serie={reachSeries.map((d) => d.v)} />
        <Kpi icon={Zap} bg="bg-[#FFE46B]" label={t("insights.kpiInteractions")} value={fmt(kpis?.interactions)} serie={daily.filter((d) => d.total_interactions != null).map((d) => d.total_interactions ?? 0)} />
        <Kpi icon={UserPlus} bg="bg-[#FFD3E8]" label={t("insights.kpiProfileViews")} value={fmt(kpis?.profileViews)} serie={daily.filter((d) => d.profile_views != null).map((d) => d.profile_views ?? 0)} />
      </div>

      {/* Celular: abas presas no topo que levam até cada parte da página. */}
      <AbasInsights />

      {/* gráficos */}
      {(reachSeries.length > 1 || followerSeries.length > 1) ? (
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-3 sm:gap-4 mt-4">
          <div className={`${CARD} p-4`}>
            <h4 className="text-[16px] font-display font-extrabold">{t("insights.chartReach")}</h4>
            {reachSeries.length > 1 ? (
              <>
                <div className="h-[160px] mt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reachSeries} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" axisLine={{ stroke: "#1D1B18", strokeWidth: 2 }} tickLine={false} />
                      <Tooltip cursor={{ fill: "rgba(29,27,24,.06)" }} />
                      <ReferenceLine y={mediaAlcance} stroke="#1D1B18" strokeOpacity={0.45} strokeDasharray="5 4" strokeWidth={1.5} />
                      <Bar dataKey="v" stroke="#1D1B18" strokeWidth={1.5} radius={[4, 4, 0, 0]}>
                        {reachSeries.map((d) => <Cell key={d.date} fill={d.pico ? "#EA4918" : d.fds ? "#0061EE" : "#C9DAFF"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
                  <Legenda cor="#C9DAFF" nome="dia de semana" />
                  <Legenda cor="#0061EE" nome="sexta e sábado" />
                  <Legenda cor="#EA4918" nome="dia que estourou" />
                  <span>- - - sua média</span>
                </div>
              </>
            ) : <p className="text-xs text-muted-foreground mt-3">{t("insights.noReachSeries")}</p>}
          </div>
          <div className={`${CARD} p-4`}>
            <h4 className="text-[16px] font-display font-extrabold">{t("insights.chartFollowers")}</h4>
            {followerSeries.length > 1 ? (
              <div className="h-[160px] mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={followerSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" axisLine={{ stroke: "#1D1B18", strokeWidth: 2 }} tickLine={false} />
                    <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="v" stroke="#1D1B18" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#EA4918", stroke: "#1D1B18", strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-xs text-muted-foreground mt-3">Preenche conforme acompanhamos sua conta dia a dia (o Instagram não devolve histórico de total de seguidores).</p>}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-4">Os gráficos aparecem conforme acumulamos métricas diárias. O de alcance preenche assim que o Instagram devolver o histórico.</p>
      )}

      {/* drivers */}
      {media.length > 0 && (
        <>
          <SecaoTitulo titulo="O que mais gerou crescimento" extra={<SeloIA />} mao="repete o que deu certo" />
          <div className="grid sm:grid-cols-3 gap-3 sm:gap-4">
            <Driver icon={Eye} t={t("insights.topReach")} big={byReach[0]?.caption?.slice(0, 40) ?? "-"} s={`${fmt(m(byReach[0], "reach"))} de alcance`} permalink={byReach[0]?.permalink} thumb={byReach[0]?.thumbnail_url} legenda={fmtType(byReach[0]?.media_type ?? null)} />
            <Driver icon={Bookmark} t={t("insights.topSaves")} big={bySaves[0]?.caption?.slice(0, 40) ?? "-"} s={`${fmt(m(bySaves[0], "saved") + m(bySaves[0], "saves"))} salvos`} permalink={bySaves[0]?.permalink} thumb={bySaves[0]?.thumbnail_url} legenda={fmtType(bySaves[0]?.media_type ?? null)} />
            <Driver icon={BarChart3} t={t("insights.bestFormat")} big={fmtType(bestFormat?.t ?? null)} s={`média de ${fmt(Math.round(bestFormat?.avg ?? 0))} de alcance`} legenda="formato" />
          </div>
        </>
      )}

      {/* CRUZAMENTOS: o que rende mais por formato, pilar, tema e horário */}
      <SecaoTitulo id="ins-postar" titulo="O que postar mais" mao="cruzando os seus posts" />
      {/* Sugestões de ligar publicação ↔ post (ciclo 2 dos dados): antes da
          análise, porque é o que faz pilar e gancho aparecerem nela. */}
      <SugestoesVinculo conta={ownerId} />
      <ContentCrossAnalysis items={crossItems} dicaLigar />

      {/* GANCHOS (28/10/2026): quem segurou nos 3 primeiros segundos e por
          quanto tempo, na mesma idade (24 h ou 7 dias); e o que trouxe seguidor. */}
      <SecaoTitulo id="ins-ganchos" titulo="Ganchos e seguidores" mao="quem segurou nos primeiros segundos" />
      <div className="space-y-4">
        <RankingGanchos media={media as unknown as MidiaIg[]}
          ganchoDe={(x) => (x as unknown as { posts?: { hook?: string | null } | null }).posts?.hook ?? null} />
        <SeguidoresPorPost media={media as unknown as MidiaIg[]} diario={daily} />
      </div>

      {/* PERFIL DE AUDIÊNCIA */}
      <SecaoTitulo id="ins-publico" titulo="Quem te acompanha" mao="e o que fazem nos stories" />
      <AudienceBreakdown rows={audience} />

      {/* STORIES */}
      <SecaoTitulo titulo="Stories" mao="o resumo e story por story" />
      <StoriesSummary stories={stories} />

      {/* TODOS OS POSTS (28/10/2026): tabela ordenável com reposts e ações no perfil */}
      <SecaoTitulo id="ins-posts" titulo="Números de cada post" />
      <TabelaPosts media={media as unknown as MidiaIg[]} />

      {/* posts + vínculo manual */}
      <div className="flex items-center justify-between gap-3 flex-wrap mt-9 mb-3.5">
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
          <h2 data-tour="insights-posts" className="font-display font-extrabold text-[21px] sm:text-2xl leading-none">{t("insights.postsTitle")}</h2>
          <span className="text-[19px] sm:text-[21px] leading-none text-[#EA4918]" style={MAO}>ligue cada um ao post do Cria</span>
        </div>
        {media.length > 10 && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-muted-foreground mr-1">Mostrar</span>
            {[10, 20, 30, media.length].map((n, i) => {
              const isAll = i === 3;
              const active = isAll ? postsToShow >= media.length : postsToShow === n && postsToShow < media.length;
              // Evita repetir o botão "Todos" quando total coincide com 10/20/30.
              if (isAll && [10, 20, 30].includes(media.length)) return null;
              return (
                <Pilula key={isAll ? "all" : n} ativo={active} onClick={() => setPostsToShow(n)}>
                  {isAll ? "Todos" : n}
                </Pilula>
              );
            })}
          </div>
        )}
      </div>
      {media.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum post coletado ainda. Clique em “Atualizar” após conectar.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
          {media.slice(0, postsToShow).map((mi) => {
            const MI = MEDIA_ICON(mi.media_type);
            return (
              <div key={mi.id} className={`${CARD} p-3 flex gap-3`}>
                <div className="w-[74px] h-[74px] rounded-xl shrink-0 grid place-items-center bg-muted overflow-hidden border-2 border-foreground">
                  {mi.thumbnail_url ? <img src={mi.thumbnail_url} referrerPolicy="no-referrer" alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <MI className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] leading-snug line-clamp-2">{mi.caption || "(sem legenda)"}</p>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {fmt(m(mi, "reach"))}</span>
                    <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {fmt(m(mi, "likes"))}</span>
                    <span className="flex items-center gap-1"><Bookmark className="h-3 w-3" /> {fmt(m(mi, "saved") + m(mi, "saves"))}</span>
                    {isVideo(mi.media_type) && (m(mi, "views") + m(mi, "plays")) > 0 && (
                      <span className="flex items-center gap-1"><Play className="h-3 w-3" /> {fmt(m(mi, "views") + m(mi, "plays"))}</span>
                    )}
                  </div>
                  <div className="mt-2">
                    {mi.post_id && mi.posts ? (
                      // Já vinculado: mostra o post ligado + trocar (reabre seletor) e desvincular (postId null).
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#1D1B18] bg-[#FFD3C2] border-[1.5px] border-foreground px-2.5 py-1 rounded-full">
                          <Link2 className="h-3 w-3" /> {[mi.posts.format, mi.posts.hook].filter(Boolean).join(" · ") || mi.posts.title || t("insights.linked")}
                        </span>
                        <button onClick={() => setLinkFor(mi)} className="text-[11px] font-semibold text-muted-foreground hover:text-primary px-1.5 py-1 transition-colors">
                          Trocar
                        </button>
                        <button onClick={() => link.mutate({ insightId: mi.id, postId: null })} disabled={link.isPending} className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-red-600 px-1.5 py-1 transition-colors disabled:opacity-50">
                          <Unlink className="h-3 w-3" /> Desvincular
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setLinkFor(mi)} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-foreground bg-background border-[1.5px] border-dashed border-foreground px-2.5 py-1 rounded-full hover:border-primary/40 hover:text-primary">
                        <Link2 className="h-3 w-3" /> Vincular ao conteúdo do CRIA
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {media.length > postsToShow && (
        <div className="mt-3 flex items-center justify-center">
          <Button variant="outline" size="sm" className="rounded-full border-2 border-foreground font-bold shadow-[0_2px_0_hsl(var(--foreground))]" onClick={() => setPostsToShow((n) => n + 20)}>
            Carregar mais ({postsToShow} de {media.length})
          </Button>
        </div>
      )}

      {/* leitura IA */}
      {media.length > 0 && bestFormat && (
        <div className={`${CARD} p-4 sm:p-5 mt-9`}>
          {/* Celular: o título e o selo numa linha, o botão embaixo (13/11/2026:
              espremidos lado a lado, "Cria IA" quebrava em duas linhas). */}
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2.5">
            <h4 className="text-[18px] font-display font-extrabold flex items-center gap-2 whitespace-nowrap [&>*]:shrink-0">{t("insights.aiTitle")} <SeloIA /></h4>
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5 rounded-full border-2 border-foreground font-bold shadow-[0_2px_0_hsl(var(--foreground))]" onClick={genReading} disabled={aiLoading}>
              {aiLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {aiRead ? t("insights.aiRedo") : t("insights.aiAnalyze")}
            </Button>
          </div>

          {aiRead ? (
            <div className="mt-3 grid md:grid-cols-[1.3fr_1fr] gap-5">
              <ul className="space-y-2 text-[13.5px]">
                {aiRead.leituras.map((l, i) => (
                  <li key={i} className="flex gap-2"><TrendingUp className="h-4 w-4 text-[#00A652] shrink-0 mt-0.5" /><span>{l}</span></li>
                ))}
              </ul>
              {aiRead.acoes.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">{t("insights.nextActions")}</p>
                  <ul className="space-y-1.5 text-[13px]">
                    {aiRead.acoes.map((a, i) => (
                      <li key={i} className="flex gap-2"><Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /><span>{a}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <ul className="mt-2.5 space-y-2 text-[13px]">
              <li className="flex gap-2"><TrendingUp className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /><span>{t("insights.bestFormatTip", { format: fmtType(bestFormat.t) })}</span></li>
              <li className="flex gap-2"><TrendingUp className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /><span>{t("insights.clickToAnalyze", { button: t("insights.aiAnalyze") })}</span></li>
            </ul>
          )}

          <p className="text-[11.5px] text-muted-foreground mt-3 flex gap-2"><Info className="h-3.5 w-3.5 shrink-0 mt-0.5" /><span>“Seguidores por post” é estimativa (cruza a data do post com a variação diária). Alcance, salvos e interações são dados diretos da API do Instagram.</span></p>
        </div>
      )}

      <LinkDialog insight={linkFor} onClose={() => setLinkFor(null)} onPick={(postId) => { if (linkFor) link.mutate({ insightId: linkFor.id, postId }); setLinkFor(null); }} />
    </motion.div>
  );
}

function Kpi({ icon: Icon, label, value, delta, up, bg, serie }: { icon: typeof Users; label: string; value: string; delta?: string; up?: boolean; bg: string; serie?: number[] }) {
  // Fichas coloridas do mockup. As cores claras ficam fixas (texto escuro), então
  // o texto aqui é sempre #1D1B18, menos na ficha branca, que segue o tema.
  const claro = bg !== "bg-card";
  return (
    <div className={`${bg} rounded-[18px] border-2 border-foreground p-3.5 sm:p-4 shadow-[2px_2px_0_hsl(var(--foreground))] min-w-0 flex flex-col gap-1.5 ${claro ? "text-[#1D1B18]" : ""}`}>
      <div className="text-[11px] font-extrabold uppercase tracking-wider opacity-70 flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-[28px] sm:text-[34px] leading-none font-display font-extrabold">{value}</div>
        {serie && serie.length > 2 && <MiniCurva serie={serie} />}
      </div>
      {delta && (
        <span className={`self-start text-[11.5px] font-extrabold rounded-full border-2 border-[#1D1B18] px-2 py-0.5 ${up ? "bg-white text-[#1D1B18]" : "bg-[#1D1B18] text-white"}`}>{delta}</span>
      )}
    </div>
  );
}

/** Minicurva dos últimos dias (só desenha quando há série daquele número). */
function MiniCurva({ serie }: { serie: number[] }) {
  const w = 84, h = 30;
  const min = Math.min(...serie), max = Math.max(...serie);
  const pts = serie.map((v, i) => `${(i / (serie.length - 1)) * (w - 4) + 2},${max === min ? h / 2 : h - 3 - ((v - min) / (max - min)) * (h - 6)}`);
  const [lx, ly] = pts[pts.length - 1].split(",");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="hidden sm:block w-[84px] h-[30px] shrink-0" aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke="#1D1B18" strokeWidth={2.2} strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={3.2} fill="#EA4918" stroke="#1D1B18" strokeWidth={1.4} />
    </svg>
  );
}

function Legenda({ cor, nome }: { cor: string; nome: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] border-[1.5px] border-foreground" style={{ background: cor }} />{nome}</span>;
}

/** Celular: abas presas no topo que rolam até cada parte da página. */
const ABAS: Array<[string, string]> = [["ins-resumo", "Resumo"], ["ins-postar", "Postar"], ["ins-ganchos", "Ganchos"], ["ins-publico", "Público"], ["ins-posts", "Posts"]];
function AbasInsights() {
  const [ativa, setAtiva] = useState("ins-resumo");
  const ir = (id: string) => { setAtiva(id); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  return (
    <div className="md:hidden sticky top-[calc(var(--topo-app)+56px)] z-30 -mx-4 mt-5 px-4 py-2.5 bg-background border-y-2 border-foreground flex gap-1.5 overflow-x-auto">
      {ABAS.map(([id, nome]) => (
        <button key={id} type="button" onClick={() => ir(id)}
          className={`h-8 px-3 rounded-full text-[13px] font-display font-extrabold border-2 border-foreground whitespace-nowrap ${ativa === id ? "bg-[#EA4918] text-white" : "bg-card"}`}>
          {nome}
        </button>
      ))}
    </div>
  );
}

function Driver({ icon: Icon, t, big, s, permalink, thumb, legenda }: { icon: typeof Users; t: string; big: string; s: string; permalink?: string | null; thumb?: string | null; legenda?: string }) {
  // Quando há permalink, o destaque abre o post no Instagram em nova aba.
  const clickable = !!permalink;
  const open = () => { if (permalink) window.open(permalink, "_blank", "noopener,noreferrer"); };
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? open : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } } : undefined}
      className={`${CARD} p-3.5 flex items-center gap-3.5 ${clickable ? "cursor-pointer transition-transform hover:-translate-y-0.5" : ""}`}
    >
      {/* Polaroid: capa do post (ou o ícone, quando não há capa) com a legenda à mão. */}
      <div className="shrink-0 w-[84px] bg-white border-2 border-[#1D1B18] p-1 pb-4 -rotate-2 shadow-[2px_2px_0_rgba(29,27,24,.2)] relative">
        <div className="aspect-[4/5] bg-muted grid place-items-center overflow-hidden">
          {thumb
            ? <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            : <Icon className="h-6 w-6 text-[#1D1B18]/50" />}
        </div>
        {legenda && <span className="absolute bottom-0 inset-x-0 text-center text-[13px] leading-4 text-[#1D1B18]" style={MAO}>{legenda}</span>}
      </div>
      <div className="min-w-0">
        <div className="text-[10.5px] text-muted-foreground font-extrabold uppercase tracking-wider flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {t}</div>
        <div className="font-display font-extrabold text-[15.5px] mt-1 leading-tight line-clamp-3">{big}</div>
        <div className="text-[18px] leading-tight mt-1 text-[#1d6b3c]" style={MAO}>{s}{clickable ? " · abrir ↗" : ""}</div>
      </div>
    </div>
  );
}

// Post do CRIA no formato que o dialog de vínculo consome.
type LinkPost = { id: string; title: string; format: string | null; status: string | null; published_at: string | null };

// Rótulo de status a partir das STATUS_OPTIONS do projeto (mesmos nomes do kanban).
const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.key, s.label]));

// Ordem dos grupos otimizada pra este fluxo: você liga um post JÁ PUBLICADO no
// Instagram ao original, então publicados/agendados vêm primeiro; ideias por último.
const LINK_STATUS_ORDER = ["publicado", "agendado", "editando", "gravando", "roteiro", "ideia"];

// Quantos posts mostrar por grupo antes do "ver mais" (evita o paredão).
const GROUP_LIMIT = 8;

// Dialog de vínculo manual: lista posts do CRIA pra ligar à mídia, agrupados por
// status (tipo kanban empilhado), com busca por título e limite por grupo.
function LinkDialog({ insight, onClose, onPick }: { insight: MediaInsight | null; onClose: () => void; onPick: (postId: string | null) => void }) {
  // Posts da CONTA ATIVA: a mídia do IG é do dono da conta, então o vínculo é com
  // os posts DELE. Antes filtrava pelo user logado e a gestora via os posts dela.
  const { activeAccountId } = useActiveAccount();
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { data: posts = [] } = useQuery<LinkPost[]>({
    queryKey: ["link-posts", activeAccountId],
    enabled: !!activeAccountId && !!insight,
    queryFn: async () => {
      const { data, error } = await sbFrom("posts")
        .select("id,title,format,status,published_at")
        .eq("user_id", activeAccountId!)
        .order("published_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as LinkPost[];
    },
  });

  // Filtra por título e agrupa por status na ordem útil pro fluxo. Status fora da
  // lista conhecida caem num grupo "Outros" no fim (não some post nenhum).
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = term ? posts.filter((p) => (p.title ?? "").toLowerCase().includes(term)) : posts;
    const known = new Set(LINK_STATUS_ORDER);
    const out: { key: string; label: string; items: LinkPost[] }[] = [];
    for (const key of LINK_STATUS_ORDER) {
      const items = filtered.filter((p) => (p.status ?? "") === key);
      if (items.length) out.push({ key, label: STATUS_LABEL[key] ?? key, items });
    }
    const rest = filtered.filter((p) => !known.has(p.status ?? ""));
    if (rest.length) out.push({ key: "outros", label: "Outros", items: rest });
    return out;
  }, [posts, q]);

  const total = groups.reduce((a, g) => a + g.items.length, 0);

  return (
    <Dialog open={!!insight} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[82vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle className="font-display">{insight?.post_id ? "Trocar vínculo" : "Vincular ao conteúdo do CRIA"}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">Escolha o post do CRIA que originou esta publicação. Isso permite cruzar roteiro, legenda e hook com o desempenho.</p>

        {/* Já vinculado: mostra o vínculo atual e permite desvincular (postId null). */}
        {insight?.post_id && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <span className="text-[11px] text-muted-foreground min-w-0">
              Vinculado a: <span className="font-semibold text-foreground">{[insight.posts?.format, insight.posts?.hook].filter(Boolean).join(" · ") || insight.posts?.title || "post do CRIA"}</span>
            </span>
            <button onClick={() => onPick(null)} className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:underline shrink-0">
              <Unlink className="h-3 w-3" /> Desvincular
            </button>
          </div>
        )}

        {/* Busca por título (filtra todos os grupos) */}
        <div className="relative mt-3 shrink-0">
          <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:border-primary/40"
          />
        </div>

        {/* Grupos empilhados por status, cada card mantém o mesmo clique de vincular */}
        <div className="mt-3 overflow-y-auto flex-1 -mx-1 px-1 space-y-4">
          {total === 0 && <p className="text-sm text-muted-foreground">{q ? "Nenhum post com esse título." : "Nenhum post encontrado."}</p>}
          {groups.map((g) => {
            const isOpen = expanded[g.key];
            const shown = isOpen ? g.items : g.items.slice(0, GROUP_LIMIT);
            return (
              <div key={g.key}>
                <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1 z-10">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${getStatusClasses(g.key)}`}>{g.label}</span>
                  <span className="text-[11px] text-muted-foreground">{g.items.length}</span>
                </div>
                <div className="space-y-1.5">
                  {shown.map((p) => (
                    <button key={p.id} onClick={() => onPick(p.id)}
                      className="w-full text-left px-3 py-2.5 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors">
                      <span className="text-sm font-medium block truncate">{p.title || "(sem título)"}</span>
                      <span className="text-[11px] flex items-center gap-1.5 mt-0.5">
                        {p.format && <span className={`font-bold uppercase tracking-wide ${FORMAT_TEXT_CLASS}`} style={formatColorVars(p.format)}>{FORMAT_LABELS[p.format] ?? p.format}</span>}
                        {p.published_at && <span className="text-muted-foreground">· {p.published_at.slice(0, 10)}</span>}
                      </span>
                    </button>
                  ))}
                </div>
                {g.items.length > GROUP_LIMIT && (
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [g.key]: !isOpen }))}
                    className="mt-1.5 text-[11px] font-semibold text-primary hover:underline"
                  >
                    {isOpen ? "Ver menos" : `Ver mais (${g.items.length - GROUP_LIMIT})`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
