import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, Users, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePartner } from "@/hooks/usePartner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CopyButton } from "@/components/shared/CopyButton";
import { isValidEmail } from "@/lib/sanitize";
import { PLANS, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { ClientsGrid } from "@/components/accounts/ClientsGrid";
import { AgencyClients } from "@/components/accounts/AgencyClients";
import { ManagerSectionTitle } from "@/components/accounts/ManagerSectionTitle";

const SEAT_OPTIONS = [3, 5, 10, 20];

export default function Contas() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { partner, isPartner } = usePartner();
  const qc = useQueryClient();

  const seatLimit = profile?.seat_limit ?? 0;
  const { data: seatsUsed = 0 } = useQuery<number>({
    queryKey: ["agency-seats-used", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("agency_seats_used");
      if (error) throw error;
      return Number(data ?? 0);
    },
  });

  // Adicionar cliente (coberto pelos assentos)
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<{ email: string; inviteLink: string } | null>(null);

  // Expandir assentos (checkout)
  const [expandOpen, setExpandOpen] = useState(false);
  const [expandSeats, setExpandSeats] = useState(5);
  const [expanding, setExpanding] = useState(false);

  const handleAddClient = async () => {
    const name = addName.trim(); const email = addEmail.trim();
    if (!name || !isValidEmail(email)) { toast.error("Preencha nome e e-mail válido."); return; }
    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke("manager-add-client", { body: { name, email } });
      const err = (data as { error?: string })?.error;
      if (error || err) {
        toast.error(err === "seats_full" ? "Seus assentos acabaram. Expanda o plano pra adicionar mais."
          : err === "no_seats" ? "Você ainda não tem um plano de agência ativo."
          : err === "use_different_email" ? "Use um e-mail diferente do seu de gestora."
          : err === "rate_limited" ? "Muitas tentativas. Aguarde um minuto."
          : "Não consegui adicionar agora.");
        return;
      }
      const d = data as { email: string; inviteLink: string };
      setAddResult({ email: d.email, inviteLink: d.inviteLink });
      setAddOpen(false); setAddName(""); setAddEmail("");
      qc.invalidateQueries({ queryKey: ["agency-seats-used", user?.id] });
    } catch (e) {
      console.error("[manager-add-client] failed:", e);
      toast.error("Falha ao chamar o servidor.");
    } finally { setAdding(false); }
  };

  const handleExpand = async () => {
    setExpanding(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", { body: { plan: "agency", seats: expandSeats } });
      const url = (data as { url?: string })?.url;
      if (error || !url) { toast.error("Não consegui abrir o checkout."); return; }
      window.location.href = url;
    } catch (e) {
      console.error("[create-checkout agency] failed:", e);
      toast.error("Falha ao iniciar o checkout.");
    } finally { setExpanding(false); }
  };

  const addMsg = addResult
    ? `Oi! Criei seu acesso no CRIA. 🎉\n\nE-mail: ${addResult.email}\n1º acesso: ${addResult.inviteLink}\n\nÉ só abrir o link, criar sua senha e pronto. Qualquer dúvida, me chama!`
    : "";

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

  const seatsFree = Math.max(0, seatLimit - seatsUsed);
  const seatPct = seatLimit > 0 ? Math.min(100, Math.round((seatsUsed / seatLimit) * 100)) : 0;

  return (
    <div>
      {/* Plano de agência / assentos */}
      <div className="rounded-2xl border border-border bg-card p-5 mb-6">
        {seatLimit > 0 ? (
          <>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Users className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-sm font-display font-semibold text-foreground">Plano de Agência</p>
                  <p className="text-xs font-body text-muted-foreground">{seatsUsed} de {seatLimit} assentos usados · {seatsFree} {seatsFree === 1 ? "livre" : "livres"}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setExpandOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Expandir</Button>
                <Button size="sm" onClick={() => setAddOpen(true)} disabled={seatsFree <= 0}><UserPlus className="h-3.5 w-3.5 mr-1" /> Adicionar cliente</Button>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${seatPct}%` }} />
            </div>
            {seatsFree <= 0 && <p className="text-[11px] font-body text-muted-foreground mt-2">Assentos esgotados — expanda o plano ou pause um cliente pra liberar assento.</p>}
            <AgencyClients seatsFree={seatsFree} />
          </>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Users className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm font-display font-semibold text-foreground">Plano de Agência</p>
                <p className="text-xs font-body text-muted-foreground">Assine assentos e gerencie vários clientes — eles entram sem pagar nada, por sua conta.</p>
              </div>
            </div>
            <Button size="sm" onClick={() => setExpandOpen(true)}>Assinar assentos</Button>
          </div>
        )}
      </div>

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

      {/* Adicionar cliente (assento) */}
      <Dialog open={addOpen} onOpenChange={(o) => !adding && setAddOpen(o)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Adicionar cliente</DialogTitle>
            <DialogDescription className="font-body text-sm">Cria o acesso de criadora coberto pelo seu plano de agência. O cliente não paga nada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="font-body text-xs">Nome do cliente</Label>
              <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Nome da marca/pessoa" disabled={adding} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-xs">E-mail do cliente</Label>
              <Input type="email" inputMode="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="cliente@email.com" disabled={adding} className="rounded-xl" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>Cancelar</Button>
            <Button onClick={handleAddClient} disabled={adding || !addName.trim() || !addEmail.trim()}>{adding && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Adicionar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expandir/assinar assentos */}
      <Dialog open={expandOpen} onOpenChange={(o) => !expanding && setExpandOpen(o)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">{seatLimit > 0 ? "Expandir assentos" : "Assinar plano de Agência"}</DialogTitle>
            <DialogDescription className="font-body text-sm">Escolha quantos assentos de cliente você quer (mínimo 3). Você é cobrada por assento, mensalmente.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-primary/5 border border-primary/15 px-3 py-2 mt-1 text-sm font-body">
            <span className="text-muted-foreground line-through mr-2">R$ 49,90</span>
            <span className="font-display font-bold text-primary">R$ 36,90</span>
            <span className="text-muted-foreground"> /assento ao mês</span>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            {SEAT_OPTIONS.map((n) => (
              <button key={n} type="button" onClick={() => setExpandSeats(n)} disabled={expanding}
                className={cn("rounded-xl border-2 py-3 text-center transition-all", expandSeats === n ? "border-primary bg-primary/5" : "border-border hover:border-primary/30")}>
                <span className="text-lg font-display font-extrabold text-foreground">{n}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Label className="font-body text-xs">Outro:</Label>
            <Input type="number" min={3} max={50} value={expandSeats} onChange={(e) => setExpandSeats(Math.max(3, Math.min(50, Number(e.target.value) || 3)))} disabled={expanding} className="rounded-xl w-24" />
            <span className="text-xs font-body text-muted-foreground">assentos</span>
          </div>
          <p className="text-sm font-body text-foreground mt-3">Total: <span className="font-bold">R$ {(expandSeats * 36.9).toFixed(2).replace(".", ",")}</span>/mês · {expandSeats} assentos</p>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setExpandOpen(false)} disabled={expanding}>Cancelar</Button>
            <Button onClick={handleExpand} disabled={expanding}>{expanding && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Ir pro pagamento</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mensagem pronta após adicionar cliente */}
      <Dialog open={!!addResult} onOpenChange={(o) => !o && setAddResult(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Cliente adicionado</DialogTitle>
            <DialogDescription className="font-body text-sm">Já enviamos o acesso por e-mail pro cliente. Se quiser, mande também a mensagem abaixo (WhatsApp).</DialogDescription>
          </DialogHeader>
          {addResult && (
            <div className="rounded-xl border border-border bg-card px-3 py-2.5 mt-1">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Mensagem pronta pra enviar</p>
                <CopyButton text={addMsg} />
              </div>
              <pre className="text-xs font-body text-foreground whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere] max-h-60 overflow-y-auto">{addMsg}</pre>
            </div>
          )}
          <div className="flex justify-end mt-4">
            <Button onClick={() => setAddResult(null)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

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
