import { useState } from "react";
import { useManagerProfile, useModuleCheckout, type ModuleWithStatus, type ManagerProfileInput } from "@/hooks/useModules";
import { useManageSubscription } from "@/hooks/useManageSubscription";
import { ManagerProfileForm } from "@/components/accounts/ManagerProfileForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sparkles, Check, Clock, Loader2, Send, Users2, Wallet, Radar, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
const ICONS: Record<string, typeof Sparkles> = { aprovapost_externo: Send, crm: Users2, financeiro: Wallet, hub_cria: Radar, hub_extra: Sparkles };

// Onde cada módulo ABRE. Sem isto, o popup de um módulo ativo vira um beco sem
// saída: diz "assinatura ativa" e não oferece caminho nenhum.
const ROTA: Record<string, string> = {
  aprovapost_externo: "/socialmidia/criapost",
  crm: "/socialmidia/criacrm",
  financeiro: "/socialmidia/criacaixa",
  hub_cria: "/socialmidia/hubcria",
};
const TAGLINES: Record<string, string> = {
  aprovapost_externo: "Aprovação externa por link",
  crm: "Sua carteira de clientes",
  financeiro: "Cachês e fluxo de caixa",
  hub_cria: "Espie os concorrentes dos seus clientes",
  hub_extra: "Mais créditos de análise no Cria Radar",
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
  // Faltavam. Por isso o popup do Cria Radar abria com "O QUE VOCÊ VAI TER" VAZIO:
  // uma caixa cinza em branco na tela onde a pessoa decide comprar.
  hub_cria: [
    "Leia o que os concorrentes de cada cliente estão postando",
    "Veja os anúncios que eles estão rodando agora",
    "Transcreva os reels que bombaram",
    "As pautas viram ideias no cronograma do cliente",
    "40 análises por mês",
  ],
  hub_extra: [
    "+20 análises no Cria Radar",
    "Some à sua cota do mês",
    "Cancele quando quiser",
  ],
};

export function ModulePopup({ module: m, onClose }: { module: ModuleWithStatus | null; onClose: () => void }) {
  const { profile, hasProfile, save } = useManagerProfile();
  const checkout = useModuleCheckout();
  const { openPortal, isLoading: portalLoading } = useManageSubscription();
  const [formOpen, setFormOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const Icon = m ? (ICONS[m.code] ?? Sparkles) : Sparkles;
  const active = m ? (m.status === "active" || m.status === "past_due") : false;
  const benefits = m ? (BENEFITS[m.code] ?? []) : [];
  const busy = checkout.isPending || portalLoading;
  const navigate = useNavigate();
  const rota = m ? ROTA[m.code] : undefined;

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
    <>
      <Dialog open={!!m} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md rounded-3xl">
          {m && (
            <>
              <div className="flex flex-col items-center text-center pt-2">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3"><Icon className="h-7 w-7 text-primary" /></div>
                <span className="inline-flex items-center gap-1.5 text-xs font-body font-semibold px-3 py-1.5 rounded-full border border-border text-foreground mb-3">
                  {active ? <><Check className="h-3.5 w-3.5 text-primary" /> Ativo</> : m.coming_soon ? <><Clock className="h-3.5 w-3.5" /> Em breve</> : `${brl(m.price_cents)}/mês`}
                </span>
                <h2 className="text-xl font-display font-extrabold text-foreground">{m.name}</h2>
                <p className="text-sm text-muted-foreground font-body mt-1">{TAGLINES[m.code] ?? ""}</p>
              </div>
              <div className="bg-muted/40 rounded-2xl p-4 mt-5 text-left">
                <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-body font-bold mb-2.5">O que você vai ter</p>
                <ul className="space-y-2">
                  {benefits.map((b, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm font-body text-foreground/90"><Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {b}</li>
                  ))}
                </ul>
              </div>
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-body mt-4 mb-1">
                <Check className="h-3.5 w-3.5" /> {active ? "Assinatura ativa" : m.coming_soon ? "Avisamos quando estiver disponível" : "Cobrança separada · cancele quando quiser"}
              </p>
              <div className="mt-3">
                {active ? (
                  // Módulo ativo: a ação principal é ENTRAR NELE. "Gerenciar
                  // assinatura" é secundário, e vira o único botão quando não
                  // existe destino (o pacote de créditos, por exemplo).
                  <div className="space-y-2">
                    {rota && (
                      <Button className="w-full rounded-xl h-12" onClick={() => { onClose(); navigate(rota); }}>
                        Abrir {m.name} <ArrowRight className="h-4 w-4 ml-1.5" />
                      </Button>
                    )}
                    <Button variant="outline" className="w-full rounded-xl h-12" onClick={openPortal} disabled={busy}>Gerenciar assinatura</Button>
                  </div>
                ) : m.coming_soon ? (
                  <Button className="w-full rounded-xl h-12" disabled>Em breve</Button>
                ) : (
                  <Button className="w-full rounded-xl h-12" onClick={() => onBuy(m.code)} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Comprar agora · ${brl(m.price_cents)}/mês`}</Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ManagerProfileForm open={formOpen} initial={profile} saving={save.isPending}
        onClose={() => { setFormOpen(false); setPending(null); }} onSave={onSaved} />
    </>
  );
}
