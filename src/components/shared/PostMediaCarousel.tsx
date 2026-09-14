import { useEffect, useRef, useState } from "react";
import { ImageOff, ChevronLeft, ChevronRight, X, Play, ExternalLink } from "lucide-react";
import { getDisplayImageUrl, getDriveImageFallbackUrl, getDriveViewPageUrl, getThumbnailUrl, getVideoEmbedUrl, getVideoFileUrl, getVideoKind, isDriveMedia, isUnknownDriveMedia, isVideoMedia } from "@/lib/driveMedia";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { VideoPoster, useDriveVideoRatio } from "@/components/shared/VideoPoster";
import { coverIframeStyle, letterboxStyle, probeLetterbox, type LetterboxBox } from "@/lib/poster-letterbox";

export type CarouselMedia = {
  id?: string; provider?: string | null; external_file_id?: string | null; view_url?: string | null;
  thumbnail_url?: string | null; download_url?: string | null; bunny_video_id?: string | null;
  file_type?: string | null; file_name?: string | null;
};

function VideoSlide({ item, onReady }: { item: CarouselMedia; onReady?: () => void }) {
  const [playing, setPlaying] = useState(false);
  const thumb = getDisplayImageUrl(item);
  const [thumbOk, setThumbOk] = useState<boolean | null>(thumb ? null : false);
  // Player por tipo: Bunny/Drive são iframe (embedUrl); storage/device é arquivo (<video>).
  const kind = getVideoKind(item);
  const embedUrl = getVideoEmbedUrl(item);
  const fileUrl = getVideoFileUrl(item);
  // Tem player embutido? file toca no <video>, bunny/drive no iframe. Sem player,
  // o play abre a fonte em nova aba (nunca fica sem ação).
  const hasInlinePlayer = kind === "file" ? !!fileUrl : !!embedUrl;
  // Fallback só pro Drive: se o embed /preview for bloqueado pela conta do cliente,
  // ele ainda assiste abrindo a página do Drive em nova aba.
  /* O ESCAPE VALE TAMBÉM PRO BUNNY (Walter, 14/09/2026): vídeo que a social
     mídia anexa pelo Drive é ingerido no Bunny, e durante a transcodificação o
     iframe mostra "Processing video" e a miniatura do CDN dá 404. O link do
     arquivo original fica salvo, então dá pra assistir enquanto isso. */
  const driveViewUrl = getDriveViewPageUrl(item);
  /* Poster falhou num vídeo do Bunny = quase sempre encoding em andamento.
     Nesse caso o play vai direto pro Drive, em vez de abrir uma tela de
     "processando" que o cliente lê como defeito. */
  const aindaProcessando = kind === "bunny" && thumbOk === false && !!driveViewUrl;

  // Proporção real do vídeo (medida na miniatura, mesma medição do poster) pra o
  // estado tocando cobrir o slot com o iframe do Drive (ver coverIframeStyle).
  // Só o Drive: Bunny e <video> de arquivo já se ajustam sozinhos.
  const videoRatio = useDriveVideoRatio(kind === "drive" ? item : null);
  // Proporção do slot medida no DOM (o aspect chega de fora como string CSS).
  // Ref de callback nos DOIS estados (parado e tocando) pra medida existir antes
  // do play e sobreviver à troca de raiz.
  const [slotRatio, setSlotRatio] = useState(0);
  const slotRef = (el: HTMLDivElement | null) => {
    if (!el || el.clientHeight <= 0) return;
    const r = el.clientWidth / el.clientHeight;
    setSlotRatio((prev) => (Math.abs(prev - r) < 0.005 ? prev : r));
  };

  // Play robusto: monta o player embutido; sem player embutido (ex.: só a página do
  // Drive), abre a fonte em nova aba. O usuário SEMPRE consegue assistir.
  const onPlay = () => {
    if (aindaProcessando && driveViewUrl) { window.open(driveViewUrl, "_blank", "noopener,noreferrer"); return; }
    if (hasInlinePlayer) { setPlaying(true); return; }
    const u = driveViewUrl || embedUrl || fileUrl;
    if (u) window.open(u, "_blank", "noopener,noreferrer");
  };

  // Só monta o player DEPOIS que o cliente toca no play (não pesa os slides parados).
  if (playing && hasInlinePlayer) {
    if (kind === "file" && fileUrl)
      return <video src={fileUrl} controls playsInline autoPlay className="w-full h-full bg-black object-contain" />;
    if (embedUrl) {
      // "Cover no iframe": o player do Drive faz contain com fundo preto, então
      // iframe do tamanho do slot deixa barra dentro do player. Com a proporção
      // real medida, o iframe cresce (até o teto de escala) e o slot vira janela
      // com overflow-hidden que corta o excesso. Sem medição, null: fica o
      // iframe de sempre com as barras, sem chute.
      // VALE NO CELULAR TAMBÉM. Antes o cover só rodava no desktop, por causa
      // dos controles do player do Google que ficavam gigantes ao ampliar muito.
      // Só que o portal de aprovação é aberto justamente NO CELULAR, e lá o
      // vídeo ficava contido com borda em volta (a reclamação recorrente). Com
      // o teto de escala em 1.5, a ampliação necessária pro caso real (vídeo
      // vertical em card vertical) é pequena e os controles seguem legíveis;
      // acima disso o coverIframeStyle devolve null e o player fica contido
      // sobre o fundo desfocado, que é bem melhor que a tarja.
      // ZOOM NO CONTEÚDO DO PLAYER (o que finalmente mata o risco preto).
      // A barra que sobrava na lateral não era do nosso layout: é desenhada
      // DENTRO da página de preview do Drive, em volta do vídeo. Por isso
      // crescer o iframe nunca resolveu, o player só redesenhava a barra
      // proporcional. Com transform: scale, o que já foi renderizado é
      // ampliado e a barra sai da área visível (o wrapper corta com
      // overflow-hidden). 1.08 = ~4% de corte em cada lado.
      const ZOOM_DRIVE = 1.08;
      const cover = kind === "drive"
        ? (videoRatio && slotRatio > 0
            ? coverIframeStyle(videoRatio, slotRatio, ZOOM_DRIVE)
            // Sem a proporção medida, o iframe cobre o slot e leva o zoom
            // mesmo assim: antes esse caminho caía no iframe cru, com barra.
            : {
                position: "absolute" as const, left: "50%", top: "50%",
                width: "100%", height: "100%",
                transform: `translate(-50%, -50%) scale(${ZOOM_DRIVE})`,
              })
        : null;
      return (
        <div ref={slotRef} className="relative w-full h-full bg-black overflow-hidden">
          {/* Quando o player não cobre o slot inteiro (vertical dentro de card
              4:5, ou escala além do teto), sobrava TARJA PRETA dura em volta.
              A miniatura desfocada por trás preenche esse vazio, igual fazem
              Instagram e YouTube: o vídeo continua contido, mas a borda deixa
              de parecer defeito. */}
          {thumb && (
            <img src={thumb} alt="" aria-hidden
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-60 pointer-events-none" />
          )}
          {/* scrolling="no": a página de preview do Drive rola por conta própria e
              desenhava uma barra de rolagem DENTRO do player (o "risco" vertical que
              aparecia ao lado do vídeo na aprovação). */}
          {/* `relative z-10` (Walter, 14/09/2026: "tá meio esfumaçado"). O fundo
              desfocado é posicionado (absolute) e o player, sem medição de
              proporção, ficava ESTÁTICO. Em CSS, elemento posicionado pinta por
              cima do estático irmão: o borrão cobria o vídeo inteiro, e a
              pessoa via a peça lavada achando que era a qualidade do arquivo.
              Com o player posicionado, ele volta pra frente. */}
          <iframe src={embedUrl} scrolling="no" style={cover ?? undefined}
            className={cover ? "relative z-10 bg-black" : "relative z-10 w-full h-full bg-black"}
            allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={item.file_name || "vídeo"} />
          {driveViewUrl && (
            <button type="button" onClick={() => window.open(driveViewUrl, "_blank", "noopener,noreferrer")}
              className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-black/80">
              <ExternalLink className="h-3 w-3" /> Assistir no Drive
            </button>
          )}
        </div>
      );
    }
  }

  return (
    <div ref={slotRef} className="relative w-full h-full bg-black">
      {/* Fundo desfocado: preenche a sobra quando o frame não cobre o slot.
          Só entra quando o poster NÍTIDO já carregou: sozinho, ele viraria a
          imagem principal, e o cliente veria o vídeo lavado achando que a
          qualidade é essa. */}
      {thumb && thumbOk === true && (
        <img src={thumb} alt="" aria-hidden
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-60 pointer-events-none" />
      )}
      {/* Poster ainda não carregou: mostra a miniatura NÍTIDA e inteira, sem
          desfoque. Melhor uma imagem contida que um borrão em cima do preto. */}
      {thumb && thumbOk !== true && (
        <img src={thumb} alt="" aria-hidden
          className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
      )}
      {/* O poster mora no VideoPoster: ele cuida do fallback do Drive, da
          retentativa e da TARJA PRETA queimada na miniatura (ver poster-letterbox). */}
      <VideoPoster item={item} onStatus={(good) => { if (good && thumbOk === false) onReady?.(); setThumbOk(good); }} />
      {/* Play SEMPRE visível sobre fundo escuro: NUNCA um frame borrado sem controle.
          Se o poster não carregou (Bunny codificando / Drive bloqueado), mostra o
          rótulo "Assistir" pra deixar claro que dá pra tocar. */}
      <button type="button" onClick={onPlay} aria-label="Reproduzir vídeo" className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <span className="w-16 h-16 rounded-full bg-black/55 flex items-center justify-center shadow-lg"><Play className="h-8 w-8 text-white ml-1" /></span>
        {thumbOk !== true && (
          <span className="text-xs font-medium text-white/85 text-center px-4 leading-snug">
            {aindaProcessando
              ? "Assistir no Drive (o player está preparando este vídeo)"
              /* Bunny sem saída pelo Drive: é vídeo anexado ANTES de guardarmos
                 o arquivo de origem, e às vezes com encoding travado. Dizer
                 "Assistir" aqui é promessa que a tela não cumpre: o cliente
                 clica e cai na tela de "Processing" do player. Melhor avisar. */
              : kind === "bunny" ? "Vídeo em preparo. Se continuar assim, avise quem enviou."
              : "Assistir"}
          </span>
        )}
      </button>
      {/* Só pro Drive: atalho caso o embed /preview seja bloqueado pela conta do cliente. */}
      {driveViewUrl && (
        <button type="button" onClick={(e) => { e.stopPropagation(); window.open(driveViewUrl, "_blank", "noopener,noreferrer"); }}
          className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-black/80">
          <ExternalLink className="h-3 w-3" /> Assistir no Drive
        </button>
      )}
    </div>
  );
}

