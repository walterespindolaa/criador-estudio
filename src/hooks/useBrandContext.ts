import { useMemo } from "react";
import { useBrandItems } from "./useBrandItems";
import { usePersonas } from "./usePersonas";
import { useMoodboard } from "./useMoodboard";

// Mapping `brand_items.type` and moodboard section keys to human labels
// the AI can actually use. Anything not listed falls back to the raw key.
const ITEM_TYPE_LABELS: Record<string, string> = {
  cor: "Cores",
  fonte: "Fontes",
  tom: "Tom de voz",
  expressao: "Expressões que uso",
  evitar: "Palavras que evito",
  value: "Valores",
};

const SECTION_LABELS: Record<string, string> = {
  "moodboard-identidade": "Identidade",
  "moodboard-visual": "Visual",
  "moodboard-contexto": "Contexto e propósito",
  "moodboard-inspiracoes": "Inspirações",
  "visao-de-mundo": "Visão de mundo",
  "sobre-voce": "Sobre o criador",
  "linha-editorial": "Linha editorial",
  "tom-de-voz": "Tom de voz",
  "persona-brand": "Persona da marca",
};

/**
 * Builds a single text blob with everything the user has filled in their
 * Brandbook (brand items, moodboard, persona). Empty when there's nothing
 * to send so the caller can branch on `brandContext` truthiness without
 * extra checks.
 */
export function useBrandContext() {
  const { brandItems } = useBrandItems();
  const { personas } = usePersonas();
  const { entries } = useMoodboard();

  const brandContext = useMemo(() => {
    const parts: string[] = [];

    // Brand items grouped by type (cores, fontes, tom, expressões, evitar…)
    const byType = brandItems.reduce<Record<string, string[]>>((acc, item) => {
      const label = ITEM_TYPE_LABELS[item.type] ?? item.type;
      if (!acc[label]) acc[label] = [];
      const value = item.value ? `${item.name} (${item.value})` : item.name;
      acc[label].push(value);
      return acc;
    }, {});
    for (const [label, names] of Object.entries(byType)) {
      parts.push(`${label}: ${names.join(", ")}`);
    }

    // Moodboard answers grouped by section
    const bySection = entries.reduce<Record<string, string[]>>((acc, entry) => {
      const answer = entry.answer?.trim();
      if (!answer) return acc;
      const label = SECTION_LABELS[entry.section] ?? entry.section;
      if (!acc[label]) acc[label] = [];
      acc[label].push(answer);
      return acc;
    }, {});
    for (const [label, answers] of Object.entries(bySection)) {
      parts.push(`${label}: ${answers.join(". ")}`);
    }

    // Personas (uma ou mais)
    personas.forEach((persona, idx) => {
      if (!persona?.name) return;
      const headerBits = [persona.name];
      if (persona.age_range) headerBits.push(persona.age_range);
      if (persona.gender) headerBits.push(persona.gender);
      if (persona.location) headerBits.push(persona.location);
      const prefix = personas.length > 1 ? `Persona ${idx + 1}` : "Público-alvo";
      let line = `${prefix}: ${headerBits.join(", ")}`;
      if (persona.pain_points?.length) line += `. Dores: ${persona.pain_points.join(", ")}`;
      if (persona.desires?.length) line += `. Desejos: ${persona.desires.join(", ")}`;
      if (persona.interests?.length) line += `. Interesses: ${persona.interests.join(", ")}`;
      parts.push(line);
    });

    return parts.join("\n");
  }, [brandItems, personas, entries]);

  return { brandContext, hasBrandContext: brandContext.length > 0 };
}
