import { motion } from "framer-motion";
import { Ban, Languages, MessageSquare, MessageSquareText, Paintbrush, Palette, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BrandItem } from "@/hooks/useBrandItems";

const BRAND_ITEM_SECTIONS = [
  { type: "cor", label: "Cores da marca", icon: Paintbrush, placeholder: "Ex: #C4622D" },
  { type: "fonte", label: "Fontes", icon: Languages, placeholder: "Ex: Playfair Display" },
  { type: "tom", label: "Tom de voz", icon: MessageSquareText, placeholder: "Ex: Acolhedor e direto" },
  { type: "expressao", label: "Expressões que uso", icon: MessageSquare, placeholder: "Ex: Bora!" },
  { type: "evitar", label: "Palavras que evito", icon: Ban, placeholder: "Ex: Não use gírias" },
] as const;

type Props = {
  brandItems: BrandItem[];
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
  activeSection,
  newItemName,
  newItemValue,
  onActiveSectionChange,
  onNewItemNameChange,
  onNewItemValueChange,
  onAddBrandItem,
  onDeleteBrandItem,
}: Props) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Palette className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">Identidade da Marca</h2>
          <p className="text-sm text-muted-foreground font-body">
            Cores, fontes, expressões e elementos visuais que compõem sua marca.
          </p>
        </div>
      </div>

      {BRAND_ITEM_SECTIONS.map(section => {
        const items = brandItems.filter(i => i.type === section.type);
        return (
          <Card key={section.type} className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
                <section.icon className="h-4 w-4 text-primary/70" />
                {section.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {items.map(item => (
                    <div
                      key={item.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-background rounded-xl border border-border"
                    >
                      {section.type === "cor" && item.value && (
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.value }} />
                      )}
                      <span className="text-sm font-body text-foreground">{item.name}</span>
                      {item.value && section.type !== "cor" && (
                        <span className="text-xs text-muted-foreground font-body">({item.value})</span>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteBrandItem(item.id)}
                        className="hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {activeSection === section.type ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome"
                    value={newItemName}
                    onChange={(e) => onNewItemNameChange(e.target.value)}
                    className="rounded-xl text-sm"
                  />
                  <Input
                    placeholder={section.placeholder}
                    value={newItemValue}
                    onChange={(e) => onNewItemValueChange(e.target.value)}
                    className="rounded-xl text-sm"
                  />
                  <Button size="sm" onClick={() => onAddBrandItem(section.type)} disabled={!newItemName.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onActiveSectionChange(section.type);
                    onNewItemNameChange("");
                    onNewItemValueChange("");
                  }}
                  className="text-sm text-primary font-body font-medium hover:underline"
                >
                  + Adicionar
                </button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </motion.div>
  );
}
