import { Check, Minus } from "lucide-react";
import { PLANS, tierAtLeast, type PlanId, type Tier } from "@/lib/plans";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   O COMPARATIVO

   Os três cards dizem o que CADA plano tem. Só que a pergunta que a pessoa faz
   na hora de decidir é outra: "o que eu PERCO se pegar o mais barato?", e isso
   um card sozinho não responde, porque ela teria que comparar três listas na
   cabeça.

   A tabela responde. E ela é montada a partir do MESMO tier mínimo que a trava
   usa (lib/plans.ts). Se um recurso mudar de plano no código, a tabela muda
   junto. Tabela de preço desatualizada é processo do Procon esperando acontecer.

   ─── E NO CELULAR? ─────────────────────────────────────────────────────────
   Tabela de 4 colunas em tela de 390px não existe. O que existia era um
   overflow-x: a pessoa via a coluna do Essencial e um monte de traço, e tinha
   que ARRASTAR pro lado pra descobrir o que o Pro tinha. Ninguém arrasta. Ela
   olhava, via traço em quase tudo, e ia embora achando que o produto é pobre.

   No celular a mesma verdade vira uma ESCADA: o que já vem no Essencial, o que
   entra no Pro, o que só tem no Studio. Zero arrasto, e o degrau fica óbvio,
   que é exatamente o que a gente quer que ela veja.
   ═══════════════════════════════════════════════════════════════════════════ */

type Linha = { label: string; minimo: Tier; nota?: string };

const LINHAS: Linha[] = [
  { label: "Banco de ideias, kanban, calendário e tarefas", minimo: "essencial" },
  { label: "Brandbook e Link in Bio", minimo: "essencial" },
  { label: "Aprovar o que a sua agência mandou", minimo: "essencial" },
  // A IA existe nos TRÊS planos, muda a cota. Marcar como "só do Pro" (com um
  // traço no Essencial) era mentira ao contrário: o Essencial tem 10 gerações.
  { label: "Cria IA: legendas, roteiros, ideias e score", minimo: "essencial", nota: "10 no Essencial · 150 no Pro · 500 no Studio" },
  { label: "Armazenamento", minimo: "essencial", nota: "500 MB · 5 GB · 15 GB" },
  { label: "Insights do Instagram e Meu Feed", minimo: "pro" },
  { label: "Melhor horário pra postar", minimo: "pro" },
  { label: "Tendências do seu nicho", minimo: "pro" },
  { label: "Media Kit automático", minimo: "pro" },
  { label: "Relatórios, Biblioteca e Histórico", minimo: "pro" },
  { label: "Cria Plano: a IA monta o seu mês", minimo: "studio" },
  { label: "Cria Stories: o plano semanal de stories", minimo: "studio" },
  { label: "Collabs: parcerias, propostas e cachê", minimo: "studio" },
];

const DEGRAUS: { id: PlanId; titulo: string }[] = [
  { id: "essencial", titulo: "Já no Essencial" },
  { id: "pro", titulo: "Entra no Pro" },
  { id: "studio", titulo: "Só no Studio" },
];

export function PlanComparison({ className }: { className?: string }) {
  return (
    <div className={cn("w-full max-w-4xl mx-auto", className)}>
      <p className="text-center text-sm font-display font-bold uppercase tracking-wider text-muted-foreground mb-4">
        O que muda de um plano pro outro
      </p>

      {/* ── CELULAR: a escada ─────────────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {DEGRAUS.map(({ id, titulo }) => {
          const plano = PLANS.find((p) => p.id === id)!;
          const linhas = LINHAS.filter((l) => l.minimo === id);
          if (linhas.length === 0) return null;
          const destaque = plano.highlighted;

          return (
            <div
              key={id}
              className={cn(
                "rounded-2xl border bg-card overflow-hidden",
                destaque ? "border-primary/50 ring-1 ring-primary/20" : "border-border",
              )}
            >
              <div
                className={cn(
                  "flex items-baseline justify-between gap-2 px-4 py-3 border-b",
                  destaque ? "bg-primary/5 border-primary/20" : "bg-muted/40 border-border",
                )}
              >
                <span className="text-[13px] font-display font-extrabold text-foreground">{titulo}</span>
                <span className="text-[12px] font-body font-semibold text-muted-foreground tabular-nums">
                  {plano.price}<span className="opacity-70">/mês</span>
                </span>
              </div>

              <ul className="divide-y divide-border/60">
                {linhas.map((l) => (
                  <li key={l.label} className="flex items-start gap-2.5 px-4 py-2.5">
                    <span className="mt-0.5 inline-grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-body text-foreground leading-snug">{l.label}</span>
                      {l.nota && (
                        <span className="block text-[11.5px] font-body text-muted-foreground mt-0.5">{l.nota}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <p className="text-center text-[12px] font-body text-muted-foreground pt-1">
          Cada plano tem tudo do anterior. Você sobe, desce ou cancela quando quiser.
        </p>
      </div>

      {/* ── DESKTOP: a tabela ─────────────────────────────────────────────── */}
      <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-left">
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

      <p className="hidden md:block text-center text-[12px] font-body text-muted-foreground mt-3">
        Você troca de plano ou cancela quando quiser, sem falar com ninguém.
      </p>
    </div>
  );
}

export default PlanComparison;
