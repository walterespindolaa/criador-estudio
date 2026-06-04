import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FileText, ExternalLink } from "lucide-react";

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "image" | "iframe" | "none";
  url: string | null;
  name: string;
}

export function FilePreviewModal({ open, onOpenChange, kind, url, name }: FilePreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between gap-2">
          <p className="text-sm font-body font-medium truncate">{name}</p>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="text-primary text-xs flex items-center gap-1 shrink-0">
              <ExternalLink className="h-3.5 w-3.5" /> Abrir
            </a>
          )}
        </div>
        <div className="bg-black/90 flex items-center justify-center" style={{ minHeight: 320, maxHeight: "70vh" }}>
          {kind === "image" && url && (
            <img src={url} alt={name} className="max-w-full max-h-[70vh] object-contain" />
          )}
          {kind === "iframe" && url && (
            <iframe src={url} className="w-full" style={{ height: "70vh", border: 0 }}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen title={name} />
          )}
          {kind === "none" && (
            <div className="text-white/70 text-sm p-8 text-center">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-60" />
              Pré-visualização não disponível. Use "Abrir" acima.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
