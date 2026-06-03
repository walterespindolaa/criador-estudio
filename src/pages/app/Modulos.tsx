import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useModules, useManagerProfile, useModuleCheckout,
  type ModuleWithStatus, type ManagerProfileInput, type ManagerProfile,
} from "@/hooks/useModules";
import { useManageSubscription } from "@/hooks/useManageSubscription";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Check, Settings2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
const CLIENT_RANGES = ["1", "2-5", "6-15", "15+"];

export default function Modulos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { modules, isLoading } = useModules();
  const { profile, hasProfile, isLoading: loadingProfile, save } = useManagerProfile();
  const checkout = useModuleCheckout();
  const { openPortal, isLoading: portalLoading } = useManageSubscription();

  const [formOpen, setFormOpen] = useState(false);
  const [pendingModule, setPendingModule] = useState<string | null>(null);

  useEffect(() => {
    const c = searchParams.get("checkout");
    if (c === "success") { toast.success("Módulo contratado! Pode levar alguns segundos pra liberar."); setSearchParams({}, { replace: true }); }
    else if (c === "cancel") { toast("Checkout cancelado."); setSearchParams({}, { replace: true }); }
  }, [searchParams, setSearchParams]);

  const startContratar = (code: string) => {
    if (!hasProfile) { setPendingModule(code); setFormOpen(true); return; }
    checkout.mutate(code);
  };

  const onSavedProfile = async (input: ManagerProfileInput) => {
    await save.mutateAsync(input);
    setFormOpen(false);
    const code = pendingModule;
    setPendingModule(null);
    if (code) checkout.mutate(code);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-6">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">Módulos</h1>
        <p className="text-sm text-muted-foreground font-body mt-1">
          Ferramentas extras pra sua operação. Cada módulo é uma assinatura mensal separada — contrate só o que usar, cancele quando quiser.
        </p>
      </header>

      {isLoading || loadingProfile ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {modules.map((m) => (
            <ModuleCard
              key={m.code}
              module={m}
              busy={checkout.isPending || portalLoading}
              onContratar={() => startContratar(m.code)}
              onManage={openPortal}
            />
          ))}
        </div>
      )}

      <ManagerProfileForm
        open={formOpen}
        initial={profile}
        saving={save.isPending}
        onClose={() => { setFormOpen(false); setPendingModule(null); }}
        onSave={onSavedProfile}
      />
    </div>
  );
}

function ModuleCard({ module: m, busy, onContratar, onManage }: {
  module: ModuleWithStatus; busy: boolean; onContratar: () => void; onManage: () => void;
}) {
  const active = m.status === "active";
  const pastDue = m.status === "past_due";
  return (
    <div className="bg-card rounded-2xl border border-border shadow-warm-sm p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h2 className="font-display font-bold text-lg text-foreground">{m.name}</h2>
        {active && <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100"><Check className="h-3 w-3 mr-1" />Ativo</Badge>}
        {pastDue && <Badge className="bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100">Pagamento pendente</Badge>}
      </div>
      <p className="text-sm text-muted-foreground font-body flex-1">{m.description}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="font-display font-bold text-foreground">
          {brl(m.price_cents)}<span className="text-xs text-muted-foreground font-body font-normal">/mês</span>
        </span>
        {active || pastDue ? (
          <Button variant="outline" size="sm" onClick={onManage} disabled={busy}>
            <Settings2 className="h-4 w-4 mr-1.5" /> Gerenciar
          </Button>
        ) : (
          <Button size="sm" onClick={onContratar} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Contratar"}
          </Button>
        )}
      </div>
    </div>
  );
}

function ManagerProfileForm({ open, initial, saving, onClose, onSave }: {
  open: boolean;
  initial: ManagerProfile | null;
  saving: boolean;
  onClose: () => void;
  onSave: (input: ManagerProfileInput) => void;
}) {
  const [f, setF] = useState<ManagerProfileInput>({
    full_name: "", business_name: "", tax_id: "", whatsapp: "",
    billing_email: "", instagram_handle: "", niche: "", client_range: "",
  });

  useEffect(() => {
    if (open) {
      setF({
        full_name: initial?.full_name ?? "",
        business_name: initial?.business_name ?? "",
        tax_id: initial?.tax_id ?? "",
        whatsapp: initial?.whatsapp ?? "",
        billing_email: initial?.billing_email ?? "",
        instagram_handle: initial?.instagram_handle ?? "",
        niche: initial?.niche ?? "",
        client_range: initial?.client_range ?? "",
      });
    }
  }, [open, initial]);

  const set = (k: keyof ManagerProfileInput, v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = () => {
    if (!f.full_name?.trim() || !f.whatsapp?.trim()) { toast.error("Preencha ao menos nome e WhatsApp."); return; }
    onSave(f);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Complete seu cadastro</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground font-body -mt-2 mb-2">Preenchido uma vez só — usamos nos próximos módulos também.</p>
        <div className="space-y-3">
          <Field label="Nome completo *"><Input value={f.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} /></Field>
          <Field label="Nome profissional / marca"><Input value={f.business_name ?? ""} onChange={(e) => set("business_name", e.target.value)} /></Field>
          <Field label="CPF ou CNPJ (opcional)"><Input value={f.tax_id ?? ""} onChange={(e) => set("tax_id", e.target.value)} /></Field>
          <Field label="WhatsApp *"><Input value={f.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(00) 00000-0000" /></Field>
          <Field label="E-mail de cobrança"><Input type="email" value={f.billing_email ?? ""} onChange={(e) => set("billing_email", e.target.value)} /></Field>
          <Field label="@ do Instagram"><Input value={f.instagram_handle ?? ""} onChange={(e) => set("instagram_handle", e.target.value)} placeholder="@seuperfil" /></Field>
          <Field label="Nicho / especialidade"><Input value={f.niche ?? ""} onChange={(e) => set("niche", e.target.value)} /></Field>
          <Field label="Quantos clientes você atende?">
            <div className="flex gap-2 flex-wrap">
              {CLIENT_RANGES.map((r) => (
                <button key={r} type="button" onClick={() => set("client_range", r)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-body border transition-colors ${f.client_range === r ? "bg-primary text-primary-foreground border-primary" : "bg-transparent border-border text-muted-foreground hover:text-foreground"}`}>
                  {r}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar e continuar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-body text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
