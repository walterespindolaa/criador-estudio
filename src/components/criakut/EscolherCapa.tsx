import { useRef, useState } from "react";
import { Check, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { useAuth } from "@/contexts/AuthContext";
import { subirImagemCriakut, useSalvarPerfilCriakut } from "@/hooks/useCriakut";
import { CAPAS_CRIA, CapaCriakut } from "./CapaCriakut";
import type { CapaTipo } from "@/lib/criakut";
import { cn } from "@/lib/utils";

/* PERSONALIZAR CAPA (fluxo aprovado em 14/10/2026):
   aba 1 = as 5 capas do Cria (toca e já salva); aba 2 = subir a própria,
   recortar em 4 por 1 com zoom e girar, e salvar. O original também sobe,
   pra dar pra "ajustar de novo" depois sem pedir a foto outra vez. */

const LARGURA = 1600; // 1600 x 400: nítida no computador, leve no celular
const MAX_MB = 10;

/** O recorte sai do tamanho da foto original (às vezes 4000 px): reduz pra 1600. */
async function reduzir(blob: Blob): Promise<Blob> {
  const img = await createImageBitmap(blob);
  if (img.width <= LARGURA) return blob;
  const c = document.createElement("canvas");
  c.width = LARGURA; c.height = Math.round(img.height * (LARGURA / img.width));
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error("imagem"))), "image/jpeg", 0.88));
}

export function EscolherCapa({ open, onOpenChange, atual, urlAtual }: {
  open: boolean; onOpenChange: (v: boolean) => void; atual: CapaTipo; urlAtual?: string | null;
}) {
  const { user } = useAuth();
  const salvar = useSalvarPerfilCriakut();
  const input = useRef<HTMLInputElement>(null);
  const [bruta, setBruta] = useState<string | null>(null);
  const [original, setOriginal] = useState<File | null>(null);
  const [subindo, setSubindo] = useState(false);

  const escolher = (tipo: CapaTipo) => salvar.mutate({ capa_tipo: tipo }, { onSuccess: () => toast.success("Capa trocada!") });

  const aoEscolherArquivo = (f?: File) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast.error("Use JPG, PNG ou WEBP."); return; }
    if (f.size > MAX_MB * 1024 * 1024) { toast.error(`A imagem passa de ${MAX_MB} MB.`); return; }
    const url = URL.createObjectURL(f);
    const teste = new Image();
    teste.onload = () => {
      if (teste.width < 1600 || teste.height < 400) toast.warning("Essa imagem é pequena (o ideal é 1600 × 400 ou maior). Pode ficar borrada.");
      setOriginal(f); setBruta(url);
    };
    teste.src = url;
  };

  const aoRecortar = async (recorte: Blob) => {
    if (!user?.id) return;
    setSubindo(true);
    try {
      const [capa, orig] = await Promise.all([
        subirImagemCriakut(user.id, await reduzir(recorte), "capa"),
        original ? subirImagemCriakut(user.id, original, "capa-original") : Promise.resolve(null),
      ]);
      await salvar.mutateAsync({ capa_tipo: "propria", capa_url: capa, capa_original_url: orig } as never);
      toast.success("Capa nova no ar!");
      onOpenChange(false);
    } catch {
      toast.error("Não consegui subir a capa. Tente de novo.");
    } finally {
      setSubindo(false); setBruta(null); setOriginal(null);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">Personalizar capa</SheetTitle>
            <SheetDescription>Escolha uma das capas do Cria ou suba a sua. Formato 4 por 1 (1600 × 400 px).</SheetDescription>
          </SheetHeader>

          <p className="mt-5 mb-2 text-[11px] font-bold uppercase tracking-wider text-primary">Capas do Cria</p>
          <div className="grid gap-3">
            {CAPAS_CRIA.map((c) => (
              <button key={c.tipo} type="button" onClick={() => escolher(c.tipo)} disabled={salvar.isPending}
                className={cn("relative rounded-3xl text-left ring-offset-2 transition", atual === c.tipo ? "ring-2 ring-primary" : "hover:ring-2 hover:ring-border")}>
                <CapaCriakut tipo={c.tipo} />
                <span className="absolute left-3 bottom-2 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-bold text-foreground">{c.nome}</span>
                {atual === c.tipo && <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" /></span>}
              </button>
            ))}
          </div>

          <p className="mt-6 mb-2 text-[11px] font-bold uppercase tracking-wider text-primary">Sua própria capa</p>
          {atual === "propria" && urlAtual && <CapaCriakut tipo="propria" url={urlAtual} className="mb-3 ring-2 ring-primary ring-offset-2" />}
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { aoEscolherArquivo(e.target.files?.[0]); e.target.value = ""; }} />
          <Button type="button" variant="outline" className="w-full rounded-xl" disabled={subindo} onClick={() => input.current?.click()}>
            {subindo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {subindo ? "Subindo…" : "Subir uma imagem"}
          </Button>
          <p className="mt-2 text-[11.5px] text-muted-foreground leading-snug">
            JPG, PNG ou WEBP até {MAX_MB} MB. Depois você ajusta o zoom, gira e escolhe o pedaço que aparece.
            A faixa de baixo fica atrás da sua foto: deixe rosto e texto na parte de cima.
          </p>
        </SheetContent>
      </Sheet>

      {bruta && (
        <ImageCropModal
          open={!!bruta}
          onOpenChange={(o) => { if (!o) { setBruta(null); setOriginal(null); } }}
          imageSrc={bruta}
          onCropComplete={(b) => void aoRecortar(b)}
          aspectRatio={4}
          cropShape="rect"
        />
      )}
    </>
  );
}
