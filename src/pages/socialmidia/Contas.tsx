import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePartner } from "@/hooks/usePartner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PLANS, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { ClientsGrid } from "@/components/accounts/ClientsGrid";
import { ManagerSectionTitle } from "@/components/accounts/ManagerSectionTitle";

export default function Contas() {
  const { user } = useAuth();
  const { partner, isPartner } = usePartner();

  const [selfSubOpen, setSelfSubOpen] = useState(false);
  const [selfSubEmail, setSelfSubEmail] = useState("");
  const [selfSubPlan, setSelfSubPlan] = useState<PlanId>("studio");
  const [selfSubCoupon, setSelfSubCoupon] = useState(partner?.coupon_code ?? "");
  const [selfSubSubmitting, setSelfSubSubmitting] = useState(false);
  const managerEmail = user?.email?.toLowerCase() ?? "";
  const emailIsSameAsManager = !!selfSubEmail.trim() && selfSubEmail.trim().toLowerCase() === managerEmail;

  const handleSelfSubscribe = async () => {
    const email = selfSubEmail.trim();
    if (!email || !email.includes("@")) { toast.error("Informe um e-mail válido."); return; }
    if (email.toLowerCase() === managerEmail) { toast.error("Use um e-mail diferente do seu de gestora."); return; }
    setSelfSubSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manager-self-subscribe", {
        body: { email, plan: selfSubPlan, partner_code: selfSubCoupon.trim() || undefined },
      });
      if (error || (data as { error?: string })?.error) {
        const code = (data as { error?: string })?.error ?? "unknown";
        toast.error(code === "use_different_email" ? "Use um e-mail diferente do seu de gestora."
          : code === "forbidden_not_manager" ? "Apenas gestoras podem usar esse fluxo."
          : "Não foi possível iniciar a assinatura.");
        return;
      }
      toast.success("Enviamos um link pro e-mail PF pra finalizar a assinatura.");
      setSelfSubOpen(false); setSelfSubEmail("");
    } catch (e) {
      console.error("[manager-self-subscribe] invoke failed:", e);
      toast.error("Falha ao chamar o servidor.");
    } finally { setSelfSubSubmitting(false); }
  };

  return (
    <div>
      <ManagerSectionTitle t="Suas contas" s="As contas de clientes que você gerencia." />
      <ClientsGrid defaultLimit={5} />

      <div className="rounded-2xl border border-border bg-card/50 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Sparkles className="h-4 w-4 text-primary" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-display font-semibold text-foreground">Quer usar o cria pro seu conteúdo também?</p>
          <p className="text-xs text-muted-foreground font-body mt-0.5">Crie uma conta de criadora pra você (com e-mail PF) e ganhe ideias, calendário e IA.</p>
        </div>
        <Button size="sm" onClick={() => setSelfSubOpen(true)} className="shrink-0">Assinar pra mim</Button>
      </div>

      <Dialog open={selfSubOpen} onOpenChange={(o) => !selfSubSubmitting && setSelfSubOpen(o)}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-md max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Assinar pra mim</DialogTitle>
            <DialogDescription className="font-body text-sm">Cria uma conta de criadora num e-mail diferente do seu de gestora. Você recebe um link nesse e-mail pra finalizar a assinatura.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="font-body text-xs">E-mail PF</Label>
              <Input type="email" inputMode="email" autoComplete="off" placeholder="seu-email-pessoal@exemplo.com" value={selfSubEmail} onChange={(e) => setSelfSubEmail(e.target.value)} disabled={selfSubSubmitting} className="rounded-xl" />
              {emailIsSameAsManager && <p className="text-[11px] text-destructive font-body">Use um e-mail diferente do seu de gestora ({managerEmail}).</p>}
            </div>
            <div className="space-y-2">
              <Label className="font-body text-xs">Plano</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PLANS.map((plan) => {
                  const selected = selfSubPlan === plan.id;
                  return (
                    <button key={plan.id} type="button" onClick={() => setSelfSubPlan(plan.id)} disabled={selfSubSubmitting}
                      className={cn("text-left rounded-xl border-2 px-3 py-3 transition-all min-w-0", selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30", selfSubSubmitting && "opacity-60 cursor-not-allowed")}>
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="text-sm font-display font-semibold text-foreground truncate">{plan.name}</span>
                        {plan.highlighted && <span className="text-[9px] uppercase tracking-wider font-body font-semibold text-primary shrink-0">Recomendado</span>}
                      </div>
                      <p className="text-base font-display font-bold text-foreground mt-1">{plan.price}<span className="text-[10px] text-muted-foreground font-body font-normal">/mês</span></p>
                      <p className="text-[11px] text-muted-foreground font-body mt-0.5 line-clamp-2">{plan.tagline}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            {isPartner && partner?.coupon_code && (
              <div className="space-y-1.5">
                <Label className="font-body text-xs">Cupom (seu)</Label>
                <Input value={selfSubCoupon} onChange={(e) => setSelfSubCoupon(e.target.value)} disabled={selfSubSubmitting} className="rounded-xl font-mono text-sm" />
                <p className="text-[11px] text-muted-foreground font-body">Você pode usar o próprio cupom nesse fluxo (exceção ao bloqueio de auto-indicação).</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setSelfSubOpen(false)} disabled={selfSubSubmitting}>Cancelar</Button>
            <Button onClick={handleSelfSubscribe} disabled={selfSubSubmitting || emailIsSameAsManager || !selfSubEmail.trim()}>{selfSubSubmitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Continuar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
