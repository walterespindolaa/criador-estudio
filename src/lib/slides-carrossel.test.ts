import { describe, expect, it } from "vitest";
import { joinSlides, parseSlides } from "./slides-carrossel";

describe("parseSlides", () => {
  it("vazio vira lista vazia", () => {
    expect(parseSlides("")).toEqual([]);
    expect(parseSlides(null)).toEqual([]);
    expect(parseSlides("   \n  ")).toEqual([]);
  });
  it("separa por linha em branco e preserva quebra interna", () => {
    expect(parseSlides("um\ncontinua\n\ndois\n\n\ntres")).toEqual(["um\ncontinua", "dois", "tres"]);
  });
  it("texto antigo sem linha em branco vira um slide por linha", () => {
    expect(parseSlides("a\nb\nc")).toEqual(["a", "b", "c"]);
  });
  it("um parágrafo só é um slide", () => {
    expect(parseSlides("só isso")).toEqual(["só isso"]);
  });
  it("aceita CRLF", () => {
    expect(parseSlides("a\r\n\r\nb")).toEqual(["a", "b"]);
  });
});

describe("joinSlides", () => {
  it("junta com linha em branco e ignora vazios", () => {
    expect(joinSlides(["a", "", "  b  ", "c\nd"])).toBe("a\n\nb\n\nc\nd");
  });
  it("ida e volta não perde texto", () => {
    const original = "slide 2\nlinha extra\n\nslide 3\n\nCTA final";
    expect(joinSlides(parseSlides(original))).toBe(original);
  });
});
