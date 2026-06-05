import { useEffect, useRef, useState } from "react";
import { Reorder } from "framer-motion";
import { useCriaPostMedia, type CriaMedia } from "@/hooks/useCriaPostMedia";
import { PostMediaCarousel } from "@/components/shared/PostMediaCarousel";
import { CriaPostPublishButton } from "@/components/accounts/CriaPostPublishButton";
import { postAspect } from "@/lib/post-aspect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Video, FileImage, Link2, Loader2, Heart, MessageCircle, Send, Bookmark, GripVertical, X, Play } from "lucide-react";
import { toast } from "sonner";

const MAX_MEDIA = 20;
const ACCEPTED_MSG = "Formato não aceito. Use imagens (JPG, PNG, WebP, GIF, HEIC) ou vídeos (MP4, MOV, WebM).";
const isImg = (f: File) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name);
const isVid = (f: File) => f.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(f.name);

function Thumb({ m }: { m: CriaMedia }) {
  const video = m.file_type?.startsWith("video") || !!m.bunny_video_id || m.provider === "bunny_stream";
  const src = m.thumbnail_url || m.view_url || "";
  return (
    <div className="relative w-full h-full bg-muted">
      {src ? <img src={src} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><FileImage className="h-5 w-5" /></div>}
      {video && <span className="absolute inset-0 flex items-center justify-center pointer-events-none"><Play className="h-5 w-5 text-white [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.7))]" /></span>}
    </div>
  );
}

