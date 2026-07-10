import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FORMATS, FORMAT_LABELS } from "@/lib/constants";
import { getFormatStructure } from "@/lib/format-structures";
import { Film, Layers, Image as ImageIcon, Type, Youtube, Zap, Radio, PenLine, ChevronRight } from "lucide-react";

const FMT_ICON: Record<string, typeof Film> = { reels: Film, carrossel: Layers, foto: ImageIcon, story: Type, video: Youtube, shorts: Zap, live: Radio };
const FIELD_SHORT: Record<string, string> = { hook: "Gancho", caption: "Legenda", cta: "CTA", script: "Roteiro" };

function summary(fmt: string) {
  const s = getFormatStructure(fmt);
  const parts = s.fields.map((f) => FIELD_SHORT[f.key] || f.label);
  if (s.hasDynamicSections) parts.splice(1, 0, `${s.defaultSections} ${s.sectionLabel?.toLowerCase()}s`);
  return parts.join(" · ");
}

export function FormatPicker({ open, onPick, onBlank, onOpenChange }:{ open: boolean; onPick: (fmt: string) => void; onBlank: () => void; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
        <div>
          <h2 className="font-display text-xl font-extrabold">Começar um post</h2>
          <p className="text-sm text-muted-foreground mt-0.5 mb-4">Escolha o formato: a estrutura já vem montada pra você preencher.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FORMATS.map((fmt) => {
            const Icon = FMT_ICON[fmt] || PenLine;
            return (
              <button key={fmt} onClick={() => onPick(fmt)}
                className="group flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border text-left transition-all hover:border-primary hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0">
                <span className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 transition-colors group-hover:bg-primary group-hover:[&>svg]:text-primary-foreground">
                  <Icon className="h-5 w-5 text-primary transition-colors" strokeWidth={1.7} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-body font-bold text-sm">{FORMAT_LABELS[fmt] || fmt}</span>
                  <span className="block text-xs text-muted-foreground truncate">{summary(fmt)}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </button>
            );
          })}
        </div>
        <button onClick={onBlank}
          className="mt-3 w-full py-3 rounded-2xl border-[1.5px] border-dashed border-border text-sm font-body font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary">
          Começar em branco →
        </button>
      </DialogContent>
    </Dialog>
  );
}