/**
 * A ARTE, sem a moldura preta que às vezes vem queimada no arquivo.
 *
 * O object-cover sozinho não resolve: ele recorta a imagem INTEIRA, tarja
 * incluída, então a faixa preta continua aparecendo (Walter, 14/09/2026). Aqui
 * a tarja é medida no pixel (poster-letterbox, o mesmo motor do poster de
 * vídeo) e a arte é reposicionada pra a moldura ficar fora do quadro.
 *
 * A medição só roda no Drive, que é onde o lh3 libera CORS. Fora dele, e
 * sempre que a arte vem limpa, cai no object-cover de antes: nada muda.
 */
function ArteSemTarja({ item, thumb, full, eager, onImgError }: {
  item: CarouselMedia; thumb: string | null; full: string; eager?: boolean;
  onImgError: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<LetterboxBox | null>(null);
  const [slotRatio, setSlotRatio] = useState(0);
  const probe = isDriveMedia(item) ? getDriveImageFallbackUrl(item, 320) : null;

  useEffect(() => {
    let vivo = true;
    setBox(null);
    if (!probe) return;
    probeLetterbox(probe).then((p) => { if (vivo) setBox(p?.box ?? null); });
    return () => { vivo = false; };
  }, [probe]);

  const medir = (el: HTMLDivElement | null) => {
    wrap.current = el;
    if (el && el.clientHeight > 0) setSlotRatio(el.clientWidth / el.clientHeight);
  };
  const cortada = box && slotRatio > 0 ? letterboxStyle(box, slotRatio) : null;

  if (cortada) {
    return (
      <div ref={medir} className="absolute inset-0 overflow-hidden bg-muted">
        <img src={full} alt={item.file_name || ""} loading={eager ? undefined : "lazy"}
          style={cortada} onError={onImgError} />
      </div>
    );
  }
  return (
    <div ref={medir} className="absolute inset-0">
      <ProgressiveImage
        thumbSrc={thumb} fullSrc={full} alt={item.file_name || ""} eager={eager}
        className="w-full h-full object-cover bg-muted"
        onFullError={onImgError} onThumbError={onImgError}
      />
    </div>
  );
}

function Slide({ item, onReady, eager }: { item: CarouselMedia; onReady?: () => void; eager?: boolean }) {
  if (isVideoMedia(item)) return <VideoSlide item={item} onReady={onReady} />;
  const full = getDisplayImageUrl(item) || "";
  // Miniatura leve pro placeholder; a cheia (full) entra por cima ao carregar.
  const thumb = getThumbnailUrl(item);
  // ESTADO NEUTRO do Drive: tipo desconhecido (arquivo não público). Mostra a
  // miniatura, que existe pros dois casos, SEM play gigante e SEM prometer
  // "Assistir". O atalho discreto "Abrir no Drive" serve tanto pra ver a arte
  // quanto pra assistir o vídeo, então nada fica inacessível.
  const unknownDriveUrl = isUnknownDriveMedia(item) ? getDriveViewPageUrl(item) : null;
  const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const fb = getDriveImageFallbackUrl(item);
    if (fb && !img.dataset.fb) { img.dataset.fb = "1"; img.src = fb; }
  };
  if (full) return (
    <div className="relative w-full h-full">
      {/* TARJA PRETA NA ARTE (Walter, 14/09/2026: "olha o preto embaixo da
          imagem"). A arte às vezes vem exportada dentro de uma moldura preta
          queimada no próprio pixel, e aí object-cover não adianta: ele recorta
          a imagem inteira, tarja incluída. É o MESMO problema já resolvido no
          poster de vídeo, então usa a mesma medição (poster-letterbox) e
          reposiciona a arte pra a tarja ficar de fora. Sem tarja, nada liga. */}
      <ArteSemTarja item={item} thumb={thumb} full={full} eager={eager} onImgError={onImgError} />
      {unknownDriveUrl && (
        <button type="button" onClick={(e) => { e.stopPropagation(); window.open(unknownDriveUrl, "_blank", "noopener,noreferrer"); }}
          className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-black/80">
          <ExternalLink className="h-3 w-3" /> Abrir no Drive
        </button>
      )}
    </div>
  );
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
      {/* `overflow-y-hidden` (Walter, 14/09/2026: "essa parte de baixo parece
          que faz scroll down"). Em CSS, definir só `overflow-x: auto` faz o
          eixo Y virar `auto` junto. Qualquer slide um fio mais alto que o
          quadro criava rolagem VERTICAL dentro do carrossel, e o que aparecia
          embaixo era o fundo preto do trilho. O eixo Y agora fica travado: o
          carrossel só anda pro lado. */}
      <div ref={scroller} onScroll={onScroll} className="flex w-full h-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {media.map((m, i) => (
          <div key={m.id ?? i} className="relative w-full h-full shrink-0 snap-center">
            <Slide item={m} onReady={onVideoReady} eager={i === 0} />
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
