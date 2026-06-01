import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/shared/CopyButton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, X, MessageCircle, Loader2, Users, Coins, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { Partner } from "@/hooks/usePartner";

type AnyTable = (table: string) => ReturnType<typeof supabase.from>;
const sbFrom = supabase.from as unknown as AnyTable;

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
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);

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

  const decide = useMutation({
    mutationFn: async (action: "approve" | "reject") => {
      if (!partner) throw new Error("No partner");
      const patch =
        action === "approve"
          ? { status: "approved", approved_at: new Date().toISOString(), approved_by: user?.id ?? null }
          : { status: "rejected" };
      const { error } = await sbFrom("partners").update(patch).eq("id", partner.id);
      if (error) throw error;
      // TODO A.2: gerar cupom Stripe quando action === "approve"
    },
    onSuccess: (_data, action) => {
      toast.success(action === "approve" ? "Parceira aprovada!" : "Solicitação recusada.");
      queryClient.invalidateQueries({ queryKey: ["admin-partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner", partner?.user_id] });
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao processar a decisão."),
  });

  if (!partner) return null;

  const phoneDigits = partner.phone.replace(/\D/g, "");
  const isPending = partner.status === "pending";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">Painel da parceira</SheetTitle>
            <SheetDescription className="font-body text-sm">
              {partner.full_name}
            </SheetDescription>
          </SheetHeader>

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

            {/* Ações */}
            {isPending && (
              <section className="space-y-2 pt-2 border-t border-border">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Decisão</h3>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setConfirmAction("approve")}
                    disabled={decide.isPending}
                    className="flex-1"
                  >
                    <Check className="h-4 w-4 mr-1.5" /> Aprovar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmAction("reject")}
                    disabled={decide.isPending}
                    className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-4 w-4 mr-1.5" /> Recusar
                  </Button>
                </div>
              </section>
            )}

            {!isPending && (
              <section className="rounded-xl bg-muted/30 px-3 py-2">
                <p className="text-xs font-body text-muted-foreground">
                  Status atual: <b className="text-foreground">{partner.status === "approved" ? "Aprovada" : "Recusada"}</b>
                </p>
              </section>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              {confirmAction === "approve" ? "Aprovar parceira?" : "Recusar solicitação?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "approve"
                ? `${partner.full_name} entra no programa de parceiras e recebe acesso ao cupom (geração do cupom Stripe será feita na Fase A.2).`
                : `A solicitação de ${partner.full_name} será marcada como recusada. Ela pode reaplicar depois.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={decide.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction) decide.mutate(confirmAction);
                setConfirmAction(null);
              }}
              disabled={decide.isPending}
            >
              {decide.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
