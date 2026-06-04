import { useRef } from "react";
import { getLocalVideoObjectUrl } from "@/lib/media-cache";

export function VideoEmbed({ viewUrl, className }: { viewUrl: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const localUrl = getLocalVideoObjectUrl(viewUrl);

  if (localUrl) {
    return (
      <video
        ref={ref}
        src={localUrl}
        controls
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onLoadedData={() => { ref.current?.play().catch(() => {}); }}
        className={className}
      />
    );
  }
  return (
    <iframe
      src={viewUrl}
      loading="lazy"
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
      allowFullScreen
      className={className}
    />
  );
}
