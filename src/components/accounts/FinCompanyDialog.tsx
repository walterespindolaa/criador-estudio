import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useManagerProfile, type FinSettings, type ManagerProfile } from "@/hooks/useModules";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { REGIMES } from "@/lib/finance";
import { cn } from "@/lib/utils";

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

const buildBase = (p: ManagerProfile | null) => ({
  full_name: p?.full_name ?? null, business_name: p?.business_name ?? null, tax_id: p?.tax_id ?? null,
  whatsapp: p?.whatsapp ?? null, billing_email: p?.billing_email ?? null,
  instagram_handle: p?.instagram_handle ?? null, niche: p?.niche ?? null, client_range: p?.client_range ?? null,
});

export function FinCompanyDialog({ open, onOpenChange }: Props) {
  const { profile, save } = useManagerProfile();
  const [s, setS] = useState<FinSettings>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fin = profile?.fin_settings ?? {};
    // Não assumimos regime: chutar "MEI" pra quem é Simples entrega um imposto errado.
    setS({ ...fin, companyName: fin.companyName ?? profile?.contract_company?.legalName ?? "" });
  }, [open, profile]);

  const set = (patch: Partial<FinSettings>) => setS((x) => ({ ...x, ...patch }));
  const isMei = s.regime === "mei";

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
            <div className="grid grid-cols-3 gap-2">
              {REGIMES.map((r) => (
                <button key={r.v} type="button" onClick={() => set({ regime: r.v })}
                  className={cn("rounded-xl border-2 px-2 py-2.5 text-center transition-all", s.regime === r.v ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30")}>
                  <span className={cn("block text-[13px] font-body", s.regime === r.v ? "text-foreground font-semibold" : "text-muted-foreground")}>{r.label}</span>
                  <span className="block text-[10px] font-body text-muted-foreground leading-tight mt-0.5">{r.hint}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] font-body text-muted-foreground">
              É isso que permite o Caixa calcular o imposto do mês <strong>e por cliente</strong>.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Régua de alocação</p>
            <div className="grid grid-cols-2 gap-3">
              {!s.regime ? (
                <p className="col-span-2 text-[12px] font-body text-muted-foreground">Escolha o regime acima pra liberar o campo de imposto.</p>
              ) : isMei ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">DAS mensal</Label>
                  <MoneyInput value={s.dasMonthly ?? null} onChange={(n) => set({ dasMonthly: n ?? 0 })} className="bg-card" />
                </div>
              ) : (
                <Num label="Alíquota efetiva (%)" value={s.taxPct} onChange={(n) => set({ taxPct: n })} />
              )}
              <Num label="Reinvestimento (%)" value={s.reinvestPct} onChange={(n) => set({ reinvestPct: n })} />
              <Num label="Pró-labore (%)" value={s.proLaborePct} onChange={(n) => set({ proLaborePct: n })} />
            </div>
            <p className="text-[11px] text-muted-foreground font-body">
              No lado PJ, a cada receita o Caixa sugere quanto reservar pra imposto, reinvestir e tirar de pró-labore.
              É <strong>organização</strong>, não apuração fiscal — confirme os números com sua contabilidade.
            </p>
          </div>

          {/* Meta de reserva — é o que faz a barra da Pessoa Física te cobrar. */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pessoa física</p>
            <Num label="Quero guardar por mês (%)" value={s.reservePct} onChange={(n) => set({ reservePct: n })} />
            <p className="text-[11px] text-muted-foreground font-body">
              Quanto da sua renda pessoal você quer guardar. A tela Pessoal mostra a barra da meta e o quanto sobrou de verdade,
              já descontando as contas fixas que ainda vão cair.
            </p>
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
