import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, MessageCircle, Send, Bookmark, Play, Share2, Music2, UserPlus } from "lucide-react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";

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
}

export function PostPreviewModal({
  open, onOpenChange, title, hook, caption, platform, format, userName, userHandle, avatarUrl,
}: PostPreviewProps) {
  const initials = (userName || "C")[0].toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-background">
        <Tabs defaultValue={platform || "instagram"} className="w-full">
          <TabsList className="w-full rounded-none border-b border-border bg-card">
            <TabsTrigger value="instagram" className="flex-1 font-body text-xs"><PlatformIcon platform="instagram" size="sm" /><span className="ml-1">Instagram</span></TabsTrigger>
            <TabsTrigger value="tiktok" className="flex-1 font-body text-xs"><PlatformIcon platform="tiktok" size="sm" /><span className="ml-1">TikTok</span></TabsTrigger>
            <TabsTrigger value="youtube" className="flex-1 font-body text-xs"><PlatformIcon platform="youtube" size="sm" /><span className="ml-1">YouTube</span></TabsTrigger>
          </TabsList>

          {/* Instagram Preview */}
          <TabsContent value="instagram" className="mt-0">
            <div className="bg-black text-white aspect-[9/16] max-h-[480px] relative flex flex-col justify-between overflow-hidden rounded-b-lg">
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
              <div className="relative z-10 p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-white/40">
                  {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <span className="text-xs font-bold">{initials}</span>}
                </div>
                <div>
                  <p className="text-xs font-semibold">{userName}</p>
                  <p className="text-[10px] opacity-70">@{userHandle || "usuario"}</p>
                </div>
              </div>
              <div className="relative z-10 p-4 flex gap-3">
                <div className="flex-1">
                  {hook && <p className="text-sm font-bold mb-2 leading-snug">{hook}</p>}
                  {caption && <p className="text-xs opacity-80 line-clamp-3">{caption}</p>}
                </div>
                <div className="flex flex-col gap-4 items-center">
                  <Heart className="h-6 w-6" />
                  <MessageCircle className="h-6 w-6" />
                  <Send className="h-6 w-6" />
                  <Bookmark className="h-6 w-6" />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TikTok Preview */}
          <TabsContent value="tiktok" className="mt-0">
            <div className="bg-black text-white aspect-[9/16] max-h-[480px] relative flex flex-col justify-between overflow-hidden rounded-b-lg">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />
              <div className="relative z-10 p-4 pt-8">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-white/40">
                    {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <span className="text-sm font-bold">{initials}</span>}
                  </div>
                  <span className="text-xs font-semibold">@{userHandle || "usuario"}</span>
                  <button className="ml-2 px-3 py-0.5 rounded border border-white/60 text-[10px] flex items-center gap-1"><UserPlus className="h-3 w-3" /> Seguir</button>
                </div>
              </div>
              <div className="relative z-10 p-4 flex gap-3">
                <div className="flex-1">
                  {hook && <p className="text-sm font-bold mb-1">{hook}</p>}
                  {caption && <p className="text-xs opacity-80 line-clamp-2">{caption}</p>}
                  <div className="flex items-center gap-1 mt-2 opacity-60"><Music2 className="h-3 w-3" /><span className="text-[10px]">Som original</span></div>
                </div>
                <div className="flex flex-col gap-4 items-center">
                  <Heart className="h-6 w-6" />
                  <MessageCircle className="h-6 w-6" />
                  <Share2 className="h-6 w-6" />
                  <Bookmark className="h-6 w-6" />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* YouTube Preview */}
          <TabsContent value="youtube" className="mt-0">
            <div className="p-4">
              <div className="bg-muted aspect-video rounded-xl relative flex items-center justify-center mb-3">
                <div className="w-16 h-16 rounded-full bg-red-600/90 flex items-center justify-center">
                  <Play className="h-8 w-8 text-white fill-white" />
                </div>
                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded">
                  {format === "shorts" ? "0:30" : format === "reels" ? "1:00" : "8:42"}
                </div>
                <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-semibold">HD</div>
              </div>
              <p className="font-body font-semibold text-foreground text-sm mb-1 line-clamp-2">{title || "Título do vídeo"}</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                  {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-foreground">{initials}</span>}
                </div>
                <div>
                  <p className="text-xs font-body text-foreground font-medium">{userName}</p>
                  <p className="text-[10px] text-muted-foreground font-body">0 visualizações · agora</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
