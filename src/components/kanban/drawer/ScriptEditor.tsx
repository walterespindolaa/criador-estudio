import { Cloud, Image as ImageIcon, Minus, PenLine, Plus, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface Section {
  text: string;
  captacao: string;
  driveFileId?: string | null;
  driveFileName?: string | null;
  driveThumbnail?: string | null;
}

export const emptySection = (): Section => ({
  text: "",
  captacao: "",
  driveFileId: null,
  driveFileName: null,
  driveThumbnail: null,
});

type Props = {
  sections: Section[];
  onChange: (next: Section[] | ((prev: Section[]) => Section[])) => void;
  sectionLabel: string;
  picking: boolean;
  onPickDriveForSection: (index: number) => Promise<void>;
  uploadingLocal?: boolean;
  onUploadLocalForSection?: (index: number) => void;
};

export function ScriptEditor({
  sections,
  onChange,
  sectionLabel,
  picking,
  onPickDriveForSection,
  uploadingLocal = false,
  onUploadLocalForSection,
}: Props) {
  const updateAt = (index: number, patch: Partial<Section>) => {
    onChange(prev => prev.map((s, j) => (j === index ? { ...s, ...patch } : s)));
  };

  return (
    <div className="space-y-3">
      <Label className="font-body text-sm flex items-center gap-2">
        <PenLine className="h-4 w-4" /> {sectionLabel}s
      </Label>
      {sections.map((sec, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border/60 overflow-hidden bg-card/50 hover:border-border transition-colors"
        >
          <div className="flex">
            {/* Coluna esquerda: conteúdo */}
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                <span className="text-[9px] font-body uppercase tracking-[0.15em] text-muted-foreground/60 font-semibold">
                  {sectionLabel} {String(i + 1).padStart(2, "0")}
                </span>
              </div>

              <Textarea
                placeholder={`O que acontece na ${sectionLabel.toLowerCase()} ${i + 1}...`}
                value={sec.text}
                onChange={(e) => updateAt(i, { text: e.target.value })}
                className="border-0 bg-transparent px-3 pb-1 pt-0 text-sm font-body resize-none focus-visible:ring-0 min-h-[48px]"
                rows={2}
              />

              <div className="mx-3 border-t border-dashed border-border/40" />

              <Textarea
                placeholder="Como gravar: enquadramento, tom, ação..."
                value={sec.captacao || ""}
                onChange={(e) => updateAt(i, { captacao: e.target.value })}
                className="border-0 bg-muted/40 flex-1 px-3 pt-2 pb-2 text-xs font-body text-foreground placeholder:text-muted-foreground/70 resize-none focus-visible:ring-0 min-h-[36px] w-full"
                rows={1}
              />

              {!sec.driveFileId && (
                <div className="px-3 pb-2.5 pt-1.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={picking}
                    onClick={() => onPickDriveForSection(i)}
                    className="flex items-center gap-1.5 text-[10px] font-body text-muted-foreground hover:text-primary border border-dashed border-border/60 hover:border-primary/40 rounded-lg px-2 py-1 transition-all"
                  >
                    <Cloud className="h-3 w-3" />
                    {picking ? "Abrindo..." : "Drive"}
                  </button>
                  {onUploadLocalForSection && (
                    <button
                      type="button"
                      disabled={uploadingLocal}
                      onClick={() => onUploadLocalForSection(i)}
                      className="flex items-center gap-1.5 text-[10px] font-body text-muted-foreground hover:text-primary border border-dashed border-border/60 hover:border-primary/40 rounded-lg px-2 py-1 transition-all"
                    >
                      <ImageIcon className="h-3 w-3" />
                      {uploadingLocal ? "Enviando..." : "Galeria / PC"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Coluna direita: mídia */}
            {sec.driveFileId && (
              <div className="relative w-32 sm:w-40 shrink-0 bg-muted/40 border-l border-border/40">
                <img
                  src={
                    sec.driveThumbnail
                      ?? `https://lh3.googleusercontent.com/d/${encodeURIComponent(sec.driveFileId!)}=w400`
                  }
                  alt={sec.driveFileName || ""}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    const el = e.target as HTMLImageElement;
                    if (sec.driveThumbnail && el.src === sec.driveThumbnail && sec.driveFileId) {
                      el.src = `https://lh3.googleusercontent.com/d/${encodeURIComponent(sec.driveFileId)}=w400`;
                      return;
                    }
                    el.style.display = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => updateAt(i, { driveFileId: null, driveFileName: null, driveThumbnail: null })}
                  className="absolute top-1.5 right-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white p-1 transition-colors backdrop-blur-sm"
                  aria-label="Remover mídia"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={() => onChange(prev => [...prev, emptySection()])}
          className="text-xs font-body text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
        >
          <Plus className="h-3 w-3" /> Adicionar {sectionLabel.toLowerCase()}
        </button>
        {sections.length > 1 && (
          <button
            type="button"
            onClick={() => onChange(prev => prev.slice(0, -1))}
            className="text-xs font-body text-muted-foreground/50 hover:text-destructive flex items-center gap-1 transition-colors"
          >
            <Minus className="h-3 w-3" /> Remover última
          </button>
        )}
      </div>
    </div>
  );
}
