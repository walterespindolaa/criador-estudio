import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Camera, LogOut, Settings as SettingsIcon, Sparkles, StickyNote, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useActiveAccount, type ManagedAccount } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PLANS, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/Logo";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { validateUpload } from "@/lib/upload-validation";
import { SettingsManagerDrawer } from "@/components/accounts/SettingsManagerDrawer";
import { ClientNotesDrawer } from "@/components/accounts/ClientNotesDrawer";
import { PartnerApplyDrawer } from "@/components/accounts/PartnerApplyDrawer";
import { PartnerCommissions } from "@/components/accounts/PartnerCommissions";
import { ApprovalTracker } from "@/components/accounts/ApprovalTracker";
import { usePartner } from "@/hooks/usePartner";
import { useManagerApprovalOverview } from "@/hooks/useApprovals";
import { CopyButton } from "@/components/shared/CopyButton";
import { Handshake, Check, Clock, Ticket } from "lucide-react";

function initial(name: string | null | undefined) {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}

function greeting(name: string | null | undefined) {
  const first = (name ?? "").trim().split(/\s+/)[0] || "social media";
  const h = new Date().getHours();
  const part = h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
  return `${part}, ${first}!`;
}

export function ManagerHome({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { managedAccounts, accountsLoading, setActiveAccount } = useActiveAccount();
  const { signOut } = useAuth();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notesAccount, setNotesAccount] = useState<ManagedAccount | null>(null);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const { partner, isPartner, isPending: isPartnerPending } = usePartner();
  const { overview } = useManagerApprovalOverview();
  const overviewMap = useMemo(() => {
    const m: Record<string, { pendentes: number; ajustes: number }> = {};
    for (const r of overview) m[r.owner_id] = { pendentes: r.pendentes, ajustes: r.ajustes };
    return m;
  }, [overview]);

  // Self-subscribe: criar conta PF + mandar magic link pra finalizar checkout
  const [selfSubOpen, setSelfSubOpen] = useState(false);
  const [selfSubEmail, setSelfSubEmail] = useState("");
  const [selfSubPlan, setSelfSubPlan] = useState<PlanId>("studio");
  const [selfSubCoupon, setSelfSubCoupon] = useState(partner?.coupon_code ?? "");
  const [selfSubSubmitting, setSelfSubSubmitting] = useState(false);
  const managerEmail = user?.email?.toLowerCase() ?? "";
  const emailIsSameAsManager = !!selfSubEmail.trim() && selfSubEmail.trim().toLowerCase() === managerEmail;

  const handleSelfSubscribe = async () => {
    const email = selfSubEmail.trim();
    if (!email || !email.includes("@")) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (email.toLowerCase() === managerEmail) {
      toast.error("Use um e-mail diferente do seu de gestora.");
      return;
    }
    setSelfSubSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manager-self-subscribe", {
        body: { email, plan: selfSubPlan, partner_code: selfSubCoupon.trim() || undefined },
      });
      if (error || (data as { error?: string })?.error) {
        const code = (data as { error?: string })?.error ?? "unknown";
        if (code === "use_different_email") {
          toast.error("Use um e-mail diferente do seu de gestora.");
        } else if (code === "forbidden_not_manager") {
          toast.error("Apenas gestoras podem usar esse fluxo.");
        } else {
          toast.error("Não foi possível iniciar a assinatura.");
        }
        return;
      }
      toast.success("Enviamos um link pro e-mail PF pra finalizar a assinatura.");
      setSelfSubOpen(false);
      setSelfSubEmail("");
    } catch (e) {
      console.error("[manager-self-subscribe] invoke failed:", e);
      toast.error("Falha ao chamar o servidor.");
    } finally {
      setSelfSubSubmitting(false);
    }
  };

  // Upload de avatar inline (sem abrir o drawer)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const v = validateUpload(file, "avatar");
    if (!v.ok) { toast.error(v.reason); return; }
    const reader = new FileReader();
    reader.onload = () => { setRawImageSrc(reader.result as string); setCropOpen(true); };
    reader.readAsDataURL(file);
  };

  const handleAvatarCropped = async (blob: Blob) => {
    if (!user) return;
    try {
      const path = `${user.id}/avatar.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(path, blob, {
        upsert: true, contentType: "image/jpeg",
      });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const fresh = `${urlData.publicUrl}?t=${Date.now()}`;
      await updateProfile.mutateAsync({ avatar_url: fresh });
      toast.success("Foto atualizada!");
    } catch {
      toast.error("Erro ao enviar a foto.");
    } finally {
      setCropOpen(false);
      setRawImageSrc(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      {!embedded && (
      <header className="px-4 sm:px-6 py-4 flex items-center justify-between border-b border-border">
        <Logo className="h-8 w-auto" />
        <button
          onClick={handleSignOut}
          className="p-2 rounded-xl hover:bg-accent/60 transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Sair"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>
      )}

      {/* Conteúdo */}
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-4xl mx-auto">
          {/* Hero: avatar grande + saudação */}
          <section className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-10">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[3px] shrink-0 hover:scale-[1.02] transition-transform"
              aria-label="Trocar foto"
            >
              <div className="w-full h-full rounded-3xl bg-card overflow-hidden flex items-center justify-center">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-3xl font-display font-extrabold text-primary">
                    {initial(profile?.name)}
                  </span>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary border-2 border-background flex items-center justify-center shadow-sm">
                <Camera className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarSelect}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">
                  {greeting(profile?.name)}
                </h1>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-accent/60 transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="Configurações"
                >
                  <SettingsIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground font-body mt-1">
                Selecione qual cliente você quer gerenciar.
              </p>
            </div>
          </section>

          {/* Stats */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
            <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-display font-extrabold text-foreground tabular-nums">
                  {managedAccounts.length}
                </p>
                <p className="text-xs text-muted-foreground font-body">
                  {managedAccounts.length === 1 ? "cliente" : "clientes"}
                </p>
              </div>
            </div>
          </section>

          {/* Comissões da parceria (só parceira aprovada) */}
          <ApprovalTracker />
          {isPartner && <PartnerCommissions />}

          {/* Cards de cliente */}
          <section className="mb-12">
            <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Suas contas
            </h2>

            {accountsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : managedAccounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-body text-foreground font-medium">
                  Você ainda não gerencia nenhuma conta
                </p>
                <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">
                  Quando uma criadora te convidar pra gerenciar a conta dela, ela aparece aqui.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {managedAccounts.map((account) => (
                  <div
                    key={account.owner_id}
                    className="group rounded-2xl border border-border bg-card p-5 flex flex-col gap-4 hover:shadow-md hover:border-primary/40 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[2px] shrink-0 overflow-hidden">
                        <div className="w-full h-full rounded-2xl bg-card overflow-hidden flex items-center justify-center">
                          {account.avatar_url ? (
                            <img src={account.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <span className="text-lg font-display font-extrabold text-primary">
                              {initial(account.name)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-display font-bold text-foreground truncate">
                          {account.name || "Sem nome"}
                        </p>
                        {account.instagram_handle && (
                          <p className="text-xs text-muted-foreground font-body truncate">
                            @{account.instagram_handle.replace(/^@/, "")}
                          </p>
                        )}
                        {account.niche && (
                          <p className="text-[11px] text-muted-foreground font-body truncate mt-0.5">
                            {account.niche}
                          </p>
                        )}
                      </div>
                    </div>
                    {(() => {
                      const ov = overviewMap[account.owner_id];
                      if (!ov || (ov.pendentes === 0 && ov.ajustes === 0)) return null;
                      const goToApprovals = () => { setActiveAccount(account.owner_id); navigate("/app/aprovacao"); };
                      return (
                        <div className="flex items-center gap-2 flex-wrap">
                          {ov.pendentes > 0 && (
                            <button type="button" onClick={goToApprovals}
                              className="text-[11px] font-body font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-900 border border-yellow-300 hover:bg-yellow-200 transition-colors">
                              {ov.pendentes} aguardando aprovação
                            </button>
                          )}
                          {ov.ajustes > 0 && (
                            <button type="button" onClick={goToApprovals}
                              className="text-[11px] font-body font-semibold px-2 py-1 rounded-full bg-orange-100 text-orange-800 border border-orange-200 hover:bg-orange-200 transition-colors">
                              {ov.ajustes} em ajuste
                            </button>
                          )}
                        </div>
                      );
                    })()}
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setActiveAccount(account.owner_id)}
                        className="flex-1"
                      >
                        Gerenciar <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setNotesAccount(account)}
                        aria-label="Notas do cliente"
                        className="shrink-0"
                      >
                        <StickyNote className="h-4 w-4 mr-1.5" /> Notas
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Minha conta — manager assina o cria pra si */}
          <section className="rounded-2xl border border-border bg-card/50 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display font-semibold text-foreground">
                Quer usar o cria pro seu conteúdo também?
              </p>
              <p className="text-xs text-muted-foreground font-body mt-0.5">
                Crie uma conta de criadora pra você (com e-mail PF) e ganhe ideias, calendário e IA — sem sair daqui.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setSelfSubOpen(true)}
              className="shrink-0"
            >
              Assinar pra mim
            </Button>
          </section>

          {/* Programa de parceiras */}
          {isPartner ? (
            <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-card px-5 py-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Handshake className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-display font-semibold text-foreground flex items-center gap-2">
                    Você é parceira <span aria-hidden>🎉</span>
                  </p>
                  <p className="text-xs text-muted-foreground font-body mt-0.5">
                    Compartilhe seu cupom com seus clientes.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-body font-semibold shrink-0">
                  <Check className="h-3 w-3" /> Aprovada
                </span>
              </div>

              {partner?.coupon_code && (
                <div className="rounded-xl border border-primary/30 bg-background/60 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                    <Ticket className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Seu cupom
                      {partner.coupon_type === "client_discount" && partner.coupon_discount_pct
                        ? ` · ${partner.coupon_discount_pct}% off ${
                            partner.coupon_duration_months && partner.coupon_duration_months > 1
                              ? `por ${partner.coupon_duration_months} meses`
                              : "na 1ª fatura"
                          }`
                        : null}
                    </p>
                    <p className="text-lg font-display font-extrabold text-foreground tracking-wider truncate">
                      {partner.coupon_code}
                    </p>
                  </div>
                  <CopyButton text={partner.coupon_code} />
                </div>
              )}
            </section>
          ) : isPartnerPending ? (
            <section className="rounded-2xl border border-border bg-card/50 px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-display font-semibold text-foreground">
                  Solicitação em análise
                </p>
                <p className="text-xs text-muted-foreground font-body mt-0.5">
                  Vamos te avisar assim que aprovarmos seu cadastro de parceira.
                </p>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-card px-5 py-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Handshake className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-display font-semibold text-foreground">
                    Sabia que você pode usar o cria e ganhar comissão por cada cliente?
                  </p>
                  <p className="text-xs text-muted-foreground font-body mt-0.5">
                    Cadastre-se no programa de parceiras e receba um cupom exclusivo pra suas indicações.
                  </p>
                </div>
                <Button onClick={() => setPartnerOpen(true)} className="shrink-0">
                  Quero ser parceira
                </Button>
              </div>
            </section>
          )}
        </div>
      </main>

      {rawImageSrc && (
        <ImageCropModal
          open={cropOpen}
          onOpenChange={(o) => { setCropOpen(o); if (!o) setRawImageSrc(null); }}
          imageSrc={rawImageSrc}
          onCropComplete={handleAvatarCropped}
          aspectRatio={1}
          cropShape="round"
        />
      )}

      <SettingsManagerDrawer
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      <ClientNotesDrawer
        open={!!notesAccount}
        onOpenChange={(o) => { if (!o) setNotesAccount(null); }}
        ownerId={notesAccount?.owner_id ?? null}
        clientName={notesAccount?.name ?? null}
      />

      <PartnerApplyDrawer open={partnerOpen} onOpenChange={setPartnerOpen} />

      <Dialog open={selfSubOpen} onOpenChange={(o) => !selfSubSubmitting && setSelfSubOpen(o)}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="sm:max-w-md max-h-[85vh] overflow-y-auto rounded-2xl"
        >
          <DialogHeader>
            <DialogTitle className="font-display">Assinar pra mim</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Cria uma conta de criadora num e-mail diferente do seu de gestora. Você recebe um link nesse e-mail pra acessar e finalizar a assinatura.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="font-body text-xs">E-mail PF</Label>
              <Input
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="seu-email-pessoal@exemplo.com"
                value={selfSubEmail}
                onChange={(e) => setSelfSubEmail(e.target.value)}
                disabled={selfSubSubmitting}
                className="rounded-xl"
              />
              {emailIsSameAsManager && (
                <p className="text-[11px] text-destructive font-body">
                  Use um e-mail diferente do seu de gestora ({managerEmail}).
                </p>
              )}
              <p className="text-[11px] text-muted-foreground font-body">
                Você não pode usar o mesmo e-mail da sua conta de gestora.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="font-body text-xs">Plano</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PLANS.map((plan) => {
                  const selected = selfSubPlan === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelfSubPlan(plan.id)}
                      disabled={selfSubSubmitting}
                      className={cn(
                        "text-left rounded-xl border-2 px-3 py-3 transition-all min-w-0",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/30",
                        selfSubSubmitting && "opacity-60 cursor-not-allowed",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="text-sm font-display font-semibold text-foreground truncate">
                          {plan.name}
                        </span>
                        {plan.highlighted && (
                          <span className="text-[9px] uppercase tracking-wider font-body font-semibold text-primary shrink-0">
                            Recomendado
                          </span>
                        )}
                      </div>
                      <p className="text-base font-display font-bold text-foreground mt-1">{plan.price}<span className="text-[10px] text-muted-foreground font-body font-normal">/mês</span></p>
                      <p className="text-[11px] text-muted-foreground font-body mt-0.5 line-clamp-2">{plan.tagline}</p>
                      <ul className="mt-2 space-y-1">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-1.5 text-[11px] font-body text-foreground/85">
                            <Check className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                            <span className="min-w-0 break-words">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            </div>

            {isPartner && partner?.coupon_code && (
              <div className="space-y-1.5">
                <Label className="font-body text-xs">Cupom (seu)</Label>
                <Input
                  value={selfSubCoupon}
                  onChange={(e) => setSelfSubCoupon(e.target.value)}
                  disabled={selfSubSubmitting}
                  className="rounded-xl font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground font-body">
                  Você pode usar o próprio cupom nesse fluxo (exceção ao bloqueio de auto-indicação).
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setSelfSubOpen(false)} disabled={selfSubSubmitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleSelfSubscribe}
              disabled={selfSubSubmitting || emailIsSameAsManager || !selfSubEmail.trim()}
            >
              {selfSubSubmitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
