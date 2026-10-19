import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Instagram, Users, Eye, Zap, UserPlus, ArrowRight, TrendingUp, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useSocialConnection,
  useDailyMetrics,
  useMediaInsights,
  useSocialAccountOwner,
  connectInstagram,
  type MediaInsight,
  totaisConta30d,
} from "@/hooks/useSocialInsights";
import { computeCrossAnalysis, computeFollowersDelta, crossHeadlines, fmtNum, type CrossItem } from "@/components/insights/insightsUtils";

// Lê uma métrica numérica do jsonb de uma mídia (mesma convenção da tela de Insights).
const m = (mi: MediaInsight, k: string) => Number(mi.metrics?.[k] ?? 0);

/* ─── ÚLTIMOS 2 POSTS + ACERTOU/ERROU (Walter, 19/10/2026, mockup aprovado) ───
   Conta, não palpite: cada métrica do post é comparada com a média dos 10 posts
   ANTERIORES do mesmo tipo (reels e vídeo contam juntos). Mostra no máximo um
   ponto verde (>= 1,5x a média) e um vermelho (<= 0,6x). Com menos de 3 posts
   de base não compara. */
const grupoTipo = (t: string | null) => (t === "REELS" || t === "VIDEO" ? "video" : t ?? "outro");
const rotuloTipo = (t: string | null) =>
  t === "REELS" ? "Reels" : t === "VIDEO" ? "Vídeo" : t === "CAROUSEL_ALBUM" ? "Carrossel" : t === "IMAGE" ? "Foto" : "Post";
const rotuloBase = (t: string | null) =>
  grupoTipo(t) === "video" ? "reels" : t === "CAROUSEL_ALBUM" ? "carrosséis" : t === "IMAGE" ? "posts de foto" : "posts";
const salvos = (mi: MediaInsight) => m(mi, "saved") + m(mi, "saves");
const retencaoS = (mi: MediaInsight) => m(mi, "ig_reels_avg_watch_time") / 1000;

type Metrica = { k: string; ler: (mi: MediaInsight) => number; bom: string; ruim: string; soVideo?: boolean };
const METRICAS: Metrica[] = [
  { k: "salvos", ler: salvos, bom: "conteúdo útil, gente guardou pra depois.", ruim: "pouca gente guardou pra depois." },
  { k: "envios", ler: (mi) => m(mi, "shares"), bom: "conteúdo compartilhável, rodou por envio.", ruim: "quase ninguém mandou pra alguém." },
  { k: "comentários", ler: (mi) => m(mi, "comments"), bom: "gerou conversa.", ruim: "gerou pouca conversa." },
  { k: "alcance", ler: (mi) => m(mi, "reach"), bom: "chegou em gente nova.", ruim: "ficou só pra quem já te segue." },
  { k: "retenção", ler: retencaoS, bom: "o gancho segurou a pessoa.", ruim: "o gancho demorou pra chegar.", soVideo: true },
];

const fmtVezes = (r: number) => `${r.toFixed(1).replace(".", ",").replace(",0", "")}x`;

function veredito(post: MediaInsight, base: MediaInsight[]) {
  if (base.length < 3) return null;
  const video = grupoTipo(post.media_type) === "video";
  let melhor: { txt: string; r: number } | null = null;
  let pior: { txt: string; r: number } | null = null;
  for (const met of METRICAS) {
    if (met.soVideo && !video) continue;
    const media = base.reduce((a, b) => a + met.ler(b), 0) / base.length;
    if (media <= 0) continue;
    const r = met.ler(post) / media;
    const nome = met.k.charAt(0).toUpperCase() + met.k.slice(1);
    if (r >= 1.5 && (!melhor || r > melhor.r)) melhor = { r, txt: `${nome} ${fmtVezes(r)} acima da sua média: ${met.bom}` };
    if (r <= 0.6 && (!pior || r < pior.r)) {
      const pct = Math.round((1 - r) * 100);
      pior = { r, txt: `${nome} ${pct}% abaixo da média: ${met.ruim}` };
    }
  }
  return { melhor: melhor?.txt ?? null, pior: pior?.txt ?? null };
}

