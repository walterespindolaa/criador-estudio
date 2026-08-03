import { useState } from "react";
import { Heart, Send, ImageOff, Play, X, ExternalLink } from "lucide-react";
import type { CarouselMedia } from "@/components/shared/PostMediaCarousel";
import { getDisplayImageUrl, getDriveImageFallbackUrl, getDriveViewPageUrl, getThumbnailUrl, getVideoEmbedUrl, getVideoFileUrl, getVideoKind, isUnknownDriveMedia, isVideoMedia } from "@/lib/driveMedia";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { VideoPoster } from "@/components/shared/VideoPoster";

/**
 * Preview de Story (9:16, tela cheia): sem legenda e sem barra de ações de feed.
 * Usado no composer do Cria Post e no portal público de aprovação.
 */
export function StoryPreview({ media, handle, avatarUrl, onRemove }: {
  media: CarouselMedia[]; handle?: string; avatarUrl?: string | null; onRemove?: (id: string) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const n = media.length;
  const safeIdx = n > 0 ? Math.min(idx, n - 1) : 0;
  const item = n > 0 ? media[safeIdx] : null;
  const h = handle ? (handle.startsWith("@") ? handle : "@" + handle) : "@cliente";
  const initial = h.replace(/^@/, "").charAt(0).toUpperCase() || "?";

  const go = (delta: number) => { setPlaying(false); setIdx(() => Math.max(0, Math.min(n - 1, safeIdx + delta))); };

  const video = item ? isVideoMedia(item) : false;
  const src = item ? getDisplayImageUrl(item) : null;
  const thumb = item ? getThumbnailUrl(item) : null;
  // Player por tipo: Bunny/Drive são iframe; storage/device é arquivo (<video>).
  const kind = item && video ? getVideoKind(item) : null;
  const embedUrl = item && video ? getVideoEmbedUrl(item) : null;
  const fileUrl = item && video ? getVideoFileUrl(item) : null;
  // Tem player embutido? Sem player, o play abre a fonte em nova aba (nunca sem ação).
  const hasInlinePlayer = video && (kind === "file" ? !!fileUrl : !!embedUrl);
  // Fallback só pro Drive: se o embed /preview for bloqueado, abre a página do Drive.
  const driveViewUrl = item && kind === "drive" ? getDriveViewPageUrl(item) : null;
  // ESTADO NEUTRO: mídia do Drive de tipo desconhecido (arquivo não público). Mostra
  // a miniatura sem play gigante e oferece "Abrir no Drive", que resolve os dois
  // casos (ver a arte ou assistir o vídeo) sem prometer o que não sabemos.
  const unknownDriveUrl = item && isUnknownDriveMedia(item) ? getDriveViewPageUrl(item) : null;
  const driveShortcutUrl = driveViewUrl ?? unknownDriveUrl;
  const driveShortcutLabel = driveViewUrl ? "Assistir no Drive" : "Abrir no Drive";

  // Play robusto: monta o player embutido ou abre a fonte em nova aba.
  const onPlay = () => {
    if (hasInlinePlayer) { setPlaying(true); return; }
    const u = driveViewUrl || embedUrl || fileUrl;
    if (u) window.open(u, "_blank", "noopener,noreferrer");
  };

  const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const fb = item ? getDriveImageFallbackUrl(item) : null;
    if (fb && !img.dataset.fb) { img.dataset.fb = "1"; img.src = fb; return; }
    img.style.display = "none";
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-black select-none" style={{ aspectRatio: "9 / 16" }}>
      {/* Mídia cobrindo a tela toda */}
      {item ? (
        playing && hasInlinePlayer && kind === "file" && fileUrl ? (
          <video src={fileUrl} controls playsInline autoPlay className="w-full h-full bg-black object-cover" />
        ) : playing && hasInlinePlayer && embedUrl ? (
          <iframe src={embedUrl} className="w-full h-full bg-black" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={item.file_name || "vídeo"} />
        ) : video ? (
          // Vídeo parado: mesmo poster do carrossel, que já trata a TARJA PRETA
          // queimada na miniatura do Drive (ver src/lib/poster-letterbox.ts).
          <VideoPoster key={item.id ?? safeIdx} item={item} />
        ) : src ? (
          <ProgressiveImage key={item.id ?? safeIdx} thumbSrc={thumb} fullSrc={src} alt={item.file_name || ""}
            className="w-full h-full object-cover" onFullError={onImgError} onThumbError={onImgError} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/40"><ImageOff className="h-10 w-10" /></div>
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/40"><ImageOff className="h-10 w-10" /></div>
      )}

      {/* Gradientes pra leitura dos elementos */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />

      {/* Barrinhas de progresso (1 segmento por mídia) */}
      <div className="absolute top-2 left-2 right-2 z-20 flex gap-1 pointer-events-none">
        {Array.from({ length: Math.max(n, 1) }).map((_, i) => (
          <span key={i} className={`h-[3px] flex-1 rounded-full ${i <= safeIdx ? "bg-white" : "bg-white/35"}`} />
        ))}
      </div>

      {/* Avatar + @usuario */}
      <div className="absolute top-5 left-3 z-20 flex items-center gap-2 pointer-events-none">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-white/25 ring-1 ring-white/60 flex items-center justify-center shrink-0">
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            : <span className="text-[12px] font-bold text-white">{initial}</span>}
        </div>
        <span className="text-[13px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,.5)]">{h}</span>
        <span className="text-[12px] text-white/70">agora</span>
      </div>

      {/* Navegação por toque nas laterais */}
      {n > 1 && !playing && (
        <>
          {safeIdx > 0 && <button type="button" aria-label="Mídia anterior" onClick={() => go(-1)} className="absolute left-0 top-16 bottom-16 w-1/3 z-10" />}
          {safeIdx < n - 1 && <button type="button" aria-label="Próxima mídia" onClick={() => go(1)} className="absolute right-0 top-16 bottom-16 w-1/3 z-10" />}
        </>
      )}

      {/* Play SEMPRE visível pra vídeo: nunca um frame sem controle. Sem player
          embutido (Drive bloqueado etc.), o clique abre a fonte em nova aba. */}
      {video && !playing && (
        <button type="button" onClick={onPlay} aria-label="Reproduzir vídeo" className="absolute inset-0 z-[15] flex flex-col items-center justify-center gap-2">
          <span className="w-16 h-16 rounded-full bg-black/55 flex items-center justify-center shadow-lg"><Play className="h-8 w-8 text-white ml-1" /></span>
          {!src && <span className="text-xs font-medium text-white/85">Assistir</span>}
        </button>
      )}

      {/* Só pro Drive: atalho caso o embed /preview seja bloqueado pela conta do cliente,
          ou quando o tipo do arquivo é desconhecido (aí o rótulo é neutro: "Abrir"). */}
      {driveShortcutUrl && (
        <button type="button" onClick={() => window.open(driveShortcutUrl, "_blank", "noopener,noreferrer")}
          className="absolute bottom-16 right-2 z-30 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-black/80">
          <ExternalLink className="h-3 w-3" /> {driveShortcutLabel}
        </button>
      )}

      {/* Remover (só no composer) */}
      {onRemove && item?.id && (
        <button type="button" onClick={() => onRemove(item.id!)} aria-label="Remover mídia"
          className="absolute top-12 right-2 z-30 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80"><X className="h-4 w-4" /></button>
      )}

      {/* Rodapé de story: só a pílula de resposta, sem legenda */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-3 pointer-events-none">
        <div className="flex-1 h-10 rounded-full border border-white/60 px-4 flex items-center text-[13px] text-white/85">Responder...</div>
        <Heart className="h-6 w-6 text-white shrink-0 [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.5))]" />
        <Send className="h-6 w-6 text-white shrink-0 [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.5))]" />
      </div>
    </div>
  );
}
