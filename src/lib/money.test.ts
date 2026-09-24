import { describe, it, expect } from "vitest";
import { brlReais, brlCentavos, formatBRL, parseBRL } from "./money";

const nbsp = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

describe("dinheiro", () => {
  it("brlReais formata reais com milhar e vírgula", () => {
    expect(nbsp(brlReais(1234.5))).toBe("R$ 1.234,50");
    expect(nbsp(brlReais(0))).toBe("R$ 0,00");
    expect(nbsp(brlReais(null))).toBe("R$ 0,00");
  });
  it("brlCentavos divide por 100 (valor do Stripe)", () => {
    expect(nbsp(brlCentavos(119700))).toBe("R$ 1.197,00");
    expect(nbsp(brlCentavos(undefined))).toBe("R$ 0,00");
  });
  it("formatBRL vira traço no zero por padrão", () => {
    expect(formatBRL(0)).toBe("-");
    expect(nbsp(formatBRL(0, { zeroAsDash: false }))).toBe("R$ 0,00");
  });
  it("parseBRL lê o que a pessoa digita", () => {
    expect(parseBRL("1.234,56")).toBe(1234.56);
    expect(parseBRL("R$ 50")).toBe(50);
  });
});
