import { ArrowDownUp, ArrowDownNarrowWide, ArrowUpNarrowWide } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrdemDir } from "@/lib/ordenar-por-data";

// Alternador de ORDEM do quadro, no mesmo visual dos chips de filtro que já
// existem no topo dos boards (pill, ativo = primary).
//
// É só EXIBIÇÃO: nada é gravado no banco. Ligar e desligar não bagunça a ordem
// que a pessoa arrastou, ela volta inteira quando o alternador é desligado.
//
// "Por data" agora ALTERNA a direção: o primeiro clique liga (asc, mais antigo
// primeiro) e cada clique seguinte inverte (asc <-> desc). A seta do chip mostra
// o sentido atual. Passa `direcao` + `onToggle` (do useOrdemPorData) pra isso; se
// `onToggle` não vier, o chip cai no comportamento antigo (só liga via onChange).
//
// `rotuloPadrao` diz o que é a ordem de fábrica daquele quadro:
//  - "Ordem manual" nos boards onde dá pra arrastar e a posição é salva;
//  - "Mais recentes" nos boards que não têm ordem manual (a lista vem do banco
//    do mais novo pro mais antigo).
export function OrdemDataToggle({ valor, direcao = "asc", onChange, onToggle, rotuloPadrao = "Ordem manual", className }: {
  valor: boolean;
  direcao?: OrdemDir;
  onChange: (v: boolean) => void;
  onToggle?: () => void;
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

  // Ícone do chip "Por data": desligado mostra o neutro (setas cruzadas); ligado
  // mostra o sentido (asc = crescente/mais antigo em cima; desc = decrescente).
  const Icon = !valor ? ArrowDownUp : direcao === "asc" ? ArrowUpNarrowWide : ArrowDownNarrowWide;
  const dirTxt = direcao === "asc" ? "mais antigos primeiro" : "mais recentes primeiro";
  const titulo = valor
    ? `Ordenado por data (${dirTxt}). Clique pra inverter. Card sem data fica no fim.`
    : "Ordena cada coluna pela data. Card sem data vai pro fim.";

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
        onClick={() => (onToggle ? onToggle() : onChange(true))}
        title={titulo}
        className={chip(valor)}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Por data
      </button>
    </div>
  );
}
