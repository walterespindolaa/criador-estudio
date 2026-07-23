import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Reorder } from "framer-motion";
import { useCriaPostMedia, type CriaMedia } from "@/hooks/useCriaPostMedia";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { PostMediaCarousel } from "@/components/shared/PostMediaCarousel";
import { StoryPreview } from "@/components/accounts/StoryPreview";
import { CriaPostPublishButton } from "@/components/accounts/CriaPostPublishButton";
import { postAspect } from "@/lib/post-aspect";
import { getDisplayImageUrl, getDriveImageFallbackUrl, getDriveFileId, isDriveMedia, isVideoMedia } from "@/lib/driveMedia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Video, FileImage, Link2, Loader2, Heart, MessageCircle, Send, Bookmark, GripVertical, X, Play, Download, ExternalLink, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const MAX_MEDIA = 20;
const ACCEPTED_MSG = "Formato não aceito. Use imagens (JPG, PNG, WebP, GIF, HEIC) ou vídeos (MP4, MOV, WebM).";
const isImg = (f: File) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name);
const isVid = (f: File) => f.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(f.name);

function Thumb({ m }: { m: CriaMedia }) {
  const video = isVideoMedia(m);
  // Drive: view_url é página, não imagem. O helper monta o thumbnail exibível.
  const src = (isDriveMedia(m) ? getDisplayImageUrl(m, 400) : m.thumbnail_url || m.view_url) || "";
  // Fallback pro Drive: se o thumbnail falhar, tenta o lh3.
  const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const fb = getDriveImageFallbackUrl(m, 1000);
    if (fb && !img.dataset.fb) {
      img.dataset.fb = "1";
      img.src = fb;
      return;
    }
    img.style.display = "none";
  };
  return (
    <div className="relative w-full h-full bg-muted">
      {src ? <img src={src} alt="" draggable={false} loading="lazy" className="w-full h-full object-cover select-none" onError={onImgError} />
        : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><FileImage className="h-5 w-5" /></div>}
      {video && <span className="absolute inset-0 flex items-center justify-center pointer-events-none"><Play className="h-5 w-5 text-white [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.7))]" /></span>}
    </div>
  );
}

// Nome de arquivo seguro pro download individual: <titulo>-<n>.<ext> sem acento/espaço.
function baixarNomeArquivo(title: string | undefined, index: number, m: CriaMedia, mimeType?: string): string {
  const base = (title || "post")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 60) || "post";
  // Extensão: tenta pelo nome do arquivo salvo, depois pelo mime, senão jpg.
  const fromName = (m.file_name || "").match(/\.([a-z0-9]{2,5})$/i)?.[1];
  const fromMime = (mimeType || m.file_type || "").split("/")[1]?.split(";")[0];
  const ext = (fromName || fromMime || "jpg").toLowerCase().replace("jpeg", "jpg");
  return `${base}-${index + 1}.${ext}`;
}

