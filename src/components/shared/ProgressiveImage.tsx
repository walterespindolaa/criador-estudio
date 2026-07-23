import { useState } from "react";

/**
 * Imagem com PREVIEW PROGRESSIVO: mostra primeiro a MINIATURA leve (thumbSrc)
 * como placeholder e carrega a imagem CHEIA (fullSrc) por cima, revelando-a
 * quando ela termina de carregar (efeito "aparece reduzida e depois nítida").
 *
 * A cheia usa loading="lazy": em carrossel/grade, o browser adia as imagens que
 * ainda não estão à vista, então NÃO puxa todas as fotos cheias de uma vez.
 * Se não houver miniatura distinta, cai pra uma imagem só (comportamento antigo).
 */
export function ProgressiveImage({
  thumbSrc, fullSrc, alt = "", className = "", draggable, onFullError, onThumbError, eager,
}: {
  thumbSrc: string | null;
  fullSrc: string | null;
  alt?: string;
  className?: string;
  draggable?: boolean;
  // Repassa o erro pro chamador tratar (ex.: fallback do Drive lh3).
  onFullError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onThumbError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  // eager: carrega a cheia sem lazy (ex.: primeiro slide já visível).
  eager?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const hasThumb = !!thumbSrc && thumbSrc !== fullSrc;

  // Sem miniatura distinta: uma imagem só, como era antes.
  if (!hasThumb) {
    return fullSrc ? (
      <img src={fullSrc} alt={alt} draggable={draggable} loading={eager ? undefined : "lazy"}
        className={className} onError={onFullError} />
    ) : null;
  }

  return (
    <div className="relative w-full h-full">
      {/* Miniatura: placeholder rápido. Fica um leve blur até a cheia entrar. */}
      <img
        src={thumbSrc!} alt={alt} draggable={draggable} aria-hidden
        className={`${className} absolute inset-0 transition-[filter,opacity] duration-300 ${ready ? "opacity-0" : "opacity-100 blur-[6px] scale-[1.02]"}`}
        onError={onThumbError}
      />
      {/* Imagem cheia: entra por cima quando carrega. */}
      {fullSrc && (
        <img
          src={fullSrc} alt={alt} draggable={draggable} loading={eager ? undefined : "lazy"} decoding="async"
          className={`${className} relative transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setReady(true)}
          onError={onFullError}
        />
      )}
    </div>
  );
}
