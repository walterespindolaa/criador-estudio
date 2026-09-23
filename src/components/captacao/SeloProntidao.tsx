import { cn } from "@/lib/utils";
import type { Prontidao } from "@/lib/captacao-prontidao";

/* O SELO DE PRONTIDÃO (Captação v4, ciclo 1)
   Um componente só pra o mesmo estado ter a mesma cara no módulo, na ficha do
   cliente e na home. A cor vem do TOM (o que a pessoa precisa fazer), não do
   degrau: "sem roteiro" e "3 sem virar post" são degraus opostos, mas os dois
   pedem ação dela, então os dois são amarelos. Verde é "está bem", cinza é
   "esperando alguém" ou "encerrada". */
const TOM_CLASS: Record<Prontidao["tom"], string> = {
  atencao: "bg-[hsl(var(--cria-amarelo)/0.15)] text-[hsl(var(--cria-amarelo))]",
  espera: "bg-muted text-muted-foreground",
  ok: "bg-[hsl(var(--cria-verde)/0.12)] text-[hsl(var(--cria-verde))]",
  neutro: "bg-muted text-muted-foreground/70",
};

export function SeloProntidao({ p, comDetalhe = false, className }: { p: Prontidao; comDetalhe?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-body font-bold whitespace-nowrap", TOM_CLASS[p.tom], className)}
      title={p.detalhe ?? undefined}>
      {p.rotulo}
      {comDetalhe && p.detalhe && <span className="font-medium opacity-80">· {p.detalhe}</span>}
    </span>
  );
}

/* A linha de texto que acompanha o selo quando há espaço: o detalhe em
   cinza, e o próximo passo em destaque. */
export function LinhaProntidao({ p, className }: { p: Prontidao; className?: string }) {
  if (!p.detalhe && !p.proximoPasso) return null;
  return (
    <span className={cn("min-w-0 truncate text-[11px] font-body", p.tom === "atencao" ? "text-[hsl(var(--cria-amarelo))] font-semibold" : "text-muted-foreground", className)}>
      {p.detalhe ?? p.proximoPasso}
    </span>
  );
}
