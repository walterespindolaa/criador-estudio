import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useRef } from "react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Heart, MessageCircle, Send, Bookmark, Play, Music2, Share2, ChevronLeft, ChevronRight, Image, X, FileText } from "lucide-react";
import { MolduraLinkedIn } from "@/components/shared/MolduraLinkedIn";
import { VideoMediaSlot } from "./VideoMediaSlot";
import { YT_CORTE_MAIS, capitulosDoRoteiro, duracaoYouTube, hashtagsDaDescricao, type YoutubeDoPost } from "@/lib/youtube";

interface SectionData {
  text: string;
  /** Minuto do bloco no vídeo de YouTube (vira capítulo). */
  minuto?: string | null;
  driveFileId?: string | null;
  driveFileName?: string | null;
  driveThumbnail?: string | null;
}

interface PostPreviewContentProps {
  title: string;
  hook: string;
  caption: string;
  platform: string;
  format: string;
  userName: string;
  userHandle: string;
  avatarUrl: string | null;
  mediaUrl?: string;
  mediaType?: string;
  media?: string;
  thumbnail?: string;
  coverImage?: string;
  sections?: SectionData[];
  /** Imagens do carrossel, na ordem da tira de mídia do editor (27/09/2026).
   *  A mídia do carrossel saiu das lâminas e virou uma tira só; a prévia ainda
   *  lia a imagem de cada lâmina e ficava no placeholder. */
  carouselMedia?: string[];
  /** Vídeo de cada lâmina, na mesma posição de carouselMedia (null = imagem).
   *  Walter, 24/11/2026: vídeo dentro do carrossel não aparecia na prévia. */
  carouselVideos?: (string | null)[];
  // No modal, a fila de abas deixa um vao a direita pro X redondo nao cobrir o YT.
  folgaParaFechar?: boolean;
  /** Painel do editor (19/10/2026): a plataforma já foi escolhida no
   *  formulário; sem as abas IG/TK/YT a prévia ganha 44px de altura. */
  semAbasPlataforma?: boolean;
  /** Capa do Reels (posts.cover_url). Aparece por cima do vídeo até o play,
   *  como no Instagram antes de tocar (20/10/2026). */
  capa?: string | null;
  /** Progresso do envio do vídeo (0-100) enquanto ele ainda sobe. */
  envioPct?: number | null;
  /** Campos do post de YouTube (25/11/2026): título do vídeo, miniatura etc. */
  youtube?: YoutubeDoPost | null;
}

interface PostPreviewProps extends PostPreviewContentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* MINIATURA DO DRIVE QUE NÃO ABRE (Gabriela, 25/11/2026). O lh3 só serve
   arquivo público; com o arquivo privado a prévia mostrava o ícone quebrado e
   a palavra "preview". No erro tenta a miniatura do próprio Drive (que usa o
   login do Google do navegador) e, se nem ela vier, some com a imagem. */
function seImagemFalhar(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  const id = img.src.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  if (id && !img.dataset.tentouDrive) {
    img.dataset.tentouDrive = "1";
    img.src = `https://drive.google.com/thumbnail?id=${id}&sz=w800`;
    return;
  }
  img.style.display = "none";
}

/* VÍDEO DO DRIVE (08/11/2026, Walter: "não consigo visualizar o vídeo, dar
   play"). O <video src> do Drive não toca (cookie/CORS), então a prévia era só
   a foto do quadro, sem play. Agora mostra a foto com o botão e, no clique,
   troca pelo player do próprio Drive (iframe /preview), que toca pra quem tem
   acesso ao arquivo. */
