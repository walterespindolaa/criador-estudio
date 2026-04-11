import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Heart, MessageCircle, Send, Bookmark, Play, Music2, Share2, ChevronLeft, ChevronRight, Image } from "lucide-react";

interface SectionData {
  text: string;
  driveFileId?: string | null;
  driveFileName?: string | null;
  driveThumbnail?: string | null;
}

interface PostPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  sections?: SectionData[];
}

export function PostPreviewModal({ open, onOpenChange, title, hook, caption, platform, format, userName, userHandle, avatarUrl, mediaUrl, mediaType, sections }: PostPreviewProps) {
  const initials = (userName || "C")[0].toUpperCase();
  const [igTab, setIgTab] = useState<"feed" | "reels">("feed");
  const [ytTab, setYtTab] = useState<"thumbnail" | "shorts">("thumbnail");
  const [carouselIdx, setCarouselIdx] = useState(0);

  useEffect(() => { if (open) setCarouselIdx(0); }, [open, format]);

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
        ? <img src={avatarUrl} className="w-full h-full object-cover" alt={userName} />
        : <span style={{ fontSize: size * 0.4, fontWeight: 700 }} className="text-white">{initials}</span>}
    </div>
  );

  const isCarousel = format === "carrossel" && sections && sections.length > 0;
  const carouselSlides = isCarousel ? sections!.slice(0, 10) : [];
  const currentSlide = carouselSlides[carouselIdx];
  const currentCarouselMedia = currentSlide?.driveFileId
    ? `https://lh3.googleusercontent.com/d/${encodeURIComponent(currentSlide.driveFileId)}=w800`
    : null;

  // Gradient placeholder when no media
  const GradientPlaceholder = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => (
    <div className={`w-full h-full flex flex-col items-center justify-center ${className}`}
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>
      <Image className="h-10 w-10 text-white/20 mb-2" />
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
          {imgUrl ? (
            <img src={imgUrl} alt={`Lâmina ${carouselIdx + 1}`} className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <GradientPlaceholder>
              {currentSlide?.text && <p className="text-white/60 text-xs text-center px-6 max-w-[200px]">{currentSlide.text}</p>}
            </GradientPlaceholder>
          )}
          <CarouselNav total={carouselSlides.length} current={carouselIdx} onChange={setCarouselIdx} />
        </div>
      );
    }

    return (
      <div className="relative w-full aspect-[4/5] overflow-hidden">
        {mediaUrl ? (
          <img src={mediaUrl} alt="preview" className="w-full h-full object-cover" />
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
          {/* Background media or gradient */}
          {mediaUrl ? (
            <img src={mediaUrl} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }} />
          )}

          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70 z-[1]" />

          {/* Top bar */}
          {isShorts ? (
            <div className="absolute top-3 left-0 right-0 text-center z-10">
              <span className="text-white text-[10px] font-bold bg-red-600 px-2.5 py-0.5 rounded">Shorts</span>
            </div>
          ) : (
            <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
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
          <div className="absolute right-2.5 bottom-20 flex flex-col gap-4 items-center z-10">
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
          <div className="absolute bottom-4 left-3 right-14 z-10">
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden rounded-3xl border-0 shadow-2xl bg-background">
        <Tabs defaultValue={platform || "instagram"} className="w-full">
          <TabsList className="w-full rounded-none border-b border-border bg-card/80 backdrop-blur grid grid-cols-3 h-11">
            {["instagram", "tiktok", "youtube"].map(p => (
              <TabsTrigger key={p} value={p} className="font-body text-[11px] gap-1 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none">
                <PlatformIcon platform={p as any} size="sm" />
                <span className="capitalize">{p === "youtube" ? "YT" : p === "instagram" ? "IG" : "TK"}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* INSTAGRAM */}
          <TabsContent value="instagram" className="m-0">
            <div className="flex border-b border-border/50 bg-card/50">
              {(["feed", "reels"] as const).map(t => (
                <button key={t} onClick={() => setIgTab(t)}
                  className={`flex-1 py-1.5 text-[11px] font-body transition-colors ${igTab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
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
                      ? <img src={avatarUrl} className="w-full h-full object-cover" alt={userName} />
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
                  {(caption || hook) && (
                    <p className="text-[11px] text-foreground line-clamp-2">
                      <span className="font-semibold">{userName}</span>{" "}{caption || hook}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <VerticalPreview variant="reels" />
            )}
          </TabsContent>

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
              <div className="p-3 bg-card">
                <div className="relative rounded-xl overflow-hidden aspect-video mb-3">
                  {mediaUrl ? (
                    <img src={mediaUrl} alt="thumbnail" className="w-full h-full object-cover" />
                  ) : (
                    <GradientPlaceholder>
                      <Play className="h-10 w-10 text-white/30" />
                    </GradientPlaceholder>
                  )}
                  <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-body">8:42</div>
                </div>
                <div className="flex gap-2.5">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center shrink-0">
                    {avatarUrl
                      ? <img src={avatarUrl} className="w-full h-full object-cover" alt={userName} />
                      : <span className="text-xs font-bold text-primary">{initials}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{title || hook || "Título do vídeo"}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{userName} · 0 visualizações · agora</p>
                  </div>
                </div>
              </div>
            ) : (
              <VerticalPreview variant="shorts" />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
