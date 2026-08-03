import { useEffect, useRef, useState } from "react";
import { getDisplayImageUrl, getDriveImageFallbackUrl, isDriveMedia, type MediaLike } from "@/lib/driveMedia";
import { letterboxStyle, measureLetterbox, type LetterboxBox } from "@/lib/poster-letterbox";

/**
 * POSTER (frame) de um vídeo na prévia do post. Usado pelo carrossel do Cria Post
 * e pela prévia de Story, pra os dois tratarem a miniatura do mesmo jeito.
 *
 * Resolve três coisas que a prévia tinha:
 *  1. TARJA PRETA QUEIMADA NO PIXEL: a miniatura de vídeo às vezes vem com moldura
 *     preta na própria imagem, e aí object-cover não adianta. Ver o porquê e os
 *     testes em src/lib/poster-letterbox.ts. Sem tarja, nada muda.
 *  2. CACHE-BUSTER QUEBRADO: a URL do Drive já tem query (?id=…&sz=w1600); a
 *     retentativa colava "?r=1" no fim e o sz virava "w1600?r=1", fazendo o Drive
 *     devolver um frame de 124px de largura — aquela miniatura borrada.
 *  3. Fallback lh3 numa vez só, sem repetir a lógica em cada tela.
 */
export function VideoPoster({ item, onStatus, className = "" }: {
  item: MediaLike;
  /** Avisa se o frame apareceu (true) ou falhou (false). */
  onStatus?: (ok: boolean) => void;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const src = getDisplayImageUrl(item);
  const [ok, setOk] = useState<boolean | null>(src ? null : false);
  const [retry, setRetry] = useState(0);
  const [box, setBox] = useState<LetterboxBox | null>(null);
  const [slotRatio, setSlotRatio] = useState(0);

  // Só o Drive tem miniatura com CORS liberado (lh3 responde ACAO: *), então a
  // medição da tarja roda só nele. Bunny/storage seguem no object-cover puro.
  const probe = isDriveMedia(item) ? getDriveImageFallbackUrl(item, 320) : null;

  useEffect(() => {
    let alive = true;
    setBox(null);
    if (!probe) return;
    measureLetterbox(probe).then((b) => { if (alive) setBox(b); });
    return () => { alive = false; };
  }, [probe]);

  // Retenta quando o frame falha (Bunny ainda codificando, Drive demorando a
  // gerar a miniatura). Limitado: antes ficava tentando pra sempre.
  useEffect(() => {
    if (ok !== false || !src || retry >= 3) return;
    const t = setTimeout(() => setRetry((n) => n + 1), 5000);
    return () => clearTimeout(t);
  }, [ok, retry, src]);

  if (!src) return null;

  // Cache-buster com & (a URL já tem query) ou com ? quando ainda não tem.
  const busted = retry ? `${src}${src.includes("?") ? "&" : "?"}r=${retry}` : src;
  const cropped = box && slotRatio > 0 ? letterboxStyle(box, slotRatio) : null;

  return (
    <div ref={wrap} className={`absolute inset-0 overflow-hidden ${className}`}>
      <img
        key={retry}
        src={busted}
        alt={item.file_name || ""}
        className={`${cropped ? "" : "w-full h-full object-cover"} ${ok ? "" : "opacity-0"}`}
        style={cropped ?? undefined}
        onLoad={() => {
          const el = wrap.current;
          if (el && el.clientHeight > 0) setSlotRatio(el.clientWidth / el.clientHeight);
          setOk(true); onStatus?.(true);
        }}
        onError={(e) => {
          const img = e.currentTarget;
          const fb = getDriveImageFallbackUrl(item);
          if (fb && !img.dataset.fb) { img.dataset.fb = "1"; img.src = fb; return; }
          setOk(false); onStatus?.(false);
        }}
      />
    </div>
  );
}
