import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Heart, MessageCircle, Send, Bookmark, Play, Music2, Share2 } from "lucide-react";

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
}

export function PostPreviewModal({ open, onOpenChange, title, hook, caption, platform, format, userName, userHandle, avatarUrl, mediaUrl }: PostPreviewProps) {
  const initials = (userName || "C")[0].toUpperCase();
  const [igTab, setIgTab] = useState<"feed" | "reels">("feed");
  const [ytTab, setYtTab] = useState<"thumbnail" | "shorts">("thumbnail");

  const Avatar = ({ size = "sm" }: { size?: "sm" | "lg" }) => (
    <div className={`rounded-full overflow-hidden bg-primary/20 flex items-center justify-center shrink-0 ${size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm"} font-bold text-primary`}>
      {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" alt={userName} /> : initials}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-background rounded-2xl">
        <Tabs defaultValue={platform || "instagram"} className="w-full">
          <TabsList className="w-full rounded-none border-b border-border bg-card grid grid-cols-3 h-10">
            <TabsTrigger value="instagram" className="font-body text-xs flex items-center gap-1.5">
              <PlatformIcon platform="instagram" size="sm" /> Instagram
            </TabsTrigger>
            <TabsTrigger value="tiktok" className="font-body text-xs flex items-center gap-1.5">
              <PlatformIcon platform="tiktok" size="sm" /> TikTok
            </TabsTrigger>
            <TabsTrigger value="youtube" className="font-body text-xs flex items-center gap-1.5">
              <PlatformIcon platform="youtube" size="sm" /> YouTube
            </TabsTrigger>
          </TabsList>

          {/* Instagram */}
          <TabsContent value="instagram" className="m-0">
            <div className="flex border-b border-border bg-card/50">
              <button onClick={() => setIgTab("feed")}
                className={`flex-1 py-2 text-xs font-body transition-colors ${igTab === "feed" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
                Feed (1:1)
              </button>
              <button onClick={() => setIgTab("reels")}
                className={`flex-1 py-2 text-xs font-body transition-colors ${igTab === "reels" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
                Reels / Story (9:16)
              </button>
            </div>

            {igTab === "feed" ? (
              <div className="bg-white">
                <div className="flex items-center gap-2 p-3">
                  <Avatar />
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{userName}</p>
                    <p className="text-[10px] text-gray-500">@{userHandle}</p>
                  </div>
                  <button className="ml-auto text-xs font-bold text-blue-500">Seguir</button>
                </div>
                <div className="w-full aspect-square overflow-hidden bg-muted relative">
                  {mediaUrl ? (
                    <img src={mediaUrl} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center p-4">
                      {hook && <p className="text-sm font-bold text-center text-foreground">"{hook}"</p>}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex gap-3 mb-2 text-gray-800">
                    <Heart className="h-5 w-5" />
                    <MessageCircle className="h-5 w-5" />
                    <Send className="h-5 w-5" />
                    <Bookmark className="h-5 w-5 ml-auto" />
                  </div>
                  <p className="text-xs text-gray-500 mb-1">1.234 curtidas</p>
                  {caption && <p className="text-xs text-gray-900 line-clamp-2"><span className="font-semibold">{userName}</span> {caption}</p>}
                  {hook && !caption && <p className="text-xs text-gray-900 line-clamp-2"><span className="font-semibold">{userName}</span> {hook}</p>}
                </div>
              </div>
            ) : (
              <div className="bg-black relative overflow-hidden" style={{ aspectRatio: "9/16", maxHeight: 480 }}>
                {mediaUrl ? (
                  <img src={mediaUrl} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
                <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                  <Avatar />
                  <div>
                    <p className="text-white text-xs font-semibold">{userName}</p>
                    <p className="text-white/60 text-[10px]">@{userHandle}</p>
                  </div>
                  <button className="ml-2 border border-white text-white text-[10px] px-2 py-0.5 rounded-full">Seguir</button>
                </div>
                <div className="absolute right-3 bottom-20 flex flex-col gap-4 items-center z-10">
                  <div className="flex flex-col items-center gap-0.5"><Heart className="h-6 w-6 text-white" /><span className="text-white text-[10px]">1,2k</span></div>
                  <div className="flex flex-col items-center gap-0.5"><MessageCircle className="h-6 w-6 text-white" /><span className="text-white text-[10px]">48</span></div>
                  <div className="flex flex-col items-center gap-0.5"><Send className="h-6 w-6 text-white" /><span className="text-white text-[10px]">Enviar</span></div>
                  <Bookmark className="h-6 w-6 text-white" />
                </div>
                <div className="absolute bottom-4 left-3 right-14 z-10">
                  {hook && <p className="text-white text-xs font-semibold mb-1 line-clamp-2">{hook}</p>}
                  {caption && <p className="text-white/80 text-[10px] line-clamp-2">{caption}</p>}
                  <p className="text-white/50 text-[10px] mt-1 flex items-center gap-1"><Music2 className="h-2.5 w-2.5" /> Som original · {userName}</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TikTok */}
          <TabsContent value="tiktok" className="m-0">
            <div className="bg-black relative overflow-hidden" style={{ aspectRatio: "9/16", maxHeight: 480 }}>
              {mediaUrl ? (
                <img src={mediaUrl} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />
              <div className="absolute right-2 bottom-24 flex flex-col gap-5 items-center z-10">
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white">
                    <Avatar />
                  </div>
                  <span className="text-white text-[10px] mt-1">+</span>
                </div>
                <div className="flex flex-col items-center gap-0.5"><Heart className="h-7 w-7 text-white" /><span className="text-white text-[10px]">98,3k</span></div>
                <div className="flex flex-col items-center gap-0.5"><MessageCircle className="h-7 w-7 text-white" /><span className="text-white text-[10px]">1.234</span></div>
                <div className="flex flex-col items-center gap-0.5"><Share2 className="h-7 w-7 text-white" /><span className="text-white text-[10px]">Salvar</span></div>
              </div>
              <div className="absolute bottom-4 left-3 right-14 z-10">
                <p className="text-white text-sm font-semibold mb-1">@{userHandle}</p>
                {hook && <p className="text-white text-xs mb-1 line-clamp-2">{hook}</p>}
                {caption && <p className="text-white/80 text-[10px] line-clamp-2">{caption}</p>}
                <p className="text-white/50 text-[10px] mt-1.5 flex items-center gap-1"><Music2 className="h-2.5 w-2.5" /> Som original · {userName}</p>
              </div>
            </div>
          </TabsContent>

          {/* YouTube */}
          <TabsContent value="youtube" className="m-0">
            <div className="flex border-b border-border bg-card/50">
              <button onClick={() => setYtTab("thumbnail")}
                className={`flex-1 py-2 text-xs font-body transition-colors ${ytTab === "thumbnail" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
                Thumbnail (16:9)
              </button>
              <button onClick={() => setYtTab("shorts")}
                className={`flex-1 py-2 text-xs font-body transition-colors ${ytTab === "shorts" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
                Shorts (9:16)
              </button>
            </div>

            {ytTab === "thumbnail" ? (
              <div className="bg-white p-3">
                <div className="relative rounded-lg overflow-hidden aspect-video bg-gray-200 mb-3">
                  {mediaUrl ? (
                    <img src={mediaUrl} alt="thumbnail" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute bottom-1.5 right-1.5 bg-black text-white text-[10px] px-1 rounded">8:42</div>
                  <div className="absolute top-1.5 right-1.5 bg-black text-white text-[10px] px-1 rounded">HD</div>
                </div>
                <div className="flex gap-2">
                  <Avatar size="lg" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2">{title || hook || "Título do vídeo"}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{userName} · 0 visualizações · agora</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-black relative overflow-hidden" style={{ aspectRatio: "9/16", maxHeight: 480 }}>
                {mediaUrl ? (
                  <img src={mediaUrl} alt="shorts" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />
                <div className="absolute top-2 left-0 right-0 text-center z-10">
                  <span className="text-white text-xs font-bold bg-red-600 px-2 py-0.5 rounded">Shorts</span>
                </div>
                <div className="absolute right-2 bottom-24 flex flex-col gap-4 items-center z-10">
                  <div className="flex flex-col items-center gap-0.5"><Heart className="h-6 w-6 text-white" /><span className="text-white text-[10px]">24k</span></div>
                  <div className="flex flex-col items-center gap-0.5"><MessageCircle className="h-6 w-6 text-white" /><span className="text-white text-[10px]">482</span></div>
                  <div className="flex flex-col items-center gap-0.5"><Share2 className="h-6 w-6 text-white" /><span className="text-white text-[10px]">Salvar</span></div>
                </div>
                <div className="absolute bottom-4 left-3 right-14 z-10">
                  <p className="text-white font-semibold text-sm mb-1 line-clamp-2">{title || hook || "Título do Short"}</p>
                  <p className="text-white/70 text-xs">{userName}</p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
