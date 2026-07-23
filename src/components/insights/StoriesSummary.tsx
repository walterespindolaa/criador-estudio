import { CircleDot, Eye, MessageCircle, Reply, MousePointerClick } from "lucide-react";
import { computeStoriesSummary, fmtNum, type StoryLike } from "./insightsUtils";

// Bloco de STORIES: agrega alcance, respostas, taxa de resposta e navegação dos
// stories capturados (eles somem em 24h, então trabalhamos com o snapshot coletado).

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Eye; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[11px] font-body uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-display font-extrabold text-foreground">{value}</p>
      {sub && <p className="text-[11px] font-body text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function StoriesSummary({ stories }: { stories: StoryLike[] | undefined | null }) {
  const s = computeStoriesSummary(stories);

  if (!s.hasData) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <CircleDot className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-body text-foreground font-medium">Sem stories no período</p>
        <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">
          Stories somem em 24h; capturamos os que estavam no ar na última sincronização. Publique stories e volte após atualizar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Eye} label="Alcance" value={fmtNum(s.reach)} sub={`${fmtNum(s.avgReach)} por story · ${s.count} stories`} />
        <Stat icon={MessageCircle} label="Respostas" value={fmtNum(s.replies)} />
        <Stat icon={Reply} label="Taxa de resposta" value={s.reach > 0 ? `${s.replyRate.toFixed(1)}%` : "-"} sub="respostas ÷ alcance" />
        <Stat icon={MousePointerClick} label="Navegação" value={fmtNum(s.navigation)} sub="toques e saídas" />
      </div>
    </div>
  );
}
