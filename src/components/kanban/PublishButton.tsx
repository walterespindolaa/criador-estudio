import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import {
  detectMediaOrigin, resolveShareableUrl, buildShareFile,
} from "@/lib/social-share";
import { getLocalVideoFile } from "@/lib/media-cache";
import { PublicarDialog, type PublicarMidia } from "@/components/shared/PublicarDialog";

/* O botão só ABRE a tela de publicar (PublicarDialog), que é a mesma do Cria
   Post. Antes daqui saíam três caminhos diferentes de toast e nenhuma tela:
   no desktop parecia que o botão não fazia nada, a cópia da legenda acontecia
   depois de vários await (o iOS recusa: não é mais o gesto do clique) e o
   share ia com TEXTO, que é justamente o que faz o Instagram sumir da lista. */

interface PublishButtonProps {
  caption: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
}

export function PublishButton({ caption, mediaUrl, mediaType }: PublishButtonProps) {
  const [open, setOpen] = useState(false);

  const midia = useMemo<PublicarMidia | null>(() => {
    const origin = detectMediaOrigin(mediaUrl);
    if (origin === "none") return null;
    if (origin === "drive") {
      return {
        build: async () => null,
        rotulo: "arquivo",
        aviso: "A mídia deste post está no Google Drive, e de lá não dá pra mandar o arquivo direto pro Instagram. Baixe do Drive e anexe no app.",
      };
    }
    const fileUrl = resolveShareableUrl(mediaUrl!, origin);
    if (!fileUrl) return null;
    return {
      // Vídeo recém-subido tem cópia local: compartilha na hora, sem rede.
      build: async () => getLocalVideoFile(mediaUrl!) ?? (await buildShareFile(fileUrl, mediaType)),
      rotulo: mediaType === "video" ? "o vídeo" : "a mídia",
    };
  }, [mediaUrl, mediaType]);

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="hero" className="gap-2" aria-label="Publicar">
        <Send className="h-4 w-4" />
        <span className="hidden sm:inline">Publicar</span>
      </Button>
      <PublicarDialog open={open} onOpenChange={setOpen} caption={caption} midia={midia} />
    </>
  );
}