export function CriaPostMedia({ postId, platform, format, caption, handle, approved }: {
  postId: string; platform: string; format: string; caption?: string; handle?: string; approved?: boolean;
}) {
  const { list, uploadImage, uploadVideo, addDriveLink, remove, reorder } = useCriaPostMedia(postId);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const gifRef = useRef<HTMLInputElement>(null);
  const [driveUrl, setDriveUrl] = useState("");
  const [showDrive, setShowDrive] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const dirty = useRef(false);
  const busy = uploadImage.isPending || uploadVideo.isPending || addDriveLink.isPending;

  const media = list.data ?? [];
  const count = media.length;
  const full = count >= MAX_MEDIA;
  const remaining = () => MAX_MEDIA - (list.data?.length ?? 0);

  useEffect(() => { if (!dirty.current) setOrder(media.map((m) => m.id)); }, [media]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dirty.current) return;
    const ids = order;
    const t = setTimeout(() => { reorder.mutate(ids, { onSettled: () => { dirty.current = false; } }); }, 600);
    return () => clearTimeout(t);
  }, [order]); // eslint-disable-line react-hooks/exhaustive-deps

  const ordered: CriaMedia[] = order.length
    ? (order.map((id) => media.find((m) => m.id === id)).filter(Boolean) as CriaMedia[])
    : media;

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>, kind: "image" | "video" | "gif") => {
    const files = Array.from(e.target.files ?? []); e.target.value = "";
    if (!files.length) return;
    const slots = remaining();
    if (slots <= 0) { toast.error(`Máximo de ${MAX_MEDIA} mídias por post.`); return; }
    const take = files.slice(0, slots);
    if (files.length > slots) toast.warning(`Só cabem mais ${slots}. Enviando as primeiras ${slots}.`);
    let okImg = 0;
    for (const f of take) {
      const wantVideo = kind === "video";
      if (wantVideo ? !isVid(f) : !isImg(f)) { toast.error(ACCEPTED_MSG); continue; }
      try {
        if (wantVideo) { await uploadVideo.mutateAsync(f); toast.success("Vídeo enviado, processando…"); }
        else { await uploadImage.mutateAsync(f); okImg++; }
      } catch (err) { toast.error(err instanceof Error ? err.message : "Falha no upload"); }
    }
    if (okImg === 1) toast.success("Mídia adicionada");
    else if (okImg > 1) toast.success(`${okImg} mídias adicionadas`);
  };

  const onDrive = async () => {
    if (!driveUrl.trim()) return;
    if (remaining() <= 0) { toast.error(`Máximo de ${MAX_MEDIA} mídias por post.`); return; }
    try { await addDriveLink.mutateAsync(driveUrl.trim()); setDriveUrl(""); setShowDrive(false); toast.success("Link adicionado"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao adicionar"); }
  };

  const onRemoveMedia = async (id: string) => {
    try { await remove.mutateAsync(id); toast.success("Mídia removida"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao remover"); }
  };

  const aspect = postAspect(platform, format);
  const vertical = aspect === "9 / 16";
  const h = handle ? (handle.startsWith("@") ? handle : "@" + handle) : "@cliente";
  const onReady = () => toast.success("Vídeo pronto!");

  return (
    <div className="space-y-3">
      {approved && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-3 space-y-2">
          <p className="text-xs font-body font-bold text-green-800">Aprovado pelo cliente — pronto pra publicar.</p>
          <CriaPostPublishButton caption={caption ?? ""} media={ordered} />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <input ref={imgRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => onPick(e, "image")} />
        <input ref={vidRef} type="file" accept="video/*" multiple hidden onChange={(e) => onPick(e, "video")} />
        <input ref={gifRef} type="file" accept="image/gif" multiple hidden onChange={(e) => onPick(e, "gif")} />
        <Button type="button" size="sm" variant="outline" disabled={busy || full} onClick={() => imgRef.current?.click()}><ImagePlus className="h-4 w-4 mr-1.5" /> Imagem</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || full} onClick={() => vidRef.current?.click()}><Video className="h-4 w-4 mr-1.5" /> Vídeo</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || full} onClick={() => gifRef.current?.click()}><FileImage className="h-4 w-4 mr-1.5" /> GIF</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || full} onClick={() => setShowDrive((s) => !s)}><Link2 className="h-4 w-4 mr-1.5" /> Link Drive</Button>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <span className={`ml-auto text-xs font-body ${full ? "text-orange-600 font-bold" : "text-muted-foreground"}`}>{count}/{MAX_MEDIA}</span>
      </div>

      {showDrive && (
        <div className="flex items-center gap-2">
          <Input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="Cole o link do Google Drive" className="h-9 rounded-xl" />
          <Button type="button" size="sm" onClick={onDrive} disabled={addDriveLink.isPending}>Adicionar</Button>
        </div>
      )}

      {ordered.length > 1 && (
        <div>
          <p className="text-[11px] text-muted-foreground font-body mb-1.5">Arraste para reordenar</p>
          <Reorder.Group axis="x" values={ordered} onReorder={(v) => { dirty.current = true; setOrder(v.map((m) => m.id)); }}
            className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
            {ordered.map((m, i) => (
              <Reorder.Item key={m.id} value={m} className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-border cursor-grab active:cursor-grabbing bg-muted">
                <Thumb m={m} />
                <span className="absolute top-0.5 left-0.5 z-10 bg-black/65 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{i + 1}</span>
                <button type="button" onClick={() => onRemoveMedia(m.id)} className="absolute top-0.5 right-0.5 z-10 bg-black/65 text-white rounded-full p-0.5"><X className="h-3 w-3" /></button>
                <span className="absolute bottom-0.5 right-0.5 z-10 text-white/90 pointer-events-none"><GripVertical className="h-3.5 w-3.5 [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.7))]" /></span>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>
      )}

      <div className={`bg-white border border-border rounded-2xl overflow-hidden ${vertical ? "max-w-[300px]" : ""}`}>
        {vertical ? (
          <div className="relative">
            <PostMediaCarousel media={ordered} aspect={aspect} onRemove={onRemoveMedia} onVideoReady={onReady} />
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
            <PostMediaCarousel media={ordered} aspect={aspect} onRemove={onRemoveMedia} onVideoReady={onReady} />
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
