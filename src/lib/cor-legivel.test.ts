import { describe, it, expect } from "vitest";
import { luminance, readableFg, readableFgHex, corSeguraEmFundoClaro, shadeHex } from "./cor-legivel";

// Marca clara com texto branco era o bug: o hero da aprovação ficava ilegível.
describe("cor legível", () => {
  it("branco tem luminância 1 e preto 0", () => {
    expect(luminance("#ffffff")).toBeCloseTo(1, 3);
    expect(luminance("#000000")).toBeCloseTo(0, 3);
  });
  it("marca clara pede texto escuro; marca escura pede texto branco", () => {
    expect(readableFgHex("#FAF3E0")).toBe("#1c1917");
    expect(readableFgHex("#0F6E56")).toBe("#ffffff");
    expect(readableFg("#EA4918")).toBe("0 0% 100%");
  });
  it("corSeguraEmFundoClaro escurece até ter contraste", () => {
    const cor = corSeguraEmFundoClaro("#FFE680");
    expect(luminance(cor)).toBeLessThanOrEqual(0.35);
  });
  it("cor já escura fica como está", () => {
    expect(corSeguraEmFundoClaro("#222222")).toBe("#222222");
  });
  it("shadeHex não estoura os limites", () => {
    expect(shadeHex("#ffffff", 50)).toBe("#ffffff");
    expect(shadeHex("#000000", -50)).toBe("#000000");
  });
});
