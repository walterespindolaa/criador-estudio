import { Plus, Save, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlatformIcon } from "@/components/shared/PlatformIcon";

export interface PersonaData {
  id: string | null;
  name: string;
  age_range: string;
  gender: string;
  location: string;
  interests: string[];
  pain_points: string[];
  desires: string[];
  platforms: string[];
  notes: string;
}

type TagField = "interests" | "pain_points" | "desires";

type Props = {
  persona: PersonaData;
  newTag: string;
  onPersonaChange: (next: PersonaData | ((prev: PersonaData) => PersonaData)) => void;
  onNewTagChange: (value: string) => void;
  onAddTag: (field: TagField) => void;
  onRemoveTag: (field: TagField, idx: number) => void;
  onSave: () => void;
};

const TAG_SECTIONS: ReadonlyArray<{ label: string; field: TagField }> = [
  { label: "Interesses", field: "interests" },
  { label: "Dores principais", field: "pain_points" },
  { label: "Desejos", field: "desires" },
];

export function PersonaStructuredForm({
  persona,
  newTag,
  onPersonaChange,
  onNewTagChange,
  onAddTag,
  onRemoveTag,
  onSave,
}: Props) {
  const setField = <K extends keyof PersonaData>(key: K, value: PersonaData[K]) => {
    onPersonaChange(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-primary/70" /> Dados estruturados da persona
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <Label className="font-body text-sm">Faixa etária</Label>
          <div className="flex gap-2 flex-wrap">
            {["18-24", "25-34", "35-44", "45+"].map(a => (
              <button
                key={a}
                type="button"
                onClick={() => setField("age_range", persona.age_range === a ? "" : a)}
                className={`px-3 py-1.5 rounded-xl text-sm font-body border transition-colors ${
                  persona.age_range === a
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

        {TAG_SECTIONS.map(section => (
          <div key={section.field} className="space-y-2">
            <Label className="font-body text-sm">{section.label}</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
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
            </div>
            <div className="flex gap-2">
              <Input
                placeholder={`Adicionar ${section.label.toLowerCase()}...`}
                value={newTag}
                onChange={(e) => onNewTagChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onAddTag(section.field);
                }}
                className="rounded-xl text-sm"
              />
              <Button variant="outline" size="sm" onClick={() => onAddTag(section.field)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

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

        <div className="space-y-2">
          <Label className="font-body text-sm">Notas</Label>
          <Textarea
            placeholder="Observações sobre seu público..."
            value={persona.notes}
            onChange={(e) => setField("notes", e.target.value)}
            className="rounded-xl min-h-[60px]"
          />
        </div>

        <Button variant="hero" onClick={onSave} className="gap-2">
          <Save className="h-4 w-4" /> Salvar persona
        </Button>
      </CardContent>
    </Card>
  );
}
