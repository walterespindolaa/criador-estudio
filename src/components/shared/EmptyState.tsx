import type { ElementType } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { OrganicBlobs } from "@/components/brand/OrganicBlobs";
import { Sticker, type StickerName } from "@/components/shared/Sticker";
import type { CriaColor } from "@/lib/moduleTheme";

/* ═══════════════════════════════════════════════════════════════════════════
   O ESTADO VAZIO

   Este componente EXISTIA e era usado em UM lugar (Collabs). Metade das telas
   do sistema não dizia nada quando estava vazia — inclusive "Minhas Ideias",
   que é literalmente a primeira coisa que um criador abre. Ela chegava na
   primeira semana, via um branco, e concluía que tinha quebrado.

   Estado vazio não é enfeite. Pra quem acabou de assinar, ele é o ÚNICO
   onboarding que a pessoa lê de verdade. As regras que este componente força:

   1. O título é um CONVITE, não um lamento. "Comece pelo caos da sua cabeça",
      nunca "Nenhuma ideia encontrada". Ela já sabe que está vazio — o que ela
      não sabe é o que fazer.
   2. Uma linha dizendo PRA QUE serve a tela. É a chance de ensinar.
   3. Um botão, com VERBO. Um só: duas escolhas diante do vazio é ansiedade.
   4. Exemplos, quando ajudam. O campo em branco é a pior parte de começar.
   ═══════════════════════════════════════════════════════════════════════════ */

type EmptyStateProps = {
  icon: ElementType;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  /** Cor do módulo (as formas orgânicas atrás). */
  cor?: CriaColor;
  /** O que ela poderia escrever aqui. Mata o medo da folha em branco. */
  examples?: string[];
  /** Um caminho alternativo, discreto (link, "ou importe do Drive"...). */
  secondary?: ReactNode;
  /** Sticker da marca no lugar do ícone (a CriaTura acolhe melhor que um traço). */
  sticker?: StickerName;
  /** Selo bem apagado num canto do container. Tempero, dose comedida. */
  cornerSticker?: StickerName;
  /** @deprecated a cor vem do módulo agora. Mantido pra não quebrar o Collabs. */
  gradient?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  cor = "laranja",
  examples,
  secondary,
  sticker,
  cornerSticker,
}: EmptyStateProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <OrganicBlobs color={cor} />

      {cornerSticker && (
        <Sticker
          name={cornerSticker}
          className="absolute -bottom-6 -right-5 w-40 opacity-[0.08]"
        />
      )}

      <div className="relative mx-auto max-w-md">
        {sticker ? (
          <Sticker name={sticker} className="mx-auto mb-3 w-[90px]" />
        ) : (
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-6 w-6" strokeWidth={1.75} />
          </span>
        )}

        <h3 className="font-display text-xl font-extrabold tracking-tight text-foreground">{title}</h3>
        <p className="mt-1.5 text-[13.5px] font-body leading-relaxed text-muted-foreground">{description}</p>

        {examples && examples.length > 0 && (
          <div className="mt-5 space-y-1.5 text-left">
            <p className="mb-2 text-center text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground">
              Por exemplo
            </p>
            {examples.map((e) => (
              <p
                key={e}
                className="rounded-xl border border-border bg-background/70 px-3.5 py-2 text-[12.5px] font-body text-muted-foreground"
              >
                “{e}”
              </p>
            ))}
          </div>
        )}

        {action && (
          <Button variant="hero" size="lg" className="mt-6" onClick={action.onClick}>
            {action.label}
          </Button>
        )}

        {secondary && <div className="mt-3">{secondary}</div>}
      </div>
    </div>
  );
}

export default EmptyState;
