import { useEffect, useRef, useState } from "react";
import { Copy, Check, Instagram, Share2, Loader2, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLICAR: a tela de "copiar a legenda e ir pro Instagram"

   Três coisas quebravam aqui e todas moram no mesmo lugar:

   1. "Publicar não abre nada": no desktop o botão só disparava um toast. Não
      havia tela nenhuma, então a pessoa clicava e parecia que nada acontecia.

   2. "Copiar legenda não funciona": navigator.clipboard.writeText SÓ funciona
      se for chamado no mesmo "gesto" do clique. O código chamava clipboard
      DEPOIS de vários await (buscar o arquivo, montar o File), e o iOS trata
      isso como cópia sem gesto: falha calada. Aqui a cópia acontece no clique,
      antes de qualquer await, e existe um fallback com textarea + execCommand
      pra navegador que bloqueia a API. Se tudo falhar, a legenda fica na tela,
      selecionável, pra copiar na mão: NUNCA um beco sem saída.

   3. "Instagram não aparece no compartilhar": o menu do sistema só lista apps
      que aceitam o que você mandou. Compartilhar TEXTO não mostra o Instagram
      (ele não recebe texto). Por isso, quando existe arquivo, compartilhamos
      SÓ o arquivo (a legenda já foi pro clipboard) e o Instagram aparece. E
      tem um botão direto "Abrir o Instagram" pra quando não há arquivo.
   ═══════════════════════════════════════════════════════════════════════════ */

// Cópia que funciona no iOS: tenta a API moderna e cai no textarea + execCommand.
// Precisa ser chamada DENTRO do clique, sem await antes.
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch { /* segue pro fallback */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, texto.length); // iOS ignora select() sozinho
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

export type PublicarMidia = {
  /** Monta o arquivo pra compartilhar (null = não dá pra compartilhar mídia). */
  build: () => Promise<File | null>;
  /** Rótulo do que vai ser compartilhado (ex.: "a imagem", "o vídeo"). */
  rotulo: string;
  /** Motivo de não dar pra compartilhar (ex.: Drive), mostrado como aviso. */
  aviso?: string;
};

export function PublicarDialog({ open, onOpenChange, caption, midia, onBaixar }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  caption: string;
  midia?: PublicarMidia | null;
  /** Opcional: baixar a mídia (quando não dá pra compartilhar direto). */
  onBaixar?: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [falhouCopia, setFalhouCopia] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const textoRef = useRef<HTMLTextAreaElement>(null);
  const legenda = (caption ?? "").trim();
  const podeCompartilhar = typeof navigator !== "undefined" && !!navigator.share;

  // Ao abrir, já tenta copiar (o clique que abriu o diálogo ainda vale como
  // gesto). Se o navegador recusar, o aviso de "copie na mão" aparece.
  useEffect(() => {
    if (!open || !legenda) return;
    let vivo = true;
    copiarTexto(legenda).then((ok) => {
      if (!vivo) return;
      setCopiado(ok);
      setFalhouCopia(!ok);
    });
    return () => { vivo = false; };
  }, [open, legenda]);

  const copiarAgora = async () => {
    const ok = await copiarTexto(legenda);
    setCopiado(ok);
    setFalhouCopia(!ok);
    if (ok) { toast.success("Legenda copiada"); setTimeout(() => setCopiado(false), 2500); }
    else { textoRef.current?.select(); toast.error("O navegador bloqueou a cópia. Selecionei o texto: use copiar do teclado."); }
  };

  const abrirInstagram = () => {
    // Deep link do app; se não houver app (desktop), o https abre o site.
    const ehMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    window.open(ehMobile ? "instagram://app" : "https://www.instagram.com/", "_blank", "noopener,noreferrer");
  };

  const compartilharMidia = async () => {
    if (!midia) return;
    setPreparando(true);
    try {
      const file = await midia.build();
      if (!file) { toast.error("Não consegui preparar o arquivo. Use o Baixar e anexe no app."); return; }
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        toast.error("Este navegador não compartilha arquivo. Use o Baixar e anexe no app.");
        return;
      }
      // SEM texto junto: com texto, o sistema esconde o Instagram da lista.
      await navigator.share({ files: [file] });
    } catch (e) {
      // AbortError = a pessoa fechou o menu; não é erro.
      if (e instanceof Error && e.name !== "AbortError") toast.error("Não consegui abrir o compartilhamento.");
    } finally {
      setPreparando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Publicar no Instagram</DialogTitle></DialogHeader>
        <p className="text-[12px] font-body text-muted-foreground -mt-1">
          O Instagram não deixa nenhum app postar a legenda por você. O caminho é: copiar a legenda aqui, abrir o app e colar.
        </p>

        {/* 1. Legenda */}
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-display font-bold text-foreground">1. A legenda</span>
            <Button size="sm" onClick={copiarAgora} className="rounded-xl h-8">
              {copiado ? <><Check className="h-3.5 w-3.5 mr-1.5" /> Copiada</> : <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar</>}
            </Button>
          </div>
          {/* Textarea de verdade (não <p>): dá pra selecionar e copiar na mão
              mesmo se a API do navegador bloquear tudo. */}
          <textarea
            ref={textoRef}
            readOnly
            value={legenda || "(sem legenda)"}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full min-h-[110px] max-h-52 rounded-xl border border-border bg-muted/20 p-2.5 text-[13px] font-body text-foreground outline-none resize-y"
          />
          {falhouCopia && (
            <p className="text-[11px] font-body text-destructive mt-1.5">
              O navegador bloqueou a cópia automática. Toque no texto acima e use copiar (Cmd/Ctrl+C ou o menu do celular).
            </p>
          )}
        </div>

        {/* 2. Mídia */}
        <div className="rounded-2xl border border-border bg-card p-3">
          <span className="text-xs font-display font-bold text-foreground">2. A mídia</span>
          {midia?.aviso && (
            <p className="text-[11.5px] font-body text-muted-foreground mt-1">{midia.aviso}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {midia && podeCompartilhar && (
              <Button size="sm" variant="outline" onClick={compartilharMidia} disabled={preparando} className="rounded-xl h-9">
                {preparando ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5 mr-1.5" />}
                {preparando ? "Preparando…" : `Compartilhar ${midia.rotulo}`}
              </Button>
            )}
            {onBaixar && (
              <Button size="sm" variant="outline" onClick={onBaixar} className="rounded-xl h-9">
                <Download className="h-3.5 w-3.5 mr-1.5" /> Baixar
              </Button>
            )}
            {!midia && (
              <p className="text-[11.5px] font-body text-muted-foreground">
                Sem arquivo pra compartilhar aqui: pegue a mídia no post e anexe no app.
              </p>
            )}
          </div>
          {midia && podeCompartilhar && (
            <p className="text-[10.5px] font-body text-muted-foreground mt-1.5">
              O Instagram só aparece na lista de apps quando você compartilha o arquivo (ele não aceita texto solto).
            </p>
          )}
        </div>

        {/* 3. Abrir o app */}
        <Button onClick={abrirInstagram} className={cn("w-full rounded-2xl h-11 gap-2")}>
          <Instagram className="h-4 w-4" /> 3. Abrir o Instagram e colar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
