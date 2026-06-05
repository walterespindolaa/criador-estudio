import { useEffect, useState } from "react";
import { VideoEmbed } from "./VideoEmbed";

export function MediaPreparingPlaceholder({ pct, label }: { pct?: number | null; label?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-black/90 px-6">
      <img src="/logo-icon.png" alt="CRIA" className="w-14 h-14 animate-pulse opacity-90" />
      <div className="w-40 h-1.5 rounded-full bg-white/20 overflow-hidden">
        {typeof pct === "number" ? (
          <div className="h-full bg-white/80 transition-all duration-300" style={{ width: `${Math.max(3, pct)}%` }} />
        ) : (
          <div className="h-full w-1/3 bg-white/70 animate-pulse" />
        )}
      </div>
      <p className="text-white/70 text-[11px] font-body text-center">
        {label ?? "Preparando pré-visualização…"}
      </p>
    </div>
  );
}

export function VideoMediaSlot({ viewUrl, thumbUrl, className }: {
  viewUrl: string;
  thumbUrl?: string | null;
  className?: string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!thumbUrl) { setReady(true); return; }
    let cancelled = false;
    let timer: number | undefined;
    const check = () => {
      const img = new Image();
      img.onload = () => { if (!cancelled) setReady(true); };
      img.onerror = () => { if (!cancelled) timer = window.setTimeout(check, 5000); };
      img.src = `${thumbUrl}?t=${Date.now()}`;
    };
    check();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [thumbUrl]);

  if (ready) return <VideoEmbed viewUrl={viewUrl} className={className} />;
  return <MediaPreparingPlaceholder label="Preparando vídeo…" />;
}
