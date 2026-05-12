import { Cloud, Minus, PenLine, Plus, X } from "lucide-react";
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
};

export function ScriptEditor({ sections, onChange, sectionLabel, picking, onPickDriveForSection }: Props) {
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
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
            <span className="text-[9px] font-body uppercase tracking-[0.15em] text-muted-foreground/60 font-semibold">
              {sectionLabel} {String(i + 1).padStart(2, "0")}
            </span>
            {sec.driveFileId && (
              <div className="ml-auto flex items-center gap-1">
                <img
                  src={`https://lh3.googleusercontent.com/d/${encodeURIComponent(sec.driveFileId)}=w80`}
                  alt=""
                  className="w-5 h-5 rounded object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <button
                  type="button"
                  onClick={() => updateAt(i, { driveFileId: null, driveFileName: null, driveThumbnail: null })}
                  className="text-muted-foreground/50 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
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
            className="border-0 bg-muted/40 rounded-b-xl px-3 pt-2 pb-2 text-xs font-body text-foreground placeholder:text-muted-foreground/70 resize-none focus-visible:ring-0 min-h-[36px] w-full"
            rows={1}
          />

          {!sec.driveFileId && (
            <div className="px-3 pb-2.5">
              <button
                type="button"
                disabled={picking}
                onClick={() => onPickDriveForSection(i)}
                className="flex items-center gap-1.5 text-[10px] font-body text-muted-foreground hover:text-primary border border-dashed border-border/60 hover:border-primary/40 rounded-lg px-2 py-1 transition-all"
              >
                <Cloud className="h-3 w-3" />
                Adicionar mídia
              </button>
            </div>
          )}
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
