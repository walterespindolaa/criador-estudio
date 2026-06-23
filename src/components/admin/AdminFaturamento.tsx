import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, TrendingUp, Users, Clock, Ticket } from "lucide-react";

type Billing = { active: number; trialing: number; mrr: number; currency: string };

const brl = (n: number) => "R$ " + (n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

function Card({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-body">{label}</span>
      </div>
      <p className="text-2xl font-display font-extrabold text-foreground">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground font-body mt-0.5">{sub}</p>}
    </div>
  );
}

export function AdminFaturamento() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<Billing>({
    queryKey: ["admin-billing"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-billing");
      if (error) throw error;
      const err = (data as { error?: string })?.error;
      if (err) throw new Error(err);
      return data as Billing;
    },
    staleTime: 5 * 60 * 1000,
  });

  const ticket = data && data.active > 0 ? data.mrr / data.active : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground font-body">Dados ao vivo do Stripe (assinaturas e receita recorrente).</p>
        <button onClick={() => refetch()} className="shrink-0 inline-flex items-center gap-1.5 text-xs font-body font-medium rounded-lg border border-border px-3 py-1.5 hover:bg-muted transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground font-body py-6 text-center">Carregando do Stripe…</p>
      ) : error ? (
        <div className="rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive font-body">
          Não consegui ler o Stripe. Confira se a function <code>admin-billing</code> foi deployada e se o <code>STRIPE_SECRET_KEY</code> está configurado.
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card icon={TrendingUp} label="MRR (receita recorrente)" value={brl(data!.mrr)} sub={`em ${data!.currency}`} />
          <Card icon={Users} label="Assinaturas ativas" value={String(data!.active)} />
          <Card icon={Clock} label="Em teste (trial)" value={String(data!.trialing)} />
          <Card icon={Ticket} label="Ticket médio" value={brl(ticket)} sub="MRR ÷ ativas" />
        </div>
      )}
    </div>
  );
}
