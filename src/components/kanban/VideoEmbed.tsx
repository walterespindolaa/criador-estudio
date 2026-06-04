import { useEffect, useState } from "react";
import { getLocalVideoObjectUrl } from "@/lib/media-cache";

export function VideoEmbed({ viewUrl, className }: { viewUrl: string; className?: string }) {
  const [localUrl] = useState<string | null>(() => getLocalVideoObjectUrl(viewUrl));
  useEffect(() => {
    return () => { if (localUrl) URL.revokeObjectURL(localUrl); };
  }, [localUrl]);

  if (localUrl) {
    return <video src={localUrl} controls playsInline className={className} />;
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
