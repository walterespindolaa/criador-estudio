import { describe, it, expect } from "vitest";
import { casaNicho, nichosDe } from "./nichos";

describe("nichosDe", () => {
  it("separa e normaliza", () => {
    expect(nichosDe("Lifestyle, Moda e Beleza")).toEqual(["lifestyle", "moda", "beleza"]);
    expect(nichosDe("Saúde Mental / Música")).toEqual(["saude mental", "musica"]);
    expect(nichosDe(null)).toEqual([]);
  });
});

describe("casaNicho", () => {
  it("geral serve pra todo mundo", () => {
    expect(casaNicho("geral", "Moda")).toBe(true);
    expect(casaNicho(null, "Moda")).toBe(true);
  });
  it("casa nicho a nicho, sem depender de maiúscula ou acento", () => {
    expect(casaNicho("lifestyle", "Lifestyle, Moda, Beleza")).toBe(true);
    expect(casaNicho("musica", "Música, Moda")).toBe(true);
    expect(casaNicho("esportes", "Lifestyle, Moda")).toBe(false);
  });
});
