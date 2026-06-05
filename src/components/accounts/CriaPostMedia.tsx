import { useRef, useState } from "react";
import { useCriaPostMedia } from "@/hooks/useCriaPostMedia";
import { PostMediaCarousel } from "@/components/shared/PostMediaCarousel";
import { postAspect } from "@/lib/post-aspect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Video, FileImage, Link2, Loader2, Heart, MessageCircle, Send, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { CriaPostPublishButton } from "@/components/accounts/CriaPostPublishButton";

export function CriaPostMedia({ postId, platform, format, caption, handle, approved }: {
  postId: string; platform: string; format: string; caption?: string; handle?: string; approved?: boolean;
}) {
  const { list, uploadImage, uploadVideo, addDriveLink, remove } = useCriaPostMedia(postId);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const gifRef = useRef<HTMLInputElement>(null);
  const [driveUrl, setDriveUrl] = useState("");
  const [showDrive, setShowDrive] = useState(false);
  const busy = uploadImage.isPending || uploadVideo.isPending || addDriveLink.isPending;

  const onImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    try { await uploadImage.mutateAsync(f); toast.success("Imagem adicionada"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha no upload"); }
  };
  const onVid = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    try { await uploadVideo.mutateAsync(f); toast.success("Vídeo enviado, processando…"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha no upload"); }
  };
  const onDrive = async () => {
    if (!driveUrl.trim()) return;
    try { await addDriveLink.mutateAsync(driveUrl.trim()); setDriveUrl(""); setShowDrive(false); toast.success("Link adicionado"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao adicionar"); }
  };
  const onRemoveMedia = async (id: string) => {
    try { await remove.mutateAsync(id); toast.success("Mídia removida"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao remover"); }
  };

  const media = list.data ?? [];
  const aspect = postAspect(platform, format);
  const vertical = aspect === "9 / 16";
  const h = handle ? (handle.startsWith("@") ? handle : "@" + handle) : "@cliente";
  const onReady = () => toast.success("Vídeo pronto!");

  return (
    <div className="space-y-3">
      {approved && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-3 space-y-2">
          <p className="text-xs font-body font-bold text-green-800">Aprovado pelo cliente — pronto pra publicar.</p>
          <CriaPostPublishButton caption={caption ?? ""} media={media} />
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <input ref={imgRef} type="file" accept="image/*,.heic,.heif" hidden onChange={onImg} />
        <input ref={vidRef} type="file" accept="video/*" hidden onChange={onVid} />
        <input ref={gifRef} type="file" accept="image/gif" hidden onChange={onImg} />
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => imgRef.current?.click()}><ImagePlus className="h-4 w-4 mr-1.5" /> Imagem</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => vidRef.current?.click()}><Video className="h-4 w-4 mr-1.5" /> Vídeo</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => gifRef.current?.click()}><FileImage className="h-4 w-4 mr-1.5" /> GIF</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setShowDrive((s) => !s)}><Link2 className="h-4 w-4 mr-1.5" /> Link Drive</Button>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {showDrive && (
        <div className="flex items-center gap-2">
          <Input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="Cole o link do Google Drive" className="h-9 rounded-xl" />
          <Button type="button" size="sm" onClick={onDrive} disabled={addDriveLink.isPending}>Adicionar</Button>
        </div>
      )}

      <div className={`bg-white border border-border rounded-2xl overflow-hidden ${vertical ? "max-w-[300px]" : ""}`}>
        {vertical ? (
          <div className="relative">
            <PostMediaCarousel media={media} aspect={aspect} onRemove={onRemoveMedia} onVideoReady={onReady} />
            <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/65 to-transparent pointer-events-none" />
            <div className="absolute right-3 bottom-14 z-10 flex flex-col items-center gap-3.5 text-white pointer-events-none [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.6))]">
              <Heart className="h-6 w-6" /><MessageCircle className="h-6 w-6" /><Send className="h-6 w-6" /><Bookmark className="h-6 w-6" />
            </div>
            {caption?.trim() && (
              <div className="absolute left-3 right-14 bottom-3 z-10 text-white text-[12px] leading-snug pointer-events-none line-clamp-2 [text-shadow:0_1px_3px_rgba(0,0,0,.6)]">
                <span className="font-bold mr-1">{h}</span>{caption}
              </div>
            )}
          </div>
        ) : (
          <>
            <PostMediaCarousel media={media} aspect={aspect} onRemove={onRemoveMedia} onVideoReady={onReady} />
            <div className="flex items-center gap-4 px-3.5 pt-3 pb-1.5 text-foreground/80">
              <Heart className="h-5 w-5" /><MessageCircle className="h-5 w-5" /><Send className="h-5 w-5" /><Bookmark className="h-5 w-5 ml-auto" />
            </div>
            {caption?.trim()
              ? <p className="px-3.5 pb-3.5 text-[13px] leading-snug text-foreground whitespace-pre-wrap"><span className="font-bold mr-1.5">{h}</span>{caption}</p>
              : <p className="px-3.5 pb-3.5 text-xs text-muted-foreground">A legenda aparece aqui.</p>}
          </>
        )}
      </div>
    </div>
  );
}
