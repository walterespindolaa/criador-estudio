import { useRef, useState } from "react";
import { Check, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageCropModal } from "@/components/shared/ImageCropModal";
import { useAuth } from "@/contexts/AuthContext";
import { subirImagemCriakut, useSalvarPerfilCriakut } from "@/hooks/useCriakut";
import { CAPAS_CRIA, CapaCriakut } from "./CapaCriakut";
import type { CapaTipo } from "@/lib/criakut";
import { cn } from "@/lib/utils";

/* PERSONALIZAR CAPA (fluxo aprovado em 14/10/2026; virou popup no mesmo dia a
   pedido do Walter, com tudo cabendo sem rolar): as 5 capas do Cria (toca e já
   salva) e, no sexto quadro, subir a própria, recortar em 4 por 1 com zoom e
   girar. O original também sobe, pra dar pra "ajustar de novo" depois. */

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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-[20px]">Personalizar capa</DialogTitle>
            <DialogDescription>Toque numa capa do Cria e ela já entra. Ou suba a sua (1600 × 400 px, o pedaço de cima é o que mais aparece).</DialogDescription>
          </DialogHeader>
          <div className="mt-1 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {CAPAS_CRIA.map((c) => (
              <button key={c.tipo} type="button" onClick={() => escolher(c.tipo)} disabled={salvar.isPending}
                className={cn("relative overflow-hidden rounded-2xl text-left ring-offset-2 ring-offset-background transition", atual === c.tipo ? "ring-2 ring-primary" : "hover:ring-2 hover:ring-border")}>
                <CapaCriakut tipo={c.tipo} className="rounded-2xl" />
                <span className="absolute bottom-1.5 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-bold text-foreground">{c.nome}</span>
                {atual === c.tipo && <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}
              </button>
            ))}
            {/* Sexto quadro: a própria capa (ou o botão de subir). */}
            <button type="button" disabled={subindo} onClick={() => input.current?.click()}
              className={cn("relative grid aspect-[4/1] place-items-center overflow-hidden rounded-2xl border-2 border-dashed text-[12px] font-semibold ring-offset-2 ring-offset-background transition",
                atual === "propria" ? "border-transparent ring-2 ring-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary")}>
              {atual === "propria" && urlAtual
                ? <>
                    <img src={urlAtual} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    <span className="absolute bottom-1.5 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-bold text-foreground"><Upload className="h-3 w-3" /> Trocar a sua</span>
                  </>
                : <span className="inline-flex items-center gap-1.5">{subindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {subindo ? "Subindo…" : "Subir a minha"}</span>}
            </button>
          </div>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { aoEscolherArquivo(e.target.files?.[0]); e.target.value = ""; }} />
          <p className="text-[11.5px] leading-snug text-muted-foreground">
            JPG, PNG ou WEBP até {MAX_MB} MB. Depois você ajusta o zoom, gira e escolhe o pedaço que aparece. Deixe rosto e texto na parte de cima: a de baixo fica atrás da sua foto.
          </p>
        </DialogContent>
      </Dialog>

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