function VideoDoDrive({ fileId, poster, className }: { fileId: string; poster: string | null; className?: string }) {
  const [tocar, setTocar] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!tocar || !caixa.current) return;
    const el = caixa.current;
    const medir = () => setTam({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tocar]);
  if (tocar) {
    /* O player do Drive abaixo de ~300px de largura empurra o vídeo pro lado e
       deixa uma faixa preta (testado em 08/11/2026). Então o iframe nasce com
       405px de largura, na proporção da moldura, e é reduzido por escala. */
    const BASE = 405;
    const escala = tam && tam.w > 0 ? tam.w / BASE : 1;
    const altura = tam && tam.w > 0 ? Math.round((tam.h / tam.w) * BASE) : 720;
    return (
      <div ref={caixa} className={`${className ?? ""} overflow-hidden bg-black`}>
        {tam && (
          <iframe
            src={`https://drive.google.com/file/d/${fileId}/preview`}
            title="Vídeo do Drive"
            allow="autoplay; fullscreen"
            allowFullScreen
            className="absolute top-0 left-0 border-0"
            style={{ width: BASE, height: altura, transform: `scale(${escala})`, transformOrigin: "top left" }}
          />
        )}
      </div>
    );
  }
  return (
    <button type="button" onClick={() => setTocar(true)} aria-label="Tocar o vídeo"
      className={`${className ?? ""} block bg-neutral-900 z-[2]`}>
      {poster && <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" onError={seImagemFalhar} />}
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
          <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" />
        </span>
      </span>
    </button>
  );
}

