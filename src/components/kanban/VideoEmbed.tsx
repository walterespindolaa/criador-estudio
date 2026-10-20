/* Player do Bunny na prévia. TOCA SÓ QUANDO A PESSOA MANDA (Walter, 20/10/2026:
   "fica rodando o vídeo por trás sem eu poder pausar e fica rodando
   automático"). O autoplay vinha do padrão da biblioteca; agora a URL diz
   autoplay=false, a não ser que quem chama peça (o clique na capa, por exemplo,
   que já é a pessoa pedindo pra ver). */
export function urlDoPlayer(viewUrl: string, autoplay: boolean) {
  if (!viewUrl.includes("mediadelivery.net")) return viewUrl;
  try {
    const u = new URL(viewUrl);
    u.searchParams.set("autoplay", autoplay ? "true" : "false");
    u.searchParams.set("loop", "false");
    u.searchParams.set("preload", autoplay ? "true" : "false");
    return u.toString();
  } catch {
    return viewUrl;
  }
}

export function VideoEmbed({ viewUrl, className, autoplay = false }: { viewUrl: string; className?: string; autoplay?: boolean }) {
  // iOS Safari não reproduz vídeo via blob local (limitação do WebKit), então
  // o preview usa sempre o player do Bunny. O cache em memória segue valendo
  // para a PUBLICAÇÃO (compartilhar o arquivo), que não depende de reprodução.
  return (
    <iframe
      src={urlDoPlayer(viewUrl, autoplay)}
      loading="lazy"
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
      allowFullScreen
      className={className}
    />
  );
}
