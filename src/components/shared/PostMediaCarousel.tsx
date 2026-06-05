import { useRef, useState } from "react";
import { ImageOff, ChevronLeft, ChevronRight, X } from "lucide-react";

export type CarouselMedia = {
  id?: string; provider?: string | null; view_url?: string | null; thumbnail_url?: string | null;
  download_url?: string | null; bunny_video_id?: string | null; file_type?: string | null; file_name?: string | null;
};

function Slide({ item }: { item: CarouselMedia }) {
  const isVideo = item.file_type?.startsWith("video") || !!item.bunny_video_id || item.provider === "bunny_stream";
  const src = item.view_url || item.thumbnail_url || item.download_url || "";
  if (isVideo && item.provider === "bunny_stream" && item.view_url)
    return <iframe src={item.view_url} className="w-full h-full bg-black" allow="autoplay; fullscreen; picture-in-picture" loading="lazy" title={item.file_name || "vídeo"} />;
  if (isVideo && src) return <video src={src} className="w-full h-full object-cover bg-black" controls playsInline />;
  if (src) return <img src={src} alt={item.file_name || ""} className="w-full h-full object-cover bg-muted" loading="lazy" />;
  return <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground"><ImageOff className="h-8 w-8" /></div>;
}

export function PostMediaCarousel({ media, aspect = "4 / 5", onRemove, capVh = 60 }: {
  media: CarouselMedia[]; aspect?: string; onRemove?: (id: string) => void; capVh?: number;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const n = media.length;
  const vertical = aspect === "9 / 16";
  const style = vertical
    ? { aspectRatio: aspect, height: `${capVh}vh`, maxWidth: "100%" as const }
    : { aspectRatio: aspect, width: "100%" as const };

  const goTo = (i: number) => { const el = scroller.current; if (!el) return; const c = Math.max(0, Math.min(n - 1, i)); el.scrollTo({ left: el.clientWidth * c, behavior: "smooth" }); setIdx(c); };
  const onScroll = () => { const el = scroller.current; if (!el) return; setIdx(Math.round(el.scrollLeft / el.clientWidth)); };

  if (n === 0)
    return <div className="bg-muted flex items-center justify-center text-muted-foreground mx-auto" style={style}><ImageOff className="h-10 w-10 opacity-40" /></div>;

  return (
    <div className="relative bg-black overflow-hidden mx-auto" style={style}>
      <div ref={scroller} onScroll={onScroll} className="flex w-full h-full overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {media.map((m, i) => (
          <div key={m.id ?? i} className="relative w-full h-full shrink-0 snap-center">
            <Slide item={m} />
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
