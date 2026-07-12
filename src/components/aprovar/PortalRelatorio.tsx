import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import type { PortalPost } from "@/pages/AprovarPortal";

type Props = {
  posts: PortalPost[];
  client: { name: string; logo: string | null; manager: string | null };
  brand: string | null;
  periodStart: string | null;
  periodEnd: string | null;
};

export function PortalRelatorio({ posts, client, brand, periodStart, periodEnd }: Props) {
  const accent = brand ?? "hsl(var(--primary))";

  const stats = useMemo(() => {
    const total = posts.length;
    const aprovados = posts.filter((p) => p.approval_status === "aprovado").length;
    const pendentes = posts.filter((p) => p.approval_status === "pendente").length;
    const ajustes = posts.filter((p) => p.approval_status === "ajuste_solicitado").length;
    return { total, aprovados, pendentes, ajustes };
  }, [posts]);

  const fmt = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ background: `${accent}14`, color: accent }}
          >
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display font-extrabold text-lg text-foreground">
              Relatório do período
            </h2>
            <p className="text-xs font-body text-muted-foreground">
              {fmt(periodStart)} — {fmt(periodEnd)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Total" value={stats.total} accent={accent} />
          <Stat label="Aprovados" value={stats.aprovados} accent={accent} />
          <Stat label="Pendentes" value={stats.pendentes} accent={accent} />
          <Stat label="Ajustes" value={stats.ajustes} accent={accent} />
        </div>
      </div>

      {client.manager && (
        <p className="text-center text-xs font-body text-muted-foreground">
          Gerenciado por {client.manager}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-border p-4 text-center">
      <p className="text-2xl font-display font-extrabold" style={{ color: accent }}>
        {value}
      </p>
      <p className="text-xs font-body text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
