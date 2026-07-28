import { useState } from "react";
import { Plus, Save, Users, Bot, Wand2, Trophy, SmilePlus, Crown, Briefcase, UserCircle, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { cn } from "@/lib/utils";

export const PERSONA_ICONS = [
  { id: "bot", icon: Bot, label: "Digital" },
  { id: "wand", icon: Wand2, label: "Criativo" },
  { id: "trophy", icon: Trophy, label: "Conquista" },
  { id: "smile", icon: SmilePlus, label: "Conexão" },
  { id: "crown", icon: Crown, label: "Liderança" },
  { id: "briefcase", icon: Briefcase, label: "Profissional" },
] as const;

export interface PersonaData {
  id: string | null;
  name: string;
  icon: string;
  age_range: string;
  gender: string;
  location: string;
  interests: string[];
  pain_points: string[];
  desires: string[];
  objections: string[];
  how_you_help: string;
  platforms: string[];
  notes: string;
}

export type TagField = "interests" | "pain_points" | "desires" | "objections";

type Props = {
  persona: PersonaData;
  onPersonaChange: (next: PersonaData | ((prev: PersonaData) => PersonaData)) => void;
  onAddTag: (field: TagField, value: string) => void;
  onRemoveTag: (field: TagField, idx: number) => void;
  onSave: () => void;
};

// Seções de tags da coluna "Psicologia & conteúdo".
// Cada uma vira uma lista de chips (mesmo padrão de dores/desejos/interesses).
const TAG_SECTIONS: ReadonlyArray<{ label: string; field: TagField; hint?: string; placeholder?: string }> = [
  { label: "Dores principais", field: "pain_points", placeholder: "Adicionar dor..." },
  { label: "Desejos", field: "desires", placeholder: "Adicionar desejo..." },
  {
    label: "Objeções",
    field: "objections",
    hint: "O que faz essa persona hesitar ou não comprar? Medos, dúvidas e receios.",
    placeholder: "Ex: acho caro, não tenho tempo...",
  },
  { label: "Interesses", field: "interests", placeholder: "Adicionar interesse..." },
];

const AGE_OPTIONS = ["18-24", "25-34", "35-44", "45+"] as const;

function parseAgeRanges(value: string): string[] {
  return value ? value.split(",").map(s => s.trim()).filter(Boolean) : [];
}

export function PersonaStructuredForm({
  persona,
  onPersonaChange,
  onAddTag,
  onRemoveTag,
  onSave,
}: Props) {
  const setField = <K extends keyof PersonaData>(key: K, value: PersonaData[K]) => {
    onPersonaChange(prev => ({ ...prev, [key]: value }));
  };

  const [newTagDraft, setNewTagDraft] = useState<Record<TagField, string>>({
    interests: "",
    pain_points: "",
    desires: "",
    objections: "",
  });

  const handleAddTag = (field: TagField) => {
    const value = newTagDraft[field].trim();
    if (!value) return;
    onAddTag(field, value);
    setNewTagDraft(prev => ({ ...prev, [field]: "" }));
  };

  const ageRanges = parseAgeRanges(persona.age_range);
  const toggleAgeRange = (option: string) => {
    const next = ageRanges.includes(option)
      ? ageRanges.filter(a => a !== option)
      : [...ageRanges, option];
    setField("age_range", next.join(", "));
  };

  // Renderiza uma seção de tags (chips + input de adicionar).
  const renderTagSection = (section: (typeof TAG_SECTIONS)[number]) => (
    <div key={section.field} className="space-y-2">
      <Label className="font-body text-sm">{section.label}</Label>
      {section.hint && (
        <p className="text-xs text-muted-foreground font-body leading-snug">{section.hint}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {(persona[section.field] as string[]).map((tag, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded-lg text-xs font-body">
            {tag}
            <button
              type="button"
              onClick={() => onRemoveTag(section.field, i)}
              className="hover:text-destructive"
            >
              ×
            </button>
          </span>
        ))}
        {(persona[section.field] as string[]).length === 0 && (
          <span className="text-xs text-muted-foreground/60 font-body italic">Nada cadastrado ainda</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder={section.placeholder ?? `Adicionar ${section.label.toLowerCase()}...`}
          value={newTagDraft[section.field]}
          onChange={(e) => setNewTagDraft(prev => ({ ...prev, [section.field]: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddTag(section.field);
            }
          }}
          className="rounded-xl text-sm"
        />
        <Button variant="outline" size="sm" onClick={() => handleAddTag(section.field)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-primary/70" /> Dados estruturados da persona
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Em telas maiores usamos 2 colunas pra aproveitar a largura;
            no mobile empilha numa coluna só. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {/* ─── Coluna 1: Identidade ─── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-body font-semibold uppercase tracking-wide text-muted-foreground">
              <UserCircle className="h-4 w-4 text-primary/60" /> Identidade
            </div>

            <div className="space-y-2">
              <Label className="font-body text-sm">Nome da persona</Label>
              <Input
                placeholder="Ex: Maria, 28 anos"
                value={persona.name}
                onChange={(e) => setField("name", e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-body text-sm">Ícone</Label>
              <div className="grid grid-cols-6 gap-2">
                {PERSONA_ICONS.map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setField("icon", id)}
                    title={label}
                    aria-label={label}
                    className={cn(
                      "h-11 w-full rounded-xl flex items-center justify-center transition-all border-2",
                      persona.icon === id
                        ? "border-primary bg-primary/10 text-primary scale-105"
                        : "border-border bg-muted/20 text-muted-foreground hover:border-primary/40 hover:text-primary"
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-body text-sm">Faixa etária</Label>
              <div className="flex gap-2 flex-wrap">
                {AGE_OPTIONS.map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAgeRange(a)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${
                      ageRanges.includes(a)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-body text-sm">Gênero</Label>
              <div className="flex gap-2 flex-wrap">
                {["Mulheres", "Homens", "Todos"].map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setField("gender", persona.gender === g ? "" : g)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${
                      persona.gender === g
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-body text-sm">Localização</Label>
              <Input
                placeholder="Ex: Brasil, São Paulo"
                value={persona.location}
                onChange={(e) => setField("location", e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-body text-sm">Plataformas que usa</Label>
              <div className="flex gap-2">
                {(["instagram", "tiktok", "youtube"] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      setField(
                        "platforms",
                        persona.platforms.includes(p)
                          ? persona.platforms.filter(x => x !== p)
                          : [...persona.platforms, p]
                      )
                    }
                    className={`px-3 py-2 rounded-xl border transition-colors ${
                      persona.platforms.includes(p) ? "bg-primary/10 border-primary" : "bg-background border-border"
                    }`}
                  >
                    <PlatformIcon platform={p} size="sm" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Coluna 2: Psicologia & conteúdo ─── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-body font-semibold uppercase tracking-wide text-muted-foreground">
              <Brain className="h-4 w-4 text-primary/60" /> Psicologia & conteúdo
            </div>

            {TAG_SECTIONS.map(renderTagSection)}

            <div className="space-y-2">
              <Label className="font-body text-sm">Como você ajuda essa persona</Label>
              <Textarea
                placeholder="Ex: Ensino ela a criar conteúdo de forma simples e consistente..."
                value={persona.how_you_help}
                onChange={(e) => setField("how_you_help", e.target.value)}
                className="rounded-xl min-h-[80px]"
              />
            </div>
          </div>
        </div>

        {/* Notas em largura total, abaixo das duas colunas. */}
        <div className="space-y-2">
          <Label className="font-body text-sm">Notas</Label>
          <Textarea
            placeholder="Observações sobre seu público..."
            value={persona.notes}
            onChange={(e) => setField("notes", e.target.value)}
            className="rounded-xl min-h-[80px]"
          />
        </div>

        <Button variant="hero" onClick={onSave} className="gap-2 w-full sm:w-auto">
          <Save className="h-4 w-4" /> Salvar persona
        </Button>
      </CardContent>
    </Card>
  );
}
