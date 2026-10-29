import { toast } from "sonner";
import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export type ImageCropModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  aspectRatio?: number;
  cropShape?: "round" | "rect";
};

export function ImageCropModal({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
  aspectRatio = 1,
  cropShape = "round",
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset transform whenever a new image comes in (e.g. user picks a
  // different file without closing the modal between attempts).
  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setCroppedAreaPixels(null);
    }
  }, [open, imageSrc]);

  const onCropDone = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    try {
      setSaving(true);
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      onCropComplete(blob);
      onOpenChange(false);
    } catch (e) {
      // Antes o erro sumia calado e o "Salvar" parecia não fazer nada.
      console.warn("[recorte] falhou", e);
      toast.error("Não consegui recortar essa foto. Tente de novo ou escolha outra.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Ajustar imagem</DialogTitle>
        </DialogHeader>

        <div className="relative w-full h-[300px] bg-muted rounded-xl overflow-hidden">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspectRatio}
              cropShape={cropShape}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropDone}
              showGrid={false}
            />
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.05}
              onValueChange={([val]) => setZoom(val)}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>

          <div className="flex items-center gap-3">
            <RotateCw className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider
              value={[rotation]}
              min={0}
              max={360}
              step={1}
              onValueChange={([val]) => setRotation(val)}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
              {rotation}°
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="hero" onClick={handleSave} disabled={saving || !croppedAreaPixels}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* RECORTE QUE NÃO SALVAVA NO IPHONE (Walter, 29/10/2026: "na hora do recorte
   não vai"). O jeito antigo desenhava a foto inteira num canvas quadrado de
   lado 2 x raiz(2) x metade do maior lado: uma foto de iPhone (4032 px) virava
   um canvas de ~5700 x 5700, acima do limite do Safari no celular (~16,7
   milhões de pixels). O Safari falhava calado e o Salvar não fazia nada.
   Agora segue o jeito da própria react-easy-crop v5 (caixa da foto girada,
   que é a referência do croppedAreaPixels), com o canvas reduzido pra caber
   no limite e a saída no máximo com 2048 px no lado maior. */
const LADO_MAX_CANVAS = 4096;
const LADO_MAX_SAIDA = 2048;

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const rad = (rotation * Math.PI) / 180;
  const bW = Math.abs(Math.cos(rad) * image.width) + Math.abs(Math.sin(rad) * image.height);
  const bH = Math.abs(Math.sin(rad) * image.width) + Math.abs(Math.cos(rad) * image.height);
  const s = Math.min(1, LADO_MAX_CANVAS / Math.max(bW, bH));

  const girada = document.createElement("canvas");
  girada.width = Math.round(bW * s);
  girada.height = Math.round(bH * s);
  const g = girada.getContext("2d");
  if (!g) throw new Error("Canvas 2D context unavailable");
  g.scale(s, s);
  g.translate(bW / 2, bH / 2);
  g.rotate(rad);
  g.translate(-image.width / 2, -image.height / 2);
  g.drawImage(image, 0, 0);

  const cw = pixelCrop.width * s, ch = pixelCrop.height * s;
  const k = Math.min(1, LADO_MAX_SAIDA / Math.max(cw, ch));
  const saida = document.createElement("canvas");
  saida.width = Math.max(1, Math.round(cw * k));
  saida.height = Math.max(1, Math.round(ch * k));
  const o = saida.getContext("2d");
  if (!o) throw new Error("Canvas 2D context unavailable");
  o.imageSmoothingQuality = "high";
  o.drawImage(girada, pixelCrop.x * s, pixelCrop.y * s, cw, ch, 0, 0, saida.width, saida.height);
  // Libera a memória do canvas grande já (o Safari demora a recolher).
  girada.width = 0; girada.height = 0;

  return new Promise<Blob>((resolve, reject) => {
    saida.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Falha ao gerar imagem."));
      },
      "image/jpeg",
      0.9
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    img.setAttribute("crossOrigin", "anonymous");
    img.src = url;
  });
}
