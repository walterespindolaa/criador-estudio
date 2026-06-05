import { useRef, useState } from "react";
import { useCriaPostMedia } from "@/hooks/useCriaPostMedia";
import { PostMediaCarousel } from "@/components/shared/PostMediaCarousel";
import { postAspect } from "@/lib/post-aspect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Video, FileImage, Link2, Loader2, Heart, MessageCircle, Send, Bookmark } from "lucide-react";
import { toast } from "sonner";

export function CriaPostMedia({ postId, platform, format, caption }: {
  postId: string; platform: string; format: string; caption?: string;
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
    try { await uploadVideo.mutateAsync(f); toast.success("Vídeo adicionado"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha no upload"); }
  };
  const onDrive = async () => {
    if (!driveUrl.trim()) return;
    try { await addDriveLink.mutateAsync(driveUrl.trim()); setDriveUrl(""); setShowDrive(false); toast.success("Link adicionado"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao adicionar"); }
  };

  const media = list.data ?? [];
  const handle = "@cliente";

  return (
    <div className="space-y-3">
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

      {/* Prévia estilo post (igual o cliente vê) */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <PostMediaCarousel media={media} aspect={postAspect(platform, format)} onRemove={(id) => remove.mutate(id)} />
        <div className="flex items-center gap-4 px-3.5 pt-3 pb-1.5 text-foreground/80">
          <Heart className="h-5 w-5" /><MessageCircle className="h-5 w-5" /><Send className="h-5 w-5" /><Bookmark className="h-5 w-5 ml-auto" />
        </div>
        {caption && caption.trim()
          ? <p className="px-3.5 pb-3.5 text-[13px] leading-snug text-foreground whitespace-pre-wrap"><span className="font-bold mr-1.5">{handle}</span>{caption}</p>
          : <p className="px-3.5 pb-3.5 text-xs text-muted-foreground">A legenda aparece aqui.</p>}
      </div>
    </div>
  );
}
