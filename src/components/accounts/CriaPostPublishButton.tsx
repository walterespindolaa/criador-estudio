import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { buildShareFile } from "@/lib/social-share";
import { PublicarDialog, type PublicarMidia } from "@/components/shared/PublicarDialog";
import type { CarouselMedia } from "@/components/shared/PostMediaCarousel";
import { isDriveMedia, isVideoMedia } from "@/lib/driveMedia";

/* O botão só ABRE a tela de publicar. Toda a lógica (copiar com fallback,
   compartilhar só o arquivo pro Instagram aparecer, abrir o app) vive no
   PublicarDialog, que é o mesmo nos dois lugares do produto.

   Antes daqui saía só um toast: no desktop "abra no celular", no celular um
   share de TEXTO (que nunca lista o Instagram). Era o "não abre nada" e o
   "Instagram não aparece". */

// Primeira mídia que dá pra compartilhar como arquivo. Drive fica de fora: o
// link dele não entrega o binário (é página de preview).
function primeiraCompartilhavel(media: CarouselMedia[]): { url: string; tipo: "image" | "video" } | null {
  for (const m of media) {
    if (isDriveMedia(m)) continue;
    const url = m.download_url || m.view_url || "";
    if (!/^https?:\/\//.test(url)) continue;
    return { url, tipo: isVideoMedia(m) ? "video" : "image" };
  }
  return null;
}

export function CriaPostPublishButton({ caption, media }: { caption: string; media: CarouselMedia[] }) {
  const [open, setOpen] = useState(false);

  const midia = useMemo<PublicarMidia | null>(() => {
    const alvo = primeiraCompartilhavel(media);
    const temDrive = media.some((m) => isDriveMedia(m));
    if (!alvo) {
      return temDrive
        ? { build: async () => null, rotulo: "arquivo", aviso: "A mídia deste post está no Google Drive, e de lá não dá pra mandar o arquivo direto pro Instagram. Baixe do Drive e anexe no app." }
        : null;
    }
    return {
      build: () => buildShareFile(alvo.url, alvo.tipo),
      rotulo: alvo.tipo === "video" ? "o vídeo" : "a imagem",
    };
  }, [media]);

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="hero" className="w-full gap-2 rounded-2xl h-12">
        <Send className="h-4 w-4" /> Publicar no Instagram
      </Button>
      <PublicarDialog open={open} onOpenChange={setOpen} caption={caption} midia={midia} />
    </>
  );
}
