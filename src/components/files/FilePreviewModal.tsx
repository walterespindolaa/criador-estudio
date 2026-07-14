import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FileText, ExternalLink, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════════════════
   VER E BAIXAR O ARQUIVO

   O que existia: imagem abria num modal (sem baixar), e PDF NÃO abria — ele
   caía num window.open, que o bloqueador de pop-up do celular come na maioria
   das vezes. Na prática a pessoa via que o arquivo estava lá e não conseguia
   nem olhar nem baixar. Arquivo que você não abre não é arquivo, é lembrete.

   Agora: imagem e PDF abrem AQUI dentro, e existe um botão de baixar de
   verdade (busca o blob e salva com o nome certo — o atributo `download` num
   link pra outro domínio é ignorado pelo navegador, então ele não serviria).
   ═══════════════════════════════════════════════════════════════════════════ */

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "image" | "pdf" | "iframe" | "none";
  url: string | null;
  name: string;
}

export function FilePreviewModal({ open, onOpenChange, kind, url, name }: FilePreviewModalProps) {
  const [baixando, setBaixando] = useState(false);

  const baixar = async () => {
    if (!url || baixando) return;
    setBaixando(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = name || "arquivo";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Solta a memória; sem isso o blob fica preso até recarregar a página.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      toast.error("Não foi possível baixar. Tente 'Abrir'.");
    } finally {
      setBaixando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="p-3 pr-12 border-b border-border flex items-center justify-between gap-2">
          <p className="text-sm font-body font-medium truncate">{name}</p>
          {url && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={baixar}
                disabled={baixando}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-body font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-60"
              >
                {baixando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Baixar
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-body font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Abrir
              </a>
            </div>
          )}
        </div>

        <div className="bg-black/90 flex items-center justify-center" style={{ minHeight: 320, maxHeight: "72vh" }}>
          {kind === "image" && url && (
            <img src={url} alt={name} className="max-w-full max-h-[72vh] object-contain" />
          )}

          {/* PDF: <object> em vez de <iframe> porque ele tem fallback nativo —
              se o navegador (Safari do iPhone, principalmente) não souber
              renderizar inline, ele mostra o conteúdo de dentro em vez de um
              retângulo branco mudo. */}
          {kind === "pdf" && url && (
            <object data={url} type="application/pdf" className="w-full" style={{ height: "72vh" }} aria-label={name}>
              <div className="text-white/80 text-sm p-8 text-center">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-60" />
                <p className="mb-3">Seu navegador não abre PDF aqui dentro.</p>
                <button
                  type="button"
                  onClick={baixar}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-white text-xs font-semibold hover:bg-white/25"
                >
                  <Download className="h-3.5 w-3.5" /> Baixar o PDF
                </button>
              </div>
            </object>
          )}

          {kind === "iframe" && url && (
            <iframe src={url} className="w-full" style={{ height: "72vh", border: 0 }}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen title={name} />
          )}

          {kind === "none" && (
            <div className="text-white/70 text-sm p-8 text-center">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-60" />
              Este tipo de arquivo não abre aqui dentro. Use "Baixar" ou "Abrir".
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
