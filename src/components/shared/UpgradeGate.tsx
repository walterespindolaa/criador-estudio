import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Check, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrganicBlobs } from "@/components/brand/OrganicBlobs";
import { useTier } from "@/hooks/useTier";
import { FEATURES, PLANS, tierAtLeast, type FeatureKey } from "@/lib/plans";

/* ═══════════════════════════════════════════════════════════════════════════
   A TRAVA QUE VENDE

   Este componente existia e NUNCA foi usado. Cada página inventava a própria
   trava e o Collabs, por exemplo, dava <Navigate to="/app/assinar">: porta na
   cara. A pessoa clicou EM COLLABS. Ela queria Collabs. Jogar ela numa tabela
   de preços genérica é desperdiçar o melhor momento de venda que existe.

   Agora a trava mostra exatamente o que ela ganharia NAQUELA tela, com o CTA
   do plano certo. Uma fonte de verdade (FEATURES em lib/plans.ts) diz o tier
   mínimo e o texto. Página nenhuma decide isso sozinha de novo.
   ═══════════════════════════════════════════════════════════════════════════ */

export function UpgradeGate({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { tier, isAdmin, isLoading } = useTier();
  const navigate = useNavigate();
  const def = FEATURES[feature];

  if (isLoading || !def) return null;

  // "admin": recurso que custa dinheiro de verdade e ainda não virou produto
  // (o Estúdio gera imagem por IA). Fica trancado até ter cota e preço.
  if (def.minimo === "admin") {
    if (isAdmin) return <>{children}</>;
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-6">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground mb-4">
          <Clock className="h-6 w-6" />
        </span>
        <h3 className="font-display text-xl font-extrabold text-foreground mb-1.5">{def.titulo}</h3>
        <p className="text-sm font-body text-muted-foreground max-w-sm">{def.linha}</p>
      </div>
    );
  }

  if (tierAtLeast(tier, def.minimo)) return <>{children}</>;

  const plano = PLANS.find((p) => p.id === def.minimo);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-10 my-4">
      <OrganicBlobs color={def.minimo === "studio" ? "lilas" : "laranja"} />

      <div className="relative max-w-xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 mb-3">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="text-[11px] font-body font-bold uppercase tracking-wider">
            {plano ? `Está no ${plano.name}` : "Faça upgrade"}
          </span>
        </span>

        <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          {def.titulo}
        </h2>
        <p className="mt-2 text-sm font-body text-muted-foreground leading-relaxed">{def.linha}</p>

        <ul className="mt-5 space-y-2.5">
          {def.ganhos.map((g) => (
            <li key={g} className="flex items-start gap-2.5 text-sm font-body text-foreground">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-black text-secondary-foreground">
                <Check className="h-3 w-3" />
              </span>
              {g}
            </li>
          ))}
        </ul>

        <div className="mt-7 flex items-center gap-3 flex-wrap">
          <Button size="lg" onClick={() => navigate(`/app/assinar?plano=${def.minimo}`)}>
            {plano ? `Liberar por ${plano.price}/mês` : "Fazer upgrade"}
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
          {plano && (
            <p className="text-[12px] font-body text-muted-foreground">
              {plano.tagline}. Cancela quando quiser.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default UpgradeGate;
