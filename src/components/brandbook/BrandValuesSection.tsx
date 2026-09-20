import { Ban, Languages, MessageSquare, MessageSquareText, Paintbrush, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BrandItem } from "@/hooks/useBrandItems";

const BRAND_ITEM_SECTIONS = [
  { type: "cor", label: "Cores da marca", ajuda: "Nome e o código hex. Vai pro prompt de arte e pro PDF.", icon: Paintbrush, placeholder: "Ex: #C4622D" },
  { type: "fonte", label: "Fontes", ajuda: "As famílias que você usa nas artes.", icon: Languages, placeholder: "Ex: Playfair Display" },
  { type: "tom", label: "Tom de voz em poucas palavras", ajuda: "Etiquetas curtas. A IA lê estas antes das respostas longas.", icon: MessageSquareText, placeholder: "Ex: Acolhedor e direto" },
  { type: "expressao", label: "Expressões que uso", ajuda: "Gírias, bordões, jeitos de falar que são seus.", icon: MessageSquare, placeholder: "Ex: Bora!" },
  { type: "evitar", label: "Palavras que evito", ajuda: "O que não pode aparecer numa legenda sua.", icon: Ban, placeholder: "Ex: Não use gírias" },
] as const;

type TipoDeItem = (typeof BRAND_ITEM_SECTIONS)[number]["type"];

type Props = {
  brandItems: BrandItem[];
  /** Quais listas mostrar. Cores e fontes moram na Identidade; tom, expressões
   *  e o que evitar moram no Tom de Voz. Antes as cinco viviam juntas numa aba
   *  chamada Identidade, e "palavras que evito" não é identidade visual. */
  tipos: ReadonlyArray<TipoDeItem>;
  activeSection: string | null;
  newItemName: string;
  newItemValue: string;
  onActiveSectionChange: (section: string | null) => void;
  onNewItemNameChange: (value: string) => void;
  onNewItemValueChange: (value: string) => void;
  onAddBrandItem: (type: string) => void;
  onDeleteBrandItem: (id: string) => void;
};

export function BrandValuesSection({
  brandItems,
  tipos,
  activeSection,
  newItemName,
  newItemValue,
  onActiveSectionChange,
  onNewItemNameChange,
  onNewItemValueChange,
  onAddBrandItem,
  onDeleteBrandItem,
}: Props) {
  const secoes = BRAND_ITEM_SECTIONS.filter((s) => tipos.includes(s.type));
  return (
    <div className="space-y-4">
      {secoes.map((section) => {
        const items = brandItems.filter((i) => i.type === section.type);
        const aberta = activeSection === section.type;
        return (
          <div key={section.type} className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2.5">
                  <section.icon className="h-[18px] w-[18px] text-primary" />
                  {section.label}
                </h3>
                <p className="text-[12px] font-body text-muted-foreground mt-0.5 leading-snug">{section.ajuda}</p>
              </div>
              <span className="shrink-0 text-[11px] font-body font-bold tabular-nums rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
                {items.length}
              </span>
            </div>

            {items.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {items.map((item) => (
                  <div key={item.id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-background rounded-xl border border-border">
                    {section.type === "cor" && item.value && (
                      <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: item.value }} />
                    )}
                    <span className="text-sm font-body text-foreground">{item.name}</span>
                    {item.value && section.type !== "cor" && (
                      <span className="text-xs text-muted-foreground font-body">({item.value})</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteBrandItem(item.id)}
                      aria-label={`Remover ${item.name}`}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {aberta ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  autoFocus
                  placeholder="Nome"
                  value={newItemName}
                  onChange={(e) => onNewItemNameChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newItemName.trim()) onAddBrandItem(section.type); }}
                  className="rounded-xl text-sm"
                />
                <Input
                  placeholder={section.placeholder}
                  value={newItemValue}
                  onChange={(e) => onNewItemValueChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newItemName.trim()) onAddBrandItem(section.type); }}
                  className="rounded-xl text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => onAddBrandItem(section.type)} disabled={!newItemName.trim()} className="gap-1">
                    <Plus className="h-4 w-4" /> Adicionar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onActiveSectionChange(null)}>Fechar</Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onActiveSectionChange(section.type);
                  onNewItemNameChange("");
                  onNewItemValueChange("");
                }}
                className="inline-flex items-center gap-1 text-sm text-primary font-body font-semibold hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
