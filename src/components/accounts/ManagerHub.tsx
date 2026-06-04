import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Home, Boxes, Handshake, DollarSign, Users, ListChecks, Settings as SettingsIcon,
  LogOut, ArrowRight, Camera, StickyNote, Sparkles, Loader2, Check, Clock, Ticket,
  Send, Users2, Wallet,
} from "lucide-react";
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
import { ModulePopup } from "@/components/accounts/ModulePopup";
import { CopyButton } from "@/components/shared/CopyButton";
import { usePartner } from "@/hooks/usePartner";
import { useModules, type ModuleWithStatus } from "@/hooks/useModules";

type Section = "inicio" | "parceria" | "comissoes" | "contas" | "aprovacoes";
type ApprovalFilter = "pendente" | "ajuste_solicitado" | "aprovado" | null;
const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
const MODICONS: Record<string, typeof Send> = { aprovapost_externo: Send, crm: Users2, financeiro: Wallet };
const CLIENT_STEPS = [5, 10, 15, 20];

function initial(name: string | null | undefined) { return name ? name.trim().charAt(0).toUpperCase() : "?"; }
function greeting(name: string | null | undefined) {
  const first = (name ?? "").trim().split(/\s+/)[0] || "social media";
  const h = new Date().getHours();
  const part = h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
  return `${part}, ${first}!`;
}

