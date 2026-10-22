import { describe, expect, it } from "vitest";
import { NICHOS, blocosDoNicho } from "@/lib/bioEspecialista";
import { previaDoNicho } from "@/components/bio/PreviaModelo";

describe("prévia dos ramos do especialista", () => {
  it("todo marcador vira exemplo na prévia, e o bloco aplicado continua com ele", () => {
    for (const n of NICHOS) {
      const blocos = blocosDoNicho(n);
      const antes = JSON.stringify(blocos);
      const p = previaDoNicho(blocos as never);
      const juntos = blocos.map((b, i) => ({ ...(b.data ?? {}), ...(p.blocos?.[i] ?? {}) }));
      expect(JSON.stringify(juntos), n.id).not.toMatch(/\[[^\]"{}]+\]/);
      expect(JSON.stringify(blocos)).toBe(antes);
    }
  });
});
