import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useManagerProfile, type ContractCompany, type ManagerProfile } from "@/hooks/useModules";
import { cn } from "@/lib/utils";

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

const buildBase = (p: ManagerProfile | null) => ({
  full_name: p?.full_name ?? null, business_name: p?.business_name ?? null, tax_id: p?.tax_id ?? null,
  whatsapp: p?.whatsapp ?? null, billing_email: p?.billing_email ?? null,
  instagram_handle: p?.instagram_handle ?? null, niche: p?.niche ?? null, client_range: p?.client_range ?? null,
});

export function ManagerCompanyDialog({ open, onOpenChange }: Props) {
  const { profile, save } = useManagerProfile();
  const [cc, setCc] = useState<ContractCompany>({ personType: "pj" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setCc({ personType: "pj", ...(profile?.contract_company ?? {}) }); }, [open, profile]);

  const set = (patch: Partial<ContractCompany>) => setCc((c) => ({ ...c, ...patch }));
  const isPj = (cc.personType ?? "pj") === "pj";

  const onSave = async () => {
    setSaving(true);
    try {
      await save.mutateAsync({ ...buildBase(profile), contract_company: cc });
      toast.success("Dados da empresa salvos!");
      onOpenChange(false);
    } catch { toast.error("Erro ao salvar."); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Dados da minha empresa</DialogTitle>
          <DialogDescription className="font-body text-sm">Usados como CONTRATADA nos contratos que você gerar. Preenche uma vez e reusa.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Você recebe como</Label>
            <div className="grid grid-cols-2 gap-2">
              {([["pj", "CNPJ (pessoa jurídica)", Building2], ["pf", "CPF (pessoa física)", User]] as const).map(([v, l, Icon]) => (
                <button key={v} type="button" onClick={() => set({ personType: v })}
                  className={cn("flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-body transition-all", (cc.personType ?? "pj") === v ? "border-primary bg-primary/5 text-foreground font-semibold" : "border-border bg-card text-muted-foreground hover:border-primary/30")}>
                  <Icon className="h-4 w-4 shrink-0" /> {l}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Fld label={isPj ? "Razão social" : "Nome completo"} full><Input value={cc.legalName ?? ""} onChange={(e) => set({ legalName: e.target.value })} className="rounded-xl" /></Fld>
            <Fld label={isPj ? "CNPJ" : "CPF"}><Input value={cc.document ?? ""} onChange={(e) => set({ document: e.target.value })} className="rounded-xl" /></Fld>
            <Fld label="CEP"><Input value={cc.cep ?? ""} onChange={(e) => set({ cep: e.target.value })} className="rounded-xl" /></Fld>
            <Fld label="Endereço (rua, nº, complemento)" full><Input value={cc.address ?? ""} onChange={(e) => set({ address: e.target.value })} className="rounded-xl" /></Fld>
            <Fld label="Cidade"><Input value={cc.city ?? ""} onChange={(e) => set({ city: e.target.value })} className="rounded-xl" /></Fld>
            <Fld label="UF"><Input value={cc.uf ?? ""} onChange={(e) => set({ uf: e.target.value })} maxLength={2} className="rounded-xl" /></Fld>
          </div>

          {isPj && (
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Representante (quem assina pela empresa)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Fld label="Nome do representante" full><Input value={cc.repName ?? ""} onChange={(e) => set({ repName: e.target.value })} className="rounded-xl" /></Fld>
                <Fld label="Nacionalidade"><Input value={cc.repNationality ?? ""} onChange={(e) => set({ repNationality: e.target.value })} placeholder="brasileira" className="rounded-xl" /></Fld>
                <Fld label="Profissão"><Input value={cc.repProfession ?? ""} onChange={(e) => set({ repProfession: e.target.value })} placeholder="empresária" className="rounded-xl" /></Fld>
                <Fld label="RG"><Input value={cc.repRg ?? ""} onChange={(e) => set({ repRg: e.target.value })} className="rounded-xl" /></Fld>
                <Fld label="CPF do representante"><Input value={cc.repCpf ?? ""} onChange={(e) => set({ repCpf: e.target.value })} className="rounded-xl" /></Fld>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Fld({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn("space-y-1.5", full && "sm:col-span-2")}><Label className="text-xs">{label}</Label>{children}</div>;
}
