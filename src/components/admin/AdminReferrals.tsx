import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyButton } from "@/components/shared/CopyButton";
import { Loader2, CircleDollarSign, Check, Clock, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Referral = {
  id: string;
  partner_id: string;
  partner_name: string | null;
  partner_pix: string | null;
  referred_user_id: string;
  referred_email: string | null;
  status: "pending" | "payable" | "paid" | "canceled";
  gross_amount_cents: number | null;
  net_amount_cents: number | null;
  currency: string | null;
  paid_invoices_count: number | null;
  created_at: string;
  unlocked_at: string | null;
  paid_at: string | null;
  payout_proof_url: string | null;
  payout_note: string | null;
};

const STATUS_BADGE: Record<Referral["status"], string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  payable: "bg-emerald-50 text-emerald-700 border-emerald-200",
  paid: "bg-muted text-muted-foreground border-border",
  canceled: "bg-red-50 text-red-700 border-red-200",
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

function formatBRL(cents: number | null): string {
  if (!cents) return "R$ 0,00";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type StatusFilter = "todas" | Referral["status"];

export function AdminReferrals() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("payable");
  const [payoutTarget, setPayoutTarget] = useState<Referral | null>(null);
  const [payoutNote, setPayoutNote] = useState("");
  const [payoutProof, setPayoutProof] = useState("");

  const { data: referrals = [], isLoading } = useQuery<Referral[]>({
    queryKey: ["admin-referrals"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string, args?: unknown,
      ) => Promise<{ data: Referral[] | null; error: unknown }>)("admin_list_referrals");
      if (error) throw error;
      return (data ?? []) as Referral[];
    },
  });

  const filtered = useMemo(
    () => (statusFilter === "todas" ? referrals : referrals.filter((r) => r.status === statusFilter)),
    [referrals, statusFilter],
  );

  const payoutMutation = useMutation({
    mutationFn: async () => {
      if (!payoutTarget) throw new Error("no_target");
      const { data, error } = await supabase.functions.invoke("partner-referral-payout", {
        body: {
          referral_id: payoutTarget.id,
          payout_note: payoutNote.trim() || undefined,
          payout_proof_url: payoutProof.trim() || undefined,
        },
      });
      if (error || (data as { error?: string })?.error) {
        throw new Error((data as { error?: string })?.error ?? "payout_failed");
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Comissão marcada como paga.");
      queryClient.invalidateQueries({ queryKey: ["admin-referrals"] });
      setPayoutTarget(null);
      setPayoutNote("");
      setPayoutProof("");
    },
    onError: (e: Error) => toast.error(`Falha: ${e.message}`),
  });

  const totals = useMemo(() => {
    const sumBy = (s: Referral["status"]) =>
      referrals.filter((r) => r.status === s).reduce((sum, r) => sum + (r.net_amount_cents ?? 0), 0);
    return {
      payable: sumBy("payable"),
      pending: sumBy("pending"),
      paid: sumBy("paid"),
    };
  }, [referrals]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-200/50 bg-emerald-50/50 dark:bg-emerald-500/5 p-4 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold">A pagar</p>
          <p className="text-xl font-display font-extrabold text-foreground mt-0.5 truncate">{formatBRL(totals.payable)}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/50 bg-amber-50/50 dark:bg-amber-500/5 p-4 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold">Em carência</p>
          <p className="text-xl font-display font-extrabold text-foreground mt-0.5 truncate">{formatBRL(totals.pending)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/30 p-4 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pago no total</p>
          <p className="text-xl font-display font-extrabold text-foreground mt-0.5 truncate">{formatBRL(totals.paid)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Label className="text-xs font-body text-muted-foreground">Filtrar:</Label>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="rounded-xl h-9 w-44 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="payable">A pagar</SelectItem>
            <SelectItem value="pending">Em carência</SelectItem>
            <SelectItem value="paid">Pagas</SelectItem>
            <SelectItem value="canceled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/30 px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground font-body">Nenhuma comissão nesse filtro.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm font-body">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 text-xs font-body font-semibold text-muted-foreground">Parceira</th>
                <th className="px-4 py-3 text-xs font-body font-semibold text-muted-foreground hidden md:table-cell">Cliente</th>
                <th className="px-4 py-3 text-xs font-body font-semibold text-muted-foreground">Bruto</th>
                <th className="px-4 py-3 text-xs font-body font-semibold text-muted-foreground">Líquido</th>
                <th className="px-4 py-3 text-xs font-body font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-xs font-body font-semibold text-muted-foreground hidden lg:table-cell">Data</th>
                <th className="px-4 py-3 text-xs font-body font-semibold text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const Icon = STATUS_ICON[r.status];
                return (
                  <tr key={r.id} className={cn("border-b border-border/40 last:border-0", r.status === "payable" && "bg-emerald-50/30 dark:bg-emerald-500/5")}>
                    <td className="px-4 py-3">
                      <p className="font-body font-semibold text-foreground truncate max-w-[160px]">{r.partner_name || "—"}</p>
                      {r.partner_pix && (
                        <div className="flex items-center gap-1 mt-0.5 min-w-0">
                          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">{r.partner_pix}</span>
                          <CopyButton text={r.partner_pix} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground font-body truncate block max-w-[180px]">{r.referred_email || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-body">{formatBRL(r.gross_amount_cents)}</td>
                    <td className="px-4 py-3 text-sm font-display font-bold text-foreground">{formatBRL(r.net_amount_cents)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 text-[10px] font-body font-semibold px-1.5 py-0.5 rounded-full border", STATUS_BADGE[r.status])}>
                        <Icon className="h-2.5 w-2.5" />
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground font-body">{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "payable" ? (
                        <Button size="sm" onClick={() => setPayoutTarget(r)} className="h-8 text-xs">
                          Marcar como paga
                        </Button>
                      ) : r.status === "paid" && r.payout_proof_url ? (
                        <a href={r.payout_proof_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          Comprovante
                        </a>
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-body">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!payoutTarget} onOpenChange={(o) => !o && !payoutMutation.isPending && setPayoutTarget(null)}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="sm:max-w-md rounded-2xl"
        >
          <DialogHeader>
            <DialogTitle className="font-display">Marcar comissão como paga</DialogTitle>
            <DialogDescription className="font-body text-sm">
              {payoutTarget?.partner_name} · {formatBRL(payoutTarget?.net_amount_cents ?? 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {payoutTarget?.partner_pix && (
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Chave Pix</p>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex-1 min-w-0 truncate text-sm font-mono text-foreground">{payoutTarget.partner_pix}</span>
                  <CopyButton text={payoutTarget.partner_pix} />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="font-body text-xs">Nota / ID da transação PIX</Label>
              <Input
                placeholder="ex.: E12345678..."
                value={payoutNote}
                onChange={(e) => setPayoutNote(e.target.value)}
                disabled={payoutMutation.isPending}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-xs">Link do comprovante (opcional)</Label>
              <Input
                type="url"
                placeholder="https://..."
                value={payoutProof}
                onChange={(e) => setPayoutProof(e.target.value)}
                disabled={payoutMutation.isPending}
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setPayoutTarget(null)} disabled={payoutMutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => payoutMutation.mutate()} disabled={payoutMutation.isPending}>
              {payoutMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Confirmar pagamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
