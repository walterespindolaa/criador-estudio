import { ArrowDownUp } from "lucide-react";
import { cn } from "@/lib/utils";

// Alternador de ORDEM do quadro, no mesmo visual dos chips de filtro que já
// existem no topo dos boards (pill, ativo = primary).
//
// É só EXIBIÇÃO: nada é gravado no banco. Ligar e desligar não bagunça a ordem
// que a pessoa arrastou, ela volta inteira quando o alternador é desligado.
//
// `rotuloPadrao` diz o que é a ordem de fábrica daquele quadro:
//  - "Ordem manual" nos boards onde dá pra arrastar e a posição é salva;
//  - "Mais recentes" nos boards que não têm ordem manual (a lista vem do banco
//    do mais novo pro mais antigo).
export function OrdemDataToggle({ valor, onChange, rotuloPadrao = "Ordem manual", className }: {
  valor: boolean;
  onChange: (v: boolean) => void;
  rotuloPadrao?: string;
  className?: string;
}) {
  const chip = (ativo: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 text-xs font-body font-semibold px-3 py-1.5 rounded-full border transition-colors",
      ativo
        ? "bg-primary text-primary-foreground border-primary"
        : "border-border text-muted-foreground hover:text-foreground",
    );

  return (
    <div role="group" aria-label="Ordem dos cards" className={cn("inline-flex items-center gap-1.5", className)}>
      <button
        type="button"
        aria-pressed={!valor}
        onClick={() => onChange(false)}
        title={rotuloPadrao === "Ordem manual" ? "Mantém os cards na ordem em que você arrastou" : "Ordem padrão do quadro"}
        className={chip(!valor)}
      >
        {rotuloPadrao}
      </button>
      <button
        type="button"
        aria-pressed={valor}
        onClick={() => onChange(true)}
        title="Ordena cada coluna pela data, do mais próximo pro mais distante. Card sem data vai pro fim."
        className={chip(valor)}
      >
        <ArrowDownUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Por data
      </button>
    </div>
  );
}
