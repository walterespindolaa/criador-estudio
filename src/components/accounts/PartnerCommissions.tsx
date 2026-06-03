import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Clock, CircleDollarSign, Check, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Referral = {
  id: string;
  status: "pending" | "payable" | "paid" | "canceled";
  gross_amount_cents: number | null;
  net_amount_cents: number | null;
  deduction_pct: number | null;
  currency: string | null;
  paid_invoices_count: number | null;
  created_at: string;
  unlocked_at: string | null;
  paid_at: string | null;
  referred_label: string | null;
};

function formatBRL(cents: number | null): string {
  if (!cents) return "R$ 0,00";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_BADGE: Record<Referral["status"], string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  payable: "bg-emerald-50 text-emerald-700 border-emerald-200",
  paid: "bg-muted text-muted-foreground border-border",
  canceled: "bg-red-50 text-red-700 border-red-200 line-through",
};

const STATUS_LABEL: Record<Referral["status"], string> = {
  pending: "Em carência",
  payable: "A receber",
  paid: "Pago",
  canceled: "Cancelada",
};

const STATUS_ICON: Record<Referral["status"], React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  payable: CircleDollarSign,
  paid: Check,
  canceled: XIcon,
};

export function PartnerCommissions() {
  const { user } = useAuth();

  const { data: referrals = [], isLoading } = useQuery<Referral[]>({
    queryKey: ["partner-referrals-mine", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string, args?: unknown,
      ) => Promise<{ data: Referral[] | null; error: unknown }>)("get_my_partner_referrals");
      if (error) throw error;
      return (data ?? []) as Referral[];
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 px-5 py-6 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalReceber = referrals
    .filter((r) => r.status === "payable")
    .reduce((sum, r) => sum + (r.net_amount_cents ?? 0), 0);
  const totalPendente = referrals
    .filter((r) => r.status === "pending")
    .reduce((sum, r) => sum + (r.net_amount_cents ?? 0), 0);
  const totalRecebido = referrals
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + (r.net_amount_cents ?? 0), 0);

  return (
    <section className="rounded-2xl border border-border bg-card/50 px-5 py-5 space-y-4 mb-4">
      <div>
        <h3 className="text-sm font-display font-semibold text-foreground flex items-center gap-2">
          <CircleDollarSign className="h-4 w-4 text-primary" />
          Suas comissões
        </h3>
        <p className="text-xs text-muted-foreground font-body mt-0.5">
          A comissão libera após o cliente pagar a 2ª fatura.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="rounded-xl border border-emerald-200/50 bg-emerald-50/50 dark:bg-emerald-500/5 px-3 py-2.5 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold">A receber</p>
          <p className="text-base font-display font-extrabold text-foreground mt-0.5 truncate">{formatBRL(totalReceber)}</p>
        </div>
        <div className="rounded-xl border border-amber-200/50 bg-amber-50/50 dark:bg-amber-500/5 px-3 py-2.5 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold">Em carência</p>
          <p className="text-base font-display font-extrabold text-foreground mt-0.5 truncate">{formatBRL(totalPendente)}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Recebido</p>
          <p className="text-base font-display font-extrabold text-foreground mt-0.5 truncate">{formatBRL(totalRecebido)}</p>
        </div>
      </div>

      {referrals.length === 0 ? (
        <p className="text-xs text-muted-foreground font-body text-center py-3">
          Ainda não há indicações. Compartilhe seu cupom pra começar.
        </p>
      ) : (
        <div className="space-y-1.5">
          {referrals.map((r) => {
            const Icon = STATUS_ICON[r.status];
            return (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card/50 px-3 py-2 min-w-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-body text-foreground truncate">{r.referred_label || "Cliente"}</p>
                  <p className="text-[11px] text-muted-foreground font-body">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    {r.paid_at && ` · pago em ${new Date(r.paid_at).toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn("text-sm font-display font-bold", r.status === "canceled" && "line-through text-muted-foreground")}>
                    {formatBRL(r.net_amount_cents)}
                  </p>
                  <span className={cn("inline-flex items-center gap-1 text-[10px] font-body font-semibold px-1.5 py-0.5 rounded-full border mt-0.5", STATUS_BADGE[r.status])}>
                    <Icon className="h-2.5 w-2.5" />
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