function tempoRelativo(iso: string | null) {
  if (!iso) return "";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `${dias} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function tituloDoPost(mi: MediaInsight) {
  const t = mi.posts?.title?.trim() || (mi.caption ?? "").split("\n").map((l) => l.trim()).find(Boolean) || "";
  return t || "Post sem legenda";
}

function UltimoPost({ post, base }: { post: MediaInsight; base: MediaInsight[] }) {
  const video = grupoTipo(post.media_type) === "video";
  const v = veredito(post, base);
  const nums: { n: string; l: string }[] = [];
  if (post.metrics?.reach != null) nums.push({ n: fmtNum(m(post, "reach")), l: "alcance" });
  if (post.metrics?.likes != null && !video) nums.push({ n: fmtNum(m(post, "likes")), l: "curtidas" });
  if (post.metrics?.saved != null || post.metrics?.saves != null) nums.push({ n: fmtNum(salvos(post)), l: "salvos" });
  if (post.metrics?.shares != null) nums.push({ n: fmtNum(m(post, "shares")), l: "envios" });
  if (post.metrics?.comments != null) nums.push({ n: fmtNum(m(post, "comments")), l: "comentários" });
  if (video && post.metrics?.ig_reels_avg_watch_time != null) nums.push({ n: `${Math.round(retencaoS(post))}s`, l: "retenção" });
  const Conteudo = (
    <>
      <div className="relative h-[110px] w-[84px] shrink-0 overflow-hidden rounded-xl bg-muted">
        {post.thumbnail_url ? (
          <img src={post.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground"><ImageOff className="h-5 w-5" /></div>
        )}
        <span className="absolute left-1.5 top-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[9.5px] font-body font-bold text-white">
          {rotuloTipo(post.media_type)} · {tempoRelativo(post.posted_at)}
        </span>
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-[13px] font-body font-bold leading-snug text-foreground">{tituloDoPost(post)}</p>
        <p className="mt-0.5 mb-2 text-[11.5px] font-body text-muted-foreground">
          vs. a média dos seus últimos {Math.min(base.length, 10)} {rotuloBase(post.media_type)}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-body text-muted-foreground">
          {nums.map((x) => <span key={x.l}><b className="text-[13px] text-foreground">{x.n}</b> {x.l}</span>)}
        </div>
        <div className="mt-2 grid gap-1 text-xs font-body leading-snug text-foreground">
          {!v && <p className="text-muted-foreground">Poucos posts pra comparar ainda.</p>}
          {v?.melhor && <p className="flex gap-1.5"><span className="mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full bg-emerald-600" />{v.melhor}</p>}
          {v?.pior && <p className="flex gap-1.5"><span className="mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full bg-red-600" />{v.pior}</p>}
          {v && !v.melhor && !v.pior && <p className="text-muted-foreground">Dentro da sua média em tudo.</p>}
        </div>
      </div>
    </>
  );
  const cls = "grid grid-cols-[84px_1fr] gap-3 rounded-2xl border border-border bg-background/40 p-3";
  return post.permalink
    ? <a href={post.permalink} target="_blank" rel="noopener noreferrer" className={cn(cls, "transition-colors hover:border-primary/40")}>{Conteudo}</a>
    : <div className={cls}>{Conteudo}</div>;
}

// Faixa de direção (verde): a primeira frase da análise honesta (ciclo 3 dos
// dados). Antes montava "Reels performam 2x" com 1 post de cada lado; agora só
// aparece quando há amostra de verdade.
function buildDirection(items: CrossItem[]): string | null {
  const cross = computeCrossAnalysis(items);
  if (!cross.hasData) return null;
  return crossHeadlines(cross)[0] ?? null;
}

function PulseCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card rounded-2xl border border-border shadow-[var(--shadow-warm)]", className)}>
      {children}
    </div>
  );
}

// Um número do momento (rótulo + valor grande + variação opcional).
function StatBox({
  icon: Icon,
  label,
  value,
  delta,
  up,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  delta?: string;
  up?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-wider font-body font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={1.75} />
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xl sm:text-2xl font-display font-extrabold text-foreground tracking-tight leading-none mt-1.5">
        {value}
      </div>
      {delta && (
        <div className={cn("text-[10px] sm:text-[11px] font-body font-bold mt-1", up ? "text-emerald-600" : "text-red-500")}>
          {delta}
        </div>
      )}
    </div>
  );
}

// Bloco "Seu conteúdo no Instagram": números do momento + faixa de direção.
// Reaproveita os hooks de insights (nada de fetch novo). Nunca quebra com conta nova/vazia.
export function InstagramPulse() {
  const navigate = useNavigate();
  const { data: conn, isLoading } = useSocialConnection();
  // Conectar é ação do DONO da conta ativa: gestora clicando aqui gravaria o
  // Instagram DELA na tela do criador. Pra ela, mostramos um aviso no lugar.
  const { isOwnAccount, contaParaConectar } = useSocialAccountOwner();
  const { data: daily = [] } = useDailyMetrics(30);
  const { data: daily60 = [] } = useDailyMetrics(60);
  const { data: media = [] } = useMediaInsights();

  // Os 2 últimos posts e, pra cada um, os 10 anteriores do mesmo tipo (base da média).
  const ultimos = useMemo(() => {
    const ord = media.filter((mi) => mi.posted_at && mi.metrics);
    return ord.slice(0, 2).map((post, i) => ({
      post,
      base: ord.slice(i + 1).filter((o) => grupoTipo(o.media_type) === grupoTipo(post.media_type)).slice(0, 10),
    }));
  }, [media]);

  /* Variação vs. os 30 dias anteriores: só com base real dos dois lados
     (3+ posts em cada janela pro alcance/engajamento; 20+ dias com dado pras
     visitas). Sem base, não mostra número nenhum. */
  const variacao = useMemo(() => {
    const agora = Date.now();
    const janela = (de: number, ate: number) => media.filter((mi) => {
      const t = mi.posted_at ? new Date(mi.posted_at).getTime() : 0;
      return t >= agora - de * 86400000 && t < agora - ate * 86400000;
    });
    const atual = janela(30, 0), antes = janela(60, 30);
    const alc = (l: MediaInsight[]) => l.reduce((a, mi) => a + m(mi, "reach"), 0);
    const inter = (l: MediaInsight[]) => l.reduce((a, mi) => a + m(mi, "likes") + m(mi, "comments") + m(mi, "saved") + m(mi, "saves") + m(mi, "shares"), 0);
    const temBase = atual.length >= 3 && antes.length >= 3 && alc(antes) > 0;
    const reachPct = temBase ? Math.round(((alc(atual) - alc(antes)) / alc(antes)) * 100) : null;
    const engA = alc(atual) > 0 ? (inter(atual) / alc(atual)) * 100 : null;
    const engB = alc(antes) > 0 ? (inter(antes) / alc(antes)) * 100 : null;
    const engPts = temBase && engA != null && engB != null ? Math.round((engA - engB) * 10) / 10 : null;
    const corte = new Date(agora - 30 * 86400000).toISOString().slice(0, 10);
    const pv = (l: typeof daily60) => l.map((d) => d.profile_views).filter((v): v is number => v != null);
    const pvA = pv(daily60.filter((d) => d.date >= corte)), pvB = pv(daily60.filter((d) => d.date < corte));
    const somaB = pvB.reduce((a, b) => a + b, 0);
    const pvPct = pvA.length >= 20 && pvB.length >= 20 && somaB > 0
      ? Math.round(((pvA.reduce((a, b) => a + b, 0) - somaB) / somaB) * 100) : null;
    return { reachPct, engPts, pvPct };
  }, [media, daily60]);
  const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${n}% vs 30d antes`;

  // Números do momento (mesma lógica confiável da tela de Insights).
  const kpis = useMemo(() => {
    const last = daily[daily.length - 1];
    // Só os posts dos últimos 30 dias (mesma regra da tela de Insights).
    const desde = Date.now() - 30 * 86400000;
    const doMes = media.filter((mi) => mi.posted_at && new Date(mi.posted_at).getTime() >= desde);
    const reach = doMes.reduce((a, mi) => a + m(mi, "reach"), 0);
    const interactions = doMes.reduce(
      (a, mi) => a + m(mi, "likes") + m(mi, "comments") + m(mi, "saved") + m(mi, "saves") + m(mi, "shares"),
      0,
    );
    // Variação de seguidores só quando a série cobre ~30 dias de verdade (evita "+N" falso).
    const fd = computeFollowersDelta(daily);
    return {
      followers: last?.followers ?? null,
      followersDelta: fd.delta,
      hasFollowersWindow: fd.hasWindow,
      reach,
      interactions,
      profileViews: totaisConta30d(daily).profileViews,
      engagement: reach > 0 ? (interactions / reach) * 100 : null,
    };
  }, [daily, media]);

  // Frase de direção a partir dos cruzamentos (formato x dia).
  const direction = useMemo<string | null>(() => {
    if (media.length === 0) return null;
    const items: CrossItem[] = media.map((mi) => ({
      media_type: mi.media_type,
      posted_at: mi.posted_at,
      reach: m(mi, "reach"),
      interactions: m(mi, "likes") + m(mi, "comments") + m(mi, "saved") + m(mi, "saves") + m(mi, "shares"),
      pillar: null,
      hook: mi.posts?.hook ?? null,
    }));
    return buildDirection(items);
  }, [media]);

  // Enquanto carrega a conexão, não pisca nada.
  if (isLoading) return null;

  // Estado vazio 1: Instagram não conectado.
  if (!conn) {
    return (
      <PulseCard className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] grid place-items-center shrink-0">
          <Instagram className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-foreground">Seu conteúdo no Instagram</h3>
          <p className="text-sm text-muted-foreground font-body mt-0.5">
            {isOwnAccount
              ? "Conecte seu Instagram pra ver seus números aqui."
              : "Instagram ainda não conectado. Peça pro dono da conta conectar o Instagram dele em Insights."}
          </p>
        </div>
        {isOwnAccount && (
          <Button
            onClick={() => connectInstagram(null, null, contaParaConectar)}
            className="gap-2 shrink-0 bg-gradient-to-r from-[#DD2A7B] to-[#8134AF] text-white hover:opacity-90 w-full sm:w-auto"
          >
            <Instagram className="h-4 w-4" /> Conectar Instagram
          </Button>
        )}
      </PulseCard>
    );
  }

  // Estado vazio 2: conectado, mas ainda sem métricas coletadas (conta nova).
  const hasNumbers = kpis.followers != null || kpis.reach > 0 || kpis.profileViews != null;
  if (!hasNumbers) {
    return (
      <PulseCard className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] grid place-items-center shrink-0">
          <Instagram className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-foreground">Seu conteúdo no Instagram</h3>
          <p className="text-sm text-muted-foreground font-body mt-0.5">
            {conn.username ? `@${conn.username} conectado. ` : ""}Seus números aparecem aqui conforme acompanhamos sua conta.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/app/insights")} className="gap-2 shrink-0 w-full sm:w-auto">
          Ver tudo <ArrowRight className="h-4 w-4" />
        </Button>
      </PulseCard>
    );
  }

  // Estado normal: números + faixa de direção.
  return (
    <PulseCard className="p-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#515BD4] grid place-items-center shrink-0">
            <Instagram className="h-3.5 w-3.5 text-white" />
          </div>
          Seu conteúdo no Instagram
          {conn.username && <span className="text-xs font-body font-normal text-muted-foreground">@{conn.username}</span>}
        </h3>
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/insights")} className="gap-1.5 text-primary shrink-0">
          Ver tudo <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        <StatBox
          icon={Users}
          label="Seguidores"
          value={fmtNum(kpis.followers)}
          delta={
            kpis.followers != null && kpis.hasFollowersWindow && kpis.followersDelta != null
              ? `${kpis.followersDelta >= 0 ? "▲" : "▼"} ${Math.abs(kpis.followersDelta)} (30d)`
              : undefined
          }
          up={(kpis.followersDelta ?? 0) >= 0}
        />
        <StatBox icon={Eye} label="Alcance 30d" value={fmtNum(kpis.reach)}
          delta={variacao.reachPct != null ? fmtPct(variacao.reachPct) : undefined} up={(variacao.reachPct ?? 0) >= 0} />
        <StatBox icon={Zap} label="Engajamento" value={kpis.engagement != null ? `${kpis.engagement.toFixed(1).replace(".0", "")}%` : "-"}
          delta={variacao.engPts != null ? `${variacao.engPts > 0 ? "+" : ""}${String(variacao.engPts).replace(".", ",")} pt vs 30d antes` : undefined}
          up={(variacao.engPts ?? 0) >= 0} />
        <StatBox icon={UserPlus} label="Visitas ao perfil" value={fmtNum(kpis.profileViews)}
          delta={variacao.pvPct != null ? fmtPct(variacao.pvPct) : undefined} up={(variacao.pvPct ?? 0) >= 0} />
      </div>

      {ultimos.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {ultimos.map(({ post, base }) => <UltimoPost key={post.id} post={post} base={base} />)}
        </div>
      )}

      {direction && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200/60 bg-emerald-50 px-3.5 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5 dark:text-emerald-400" strokeWidth={2} />
          <p className="text-[13px] font-body font-medium text-emerald-800 leading-snug dark:text-emerald-300">{direction}</p>
        </div>
      )}
    </PulseCard>
  );
}
