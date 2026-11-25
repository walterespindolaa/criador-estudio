import { describe, expect, it } from "vitest";
import { posicaoCorte } from "./LinkedInLegenda";
import { formatoLinkedInDaMidia } from "@/hooks/usePublicarRedes";

describe("posicaoCorte (ver mais do LinkedIn)", () => {
  it("texto curto aparece inteiro", () => {
    expect(posicaoCorte("Oi, tudo bem?")).toBeNull();
  });
  it("corta em 210 caracteres", () => {
    expect(posicaoCorte("a".repeat(400))).toBe(210);
  });
  it("corta na terceira quebra de linha se vier antes", () => {
    const t = "linha 1\nlinha 2\nlinha 3\nlinha 4";
    expect(posicaoCorte(t)).toBe(t.indexOf("\nlinha 4"));
  });
});

describe("formatoLinkedInDaMidia", () => {
  it("escolhe o formato pela mídia", () => {
    expect(formatoLinkedInDaMidia({ fotos: 0, videos: 0 })).toMatchObject({ formato: "texto" });
    expect(formatoLinkedInDaMidia({ fotos: 1, videos: 0 })).toMatchObject({ formato: "foto" });
    expect(formatoLinkedInDaMidia({ fotos: 6, videos: 0 })).toMatchObject({ formato: "carrossel" });
    expect(formatoLinkedInDaMidia({ fotos: 0, videos: 1 })).toMatchObject({ formato: "video" });
  });
  it("recusa foto com vídeo, dois vídeos e mais de 20 fotos", () => {
    expect("erro" in formatoLinkedInDaMidia({ fotos: 2, videos: 1 })).toBe(true);
    expect("erro" in formatoLinkedInDaMidia({ fotos: 0, videos: 2 })).toBe(true);
    expect("erro" in formatoLinkedInDaMidia({ fotos: 21, videos: 0 })).toBe(true);
  });
});
