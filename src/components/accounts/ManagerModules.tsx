import { useState } from "react";
import { useModules, useManagerProfile, useModuleCheckout, type ModuleWithStatus, type ManagerProfileInput } from "@/hooks/useModules";
import { useManageSubscription } from "@/hooks/useManageSubscription";
import { ManagerProfileForm } from "@/components/accounts/ManagerProfileForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sparkles, Check, Clock, Loader2, MessageSquareShare, Users2, Wallet } from "lucide-react";

const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
const ICONS: Record<string, typeof Sparkles> = { aprovapost_externo: MessageSquareShare, crm: Users2, financeiro: Wallet };
const TAGLINES: Record<string, string> = {
  aprovapost_externo: "Aprovação externa por link",
  crm: "Sua carteira de clientes",
  financeiro: "Cachês e fluxo de caixa",
};
const BENEFITS: Record<string, string[]> = {
  aprovapost_externo: [
    "Link de aprovação pra clientes que não usam o Cria",
    "Cliente aprova ou pede ajuste sem login, sem app",
    "Clientes externos ilimitados",
    "Visão de feed igual ao Instagram",
    "Comentários e histórico por post",
  ],
  crm: [
    "Carteira de clientes e leads num lugar só",
    "Pipeline de propostas e contratos",
    "Lembretes de follow-up",
    "Histórico de cada cliente",
  ],
  financeiro: [
    "Controle de cachês e mensalidades",
    "Contas a receber por cliente",
    "Fluxo de caixa e visão do mês",
    "Alertas de pagamentos pendentes",
  ],
};

export function ManagerModules() {
  const { modules, isLoading } = useModules();
  const { profile, hasProfile, save } = useManagerProfile();
  const checkout = useModuleCheckout();
  const { openPortal, isLoading: portalLoading } = useManageSubscription();
  const [selected, setSelected] = useState<ModuleWithStatus | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const onBuy = (code: string) => {
    if (!hasProfile) { setPending(code); setFormOpen(true); return; }
    checkout.mutate(code);
  };
  const onSaved = async (input: ManagerProfileInput) => {
    await save.mutateAsync(input);
    setFormOpen(false);
    const c = pending; setPending(null);
    if (c) checkout.mutate(c);
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight">Módulos</h1>
        <p className="text-sm text-muted-foreground font-body mt-1">Ferramentas extras pra sua operação. Cada uma é uma assinatura mensal separada — contrate só o que usar.</p>
      </header>

      {isLoading ? (
        <div className="grid sm:grid-cols-3 gap-4">{[0,1,2].map((i) => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : (
        <div className="grid sm:grid-cols-3 gap-4">
          {modules.map((m) => {
            const Icon = ICONS[m.code] ?? Sparkles;
            const active = m.status === "active" || m.status === "past_due";
            return (
              <button key={m.code} onClick={() => setSelected(m)}
                className="text-left bg-card rounded-2xl border border-border shadow-warm-sm hover:shadow-warm-md hover:scale-[1.01] transition-all p-5 flex flex-col">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center mb-3"><Icon className="h-5 w-5 text-primary" /></div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h2 className="font-display font-bold text-foreground">{m.name}</h2>
                  {active && <span className="text-[10px] font-body font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">Ativo</span>}
                  {m.coming_soon && !active && <span className="text-[10px] font-body font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">Em breve</span>}
                </div>
                <p className="text-xs text-muted-foreground font-body flex-1">{TAGLINES[m.code] ?? ""}</p>
                <span className="mt-3 font-display font-bold text-foreground text-sm">{brl(m.price_cents)}<span className="text-[11px] text-muted-foreground font-normal">/mês</span></span>
              </button>
            );
          })}
        </div>
      )}

      <ModuleDetailDialog
        module={selected}
        busy={checkout.isPending || portalLoading}
        onClose={() => setSelected(null)}
        onBuy={(code) => { setSelected(null); onBuy(code); }}
        onManage={openPortal}
      />
      <ManagerProfileForm open={formOpen} initial={profile} saving={save.isPending}
        onClose={() => { setFormOpen(false); setPending(null); }} onSave={onSaved} />
    </div>
  );
}

function ModuleDetailDialog({ module: m, busy, onClose, onBuy, onManage }: {
  module: ModuleWithStatus | null; busy: boolean; onClose: () => void;
  onBuy: (code: string) => void; onManage: () => void;
}) {
  const Icon = m ? (ICONS[m.code] ?? Sparkles) : Sparkles;
  const active = m ? (m.status === "active" || m.status === "past_due") : false;
  const benefits = m ? (BENEFITS[m.code] ?? []) : [];
  return (
    <Dialog open={!!m} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {m && (
          <>
            <div className="flex flex-col items-center text-center pt-2">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3"><Icon className="h-7 w-7 text-primary" /></div>
              <span className="inline-flex items-center gap-1 text-xs font-body font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full mb-3">
                {active ? <><Check className="h-3 w-3" /> Ativo</> : m.coming_soon ? <><Clock className="h-3 w-3" /> Em breve</> : `${brl(m.price_cents)}/mês`}
              </span>
              <h2 className="text-xl font-display font-extrabold text-foreground">{m.name}</h2>
              <p className="text-sm text-muted-foreground font-body mt-1">{TAGLINES[m.code] ?? ""}</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-4 mt-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-body font-semibold mb-2">O que você tem</p>
              <ul className="space-y-1.5">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm font-body text-foreground/90"><Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {b}</li>
                ))}
              </ul>
            </div>
            <div className="mt-5">
              {active ? (
                <Button variant="outline" className="w-full" onClick={onManage} disabled={busy}>Gerenciar assinatura</Button>
              ) : m.coming_soon ? (
                <Button className="w-full" disabled>Em breve</Button>
              ) : (
                <Button className="w-full" onClick={() => onBuy(m.code)} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Comprar agora · ${brl(m.price_cents)}/mês`}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
