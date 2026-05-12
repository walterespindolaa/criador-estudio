import { BookOpen, Heart, MessageSquare, Mic, Palette, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type SectionCounts = {
  identidade: number;
  visual: number;
  comunicacao: number;
  publico: number;
  valores: number;
  tom: number;
};

type Props = {
  counts: SectionCounts;
  onSelect: (tab: string) => void;
};

const SECTIONS = [
  { key: "identidade", icon: Heart, label: "Identidade", color: "from-pink-500 to-rose-500", tab: "moodboard" },
  { key: "visual", icon: Palette, label: "Visual", color: "from-violet-500 to-purple-500", tab: "moodboard" },
  { key: "comunicacao", icon: MessageSquare, label: "Comunicação", color: "from-blue-500 to-cyan-500", tab: "linha-editorial" },
  { key: "publico", icon: Users, label: "Público-alvo", color: "from-amber-500 to-orange-500", tab: "persona" },
  { key: "valores", icon: BookOpen, label: "Valores", color: "from-emerald-500 to-teal-500", tab: "moodboard" },
  { key: "tom", icon: Mic, label: "Tom de Voz", color: "from-indigo-500 to-blue-500", tab: "tom-de-voz" },
] as const;

export function BrandHubOverview({ counts, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
      {SECTIONS.map(section => {
        const count = counts[section.key];
        return (
          <button
            key={section.key}
            type="button"
            onClick={() => onSelect(section.tab)}
            className="bg-card rounded-xl border border-border p-4 text-left hover:shadow-warm-md hover:scale-[1.01] transition-all duration-200 group"
          >
            <div className={cn("w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center mb-3", section.color)}>
              <section.icon className="h-4 w-4 text-white" strokeWidth={1.75} />
            </div>
            <p className="text-sm font-display font-semibold text-foreground">{section.label}</p>
            <p className="text-[11px] text-muted-foreground font-body mt-0.5">
              {count > 0 ? `${count} ${count === 1 ? "item" : "itens"}` : "Configurar →"}
            </p>
          </button>
        );
      })}
    </div>
  );
}