export function ManagerHub() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { managedAccounts, accountsLoading, setActiveAccount } = useActiveAccount();
  const { partner, isPartner, isPending: isPartnerPending } = usePartner();
  const { modules } = useModules();

  const [section, setSection] = useState<Section>("inicio");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notesAccount, setNotesAccount] = useState<ManagedAccount | null>(null);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<ModuleWithStatus | null>(null);
  const [invitePartner, setInvitePartner] = useState(false);
  const [inicioLimit, setInicioLimit] = useState(5);
  const [contasLimit, setContasLimit] = useState(5);
  const [apprFilter, setApprFilter] = useState<ApprovalFilter>(null);

  // self-subscribe
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

  // avatar
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
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
      const { error } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateProfile.mutateAsync({ avatar_url: `${urlData.publicUrl}?t=${Date.now()}` });
      toast.success("Foto atualizada!");
    } catch { toast.error("Erro ao enviar a foto."); }
    finally { setCropOpen(false); setRawImageSrc(null); }
  };

  const handleSignOut = async () => { await signOut(); navigate("/"); };
  const goAprovacoes = () => { setSection("aprovacoes"); window.scrollTo(0, 0); };

  const NAV: { key: Section; label: string; icon: typeof Home }[] = [
    { key: "parceria", label: "Parceria", icon: Handshake },
    { key: "comissoes", label: "Comissões", icon: DollarSign },
    { key: "contas", label: "Suas contas", icon: Users },
    { key: "aprovacoes", label: "Acompanhamento de Aprovações", icon: ListChecks },
  ];
  const go = (s: Section) => { setSection(s); window.scrollTo(0, 0); };
  const onNavComissoes = () => { if (isPartner) go("comissoes"); else setInvitePartner(true); };

  const navBtn = (active: boolean) =>
    cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-body text-left transition-colors",
      active ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground");

  /* ---------------- SECTIONS ---------------- */
  const ClientCard = ({ account }: { account: ManagedAccount }) => (
    <div className="group rounded-2xl border border-border bg-card p-5 flex flex-col gap-4 hover:shadow-md hover:border-primary/40 transition-all">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[2px] shrink-0 overflow-hidden">
          <div className="w-full h-full rounded-2xl bg-card overflow-hidden flex items-center justify-center">
            {account.avatar_url ? <img src={account.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
              : <span className="text-lg font-display font-extrabold text-primary">{initial(account.name)}</span>}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-display font-bold text-foreground truncate">{account.name || "Sem nome"}</p>
          {account.instagram_handle && <p className="text-xs text-muted-foreground font-body truncate">@{account.instagram_handle.replace(/^@/, "")}</p>}
          {account.niche && <p className="text-[11px] text-muted-foreground font-body truncate mt-0.5">{account.niche}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => setActiveAccount(account.owner_id)} className="flex-1">Gerenciar <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
        <Button variant="outline" onClick={() => setNotesAccount(account)} aria-label="Notas do cliente" className="shrink-0"><StickyNote className="h-4 w-4 mr-1.5" /> Notas</Button>
      </div>
    </div>
  );

  const ClientSelector = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-xs text-muted-foreground font-body mr-1">Mostrar:</span>
      {CLIENT_STEPS.map((n) => (
        <button key={n} onClick={() => onChange(n)}
          className={cn("px-3.5 py-1.5 rounded-full text-xs font-body font-bold border transition-colors",
            value === n ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground")}>{n}</button>
      ))}
    </div>
  );

  const EmptyClients = () => (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><Users className="h-5 w-5 text-muted-foreground" /></div>
      <p className="text-sm font-body text-foreground font-medium">Você ainda não gerencia nenhuma conta</p>
      <p className="text-xs text-muted-foreground font-body mt-1 max-w-sm mx-auto">Quando uma criadora te convidar pra gerenciar a conta dela, ela aparece aqui.</p>
    </div>
  );

  const SectionTitle = ({ t, s }: { t: string; s?: string }) => (
    <div className="mb-5"><h1 className="text-2xl font-display font-extrabold text-foreground tracking-tight">{t}</h1>{s && <p className="text-sm text-muted-foreground font-body mt-1">{s}</p>}</div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-card/40 px-3 py-5 sticky top-0 h-screen overflow-y-auto">
        <div className="px-2 mb-5"><Logo className="h-8 w-auto" /></div>
        <button className={navBtn(section === "inicio")} onClick={() => go("inicio")}><Home className="h-4 w-4" /> Início</button>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 pt-4 pb-1.5">Módulos</p>
        {modules.map((m) => {
          const Icon = MODICONS[m.code] ?? Boxes;
          const active = m.status === "active" || m.status === "past_due";
          return (
            <button key={m.code} className={navBtn(false)} onClick={() => setSelectedModule(m)}>
              <Icon className="h-4 w-4" /> <span className="flex-1">{m.name}</span>
              <span className={cn("text-[9.5px] font-bold px-2 py-0.5 rounded-full",
                active ? "bg-green-100 text-green-700" : m.coming_soon ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
                {active ? "Ativo" : m.coming_soon ? "Em breve" : brl(m.price_cents)}
              </span>
            </button>
          );
        })}
        <div className="h-px bg-border mx-2 my-3" />
        {NAV.map((n) => {
          const Icon = n.icon;
          const onClick = n.key === "comissoes" ? onNavComissoes : () => go(n.key);
          return <button key={n.key} className={navBtn(section === n.key)} onClick={onClick}><Icon className="h-4 w-4 shrink-0" /> <span className="text-left leading-tight">{n.label}</span></button>;
        })}
        <div className="flex-1" />
        <button className={navBtn(false)} onClick={() => setSettingsOpen(true)}><SettingsIcon className="h-4 w-4" /> Configurações</button>
        <button className={navBtn(false)} onClick={handleSignOut}><LogOut className="h-4 w-4" /> Sair</button>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Nav mobile */}
        <div className="md:hidden flex items-center gap-1 border-b border-border px-3 py-2 overflow-x-auto">
          <button className={cn("px-3 py-1.5 rounded-lg text-sm font-body whitespace-nowrap", section === "inicio" ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground")} onClick={() => go("inicio")}>Início</button>
          {NAV.map((n) => (
            <button key={n.key} className={cn("px-3 py-1.5 rounded-lg text-sm font-body whitespace-nowrap", section === n.key ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground")} onClick={n.key === "comissoes" ? onNavComissoes : () => go(n.key)}>{n.key === "aprovacoes" ? "Aprovações" : n.label}</button>
          ))}
        </div>

        <main className="flex-1 px-4 sm:px-8 py-7 sm:py-10">
          <div className="w-full max-w-3xl mx-auto">

            {/* ---------- INÍCIO ---------- */}
            {section === "inicio" && (
              <div>
                <div className="flex items-center gap-4 mb-8">
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="relative w-[72px] h-[72px] rounded-3xl bg-gradient-to-br from-primary via-purple-600 to-pink-500 p-[3px] shrink-0 hover:scale-[1.02] transition-transform" aria-label="Trocar foto">
                    <div className="w-full h-full rounded-3xl bg-card overflow-hidden flex items-center justify-center">
                      {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        : <span className="text-3xl font-display font-extrabold text-primary">{initial(profile?.name)}</span>}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary border-2 border-background flex items-center justify-center shadow-sm"><Camera className="h-3.5 w-3.5 text-primary-foreground" /></div>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
                  <div className="min-w-0 flex-1">
                    <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">{greeting(profile?.name)}</h1>
                    <p className="text-sm text-muted-foreground font-body mt-1">Aqui está o resumo do seu dia.</p>
                  </div>
                  <button onClick={() => setSettingsOpen(true)} className="hidden sm:flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3 hover:shadow-md transition-all shrink-0">
                    <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center"><SettingsIcon className="h-4 w-4 text-primary" /></span>
                    <span className="text-left"><span className="block text-sm font-display font-semibold text-foreground">Configurações</span><span className="block text-[11px] text-muted-foreground font-body">Perfil, senha, conta</span></span>
                  </button>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider">Aprovações recentes</h2>
                  <button onClick={goAprovacoes} className="text-primary font-body font-bold text-xs flex items-center gap-1 hover:underline">Ver todas <ArrowRight className="h-3 w-3" /></button>
                </div>
                <div className="mb-8"><ApprovalTracker hideHeader limit={5} /></div>

                {isPartner && partner?.coupon_code && (
                  <>
                    <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider mb-3">Seu cupom de parceira</h2>
                    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-card px-4 py-3 flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"><Ticket className="h-5 w-5 text-primary" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Seu cupom</p>
                        <p className="text-lg font-display font-extrabold text-foreground tracking-wider truncate">{partner.coupon_code}</p>
                      </div>
                      <CopyButton text={partner.coupon_code} />
                    </div>
                  </>
                )}

                <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider mb-3">Seus clientes</h2>
                {accountsLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[1, 2].map((i) => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)}</div>
                ) : managedAccounts.length === 0 ? <EmptyClients /> : (
                  <>
                    {managedAccounts.length > 5 && <ClientSelector value={inicioLimit} onChange={setInicioLimit} />}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {managedAccounts.slice(0, inicioLimit).map((a) => <ClientCard key={a.owner_id} account={a} />)}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ---------- PARCERIA ---------- */}
            {section === "parceria" && (
              <div>
                <SectionTitle t="Parceria" s="Indique o Cria pros seus clientes e ganhe comissão recorrente." />
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
              </div>
            )}

            {/* ---------- COMISSÕES (parceira) ---------- */}
            {section === "comissoes" && (
              <div><SectionTitle t="Suas comissões" s="A comissão libera após o cliente pagar a 2ª fatura." /><PartnerCommissions /></div>
            )}

            {/* ---------- SUAS CONTAS ---------- */}
            {section === "contas" && (
              <div>
                <SectionTitle t="Suas contas" s="As contas de clientes que você gerencia." />
                {accountsLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[1, 2].map((i) => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)}</div>
                ) : managedAccounts.length === 0 ? <EmptyClients /> : (
                  <>
                    {managedAccounts.length > 5 && <ClientSelector value={contasLimit} onChange={setContasLimit} />}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{managedAccounts.slice(0, contasLimit).map((a) => <ClientCard key={a.owner_id} account={a} />)}</div>
                  </>
                )}
                <div className="rounded-2xl border border-border bg-card/50 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Sparkles className="h-4 w-4 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-display font-semibold text-foreground">Quer usar o cria pro seu conteúdo também?</p>
                    <p className="text-xs text-muted-foreground font-body mt-0.5">Crie uma conta de criadora pra você (com e-mail PF) e ganhe ideias, calendário e IA.</p>
                  </div>
                  <Button size="sm" onClick={() => setSelfSubOpen(true)} className="shrink-0">Assinar pra mim</Button>
                </div>
              </div>
            )}

            {/* ---------- ACOMPANHAMENTO ---------- */}
            {section === "aprovacoes" && (
              <div>
                <SectionTitle t="Acompanhamento de Aprovações" s="Todas as pendências dos seus clientes num lugar só." />
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {([["Todas", null], ["Em ajuste", "ajuste_solicitado"], ["Pendentes", "pendente"], ["Aprovados", "aprovado"]] as [string, ApprovalFilter][]).map(([label, val]) => (
                    <button key={label} onClick={() => setApprFilter(val)}
                      className={cn("px-3.5 py-1.5 rounded-full text-xs font-body font-bold border transition-colors",
                        apprFilter === val ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground")}>{label}</button>
                  ))}
                </div>
                <ApprovalTracker hideHeader statusFilter={apprFilter} />
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ---------- MODAIS ---------- */}
      <ModulePopup module={selectedModule} onClose={() => setSelectedModule(null)} />

      {/* Popup convite parceria (Comissões sem parceria) */}
      <Dialog open={invitePartner} onOpenChange={setInvitePartner}>
        <DialogContent className="max-w-md rounded-3xl">
          <div className="flex flex-col items-center text-center pt-2">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3"><Handshake className="h-7 w-7 text-primary" /></div>
            <span className="inline-flex items-center gap-1.5 text-xs font-body font-semibold px-3 py-1.5 rounded-full border border-border text-foreground mb-3"><Sparkles className="h-3.5 w-3.5 text-primary" /> Programa de Parceria</span>
            <h2 className="text-xl font-display font-extrabold text-foreground">Ganhe comissão por indicação</h2>
            <p className="text-sm text-muted-foreground font-body mt-1">Use o Cria e seja paga por cada cliente que assinar.</p>
          </div>
          <div className="bg-muted/40 rounded-2xl p-4 mt-5 text-left">
            <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-body font-bold mb-2.5">Como funciona</p>
            <ul className="space-y-2">
              {["Cupom exclusivo só seu", "Comissão recorrente por indicação", "Acompanhe indicações e valores aqui"].map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm font-body text-foreground/90"><Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {b}</li>
              ))}
            </ul>
          </div>
          <Button className="w-full rounded-xl h-12 mt-5" onClick={() => { setInvitePartner(false); setPartnerOpen(true); }}>Quero ser parceira</Button>
        </DialogContent>
      </Dialog>

      {rawImageSrc && (
        <ImageCropModal open={cropOpen} onOpenChange={(o) => { setCropOpen(o); if (!o) setRawImageSrc(null); }}
          imageSrc={rawImageSrc} onCropComplete={handleAvatarCropped} aspectRatio={1} cropShape="round" />
      )}
      <SettingsManagerDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ClientNotesDrawer open={!!notesAccount} onOpenChange={(o) => { if (!o) setNotesAccount(null); }} ownerId={notesAccount?.owner_id ?? null} clientName={notesAccount?.name ?? null} />
      <PartnerApplyDrawer open={partnerOpen} onOpenChange={setPartnerOpen} />

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
