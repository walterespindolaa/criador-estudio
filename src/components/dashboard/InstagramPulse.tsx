import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Instagram, Users, Eye, Zap, UserPlus, ArrowRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useSocialConnection,
  useDailyMetrics,
  useMediaInsights,
  useSocialAccountOwner,
  connectInstagram,
  type MediaInsight,
} from "@/hooks/useSocialInsights";
import { computeCrossAnalysis, computeFollowersDelta, crossHeadlines, fmtNum, type CrossItem } from "@/components/insights/insightsUtils";

// Lê uma métrica numérica do jsonb de uma mídia (mesma convenção da tela de Insights).
const m = (mi: MediaInsight, k: string) => Number(mi.metrics?.[k] ?? 0);

// Monta a faixa de direção (verde) a partir dos cruzamentos: formato mais forte + melhor dia.
// Cai pra primeira headline pronta se não der pra montar a frase curta.
function buildDirection(items: CrossItem[]): string | null {
  const cross = computeCrossAnalysis(items);
  if (!cross.hasData) return null;
  const parts: string[] = [];
  const [f1, f2] = cross.byFormat;
  // Rótulos vêm no plural (Reels, Carrosséis, Fotos...), então "performam" concorda sempre.
  if (f1 && f2 && f2.avgReach > 0) {
    const ratio = f1.avgReach / f2.avgReach;
    if (ratio >= 1.2) {
      parts.push(`${f1.label} performam ${ratio.toFixed(1).replace(".0", "")}x melhor que ${f2.label}`);
    } else {
      parts.push(`Formato mais forte: ${f1.label}`);
    }
  } else if (f1) {
    parts.push(`Formato mais forte: ${f1.label}`);
  }
  const topDay = cross.byWeekday[0];
  if (topDay) parts.push(`Melhor dia: ${topDay.label.toLowerCase()}`);
  if (parts.length > 0) return parts.join(". ") + ".";
  // Fallback: headline acionável já pronta dos utils.
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
  const { isOwnAccount } = useSocialAccountOwner();
  const { data: daily = [] } = useDailyMetrics(30);
  const { data: media = [] } = useMediaInsights();

  // Números do momento (mesma lógica confiável da tela de Insights).
  const kpis = useMemo(() => {
    const last = daily[daily.length - 1];
    const reach = media.reduce((a, mi) => a + m(mi, "reach"), 0);
    const interactions = media.reduce(
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
      profileViews: last?.profile_views ?? null,
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
            onClick={() => connectInstagram()}
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
        <StatBox icon={Eye} label="Alcance 30d" value={fmtNum(kpis.reach)} />
        <StatBox icon={Zap} label="Engajamento" value={kpis.engagement != null ? `${kpis.engagement.toFixed(1).replace(".0", "")}%` : "-"} />
        <StatBox icon={UserPlus} label="Visitas ao perfil" value={fmtNum(kpis.profileViews)} />
      </div>

      {direction && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200/60 bg-emerald-50 px-3.5 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5 dark:text-emerald-400" strokeWidth={2} />
          <p className="text-[13px] font-body font-medium text-emerald-800 leading-snug dark:text-emerald-300">{direction}</p>
        </div>
      )}
    </PulseCard>
  );
}
