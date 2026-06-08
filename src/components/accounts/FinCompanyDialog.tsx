import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useManagerProfile, type FinSettings, type ManagerProfile } from "@/hooks/useModules";
import { cn } from "@/lib/utils";

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

const buildBase = (p: ManagerProfile | null) => ({
  full_name: p?.full_name ?? null, business_name: p?.business_name ?? null, tax_id: p?.tax_id ?? null,
  whatsapp: p?.whatsapp ?? null, billing_email: p?.billing_email ?? null,
  instagram_handle: p?.instagram_handle ?? null, niche: p?.niche ?? null, client_range: p?.client_range ?? null,
});

export function FinCompanyDialog({ open, onOpenChange }: Props) {
  const { profile, save } = useManagerProfile();
  const [s, setS] = useState<FinSettings>({ regime: "mei" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fin = profile?.fin_settings ?? {};
    setS({ regime: "mei", ...fin, companyName: fin.companyName ?? profile?.contract_company?.legalName ?? "" });
  }, [open, profile]);

  const set = (patch: Partial<FinSettings>) => setS((x) => ({ ...x, ...patch }));
  const isMei = (s.regime ?? "mei") === "mei";

  const onSave = async () => {
    setSaving(true);
    try {
      await save.mutateAsync({ ...buildBase(profile), fin_settings: s });
      toast.success("Empresa configurada!");
      onOpenChange(false);
    } catch { toast.error("Erro ao salvar."); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[88vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Minha empresa</DialogTitle>
          <DialogDescription className="font-body text-sm">Usado no lado Empresa (PJ) do Cria Caixa. A régua é só organização, não cálculo fiscal.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome da empresa</Label>
            <Input value={s.companyName ?? ""} onChange={(e) => set({ companyName: e.target.value })} placeholder="Ex: Studio da Bia" className="rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Regime tributário</Label>
            <div className="grid grid-cols-2 gap-2">
              {([["mei", "MEI (DAS fixo)"], ["simples", "Simples (%)"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => set({ regime: v })}
                  className={cn("rounded-xl border-2 px-3 py-2.5 text-sm font-body transition-all", (s.regime ?? "mei") === v ? "border-primary bg-primary/5 text-foreground font-semibold" : "border-border bg-card text-muted-foreground hover:border-primary/30")}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Régua de alocação</p>
            <div className="grid grid-cols-2 gap-3">
              {isMei
                ? <Num label="DAS mensal (R$)" value={s.dasMonthly} onChange={(n) => set({ dasMonthly: n })} />
                : <Num label="Imposto (%)" value={s.taxPct} onChange={(n) => set({ taxPct: n })} />}
              <Num label="Reinvestimento (%)" value={s.reinvestPct} onChange={(n) => set({ reinvestPct: n })} />
              <Num label="Pró-labore (%)" value={s.proLaborePct} onChange={(n) => set({ proLaborePct: n })} />
            </div>
            <p className="text-[11px] text-muted-foreground font-body">No lado PJ, a cada receita o Caixa sugere quanto reservar pra imposto, reinvestir e tirar de pró-labore.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Num({ label, value, onChange }: { label: string; value?: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))} className="rounded-xl bg-card" />
    </div>
  );
}
