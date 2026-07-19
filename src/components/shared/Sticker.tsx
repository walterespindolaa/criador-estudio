import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   OS STICKERS DA MARCA

   PNGs oficiais servidos em /stickers/*.png (fundo transparente, cada selo já
   traz a própria forma). Sticker é tempero: dose comedida, nunca poluir.
   Sempre decorativo, então alt vazio e aria-hidden pra leitor de tela ignorar.
   ═══════════════════════════════════════════════════════════════════════════ */

export type StickerName =
  | "criatura-lampada"
  | "selo-social-club-amarelo"
  | "selo-social-club-verde"
  | "selo-social-club-azul"
  | "selo-sem-formula"
  | "selo-da-ideia-ao-post-rosa"
  | "selo-da-ideia-ao-post-amarelo";

export function Sticker({
  name,
  className,
  style,
}: {
  name: StickerName;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={`/stickers/${name}.png`}
      alt=""
      aria-hidden
      draggable={false}
      className={cn("object-contain select-none pointer-events-none", className)}
      style={style}
    />
  );
}

export default Sticker;