// Conteudo puro da previa (sem Dialog), reutilizavel: vive no modal fullscreen do
// mobile E na coluna direita fixa do desktop dentro do PostEditor.
export function PostPreviewContent({ title, hook, caption, platform, format, userName, userHandle, avatarUrl, mediaUrl, mediaType, media, thumbnail, coverImage, sections, carouselMedia, carouselVideos, folgaParaFechar, semAbasPlataforma, capa, envioPct, youtube }: PostPreviewContentProps) {
  const initials = (userName || "C")[0].toUpperCase();
  // Trocou a capa, ela volta pra frente mesmo depois de um play.
  const [capaVista, setCapaVista] = useState<string | null>(null);
  const mostraCapa = !!capa && mediaType === "video" && capaVista !== capa;
  // Com capa, o player só nasce no clique (e aí já toca): nada roda escondido atrás da capa.
  const pediuPlay = !!capa && capaVista === capa;
  const capaPorCima = mostraCapa ? (
    <button type="button" onClick={() => setCapaVista(capa ?? null)} aria-label="Ver o vídeo"
      className="absolute inset-0 z-[3] block w-full h-full overflow-hidden bg-neutral-900">
      <img src={capa!} alt="Capa do Reels" className="absolute inset-0 w-full h-full object-cover" />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
          <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" />
        </span>
      </span>
      <span className="absolute left-2.5 bottom-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-body font-bold text-white">capa</span>
    </button>
  ) : null;
  const [igTabEscolhida, setIgTab] = useState<"feed" | "reels">("feed");
  /* UMA PRÉVIA SÓ (Walter, 04/11/2026: "aqui tá Reels, mas ele puxa o formato
     de feed; deveria aparecer um ou outro, igual no de social mídia"). Quando o
     formato do post já diz qual é, a prévia segue ele e as abas somem. As abas
     só ficam pra formato que não define (ex.: sem formato escolhido). */
  const fmtIg: "feed" | "reels" | null = /reel|stor|v[ií]deo|video/i.test(format ?? "") ? "reels"
    : /carross|foto|post|est[aá]tic|imagem|feed/i.test(format ?? "") ? "feed" : null;
  const igTab = fmtIg ?? igTabEscolhida;
  const [ytTab, setYtTab] = useState<"thumbnail" | "shorts">(format === "shorts" ? "shorts" : "thumbnail");
  // Prévia do YouTube com o que o post tem de verdade (Walter, 25/11/2026, mockup aprovado):
  // duração do vídeo, hashtags em cima do título, corte do "mais" e capítulos.
  const [duracaoSeg, setDuracaoSeg] = useState<number | null>(null);
  const ytCapitulos = format === "video" ? capitulosDoRoteiro(sections ?? []) : [];
  const ytHashtags = hashtagsDaDescricao(caption).slice(0, 3);
  const ytDescricao = caption.trim();
  const ytCorte = (() => {
    let c = Math.min(YT_CORTE_MAIS, ytDescricao.length);
    let quebras = 0;
    for (let i = 0; i < c; i++) if (ytDescricao[i] === "\n" && ++quebras === 2) { c = i; break; }
    return c;
  })();
  const ytTitulo = youtube?.titulo?.trim() || title || hook || "Título do vídeo";
  const [carouselIdx, setCarouselIdx] = useState(0);

  const activeMediaUrl = mediaUrl || media || thumbnail || coverImage;
  // Vídeos do Drive não tocam em <video src> (cookie/CORS) → renderiza como imagem (poster lh3).
  const isDriveVideo = mediaType === "video" && !!activeMediaUrl && activeMediaUrl.includes("drive.google.com");
  // Vídeos do Bunny vêm como URL de iframe (player nativo do Bunny).
  const isBunnyVideo = mediaType === "video" && !!activeMediaUrl && activeMediaUrl.includes("iframe.mediadelivery.net");
  const driveVideoIdMatch = isDriveVideo ? activeMediaUrl!.match(/(?:\/d\/|[?&]id=)([a-zA-Z0-9_-]+)/) : null;
  const drivePosterUrl = driveVideoIdMatch
    ? `https://lh3.googleusercontent.com/d/${driveVideoIdMatch[1]}=w800`
    : null;
  const isPlayableVideo = mediaType === "video" && !isDriveVideo && !isBunnyVideo;

  useEffect(() => { setCarouselIdx(0); }, [format]);

  const AvatarCircle = ({ size = 32, border = false }: { size?: number; border?: boolean }) => (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center shrink-0"
      style={{
        width: size, height: size,
        border: border ? "2px solid white" : "none",
        background: avatarUrl ? "transparent" : "rgba(255,255,255,0.2)",
      }}
    >
      {avatarUrl
        ? <img src={avatarUrl} className="w-full h-full object-cover" alt={userName} loading="lazy" />
        : <span style={{ fontSize: size * 0.4, fontWeight: 700 }} className="text-white">{initials}</span>}
    </div>
  );

  /* Quantas lâminas (27/09/2026, Walter: "fica fixo esses 5 slides mesmo tendo
     só 1 ou 4"). O editor já nasce com 5 lâminas de texto vazias; contar elas
     deixava a prévia sempre em 1/5. Agora: com imagens na tira, são as
     imagens que dizem quantas lâminas existem. Sem imagem, contam só as
     lâminas que têm texto ou mídia própria (mínimo 1). */
  const secoesUsadas = (sections ?? []).filter((s) => !!(s.text?.trim() || s.driveThumbnail || s.driveFileId)).length;
  const nMidias = carouselMedia?.length ?? 0;
  const isCarousel = format === "carrossel" && ((sections?.length ?? 0) > 0 || nMidias > 0);
  const nLaminas = nMidias > 0 ? nMidias : Math.max(1, secoesUsadas);
  const carouselSlides: Partial<SectionData>[] = isCarousel
    /* Até 20 lâminas (04/11/2026): o Instagram aceita 20 no carrossel desde
       2024 e a publicação (ig-midia) já valida até 20. O teto antigo de 10
       cortava a prévia e parecia que o Cria não aceitava mais imagens. */
    ? Array.from({ length: Math.min(20, nLaminas) }, (_, i) => sections?.[i] ?? {})
    : [];
  // Se a tira encolheu (tirou imagem), a lâmina aberta não pode passar do fim.
  const slideIdx = Math.min(carouselIdx, Math.max(0, carouselSlides.length - 1));
  const currentSlide = carouselSlides[slideIdx];
  // driveThumbnail (URL pronta, vem do Storage do upload local OU do Drive)
  // tem prioridade. driveFileId só vira URL lh3 quando é um ID real do Drive,
  // não um path do Storage (que tem "/").
  const currentCarouselMedia = carouselMedia?.[slideIdx]
    ? carouselMedia[slideIdx]
    : currentSlide?.driveThumbnail
    ? currentSlide.driveThumbnail
    : currentSlide?.driveFileId
      ? (currentSlide.driveFileId.includes("/")
          ? currentSlide.driveFileId
          : `https://lh3.googleusercontent.com/d/${encodeURIComponent(currentSlide.driveFileId)}=w800`)
      : null;
  // Lâmina de vídeo: o endereço do player vem em carouselVideos, na mesma posição.
  const videoDaLamina = carouselVideos?.[slideIdx] || null;
  const laminaBunny = !!videoDaLamina && videoDaLamina.includes("iframe.mediadelivery.net");
  const laminaDriveId = videoDaLamina && videoDaLamina.includes("drive.google.com")
    ? videoDaLamina.match(/(?:\/d\/|[?&]id=)([a-zA-Z0-9_-]+)/)?.[1] ?? null
    : null;

  // Gradient placeholder when no media
  /* `icone={false}` quando quem chama já desenha o próprio símbolo. Sem isso o
     YouTube ficava com DOIS ícones empilhados (a moldura de imagem daqui mais o
     play que a aba passava como filho), que foi o "meio feio" que o Walter viu
     em 09/09/2026. */
  const GradientPlaceholder = ({ children, className = "", icone = true }: { children?: React.ReactNode; className?: string; icone?: boolean }) => (
    <div className={`w-full h-full flex flex-col items-center justify-center ${className}`}
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>
      {icone && <Image className="h-10 w-10 text-white/20 mb-2" />}
      {children}
    </div>
  );

  // Carousel navigation
  const CarouselNav = ({ total, current, onChange }: { total: number; current: number; onChange: (i: number) => void }) => (
    <>
      {current > 0 && (
        <button onClick={() => onChange(current - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/80 rounded-full flex items-center justify-center shadow-md z-20">
          <ChevronLeft className="h-4 w-4 text-gray-800" />
        </button>
      )}
      {current < total - 1 && (
        <button onClick={() => onChange(current + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/80 rounded-full flex items-center justify-center shadow-md z-20">
          <ChevronRight className="h-4 w-4 text-gray-800" />
        </button>
      )}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1 z-20">
        {Array.from({ length: total }).map((_, i) => (
          <button key={i} onClick={() => onChange(i)} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === current ? "bg-white" : "bg-white/40"}`} />
        ))}
      </div>
      <div className="absolute top-3 right-3 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full font-body z-20">
        {current + 1}/{total}
      </div>
    </>
  );

  // Media area for feed (carousel or single)
  const FeedMedia = () => {
    if (isCarousel) {
      const imgUrl = currentCarouselMedia;
      return (
        <div className="relative w-full aspect-[4/5] overflow-hidden">
          {videoDaLamina ? (
            laminaBunny ? (
              <VideoMediaSlot key={videoDaLamina} viewUrl={videoDaLamina} className="w-full h-full border-0" />
            ) : laminaDriveId ? (
              <VideoDoDrive key={laminaDriveId} fileId={laminaDriveId} poster={imgUrl || `https://lh3.googleusercontent.com/d/${laminaDriveId}=w800`} className="absolute inset-0 w-full h-full" />
            ) : (
              <video key={videoDaLamina} src={videoDaLamina} poster={imgUrl || undefined} controls playsInline className="w-full h-full object-cover" />
            )
          ) : imgUrl ? (
            <img src={imgUrl} alt={`Lâmina ${slideIdx + 1}`} className="w-full h-full object-cover" loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <GradientPlaceholder>
              {currentSlide?.text && <p className="text-white/60 text-xs text-center px-6 max-w-[200px]">{currentSlide.text}</p>}
            </GradientPlaceholder>
          )}
          <CarouselNav total={carouselSlides.length} current={slideIdx} onChange={setCarouselIdx} />
        </div>
      );
    }

    return (
      <div className="relative w-full aspect-[4/5] overflow-hidden">
        {capaPorCima}
        {activeMediaUrl ? (
          isBunnyVideo ? (
            mostraCapa ? null : <VideoMediaSlot viewUrl={activeMediaUrl!} autoplay={pediuPlay} envioPct={envioPct} className="w-full h-full border-0" />
          ) : isPlayableVideo ? (
            mostraCapa ? null : <video
              src={activeMediaUrl}
              autoPlay={pediuPlay}
              controls
              playsInline
              className="w-full h-full object-cover"
            />
          ) : isDriveVideo && driveVideoIdMatch ? (
            mostraCapa ? null : <VideoDoDrive fileId={driveVideoIdMatch[1]} poster={drivePosterUrl} className="absolute inset-0 w-full h-full" />
          ) : (
            <img src={drivePosterUrl || activeMediaUrl} alt="preview" className="w-full h-full object-cover" loading="lazy" onError={seImagemFalhar} />
          )
        ) : (
          <GradientPlaceholder>
            {hook && <p className="text-white/70 text-xs font-semibold text-center px-6 max-w-[220px]">"{hook}"</p>}
          </GradientPlaceholder>
        )}
      </div>
    );
  };

  // Vertical 9:16 preview (reels, story, tiktok, shorts)
  const VerticalPreview = ({ variant }: { variant: "reels" | "tiktok" | "shorts" }) => {
    const isTiktok = variant === "tiktok";
    const isShorts = variant === "shorts";

    return (
      <div className="flex justify-center py-4 px-4">
        <div className="relative overflow-hidden w-full max-w-[260px]"
          style={{ aspectRatio: "9/16", borderRadius: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
          {capaPorCima}
          {/* Background media or gradient */}
          {activeMediaUrl ? (
            isBunnyVideo ? (
              mostraCapa ? null : <div className="absolute inset-0"><VideoMediaSlot viewUrl={activeMediaUrl!} autoplay={pediuPlay} envioPct={envioPct} className="w-full h-full border-0" /></div>
            ) : isPlayableVideo ? (
              mostraCapa ? null : <video
                src={activeMediaUrl}
                autoPlay={pediuPlay}
                controls
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : isDriveVideo && driveVideoIdMatch ? (
              mostraCapa ? null : <VideoDoDrive fileId={driveVideoIdMatch[1]} poster={drivePosterUrl} className="absolute inset-0 w-full h-full" />
            ) : (
              <img src={drivePosterUrl || activeMediaUrl} alt="preview" className="absolute inset-0 w-full h-full object-cover" loading="lazy" onError={seImagemFalhar} />
            )
          ) : (
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }} />
          )}

          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70 z-[1] pointer-events-none" />

          {/* Top bar */}
          {isShorts ? (
            <div className="absolute top-3 left-0 right-0 text-center z-10 pointer-events-none">
              <span className="text-white text-[10px] font-bold bg-red-600 px-2.5 py-0.5 rounded">Shorts</span>
            </div>
          ) : (
            <div className="absolute top-3 left-3 flex items-center gap-2 z-10 pointer-events-none">
              <AvatarCircle size={28} border />
              <div>
                <p className="text-white text-[11px] font-semibold leading-tight">{userName}</p>
                {!isTiktok && <p className="text-white/50 text-[9px]">@{userHandle}</p>}
              </div>
              {!isTiktok && (
                <button className="ml-1 border border-white/60 text-white text-[9px] px-2 py-0.5 rounded-full">Seguir</button>
              )}
            </div>
          )}

          {/* Side actions */}
          <div className="absolute right-2.5 bottom-20 flex flex-col gap-4 items-center z-10 pointer-events-none">
            {isTiktok && (
              <div className="flex flex-col items-center gap-0.5">
                <AvatarCircle size={34} border />
                <span className="text-white text-[9px] mt-0.5">+</span>
              </div>
            )}
            <div className="flex flex-col items-center gap-0.5">
              <Heart className="h-6 w-6 text-white drop-shadow" />
              <span className="text-white text-[9px]">{isTiktok ? "98,3k" : isShorts ? "24k" : "1,2k"}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <MessageCircle className="h-6 w-6 text-white drop-shadow" />
              <span className="text-white text-[9px]">{isTiktok ? "1.234" : isShorts ? "482" : "48"}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              {isTiktok ? <Share2 className="h-6 w-6 text-white drop-shadow" /> : <Send className="h-6 w-6 text-white drop-shadow" />}
              <span className="text-white text-[9px]">{isTiktok ? "Salvar" : isShorts ? "Salvar" : "Enviar"}</span>
            </div>
            {!isTiktok && <Bookmark className="h-6 w-6 text-white drop-shadow" />}
          </div>

          {/* Bottom text */}
          <div className="absolute bottom-4 left-3 right-14 z-10 pointer-events-none">
            {isTiktok && <p className="text-white text-[11px] font-semibold mb-0.5">@{userHandle}</p>}
            {(hook || title) && <p className="text-white text-xs font-semibold mb-0.5 line-clamp-2 drop-shadow">{hook || title}</p>}
            {caption && <p className="text-white/80 text-[10px] line-clamp-2">{caption}</p>}
            {!isShorts && (
              <p className="text-white/40 text-[9px] mt-1 flex items-center gap-1">
                <Music2 className="h-2.5 w-2.5" /> Som original · {userName}
              </p>
            )}
            {isShorts && <p className="text-white/60 text-[10px] mt-0.5">{userName}</p>}
          </div>
        </div>
      </div>
    );
  };

  return (
    // key: trocar a plataforma no editor reabre a prévia na aba dela (a aba do LinkedIn só existe em post de LinkedIn).
    <Tabs key={platform || "instagram"} defaultValue={platform || "instagram"} className="w-full">
          {/* Seletor em pílulas (Walter, 01/09: as abas antigas estavam "muito
              feias perto do sistema"): trilho arredondado, sem linhas duras. */}
          {/* LinkedIn só entra nas abas quando o post é de LinkedIn (25/11/2026). */}
          <TabsList className={`${semAbasPlataforma ? "hidden" : "grid"} ml-2 mt-2 mb-1 ${platform === "linkedin" ? "grid-cols-4" : "grid-cols-3"} h-8 rounded-xl bg-muted/60 p-0.5 gap-0.5 ${folgaParaFechar ? "mr-12" : "mr-2"}`}>
            {["instagram", "tiktok", "youtube", ...(platform === "linkedin" ? ["linkedin"] : [])].map(p => (
              <TabsTrigger key={p} value={p} className="font-body text-[11px] gap-1 rounded-[10px] data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">
                <PlatformIcon platform={p} size="sm" />
                <span className="capitalize">{p === "youtube" ? "YT" : p === "instagram" ? "IG" : p === "linkedin" ? "in" : "TK"}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* INSTAGRAM */}
          <TabsContent value="instagram" className="m-0">
            <div className={`mx-2 mb-1.5 grid-cols-2 gap-0.5 rounded-xl bg-muted/40 p-0.5 ${fmtIg ? "hidden" : "grid"}`}>
              {(["feed", "reels"] as const).map(t => (
                <button key={t} onClick={() => setIgTab(t)}
                  className={`h-7 rounded-[10px] text-[10.5px] font-body font-semibold transition-colors ${igTab === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {t === "feed" ? "Feed 4:5" : "Reels / Story"}
                </button>
              ))}
            </div>

            {igTab === "feed" ? (
              <div>
                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-card">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center shrink-0">
                    {avatarUrl
                      ? <img src={avatarUrl} className="w-full h-full object-cover" alt={userName} loading="lazy" />
                      : <span className="text-xs font-bold text-primary">{initials}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{userName}</p>
                    <p className="text-[10px] text-muted-foreground">@{userHandle}</p>
                  </div>
                  <span className="text-[10px] font-bold text-primary">Seguir</span>
                </div>

                {/* Media */}
                <FeedMedia />

                {/* Actions & caption */}
                <div className="px-3 py-2 bg-card">
                  <div className="flex gap-3 mb-1.5 text-foreground">
                    <Heart className="h-5 w-5" />
                    <MessageCircle className="h-5 w-5" />
                    <Send className="h-5 w-5" />
                    <Bookmark className="h-5 w-5 ml-auto" />
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-1">1.234 curtidas</p>
                  {/* A LEGENDA É A LEGENDA (Walter, 15/09/2026).
                      Aqui era `caption || hook`: com a legenda ainda vazia, a
                      prévia mostrava o GANCHO no lugar dela. No carrossel isso
                      fica pior ainda, porque o gancho é a capa (slide 1), ou
                      seja, o texto que está DENTRO da arte aparecia de novo
                      embaixo dela, como se fosse a legenda escrita. A pessoa
                      olha a prévia e acha que já escreveu.
                      Sem legenda, a prévia mostra que falta escrever. */}
                  {caption ? (
                    <p className="text-[11px] text-foreground line-clamp-2">
                      <span className="font-semibold">{userName}</span>{" "}{caption}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/70 italic">A legenda aparece aqui</p>
                  )}
                </div>
              </div>
            ) : (
              <VerticalPreview variant="reels" />
            )}
          </TabsContent>

          {/* LINKEDIN (mockup aprovado em 25/11/2026): cara do feed do LinkedIn,
              texto cortado onde o feed corta ("ver mais") e mídia por formato. */}
          {platform === "linkedin" && (
            <TabsContent value="linkedin" className="m-0">
              <MolduraLinkedIn nome={userName} avatarUrl={avatarUrl} texto={caption}>
                  {format === "carrossel" && nMidias > 1 ? (
                    <div className="grid aspect-square grid-cols-[2fr_1fr] grid-rows-2 gap-0.5 bg-white">
                      {carouselMedia!.slice(0, 3).map((u, i) => (
                        <div key={i} className={`relative overflow-hidden bg-muted ${i === 0 ? "row-span-2" : ""}`}>
                          <img src={u} alt="" className="h-full w-full object-cover" onError={seImagemFalhar} />
                          {i === 2 && nMidias > 3 && <span className="absolute inset-0 grid place-items-center bg-black/55 text-lg font-bold text-white">+{nMidias - 3}</span>}
                        </div>
                      ))}
                    </div>
                  ) : format === "documento" ? (
                    <div className="bg-[#1d1d1d]">
                      <div className="relative aspect-[4/5] overflow-hidden">
                        {carouselMedia?.[0] || activeMediaUrl
                          ? <img src={carouselMedia?.[0] || activeMediaUrl} alt="" className="h-full w-full object-cover" onError={seImagemFalhar} />
                          : <GradientPlaceholder icone={false}><FileText className="h-10 w-10 text-white/40" /><span className="mt-2 text-[11px] text-white/60">Primeira página do PDF</span></GradientPlaceholder>}
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 text-[11px] text-white"><span>Documento</span><span>1 / {Math.max(1, nMidias)}</span></div>
                    </div>
                  ) : format !== "texto" ? (
                    <FeedMedia />
                  ) : null}
              </MolduraLinkedIn>
            </TabsContent>
          )}

          {/* TIKTOK */}
          <TabsContent value="tiktok" className="m-0">
            <VerticalPreview variant="tiktok" />
          </TabsContent>

          {/* YOUTUBE */}
          <TabsContent value="youtube" className="m-0">
            <div className="flex border-b border-border/50 bg-card/50">
              {(["thumbnail", "shorts"] as const).map(t => (
                <button key={t} onClick={() => setYtTab(t)}
                  className={`flex-1 py-1.5 text-[11px] font-body transition-colors ${ytTab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
                  {t === "thumbnail" ? "Thumbnail 16:9" : "Shorts"}
                </button>
              ))}
            </div>

            {ytTab === "thumbnail" ? (
              /* A capa vai de ponta a ponta, como no YouTube e como já era na
                 aba do Instagram aqui do lado. Antes ela tinha 12px de respiro
                 dos dois lados e canto arredondado dentro de um card de 290px:
                 sobrava moldura e o vídeo ficava minúsculo (Walter, 09/09). */
              <div className="bg-card">
                <div className="relative overflow-hidden aspect-video">
                  {/* Miniatura própria do post aparece como no YouTube: a capa por cima. */}
                  {youtube?.miniatura_url ? (
                    <img src={youtube.miniatura_url} alt="Miniatura do vídeo" className="w-full h-full object-cover" />
                  ) : activeMediaUrl ? (
                    isBunnyVideo ? (
                      <VideoMediaSlot viewUrl={activeMediaUrl!} envioPct={envioPct} className="w-full h-full border-0" />
                    ) : isPlayableVideo ? (
                      <video
                        src={activeMediaUrl}
                        controls
                        playsInline
                        onLoadedMetadata={(e) => setDuracaoSeg(e.currentTarget.duration)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img src={drivePosterUrl || activeMediaUrl} alt="thumbnail" className="w-full h-full object-cover" loading="lazy" />
                    )
                  ) : (
                    <GradientPlaceholder icone={false}>
                      {/* Botão de play do YouTube, não um ícone solto: é o que
                          faz a caixa preta parecer um vídeo e não um erro. */}
                      <span className="grid h-11 w-16 place-items-center rounded-xl bg-white/15 backdrop-blur-sm">
                        <Play className="h-5 w-5 text-white/80" fill="currentColor" />
                      </span>
                      <span className="mt-2 text-[10px] font-body text-white/45">a capa do vídeo entra aqui</span>
                    </GradientPlaceholder>
                  )}
                  {/* Duração de verdade (lida do vídeo). Sem ela, não mostra: o
                      "8:42" fixo era um número inventado (mockup de 25/11/2026). */}
                  {duracaoYouTube(duracaoSeg) && (
                    <div className="absolute bottom-2 right-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-body pointer-events-none">{duracaoYouTube(duracaoSeg)}</div>
                  )}
                  {/* Barra cortada nos capítulos, como no player do YouTube. */}
                  {ytCapitulos.length >= 3 && (
                    <div className="absolute inset-x-0 bottom-0 flex h-1 gap-0.5 pointer-events-none">
                      {ytCapitulos.map((c, i) => <i key={c.minuto} className={i === 0 ? "flex-1 bg-[#E62117]" : "flex-1 bg-white/55"} />)}
                    </div>
                  )}
                </div>
                <div className="px-3 pt-2.5">
                  {ytHashtags.length > 0 && <p className="text-[11px] text-[#065fd4] truncate">{ytHashtags.join(" ")}</p>}
                  <p className="text-[15px] font-medium text-foreground line-clamp-2 leading-snug mt-0.5">{ytTitulo}</p>
                  <p className="text-[10.5px] text-muted-foreground mt-1">Prévia de como vai aparecer</p>
                </div>
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center shrink-0">
                    {avatarUrl
                      ? <img src={avatarUrl} className="w-full h-full object-cover" alt={userName} loading="lazy" />
                      : <span className="text-xs font-bold text-primary">{initials}</span>}
                  </div>
                  <p className="text-[13px] font-medium text-foreground truncate">{userName}</p>
                  <span className="ml-auto rounded-full bg-foreground text-background px-3 py-1.5 text-[12px] font-medium">Inscrever-se</span>
                </div>
                {ytDescricao && (
                  <div className="mx-3 mb-3 rounded-xl bg-muted/60 px-3 py-2 text-[12.5px] leading-snug text-foreground whitespace-pre-line">
                    {ytDescricao.slice(0, ytCorte)}{ytCorte < ytDescricao.length && <span className="font-medium"> ...mais</span>}
                  </div>
                )}
                {ytCapitulos.length >= 3 && (
                  <div className="px-3 pb-3">
                    <p className="text-[13px] font-medium mb-1.5">Capítulos</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                      {ytCapitulos.map((c, i) => (
                        <div key={c.minuto} className="w-28 shrink-0">
                          <div className={`relative aspect-video rounded-lg ${["bg-[#EA4918]", "bg-[#FF77B9]", "bg-[#0061EE]", "bg-[#FFCF03]", "bg-[#00A652]"][i % 5]}`}>
                            <span className="absolute left-1 bottom-1 rounded bg-black/80 px-1 text-[9.5px] text-white">{c.minuto}</span>
                          </div>
                          <p className="mt-1 text-[11px] leading-tight line-clamp-2">{c.titulo}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <VerticalPreview variant="shorts" />
            )}
          </TabsContent>
    </Tabs>
  );
}

// Wrapper de dialog (mobile / botao "Previa"): mantem a mesma API de antes.
export function PostPreviewModal({ open, onOpenChange, ...rest }: PostPreviewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* O X padrao do DialogContent (absoluto no canto) caia EM CIMA da fila de
          abas IG/TK/YT e parecia um botao perdido (Walter, 04/09). Escondemos o
          padrao e desenhamos um X redondo com o mesmo alinhamento das abas. */}
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-3xl border-0 shadow-2xl bg-background [&>button:last-child]:hidden">
        <div className="relative">
          <PostPreviewContent {...rest} folgaParaFechar />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar prévia"
            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-muted/70 hover:bg-muted text-foreground flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
