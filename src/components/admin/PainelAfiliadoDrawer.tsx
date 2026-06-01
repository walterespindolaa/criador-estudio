import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CopyButton } from "@/components/shared/CopyButton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, X, MessageCircle, Loader2, Users, Coins, TrendingUp, Ticket, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { Partner, PartnerCouponType } from "@/hooks/usePartner";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from.bind(supabase) as unknown as AnyTable;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner: Partner | null;
};

const formatCpf = (cpf: string) => {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const formatPhone = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return phone;
};

export function PainelAfiliadoDrawer({ open, onOpenChange, partner }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [couponType, setCouponType] = useState<PartnerCouponType>("client_discount");
  const [discountPct, setDiscountPct] = useState<number>(20);
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [rejectOpen, setRejectOpen] = useState(false);

  // Reset form ao trocar de parceira ou fechar drawer
  useEffect(() => {
    if (open) {
      setCouponType("client_discount");
      setDiscountPct(20);
      setDurationMonths(1);
      setRejectOpen(false);
    }
  }, [open, partner?.id]);

  // Contagem de contas gerenciadas (account_members onde member_id = partner.user_id e status=active)
  const { data: managedCount = 0 } = useQuery<number>({
    queryKey: ["partner-managed-count", partner?.user_id],
    enabled: !!partner?.user_id && open,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("account_members")
        .select("id", { count: "exact", head: true })
        .eq("member_id", partner!.user_id)
        .eq("status", "active");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const approve = useMutation({
    mutationFn: async () => {
      if (!partner) throw new Error("No partner");
      const body: Record<string, unknown> = {
        partner_id: partner.id,
        coupon_type: couponType,
      };
      if (couponType === "client_discount") {
        body.discount_pct = discountPct;
        body.duration_months = durationMonths;
      }
      const { data, error } = await supabase.functions.invoke("partner-approve", { body });
      if (error || (data as { error?: string })?.error) {
        throw new Error((data as { error?: string; message?: string })?.message
          ?? (data as { error?: string })?.error
          ?? error?.message
          ?? "approve_failed");
      }
      return data as { ok: true; coupon_code: string };
    },
    onSuccess: (data) => {
      toast.success(`Cupom gerado: ${data.coupon_code}`);
      queryClient.invalidateQueries({ queryKey: ["admin-partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner", partner?.user_id] });
      onOpenChange(false);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Erro ao aprovar";
      toast.error(`Não foi possível aprovar: ${msg}`);
    },
  });

  const reject = useMutation({
    mutationFn: async () => {
      if (!partner) throw new Error("No partner");
      const { error } = await sbFrom("partners").update({ status: "rejected" }).eq("id", partner.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação recusada.");
      queryClient.invalidateQueries({ queryKey: ["admin-partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner", partner?.user_id] });
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao recusar a solicitação."),
  });

  if (!partner) return null;

  const phoneDigits = partner.phone.replace(/\D/g, "");
  const isPending = partner.status === "pending";
  const isApproved = partner.status === "approved";
  const busy = approve.isPending || reject.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl"
        >
          <DialogHeader>
            <DialogTitle className="font-display">Painel da parceira</DialogTitle>
            <DialogDescription className="font-body text-sm">
              {partner.full_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-6">
            {/* Sobre */}
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Sobre</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nome</p>
                    <p className="text-sm font-body text-foreground truncate">{partner.full_name}</p>
                  </div>
                </div>
                {partner.instagram_handle && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Instagram</p>
                      <a
                        href={`https://instagram.com/${partner.instagram_handle.replace(/^@/, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-body text-primary hover:underline truncate block"
                      >
                        @{partner.instagram_handle.replace(/^@/, "")}
                      </a>
                    </div>
                  </div>
                )}
                {partner.current_clients && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Clientes atendidos hoje</p>
                      <p className="text-sm font-body text-foreground truncate">{partner.current_clients}</p>
                    </div>
                  </div>
                )}
                {partner.time_active && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tempo de atuação</p>
                      <p className="text-sm font-body text-foreground truncate">{partner.time_active}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">CPF</p>
                    <p className="text-sm font-body text-foreground truncate">{formatCpf(partner.cpf)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Telefone</p>
                    <p className="text-sm font-body text-foreground truncate">{formatPhone(partner.phone)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Chave Pix</p>
                    <p className="text-sm font-body text-foreground break-all">{partner.pix_key}</p>
                  </div>
                  <CopyButton text={partner.pix_key} />
                </div>
              </div>
              {phoneDigits && (
                <Button
                  variant="outline"
                  className="w-full mt-1"
                  onClick={() => window.open(`https://wa.me/${phoneDigits}`, "_blank", "noopener,noreferrer")}
                >
                  <MessageCircle className="h-4 w-4 mr-2" /> Abrir WhatsApp
                </Button>
              )}
            </section>

            {/* Métricas */}
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Métricas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-body">Contas que gerencia</p>
                    <p className="text-xl font-display font-extrabold text-foreground tabular-nums">{managedCount}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-dashed border-border bg-card/50 p-3 flex items-center gap-3 opacity-70">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Coins className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-body">Comissões</p>
                    <p className="text-[11px] text-muted-foreground font-body">em breve (Fase B)</p>
                  </div>
                </div>
                <div className="rounded-xl border border-dashed border-border bg-card/50 p-3 flex items-center gap-3 opacity-70">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-body">Clientes</p>
                    <p className="text-[11px] text-muted-foreground font-body">em breve (Fase B)</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Cupom (se aprovada) */}
            {isApproved && partner.coupon_code && (
              <section className="space-y-2">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Cupom</h3>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Ticket className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {partner.coupon_type === "client_discount"
                        ? `Desconto ${partner.coupon_discount_pct ?? 0}%${
                            partner.coupon_duration_months && partner.coupon_duration_months > 1
                              ? ` por ${partner.coupon_duration_months} meses`
                              : " (1ª fatura)"
                          }`
                        : "Somente rastreio"}
                    </p>
                    <p className="text-base font-display font-extrabold text-foreground tracking-wider truncate">
                      {partner.coupon_code}
                    </p>
                  </div>
                  <CopyButton text={partner.coupon_code} />
                </div>
              </section>
            )}

            {/* Decisão (apenas pendentes) */}
            {isPending && (
              <section className="space-y-3 pt-2 border-t border-border">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Aprovar parceira</h3>

                <div className="space-y-1.5">
                  <Label className="font-body text-xs">Tipo de cupom</Label>
                  <Select value={couponType} onValueChange={(v) => setCouponType(v as PartnerCouponType)}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client_discount">Cupom com desconto pro cliente</SelectItem>
                      <SelectItem value="tracking">Só rastreio, sem desconto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {couponType === "client_discount" && (
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">% de desconto</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={discountPct}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n)) setDiscountPct(n);
                      }}
                      className="rounded-xl"
                      placeholder="20"
                    />
                    <p className="text-[11px] text-muted-foreground font-body">
                      Valor entre 1 e 100.
                    </p>
                  </div>
                )}

                {couponType === "client_discount" && (
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">Duração do desconto</Label>
                    <Select value={String(durationMonths)} onValueChange={(v) => setDurationMonths(Number(v))}>
                      <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Só a 1ª fatura</SelectItem>
                        <SelectItem value="3">3 meses</SelectItem>
                        <SelectItem value="6">6 meses</SelectItem>
                        <SelectItem value="12">12 meses</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground font-body">
                      A comissão é sempre calculada sobre o valor recebido na 1ª fatura.
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={() => approve.mutate()}
                    disabled={busy || (couponType === "client_discount" && (discountPct < 1 || discountPct > 100))}
                    className="flex-1"
                  >
                    {approve.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-1.5" />
                    )}
                    Aprovar e gerar cupom
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setRejectOpen(true)}
                    disabled={busy}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-4 w-4 mr-1.5" /> Recusar
                  </Button>
                </div>
              </section>
            )}

            {!isPending && (
              <section className="rounded-xl bg-muted/30 px-3 py-2">
                <p className="text-xs font-body text-muted-foreground">
                  Status atual:{" "}
                  <b className="text-foreground">
                    {partner.status === "approved" ? "Aprovada" : "Recusada"}
                  </b>
                </p>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={rejectOpen} onOpenChange={(o) => !reject.isPending && setRejectOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Recusar solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              A solicitação de {partner.full_name} será marcada como recusada. Ela pode reaplicar depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reject.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { reject.mutate(); setRejectOpen(false); }}
              disabled={reject.isPending}
            >
              {reject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
