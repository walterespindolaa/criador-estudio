export function VideoEmbed({ viewUrl, className }: { viewUrl: string; className?: string }) {
  // iOS Safari não reproduz vídeo via blob local (limitação do WebKit), então
  // o preview usa sempre o player do Bunny. O cache em memória segue valendo
  // para a PUBLICAÇÃO (compartilhar o arquivo), que não depende de reprodução.
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
