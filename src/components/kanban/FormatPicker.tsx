import { Sheet, SheetContent } from "@/components/ui/sheet";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-4 pt-5 pb-8 max-h-[85vh] overflow-y-auto">
        <h2 className="font-display text-lg font-bold">Começar um post</h2>
        <p className="text-sm text-muted-foreground mb-4">Escolha o formato — a estrutura já vem montada pra você preencher.</p>
        <div className="flex flex-col gap-2">
          {FORMATS.map((fmt) => {
            const Icon = FMT_ICON[fmt] || PenLine;
            return (
              <button key={fmt} onClick={() => onPick(fmt)}
                className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border text-left active:bg-primary/5 transition-colors">
                <span className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" strokeWidth={1.7} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-body font-bold text-sm">{FORMAT_LABELS[fmt] || fmt}</span>
                  <span className="block text-xs text-muted-foreground truncate">{summary(fmt)}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              </button>
            );
          })}
        </div>
        <button onClick={onBlank}
          className="mt-3 w-full py-3 rounded-2xl border-[1.5px] border-dashed border-border text-sm font-body font-semibold text-muted-foreground">
          Começar em branco →
        </button>
      </SheetContent>
    </Sheet>
  );
}
