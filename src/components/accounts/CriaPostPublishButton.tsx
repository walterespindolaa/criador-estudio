import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { buildShareFile, isMobileDevice } from "@/lib/social-share";
import type { CarouselMedia } from "@/components/shared/PostMediaCarousel";

function firstDirectImage(media: CarouselMedia[]): string | null {
  for (const m of media) {
    const isVideo = m.file_type?.startsWith("video") || !!m.bunny_video_id || m.provider === "bunny_stream";
    if (isVideo) continue;
    if (m.provider === "drive") continue; // Drive não compartilha arquivo direto
    const url = m.view_url || m.download_url || "";
    if (/^https?:\/\//.test(url)) return url;
  }
  return null;
}

export function CriaPostPublishButton({ caption, media }: { caption: string; media: CarouselMedia[] }) {
  const [loading, setLoading] = useState(false);
  const mobile = isMobileDevice();

  const copyCaption = async () => { try { await navigator.clipboard.writeText(caption || ""); } catch { /* */ } };
  const shareText = async () => { if (navigator.share) { try { await navigator.share({ text: caption || "" }); } catch { /* */ } } };

  const handlePublish = async () => {
    await copyCaption();
    if (!mobile) { toast.info("Legenda copiada. Pra publicar com a mídia, abra no celular."); return; }
    const imgUrl = firstDirectImage(media);
    if (!imgUrl) { await shareText(); toast.info("Legenda copiada. Anexe a mídia no app."); return; }
    setLoading(true);
    try {
      const file = await buildShareFile(imgUrl, "image");
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: caption || "" });
        toast.success("Legenda copiada — é só colar no Instagram");
      } else { await shareText(); toast.info("Legenda copiada. Anexe a mídia no app."); }
    } catch { /* cancelado pelo usuário */ }
    finally { setLoading(false); }
  };

  return (
    <Button onClick={handlePublish} disabled={loading} variant="hero" className="w-full gap-2 rounded-2xl h-12">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mobile ? <Send className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
      {loading ? "Preparando mídia…" : "Publicar no Instagram"}
    </Button>
  );
}
