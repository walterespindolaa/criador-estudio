import { useEffect, useMemo, useRef, useState } from "react";
import { Share2, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { desenharSemana, type ModeloSemana } from "@/lib/arte-semana";

/* COMPARTILHAR MINHA SEMANA (Walter, 11/11/2026).
   Cartão no Início da social mídia: quando ela teve post aprovado na semana,
   pode escolher um de três modelos e mandar pro story. A imagem só leva
   números (posts aprovados e quantos clientes), nunca nome de cliente.
   Sem post aprovado na semana o cartão nem aparece. */

const MODELOS: { id: ModeloSemana; nome: string }[] = [
  { id: 1, nome: "Rosa" }, { id: 2, nome: "Azul" }, { id: 3, nome: "Verde" },
];

export function CompartilharSemana({ aprovados, clientes, periodo }: { aprovados: number; clientes: number; periodo: string }) {
  const [aberto, setAberto] = useState(false);
  const [modelo, setModelo] = useState<ModeloSemana>(1);
  const [gerando, setGerando] = useState(false);
  const telas = useRef<Record<number, HTMLCanvasElement | null>>({});
  const dados = useMemo(() => ({ aprovados, clientes, periodo }), [aprovados, clientes, periodo]);
  // Desenha os três modelos quando a janela abre (o canvas é a miniatura e a imagem final).
  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    const t = setTimeout(() => {
      MODELOS.forEach((m) => { const c = telas.current[m.id]; if (c && vivo) desenharSemana(c, m.id, dados).catch(() => {}); });
    }, 60);
    return () => { vivo = false; clearTimeout(t); };
  }, [aberto, dados]);
  if (aprovados <= 0) return null;

  const compartilhar = async () => {
    const tela = telas.current[modelo];
    if (!tela || gerando) return;
    setGerando(true);
    try {
      await desenharSemana(tela, modelo, dados);
      const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, "image/png"));
      if (!blob) throw new Error("imagem vazia");
      const file = new File([blob], "minha-semana-cria.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file] }); }
        catch (e) { if ((e as Error)?.name !== "AbortError") throw e; }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        toast.success("Imagem baixada. É só postar no story.");
      }
    } catch {
      toast.error("Não consegui gerar a imagem. Tenta de novo?");
    } finally { setGerando(false); }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-[#FFCF03]/25 p-4">
        <div className="min-w-0">
          <p className="text-sm font-display font-bold text-foreground">Sua semana rendeu</p>
          <p className="text-[13px] font-body text-muted-foreground">
            {aprovados} {aprovados === 1 ? "post aprovado" : "posts aprovados"} em {clientes} {clientes === 1 ? "cliente" : "clientes"}.
          </p>
        </div>
        <Button size="sm" className="h-11 md:h-9" onClick={() => setAberto(true)}><Share2 className="mr-1.5 h-4 w-4" /> Compartilhar minha semana</Button>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Compartilhar minha semana</DialogTitle>
            <DialogDescription>Escolha um modelo. A imagem leva só os números, sem nome de cliente.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 overflow-x-auto pb-2 sm:justify-center">
            {MODELOS.map((m) => (
              <button key={m.id} type="button" onClick={() => setModelo(m.id)} aria-pressed={modelo === m.id} aria-label={`Modelo ${m.nome}`}
                className={cn("relative shrink-0 overflow-hidden rounded-xl border-2 transition-shadow", modelo === m.id ? "border-primary ring-2 ring-primary/30" : "border-border")}
                style={{ width: 216, height: 384 }}>
                <canvas ref={(el) => { telas.current[m.id] = el; }} width={1080} height={1920} style={{ width: 216, height: 384, display: "block" }} />
                {modelo === m.id && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>}
              </button>
            ))}
          </div>
          <Button className="h-11 w-full" onClick={compartilhar} disabled={gerando}>
            {gerando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Share2 className="mr-1.5 h-4 w-4" />}
            {gerando ? "Montando a imagem..." : "Compartilhar"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
