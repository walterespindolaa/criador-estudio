import { describe, expect, it } from "vitest";
import { periodoDoFechamento, rotuloPeriodo } from "./fechamento";

describe("periodoDoFechamento", () => {
  it("dia 15: antes do dia 15 fecha neste mês", () => {
    expect(periodoDoFechamento("dia15", "2026-10-10")).toEqual({ de: "2026-09-16", ate: "2026-10-15" });
  });
  it("dia 15: no próprio dia 15 ainda é o período que fecha hoje", () => {
    expect(periodoDoFechamento("dia15", "2026-10-15")).toEqual({ de: "2026-09-16", ate: "2026-10-15" });
  });
  it("dia 15: depois do 15 já é o próximo", () => {
    expect(periodoDoFechamento("dia15", "2026-09-29")).toEqual({ de: "2026-09-16", ate: "2026-10-15" });
  });
  it("dia 15: anterior atravessa o ano", () => {
    expect(periodoDoFechamento("dia15", "2026-01-05", -1)).toEqual({ de: "2025-11-16", ate: "2025-12-15" });
  });
  it("quinzenal: segunda quinzena e anterior", () => {
    expect(periodoDoFechamento("quinzenal", "2026-09-29")).toEqual({ de: "2026-09-16", ate: "2026-09-30" });
    expect(periodoDoFechamento("quinzenal", "2026-09-29", -1)).toEqual({ de: "2026-09-01", ate: "2026-09-15" });
  });
  it("quinzenal: anterior da primeira quinzena de janeiro vai pra dezembro", () => {
    expect(periodoDoFechamento("quinzenal", "2026-01-03", -1)).toEqual({ de: "2025-12-16", ate: "2025-12-31" });
  });
  it("mensal: fevereiro e mês anterior", () => {
    expect(periodoDoFechamento("mensal", "2028-02-10")).toEqual({ de: "2028-02-01", ate: "2028-02-29" });
    expect(periodoDoFechamento("servico", "2026-01-10", -1)).toEqual({ de: "2025-12-01", ate: "2025-12-31" });
  });
  it("rótulo", () => {
    expect(rotuloPeriodo({ de: "2026-09-16", ate: "2026-10-15" })).toBe("16/09 a 15/10");
  });
});
