import { getLocalVideoObjectUrl } from "@/lib/media-cache";

export function VideoEmbed({ viewUrl, className }: { viewUrl: string; className?: string }) {
  // Lê o cache a cada render (não trava num valor do mount). Se houver arquivo
  // local (vídeo recém-subido), toca na hora; senão, cai no player do Bunny.
  const localUrl = getLocalVideoObjectUrl(viewUrl);

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
