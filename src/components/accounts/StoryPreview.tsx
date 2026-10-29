import { useState } from "react";
import { Heart, Send, ImageOff, Play, X, ExternalLink } from "lucide-react";
import type { CarouselMedia } from "@/components/shared/PostMediaCarousel";
import { getDisplayImageUrl, getDriveImageFallbackUrl, getDriveViewPageUrl, getThumbnailUrl, getVideoEmbedUrl, getVideoFileUrl, getVideoKind, isUnknownDriveMedia, isVideoMedia } from "@/lib/driveMedia";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { VideoPoster, useDriveVideoRatio } from "@/components/shared/VideoPoster";
import { coverIframeStyle } from "@/lib/poster-letterbox";
import { useMidiaComTipoDrive } from "@/hooks/useMidiaComTipoDrive";
import type { FigurinhasStory } from "@/hooks/usePublicarInstagram";

/**
 * Preview de Story (9:16, tela cheia): sem legenda e sem barra de ações de feed.
 * Usado no composer do Cria Post e no portal público de aprovação.
 */
export function StoryPreview({ media: midiaCrua, handle, avatarUrl, onRemove, figurinhas }: {
  media: CarouselMedia[]; handle?: string; avatarUrl?: string | null; onRemove?: (id: string) => void;
  /** Figurinhas planejadas (link, enquete...): desenhadas por cima pro cliente aprovar o texto. */
  figurinhas?: FigurinhasStory | null;
}) {
  // Drive sem tipo (link colado ainda "Restrito"): pergunta de novo e ganha play.
  const media = useMidiaComTipoDrive(midiaCrua);
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

  // "Cover no iframe" pro estado tocando: o player /preview do Drive faz contain
  // com fundo preto, então iframe do tamanho do slot deixa barra dentro do player.
  // Com a proporção real do vídeo (mesma medição do poster, ver poster-letterbox)
  // o iframe cresce até cobrir o slot 9:16 e o excesso é cortado pelo
  // overflow-hidden. Sem medição, cover é null e fica o iframe de sempre.
  // Só o Drive: Bunny e <video> de arquivo já se ajustam sozinhos.
  const videoRatio = useDriveVideoRatio(kind === "drive" ? item : null);
  // Zoom no conteúdo (scale) junto do cover: a barra preta que sobrava na
  // lateral é desenhada DENTRO da página do Drive, então crescer o iframe não
  // resolvia; o scale empurra a barra pra fora da janela. Sem medição, o
  // iframe cobre o slot e leva o zoom do mesmo jeito.
  const ZOOM_DRIVE = 1.08;
  const cover = kind === "drive"
    ? (videoRatio
        ? coverIframeStyle(videoRatio, 9 / 16, ZOOM_DRIVE)
        : {
            position: "absolute" as const, left: "50%", top: "50%",
            width: "100%", height: "100%",
            transform: `translate(-50%, -50%) scale(${ZOOM_DRIVE})`,
          })
    : null;

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
          cover ? (
            // Janela de corte própria: o iframe maior fica fora do fluxo e o
            // excesso (onde o player desenharia a barra) some no overflow.
            <div className="absolute inset-0 overflow-hidden bg-black">
              <iframe src={embedUrl} style={cover} className="bg-black" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={item.file_name || "vídeo"} />
            </div>
          ) : (
            <iframe src={embedUrl} className="w-full h-full bg-black" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={item.file_name || "vídeo"} />
          )
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

      {/* FIGURINHAS PLANEJADAS (29/10/2026): desenho aproximado do que vai ser
          colado pelo app, só pra aprovar o conteúdo. Some quando o vídeo toca. */}
      {figurinhas && !playing && (figurinhas.enquete || figurinhas.caixinha || figurinhas.link || figurinhas.local || figurinhas.musica) && (
        <div className="absolute inset-x-6 bottom-[14%] z-10 flex flex-col items-center gap-2 pointer-events-none">
          {figurinhas.musica && (
            <span className="rounded-lg bg-white/95 px-2.5 py-1 text-[11px] font-bold text-foreground shadow">🎵 {figurinhas.musica.nome}</span>
          )}
          {figurinhas.enquete && (
            <div className="w-full max-w-[220px] rounded-2xl bg-white/95 p-2.5 text-center shadow">
              <p className="text-[12px] font-bold text-foreground leading-tight">{figurinhas.enquete.pergunta}</p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {(figurinhas.enquete.opcoes?.length ? figurinhas.enquete.opcoes : ["Sim", "Não"]).slice(0, 2).map((o) => (
                  <span key={o} className="rounded-lg bg-muted px-1.5 py-1 text-[11px] font-bold text-foreground truncate">{o}</span>
                ))}
              </div>
            </div>
          )}
          {figurinhas.caixinha && (
            <div className="w-full max-w-[220px] rounded-2xl bg-white/95 p-2.5 text-center shadow">
              <p className="text-[12px] font-bold text-foreground leading-tight">{figurinhas.caixinha.pergunta}</p>
              <p className="mt-1.5 rounded-lg bg-muted px-2 py-1 text-[10px] text-muted-foreground">Responda aqui</p>
            </div>
          )}
          {figurinhas.local && (
            <span className="rounded-lg bg-white/95 px-2.5 py-1 text-[11px] font-bold text-violet-700 shadow">📍 {figurinhas.local.nome}</span>
          )}
          {figurinhas.link && (
            <span className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-extrabold text-sky-700 shadow">🔗 {figurinhas.link.texto || figurinhas.link.url}</span>
          )}
        </div>
      )}

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
