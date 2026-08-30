import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Check, Loader2, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { PLANS, type PlanId } from "@/lib/plans";
import { BotaoDestravarGestao } from "@/pages/parceiro/Modulo";

/* ═══════════════════════════════════════════════════════════════════════════
   PLANOS, NA CASCA DO PARCEIRO

   O caminho antigo mandava o parceiro pro /app/assinar: a página de planos de
   CRIADOR, embrulhada no menu de criador, com a barra de "gerenciando conta"
   travada por cima. O Walter pegou na hora: misturava dois produtos e não
   tinha volta.

   Aqui a separação é explícita, porque são caminhos DIFERENTES:
   1. Gerenciar clientes próprios como os das agências = conta de GESTÃO
      (social mídia), que é gratuita pra começar.
   2. Tocar a própria marca como criador de conteúdo = planos do Cria criador.
   E acima de tudo: o trabalho vindo das agências é grátis pra sempre.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function PlanosParceiro() {
  const navigate = useNavigate();
  const [assinando, setAssinando] = useState<string | null>(null);

  const assinar = async (planId: PlanId) => {
    if (assinando) return;
    setAssinando(planId);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", { body: { plan: planId } });
      if (error) throw error;
      if (data?.url) { window.location.href = data.url; return; }
      throw new Error("checkout sem URL");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui abrir o checkout.");
      setAssinando(null);
    }
  };

  return (
    <div className="pb-10">
      <Card className="rounded-2xl border-border p-4 mb-5 bg-green-50/60 border-green-200">
        <p className="text-[13px] font-body text-green-900 leading-relaxed">
          <b>O seu trabalho pras agências continua grátis pra sempre.</b> Nada aqui muda isso: os
          cards que a social mídia manda, o quadro, a semana e o histórico de entregas são seus sem
          pagar nada. Os caminhos abaixo são pra quando você quiser IR ALÉM do trabalho delegado.
        </p>
      </Card>

      {/* ── Caminho 1: carteira própria = conta de gestão (grátis) ── */}
      <Card className="rounded-2xl border-border p-5 mb-5">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-pink-100 text-pink-600 grid place-items-center shrink-0">
            <Users className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-extrabold text-[16px]">Gerenciar os seus próprios clientes</p>
            <p className="text-[13px] font-body text-muted-foreground mt-1 leading-relaxed max-w-2xl">
              Se você fecha jobs direto (sem passar por agência), o caminho é o mesmo das social
              mídias que te contratam: a conta de gestão do Cria, com CRM, kanban por cliente,
              aprovação, agenda e financeiro. Ela é <b className="text-foreground">gratuita pra começar</b>,
              e você só paga quando a carteira crescer.
            </p>
            {/* Um clique, sem tela intermediária: o parceiro já é uma conta
                de gestão apontada pra parceiros; aqui ele só liga o outro
                lado do mesmo login. */}
            <div className="mt-3"><BotaoDestravarGestao destinoAposAtivar="/socialmidia/dashboard" /></div>
          </div>
        </div>
      </Card>

      {/* ── Caminho 2: a própria marca = planos do Cria criador ── */}
      <div className="flex items-center gap-2 mb-1 px-0.5">
        <Briefcase className="h-4 w-4 text-primary" />
        <p className="font-display font-extrabold text-[16px]">Pra tocar a SUA marca como criador</p>
      </div>
      <p className="text-[12.5px] font-body text-muted-foreground mb-3 px-0.5 max-w-2xl leading-relaxed">
        Outro produto, outra assinatura: os planos do Cria criador são pra quem também produz
        conteúdo próprio (ideias, calendário, IA, link na bio, media kit).
      </p>
      <div className="grid md:grid-cols-3 gap-4 items-start">
        {PLANS.map((plan) => (
          <Card key={plan.id} className="rounded-2xl border-border p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">{plan.verbo}</p>
            <p className="font-display font-extrabold text-[17px] mt-0.5">{plan.name}</p>
            <p className="text-[12px] font-body text-muted-foreground mt-0.5">{plan.tagline}</p>
            <p className="font-display font-extrabold text-2xl mt-3">{plan.price}<span className="text-[12px] font-body font-medium text-muted-foreground"> /mês</span></p>
            <ul className="mt-3 space-y-1.5">
              {plan.features.slice(0, 5).map((f) => (
                <li key={f} className="flex items-start gap-1.5 text-[12px] font-body text-muted-foreground">
                  <Check className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
            <Button variant="outline" className={cn("w-full mt-4 rounded-xl", plan.id === "pro" && "border-primary text-primary")}
              disabled={!!assinando} onClick={() => void assinar(plan.id)}>
              {assinando === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-1.5" /> Assinar</>}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
