import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  detectMediaOrigin, resolveShareableUrl, buildShareFile, isMobileDevice,
} from "@/lib/social-share";

interface PublishButtonProps {
  caption: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
}

export function PublishButton({ caption, mediaUrl, mediaType }: PublishButtonProps) {
  const [loading, setLoading] = useState(false);
  const [driveWarnOpen, setDriveWarnOpen] = useState(false);

  const origin = detectMediaOrigin(mediaUrl);
  const mobile = isMobileDevice();

  const copyCaption = async () => {
    try { await navigator.clipboard.writeText(caption || ""); toast.success("Legenda copiada"); }
    catch { toast.error("Não foi possível copiar a legenda"); }
  };

  const openAppFallback = async () => {
    await copyCaption();
    if (navigator.share) {
      try { await navigator.share({ text: caption || "" }); } catch { /* cancelado */ }
    }
  };

  const handlePublish = async () => {
    if (!mobile) {
      await copyCaption();
      toast.info("Publicação direta só pelo app do celular. Legenda copiada — abra o CRIA no celular.");
      return;
    }
    if (origin === "drive") { setDriveWarnOpen(true); return; }
    if (origin === "none") { await openAppFallback(); return; }

    const fileUrl = resolveShareableUrl(mediaUrl!, origin);
    if (!fileUrl) { await openAppFallback(); toast.info("Legenda copiada. Anexe a mídia no app."); return; }

    setLoading(true);
    try {
      await navigator.clipboard.writeText(caption || "").catch(() => {});
      const file = await buildShareFile(fileUrl, mediaType);
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: caption || "" });
        toast.success("Legenda copiada — é só colar no app");
      } else {
        await openAppFallback();
        toast.info("Legenda copiada. Anexe a mídia no app.");
      }
    } catch { /* share cancelado pelo usuário */ }
    finally { setLoading(false); }
  };

  return (
    <>
      <Button onClick={handlePublish} disabled={loading} variant="hero" className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" />
          : mobile ? <Send className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
        {loading ? "Preparando mídia…" : mobile ? "Publicar" : "Publicar pelo celular"}
      </Button>

      <AlertDialog open={driveWarnOpen} onOpenChange={setDriveWarnOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mídia no Google Drive</AlertDialogTitle>
            <AlertDialogDescription>
              Não é possível publicar direto nas redes quando a mídia está no Google Drive.
              Você pode copiar a legenda e abrir o app (depois é só anexar a mídia manualmente),
              ou subir o vídeo/foto direto no CRIA para publicar com um toque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { setDriveWarnOpen(false); await openAppFallback(); }}>
              Copiar legenda e abrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
