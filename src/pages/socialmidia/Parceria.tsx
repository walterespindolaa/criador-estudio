import { useState } from "react";
import { Handshake, Check, Clock, Ticket, Sparkles } from "lucide-react";
import { usePartner } from "@/hooks/usePartner";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/shared/CopyButton";
import { PartnerApplyDrawer } from "@/components/accounts/PartnerApplyDrawer";
import { ManagerSectionTitle } from "@/components/accounts/ManagerSectionTitle";

export default function Parceria() {
  const { partner, isPartner, isPending: isPartnerPending } = usePartner();
  const [partnerOpen, setPartnerOpen] = useState(false);
  return (
    <div>
      <ManagerSectionTitle t="Parceria" s="Indique o Cria pros seus clientes e ganhe comissão recorrente." />
      {isPartner ? (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-card px-5 py-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"><Handshake className="h-4 w-4 text-primary" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display font-semibold text-foreground flex items-center gap-2">Você é parceira <span aria-hidden>🎉</span></p>
              <p className="text-xs text-muted-foreground font-body mt-0.5">Compartilhe seu cupom com seus clientes.</p>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-body font-semibold shrink-0"><Check className="h-3 w-3" /> Aprovada</span>
          </div>
          {partner?.coupon_code && (
            <div className="rounded-xl border border-primary/30 bg-background/60 px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"><Ticket className="h-5 w-5 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Seu cupom{partner.coupon_type === "client_discount" && partner.coupon_discount_pct ? ` · ${partner.coupon_discount_pct}% off` : ""}</p>
                <p className="text-lg font-display font-extrabold text-foreground tracking-wider truncate">{partner.coupon_code}</p>
              </div>
              <CopyButton text={partner.coupon_code} />
            </div>
          )}
        </div>
      ) : isPartnerPending ? (
        <div className="rounded-2xl border border-border bg-card/50 px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0"><Clock className="h-4 w-4 text-amber-600" /></div>
          <div><p className="text-sm font-display font-semibold text-foreground">Solicitação em análise</p><p className="text-xs text-muted-foreground font-body mt-0.5">Vamos te avisar assim que aprovarmos seu cadastro.</p></div>
        </div>
      ) : (
        <div>
          <div className="rounded-2xl border border-border bg-card px-5 py-2 mb-5">
            {[["Cupom exclusivo", "Um código só seu pra compartilhar com clientes."], ["Comissão recorrente", "Ganhe enquanto seu indicado seguir assinante."], ["Acompanhamento", "Veja indicações, carência e valores recebidos."]].map(([t, d]) => (
              <div key={t} className="flex gap-3 py-3.5 border-b border-border last:border-0">
                <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Sparkles className="h-4 w-4" /></span>
                <div><p className="text-sm font-display font-semibold text-foreground">{t}</p><p className="text-xs text-muted-foreground font-body">{d}</p></div>
              </div>
            ))}
          </div>
          <Button onClick={() => setPartnerOpen(true)}>Quero ser parceira</Button>
        </div>
      )}
      <PartnerApplyDrawer open={partnerOpen} onOpenChange={setPartnerOpen} />
    </div>
  );
}
