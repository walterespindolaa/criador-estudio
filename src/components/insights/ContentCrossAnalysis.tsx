import { BarChart3, Layers, Hash, CalendarDays, Clock, Sparkles, TrendingUp } from "lucide-react";
import { computeCrossAnalysis, crossHeadlines, fmtNum, type CrossItem, type CrossGroup } from "./insightsUtils";

// CRUZAMENTOS (o ouro): performance média por FORMATO, PILAR, TEMA/HOOK e
// HORÁRIO/DIA-DA-SEMANA, com frases de direcionamento acionáveis. Cada tela mapeia
// suas mídias pro shape CrossItem (alcance/interações já extraídos) e passa aqui.

function GroupBlock({ icon: Icon, title, rows, hint }: { icon: typeof BarChart3; title: string; rows: CrossGroup[]; hint?: string }) {
  if (rows.length === 0) return null;
  const max = rows.reduce((mx, r) => Math.max(mx, r.avgReach), 0);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-primary" />
        <p className="text-sm font-display font-bold text-foreground">{title}</p>
      </div>
      {hint && <p className="text-[11px] font-body text-muted-foreground mb-3">{hint}</p>}
      <div className={`space-y-2.5 ${hint ? "" : "mt-3"}`}>
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-24 sm:w-28 text-[12px] font-body font-semibold text-foreground shrink-0 truncate" title={r.label}>{r.label}</span>
            <span className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <span className="block h-full rounded-full" style={{ width: `${max > 0 ? Math.max(4, (r.avgReach / max) * 100) : 0}%`, background: r.color || "hsl(var(--primary))" }} />
            </span>
            <span className="w-24 text-right text-[12px] font-body shrink-0">
              <b className="text-foreground">{fmtNum(r.avgReach)}</b>
              <span className="text-muted-foreground"> · {r.count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContentCrossAnalysis({ items }: { items: CrossItem[] | undefined | null }) {
  const data = computeCrossAnalysis(items);

  if (!data.hasData) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center">
        <BarChart3 className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-body text-foreground font-medium">Cruzamentos ainda sem base</p>
        <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">
          Assim que houver posts com alcance no período, mostramos o que rende mais por formato, pilar, tema e horário.
        </p>
      </div>
    );
  }

  const headlines = crossHeadlines(data);

  return (
    <div className="space-y-3">
      {/* Direcionamento em uma frase (o que fazer mais) */}
      {headlines.length > 0 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-display font-bold text-foreground">Direcionamento</p>
          </div>
          <ul className="space-y-2 text-[13px] font-body">
            {headlines.map((h, i) => (
              <li key={i} className="flex gap-2">
                <TrendingUp className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <GroupBlock icon={BarChart3} title="Alcance médio por formato" rows={data.byFormat} hint="Média de alcance de cada formato publicado." />
        {data.byPillar.length > 0 && (
          <GroupBlock icon={Layers} title="Alcance médio por pilar" rows={data.byPillar} hint="Cruzando com o pilar do conteúdo vinculado no CRIA." />
        )}
        {data.byWeekday.length > 1 && (
          <GroupBlock icon={CalendarDays} title="Alcance médio por dia" rows={data.byWeekday} hint="Dia da semana da publicação (fuso BR)." />
        )}
        {data.byTime.length > 1 && (
          <GroupBlock icon={Clock} title="Alcance médio por período" rows={data.byTime} hint="Faixa do dia da publicação (fuso BR)." />
        )}
        {data.byHook.length > 0 && (
          <GroupBlock icon={Hash} title="Hooks que mais alcançaram" rows={data.byHook} hint="Temas/ganchos dos posts vinculados com melhor desempenho." />
        )}
      </div>
      <p className="text-[11px] font-body text-muted-foreground">
        Alcance e interações são dados diretos da API do Instagram. Médias por pilar/hook consideram apenas posts vinculados ao conteúdo do CRIA.
      </p>
    </div>
  );
}
