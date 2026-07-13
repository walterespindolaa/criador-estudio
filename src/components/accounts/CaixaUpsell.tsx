import { Wallet, TrendingUp, Receipt, CalendarClock, Repeat, ArrowRight } from "lucide-react";
import { useModules } from "@/hooks/useModules";
import { useManagerOutlet } from "@/components/accounts/ManagerLayout";
import { Button } from "@/components/ui/button";
import { OrganicBlobs } from "@/components/brand/OrganicBlobs";

// Card de venda do Cria Caixa. Aparece no lugar da aba Financeiro do cliente
// pra quem não assina o módulo. Não é uma porta trancada — é uma vitrine:
// mostra exatamente o que ela ganharia SOBRE ESTE CLIENTE.
const GANHOS = [
  { icon: TrendingUp, t: "Margem real por cliente", d: "Quanto ele paga, quanto você gasta com ele (design, copy, tráfego) e o que sobra de verdade." },
  { icon: Receipt, t: "Imposto mastigado", d: "Você diz o regime (MEI, Simples, Presumido) e o Caixa calcula quanto separar — no mês e por cliente." },
  { icon: Repeat, t: "Entradas e saídas fixas", d: "Cadastre uma vez. Todo mês elas já aparecem previstas, sem você lembrar de nada." },
  { icon: CalendarClock, t: "Calendário de recebimentos", d: "Quem paga dia 10, quem paga dia 15, o que vence semana que vem. Bate o olho e sabe." },
];

export function CaixaUpsell({ clientName }: { clientName: string }) {
  const { modules } = useModules();
  const { openModule } = useManagerOutlet();
  const caixa = modules.find((m) => m.code === "financeiro");

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
      <OrganicBlobs color="azul" />

      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 mb-3">
          <Wallet className="h-3.5 w-3.5" />
          <span className="text-[11px] font-body font-bold uppercase tracking-wider">Exclusivo do Cria Caixa</span>
        </div>

        <h2 className="font-display font-extrabold text-2xl text-foreground tracking-tight">
          {clientName} dá lucro?
        </h2>
        <p className="text-sm font-body text-muted-foreground mt-1.5 max-w-lg">
          Você sabe quanto ele paga. Mas sabe quanto ele <strong className="text-foreground">custa</strong>?
          O Cria Caixa liga o dinheiro a cada cliente e responde a pergunta que decide se vale a pena continuar com ele.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          {GANHOS.map((g) => {
            const Icon = g.icon;
            return (
              <div key={g.t} className="rounded-2xl border border-border bg-background/70 backdrop-blur-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-[13px] font-display font-bold text-foreground">{g.t}</p>
                </div>
                <p className="text-[12px] font-body text-muted-foreground leading-relaxed">{g.d}</p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 mt-6 flex-wrap">
          {caixa && !caixa.coming_soon ? (
            <Button size="lg" onClick={() => openModule(caixa)}>
              Ativar o Cria Caixa <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          ) : (
            <p className="text-[13px] font-body text-muted-foreground">O Cria Caixa está em desenvolvimento.</p>
          )}
          <p className="text-[12px] font-body text-muted-foreground">
            Empresa e pessoal separados, no mesmo lugar.
          </p>
        </div>
      </div>
    </div>
  );
}

export default CaixaUpsell;
