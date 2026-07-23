import { Users, MapPin, Globe, VenetianMask } from "lucide-react";
import { computeAudienceBreakdown, fmtNum, type AudienceLike, type BreakdownItem } from "./insightsUtils";

// Bloco de PERFIL DE AUDIÊNCIA: faixa etária, gênero, top cidades e top países.
// Reaproveitado no Insights do criador e na visão do gestor sobre o cliente.

function BarRow({ item }: { item: BreakdownItem }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 sm:w-28 text-[12px] font-body text-foreground shrink-0 truncate">{item.label}</span>
      <span className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(4, item.pct)}%` }} />
      </span>
      <span className="w-14 text-right text-[12px] font-body shrink-0">
        <b className="text-foreground">{item.pct.toFixed(0)}%</b>
      </span>
    </div>
  );
}

function Dimension({ icon: Icon, title, items }: { icon: typeof Users; title: string; items: BreakdownItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <p className="text-sm font-display font-bold text-foreground">{title}</p>
      </div>
      <div className="space-y-2.5">
        {items.map((it) => <BarRow key={it.label} item={it} />)}
      </div>
    </div>
  );
}

export function AudienceBreakdown({ rows }: { rows: AudienceLike[] | undefined | null }) {
  const data = computeAudienceBreakdown(rows);

  if (!data.hasData) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <Users className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-body text-foreground font-medium">Demografia ainda coletando</p>
        <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">
          O Instagram só libera o perfil de audiência com um mínimo de seguidores. Volte após alguns dias de sincronização.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11.5px] font-body text-muted-foreground">
        {data.source === "followers" ? "Com base nos seus seguidores." : "Com base no público que engajou (seguidores indisponíveis)."}
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Dimension icon={Users} title="Faixa etária" items={data.age} />
        <Dimension icon={VenetianMask} title="Gênero" items={data.gender} />
        <Dimension icon={MapPin} title="Top cidades" items={data.city} />
        <Dimension icon={Globe} title="Top países" items={data.country} />
      </div>
    </div>
  );
}
