import { describe, expect, it } from "vitest";
import { calcularSequencia, diasFora, segundaDaSemana } from "./sequencia";

// Sexta, 27/11/2026. A semana começa na segunda 23/11.
const HOJE = "2026-11-27";
// Meio-dia em Brasília = 15h UTC.
const em = (dia: string) => `${dia}T15:00:00Z`;

describe("segundaDaSemana", () => {
  it("segunda a domingo", () => {
    expect(segundaDaSemana("2026-11-23")).toBe("2026-11-23");
    expect(segundaDaSemana("2026-11-27")).toBe("2026-11-23");
    expect(segundaDaSemana("2026-11-29")).toBe("2026-11-23"); // domingo
    expect(segundaDaSemana("2026-11-30")).toBe("2026-11-30");
  });
});

describe("calcularSequencia", () => {
  it("conta semanas seguidas batendo a meta, com a atual aberta sem quebrar", () => {
    const posts = [
      em("2026-11-02"), em("2026-11-04"), // semana 02/11: 2
      em("2026-11-09"), em("2026-11-13"), // semana 09/11: 2
      em("2026-11-17"), em("2026-11-18"), // semana 16/11: 2
      em("2026-11-24"),                   // esta semana: 1 de 2 (aberta)
    ];
    const s = calcularSequencia(posts, 2, HOJE);
    expect(s.atual).toBe(3);
    expect(s.maior).toBe(3);
    expect(s.feitosSemana).toBe(1);
    expect(s.faltamSemana).toBe(1);
    expect(s.semanas).toHaveLength(8);
    expect(s.semanas[7]).toMatchObject({ inicio: "2026-11-23", atual: true, batida: false, total: 1 });
  });

  it("semana atual batida entra na conta", () => {
    const s = calcularSequencia([em("2026-11-17"), em("2026-11-24")], 1, HOJE);
    expect(s.atual).toBe(2);
    expect(s.faltamSemana).toBe(0);
  });

  it("perder uma semana zera, mas a maior fica guardada", () => {
    const posts = [
      em("2026-10-05"), em("2026-10-12"), em("2026-10-19"), // 3 seguidas
      // semana 26/10 perdida
      em("2026-11-02"),
      // semana 09/11 perdida
      em("2026-11-16"),
    ];
    const s = calcularSequencia(posts, 1, HOJE);
    expect(s.atual).toBe(1);
    expect(s.maior).toBe(3);
  });

  it("semana passada sem meta batida zera mesmo com post", () => {
    const s = calcularSequencia([em("2026-11-09"), em("2026-11-10"), em("2026-11-17")], 2, HOJE);
    expect(s.atual).toBe(0);
    expect(s.maior).toBe(1);
  });

  it("usa o fuso de São Paulo: domingo 23h em Brasília é da semana anterior", () => {
    // Domingo 22/11 às 23h30 em Brasília = segunda 23/11 02:30 UTC.
    const s = calcularSequencia(["2026-11-23T02:30:00Z"], 1, HOJE);
    expect(s.semanas[6]).toMatchObject({ inicio: "2026-11-16", total: 1 });
    expect(s.feitosSemana).toBe(0);
    expect(s.atual).toBe(1);
  });

  it("sem posts", () => {
    const s = calcularSequencia([], 3, HOJE);
    expect(s).toMatchObject({ atual: 0, maior: 0, feitosSemana: 0, faltamSemana: 3 });
  });

  it("meta inválida vira 1", () => {
    expect(calcularSequencia([em("2026-11-24")], 0, HOJE).meta).toBe(1);
  });
});

describe("diasFora", () => {
  it("ignora o dia de hoje", () => {
    expect(diasFora(["2026-11-20", "2026-11-27"], HOJE)).toBe(7);
  });
  it("conta pelo último dia antes de hoje", () => {
    expect(diasFora(["2026-11-10", "2026-11-24", "2026-11-15"], HOJE)).toBe(3);
  });
  it("ontem é 1 dia", () => {
    expect(diasFora(["2026-11-26"], HOJE)).toBe(1);
  });
  it("conta nova (só hoje) não é volta", () => {
    expect(diasFora(["2026-11-27"], HOJE)).toBeNull();
    expect(diasFora([], HOJE)).toBeNull();
  });
});
