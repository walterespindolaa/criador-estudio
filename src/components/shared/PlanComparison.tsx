import { Check, Minus } from "lucide-react";
import { PLANS, tierAtLeast, type Tier } from "@/lib/plans";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   O COMPARATIVO

   Os três cards dizem o que CADA plano tem. Só que a pergunta que a pessoa faz
   na hora de decidir é outra: "o que eu PERCO se pegar o mais barato?" — e isso
   um card sozinho não responde, porque ela teria que comparar três listas na
   cabeça.

   A tabela responde. E ela é montada a partir do MESMO tier mínimo que a trava
   usa (lib/plans.ts). Se um recurso mudar de plano no código, a tabela muda
   junto. Tabela de preço desatualizada é processo do Procon esperando acontecer.
   ═══════════════════════════════════════════════════════════════════════════ */

type Linha = { label: string; minimo: Tier; nota?: string };

const LINHAS: Linha[] = [
  { label: "Banco de ideias, kanban, calendário e tarefas", minimo: "essencial" },
  { label: "Brandbook e Link in Bio", minimo: "essencial" },
  { label: "Aprovar o que a sua agência mandou", minimo: "essencial" },
  { label: "Cria IA: legendas, roteiros, ideias e score", minimo: "pro", nota: "10 · 150 · 500 por mês" },
  { label: "Insights do Instagram e Meu Feed", minimo: "pro" },
  { label: "Melhor horário pra postar", minimo: "pro" },
  { label: "Tendências do seu nicho", minimo: "pro" },
  { label: "Media Kit automático", minimo: "pro" },
  { label: "Relatórios, Biblioteca e Histórico", minimo: "pro" },
  { label: "Cria Plano: a IA monta o seu mês", minimo: "studio" },
  { label: "Cria Stories: o plano semanal de stories", minimo: "studio" },
  { label: "Collabs: parcerias, propostas e cachê", minimo: "studio" },
  { label: "Armazenamento", minimo: "essencial", nota: "500 MB · 5 GB · 15 GB" },
];

export function PlanComparison({ className }: { className?: string }) {
  return (
    <div className={cn("w-full max-w-4xl mx-auto", className)}>
      <p className="text-center text-sm font-display font-bold uppercase tracking-wider text-muted-foreground mb-4">
        O que muda de um plano pro outro
      </p>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-[12px] font-body font-semibold text-muted-foreground">Recurso</th>
              {PLANS.map((p) => (
                <th key={p.id} className="px-3 py-3 text-center">
                  <span className="block text-[13px] font-display font-extrabold text-foreground">
                    {p.name.replace("cria ", "")}
                  </span>
                  <span className="block text-[11px] font-body text-muted-foreground">{p.price}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINHAS.map((l) => (
              <tr key={l.label} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  <span className="block text-[13px] font-body text-foreground">{l.label}</span>
                  {l.nota && (
                    <span className="block text-[11px] font-body text-muted-foreground mt-0.5">{l.nota}</span>
                  )}
                </td>
                {PLANS.map((p) => {
                  const tem = tierAtLeast(p.id as Tier, l.minimo);
                  return (
                    <td key={p.id} className="px-3 py-3 text-center">
                      {tem ? (
                        <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-center text-[12px] font-body text-muted-foreground mt-3">
        Você troca de plano ou cancela quando quiser, sem falar com ninguém.
      </p>
    </div>
  );
}

export default PlanComparison;