export function CriaPostMedia({ postId, platform, format, caption, handle, approved, title, referenceUrl }: {
  postId: string; platform: string; format: string; caption?: string; handle?: string; approved?: boolean;
  title?: string; referenceUrl?: string | null;
}) {
  const { list, uploadImage, uploadVideo, addDriveLink, remove, reorder } = useCriaPostMedia(postId);
  const qc = useQueryClient();
  const { pickAndSave, picking } = useGoogleDrive();
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
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

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>, kind: "image" | "video") => {
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

  // Seleciona do Drive (multi): abre o seletor do Google, entra em pastas e marca
  // várias fotos de uma vez. Ideal pro carrossel. Depois recarrega a mídia.
  const onDrivePicker = async () => {
    if (remaining() <= 0) { toast.error(`Máximo de ${MAX_MEDIA} mídias por post.`); return; }
    try {
      await pickAndSave(postId);
      qc.invalidateQueries({ queryKey: ["criapost-media", postId] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Não consegui abrir o Drive"); }
  };

  // Download INDIVIDUAL de uma mídia, na melhor qualidade disponível:
  //  - Storage (device): baixa o arquivo como blob e força o download nomeado.
  //  - Drive: manda pro link de download do Drive (uc?export=download).
  //  - Vídeo (Bunny/Drive): não dá pra forçar o MP4, abre o player em nova aba.
  // Reaproveita o mesmo padrão do zip (blob + createObjectURL + a.click()), por arquivo.
  const [dlId, setDlId] = useState<string | null>(null);
  const onDownloadOne = async (m: CriaMedia, index: number) => {
    setDlId(m.id);
    try {
      if (isVideoMedia(m)) {
        const embed = m.view_url;
        if (!embed) throw new Error("Vídeo indisponível.");
        window.open(embed, "_blank", "noopener");
        toast.info("Vídeo aberto em nova aba pra você salvar de lá.");
        return;
      }
      if (isDriveMedia(m)) {
        const id = getDriveFileId(m);
        if (!id) throw new Error("Link do Drive inválido.");
        const a = document.createElement("a");
        a.href = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
        a.target = "_blank"; a.rel = "noopener";
        document.body.appendChild(a); a.click(); a.remove();
        return;
      }
      // Imagem no Storage: baixa os bytes e força o download com nome coerente.
      const url = m.view_url || m.thumbnail_url;
      if (!url) throw new Error("Arquivo indisponível.");
      const res = await fetch(url);
      if (!res.ok) throw new Error("Não consegui baixar o arquivo.");
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = obj; a.download = baixarNomeArquivo(title, index, m, blob.type);
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(obj);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui baixar.");
    } finally {
      setDlId(null);
    }
  };

  const [zipping, setZipping] = useState(false);
  // Baixa todas as mídias (qualidade original) numeradas + legenda.txt num .zip.
  const onDownloadZip = async () => {
    setZipping(true);
    try {
      const { data, error } = await supabase.functions.invoke("criapost-download-zip", { body: { post_id: postId } });
      if (error) throw error;
      const d = data as { filename: string; zip_base64: string; skipped?: number };
      const bytes = Uint8Array.from(atob(d.zip_base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
      const a = document.createElement("a"); a.href = url; a.download = d.filename; a.click();
      URL.revokeObjectURL(url);
      if (d.skipped) toast.warning(`${d.skipped} mídia(s) não baixaram (ex.: vídeo). Veja _avisos.txt no zip.`);
      else toast.success("Download pronto!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui gerar o zip.");
    } finally { setZipping(false); }
  };

  const aspect = postAspect(platform, format);
  const vertical = aspect === "9 / 16";
  const isStory = (format || "").toLowerCase() === "story";
  const h = handle ? (handle.startsWith("@") ? handle : "@" + handle) : "@cliente";
  // Normaliza a legenda pra prévia: tira espaços no fim de cada linha, colapsa
  // 3+ quebras em no máximo 2 (uma linha em branco) e dá trim nas pontas.
  const cap = (caption ?? "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const onReady = () => toast.success("Vídeo pronto!");

  return (
    <div className="space-y-3">
      {approved && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-3 space-y-2">
          <p className="text-xs font-body font-bold text-green-800">Aprovado pelo cliente, pronto pra publicar.</p>
          <div className="flex items-center gap-2 flex-wrap">
            <CriaPostPublishButton caption={caption ?? ""} media={ordered} />
            <Button type="button" size="sm" variant="outline" disabled={zipping || count === 0} onClick={onDownloadZip}>{zipping ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />} Baixar tudo (.zip)</Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <input ref={imgRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => onPick(e, "image")} />
        <input ref={vidRef} type="file" accept="video/*" multiple hidden onChange={(e) => onPick(e, "video")} />
        <Button type="button" size="sm" variant="outline" disabled={busy || full} onClick={() => imgRef.current?.click()}><ImagePlus className="h-4 w-4 mr-1.5" /> Imagem</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || full} onClick={() => vidRef.current?.click()}><Video className="h-4 w-4 mr-1.5" /> Vídeo</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || full || picking} onClick={onDrivePicker}>{picking ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileImage className="h-4 w-4 mr-1.5" />} Selecionar do Drive</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || full} onClick={() => setShowDrive((s) => !s)}><Link2 className="h-4 w-4 mr-1.5" /> Link Drive</Button>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <span className={`ml-auto text-xs font-body ${full ? "text-orange-600 font-bold" : "text-muted-foreground"}`}>{count}/{MAX_MEDIA}</span>
      </div>

      {showDrive && (
        <div>
          <div className="flex items-center gap-2">
            <Input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="Cole o link do Google Drive" className="h-9 rounded-xl" />
            <Button type="button" size="sm" onClick={onDrive} disabled={addDriveLink.isPending}>Adicionar</Button>
          </div>
          <p className="text-[11px] font-body text-muted-foreground mt-1.5">
            Cole o link do <strong>arquivo</strong>, não o da pasta. E deixe o arquivo como <strong>"Qualquer pessoa com o link"</strong> no Drive, senão a prévia não aparece.
          </p>
        </div>
      )}

      {ordered.length > 1 && (
        <div>
          <p className="text-[11px] text-muted-foreground font-body mb-1.5">Arraste para reordenar</p>
          <Reorder.Group axis="x" values={ordered} onReorder={(v) => { dirty.current = true; setOrder(v.map((m) => m.id)); }}
            className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
            {ordered.map((m, i) => (
              <Reorder.Item key={m.id} value={m} style={{ touchAction: "none" }} className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-border cursor-grab active:cursor-grabbing bg-muted select-none">
                <Thumb m={m} />
                <span className="absolute top-0.5 left-0.5 z-10 bg-black/65 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{i + 1}</span>
                <button type="button" onClick={() => onRemoveMedia(m.id)} className="absolute top-0.5 right-0.5 z-10 bg-black/65 text-white rounded-full p-0.5"><X className="h-3 w-3" /></button>
                <span className="absolute bottom-0.5 right-0.5 z-10 text-white/90 pointer-events-none"><GripVertical className="h-3.5 w-3.5 [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.7))]" /></span>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>
      )}

      {/* Anexos e links: um lugar só (estilo Trello) pra VER e ACESSAR todos os anexos
          e todos os links do post, com download individual por arquivo. Reaproveita a
          lista de mídia (inclui os do Drive) + o reference_url, sem duplicar dados. */}
      {(ordered.length > 0 || !!(referenceUrl && referenceUrl.trim())) && (
        <div className="rounded-2xl border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] font-body font-bold uppercase tracking-wide text-muted-foreground">Anexos e links</p>
          </div>

          {ordered.map((m, i) => {
            const drive = isDriveMedia(m);
            const video = isVideoMedia(m);
            const tipo = video ? "Vídeo" : drive ? "Drive" : "Imagem";
            return (
              <div key={m.id} className="flex items-center gap-2.5">
                <div className="relative shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-border bg-muted"><Thumb m={m} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-body text-foreground truncate">{m.file_name || `Mídia ${i + 1}`}</p>
                  <p className="text-[10px] font-body text-muted-foreground">{tipo}</p>
                </div>
                {drive && m.view_url && (
                  <a href={m.view_url} target="_blank" rel="noopener noreferrer" title="Abrir no Drive"
                    className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <button type="button" onClick={() => onDownloadOne(m, i)} disabled={dlId === m.id} title="Baixar este arquivo"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 disabled:opacity-50 transition-colors">
                  {dlId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </button>
              </div>
            );
          })}

          {!!(referenceUrl && referenceUrl.trim()) && (
            <a href={referenceUrl!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 group">
              <span className="shrink-0 w-10 h-10 rounded-lg border border-border bg-muted flex items-center justify-center text-muted-foreground"><Link2 className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-body text-primary group-hover:underline truncate">Referência / ideia</span>
                <span className="block text-[10px] font-body text-muted-foreground truncate">{referenceUrl}</span>
              </span>
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border text-muted-foreground group-hover:text-primary transition-colors"><ExternalLink className="h-4 w-4" /></span>
            </a>
          )}
        </div>
      )}

      {isStory ? (
        <div className="mx-auto w-full max-w-[300px]">
          <StoryPreview media={ordered} handle={handle} onRemove={onRemoveMedia} />
        </div>
      ) : (
      <div className={`bg-white border border-border rounded-2xl overflow-hidden mx-auto ${vertical ? "max-w-[360px]" : "max-w-[440px]"}`}>
        {vertical ? (
          <div className="relative">
            <PostMediaCarousel media={ordered} aspect={aspect} onRemove={onRemoveMedia} onVideoReady={onReady} />
            <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/65 to-transparent pointer-events-none" />
            <div className="absolute right-3 bottom-14 z-10 flex flex-col items-center gap-3.5 text-white pointer-events-none [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.6))]">
              <Heart className="h-6 w-6" /><MessageCircle className="h-6 w-6" /><Send className="h-6 w-6" /><Bookmark className="h-6 w-6" />
            </div>
            {cap && (
              <div className="absolute left-3 right-14 bottom-3 z-10 text-white text-[12px] leading-snug pointer-events-none line-clamp-2 [text-shadow:0_1px_3px_rgba(0,0,0,.6)]">
                <span className="font-bold mr-1">{h}</span>{cap}
              </div>
            )}
          </div>
        ) : (
          <>
            <PostMediaCarousel media={ordered} aspect={aspect} onRemove={onRemoveMedia} onVideoReady={onReady} />
            <div className="flex items-center gap-4 px-3.5 pt-3 pb-1.5 text-foreground/80">
              <Heart className="h-5 w-5" /><MessageCircle className="h-5 w-5" /><Send className="h-5 w-5" /><Bookmark className="h-5 w-5 ml-auto" />
            </div>
            {cap
              ? <p className="px-3.5 pb-3.5 text-[13px] leading-snug text-foreground whitespace-pre-wrap"><span className="font-bold mr-1.5">{h}</span>{cap}</p>
              : <p className="px-3.5 pb-3.5 text-xs text-muted-foreground">A legenda aparece aqui.</p>}
          </>
        )}
      </div>
      )}
    </div>
  );
}
