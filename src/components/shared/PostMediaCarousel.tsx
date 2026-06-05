import { useEffect, useRef, useState } from "react";
import { ImageOff, ChevronLeft, ChevronRight, X, Play } from "lucide-react";
import { Logo } from "@/components/shared/Logo";

export type CarouselMedia = {
  id?: string; provider?: string | null; view_url?: string | null; thumbnail_url?: string | null;
  download_url?: string | null; bunny_video_id?: string | null; file_type?: string | null; file_name?: string | null;
};

function VideoSlide({ item, onReady }: { item: CarouselMedia; onReady?: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [thumbOk, setThumbOk] = useState<boolean | null>(item.thumbnail_url ? null : true);
  const [bust, setBust] = useState(0);
  const thumb = item.thumbnail_url;

  useEffect(() => {
    if (thumbOk === false) { const t = setTimeout(() => setBust((b) => b + 1), 5000); return () => clearTimeout(t); }
  }, [thumbOk, bust]);

  if (playing && item.view_url)
    return <iframe src={item.view_url} className="w-full h-full bg-black" allow="autoplay; fullscreen; picture-in-picture" title={item.file_name || "vídeo"} />;

  return (
    <div className="relative w-full h-full bg-black">
      {thumb && (
        <img src={`${thumb}${bust ? `?r=${bust}` : ""}`} alt={item.file_name || ""}
          className={`w-full h-full object-cover ${thumbOk ? "" : "opacity-0"}`}
          onLoad={() => { if (thumbOk === false) onReady?.(); setThumbOk(true); }}
          onError={() => setThumbOk((p) => (p === true ? true : false))} />
      )}
      {thumbOk !== true && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#15131f] text-white">
          <Logo variant="dark" className="h-7 w-auto" />
          <div className="w-3/5 h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-primary to-purple-400 animate-pulse" />
          </div>
          <span className="text-xs text-white/70">Processando vídeo…</span>
        </div>
      )}
      {thumbOk === true && (
        <button type="button" onClick={() => setPlaying(true)} className="absolute inset-0 flex items-center justify-center">
          <span className="w-14 h-14 rounded-full bg-black/55 flex items-center justify-center"><Play className="h-7 w-7 text-white ml-0.5" /></span>
        </button>
      )}
    </div>
  );
}

function Slide({ item, onReady }: { item: CarouselMedia; onReady?: () => void }) {
  const isVideo = item.file_type?.startsWith("video") || !!item.bunny_video_id || item.provider === "bunny_stream";
  if (isVideo) return <VideoSlide item={item} onReady={onReady} />;
  const src = item.view_url || item.thumbnail_url || item.download_url || "";
  if (src) return <img src={src} alt={item.file_name || ""} className="w-full h-full object-cover bg-muted" loading="lazy" />;
  return <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground"><ImageOff className="h-8 w-8" /></div>;
}

export function PostMediaCarousel({ media, aspect = "4 / 5", onRemove, onVideoReady }: {
  media: CarouselMedia[]; aspect?: string; onRemove?: (id: string) => void; onVideoReady?: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const n = media.length;
  const goTo = (i: number) => { const el = scroller.current; if (!el) return; const c = Math.max(0, Math.min(n - 1, i)); el.scrollTo({ left: el.clientWidth * c, behavior: "smooth" }); setIdx(c); };
  const onScroll = () => { const el = scroller.current; if (!el) return; setIdx(Math.round(el.scrollLeft / el.clientWidth)); };

  if (n === 0)
    return <div className="w-full bg-muted flex items-center justify-center text-muted-foreground" style={{ aspectRatio: aspect }}><ImageOff className="h-10 w-10 opacity-40" /></div>;

  return (
    <div className="relative w-full bg-black overflow-hidden" style={{ aspectRatio: aspect }}>
      <div ref={scroller} onScroll={onScroll} className="flex w-full h-full overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {media.map((m, i) => (
          <div key={m.id ?? i} className="relative w-full h-full shrink-0 snap-center">
            <Slide item={m} onReady={onVideoReady} />
            {onRemove && m.id && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(m.id!); }}
                className="absolute top-2 left-2 z-20 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80"><X className="h-4 w-4" /></button>
            )}
          </div>
        ))}
      </div>
      {n > 1 && (
        <>
          {idx > 0 && <button type="button" onClick={() => goTo(idx - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"><ChevronLeft className="h-5 w-5" /></button>}
          {idx < n - 1 && <button type="button" onClick={() => goTo(idx + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"><ChevronRight className="h-5 w-5" /></button>}
          <span className="absolute top-3 right-3 z-10 bg-black/55 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">{idx + 1}/{n}</span>
          <div className="absolute bottom-3 left-0 right-0 z-10 flex gap-1.5 justify-center pointer-events-none">
            {media.map((_, i) => <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === idx ? "bg-white" : "bg-white/50"}`} />)}
          </div>
        </>
      )}
    </div>
  );
}
