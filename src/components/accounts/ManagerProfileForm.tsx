import { useEffect, useState, type ReactNode } from "react";
import type { ManagerProfile, ManagerProfileInput } from "@/hooks/useModules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const CLIENT_RANGES = ["1", "2-5", "6-15", "15+"];

export function ManagerProfileForm({ open, initial, saving, onClose, onSave }: {
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
    if (open) setF({
      full_name: initial?.full_name ?? "", business_name: initial?.business_name ?? "",
      tax_id: initial?.tax_id ?? "", whatsapp: initial?.whatsapp ?? "",
      billing_email: initial?.billing_email ?? "", instagram_handle: initial?.instagram_handle ?? "",
      niche: initial?.niche ?? "", client_range: initial?.client_range ?? "",
    });
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
                  className={`px-3 py-1.5 rounded-lg text-sm font-body border transition-colors ${f.client_range === r ? "bg-primary text-primary-foreground border-primary" : "bg-transparent border-border text-muted-foreground hover:text-foreground"}`}>{r}</button>
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
  return (<div className="space-y-1"><Label className="text-xs font-body text-muted-foreground">{label}</Label>{children}</div>);
}
