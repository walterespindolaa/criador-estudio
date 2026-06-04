import { useRef, useState } from "react";
import { useCriaPostMedia } from "@/hooks/useCriaPostMedia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Video, FileImage, Link2, X, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

export function CriaPostMedia({ postId }: { postId: string }) {
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

      {media.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {media.map((m) => (
            <div key={m.id} className="relative group aspect-square rounded-xl overflow-hidden border border-border bg-muted">
              {m.provider === "bunny_stream" ? (
                <div className="w-full h-full flex items-center justify-center bg-foreground/5"><Play className="h-6 w-6 text-muted-foreground" /></div>
              ) : (
                <img src={m.thumbnail_url || m.view_url || ""} alt={m.file_name} loading="lazy" className="w-full h-full object-cover" />
              )}
              <button type="button" onClick={() => remove.mutate(m.id)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      ) : (
        !busy && <p className="text-xs text-muted-foreground font-body">Nenhuma mídia ainda. Adicione imagem, vídeo, GIF ou link do Drive.</p>
      )}
    </div>
  );
}
