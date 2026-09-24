import { describe, it, expect } from "vitest";
import { ROTULO_APROVACAO, ROTULO_ETAPA, ROTULO_CRONOGRAMA, rotulo } from "./labels";

describe("rótulos únicos", () => {
  it("cobre os 5 status do Cria Post", () => {
    expect(Object.keys(ROTULO_APROVACAO).sort()).toEqual(["ajuste_solicitado", "aprovado", "em_producao", "pendente", "postado"]);
  });
  it("cobre as 6 etapas do criador", () => {
    expect(Object.keys(ROTULO_ETAPA)).toHaveLength(6);
  });
  it("rotulo() nunca devolve undefined", () => {
    expect(rotulo(ROTULO_CRONOGRAMA, "aprovado")).toBe("Aprovado");
    expect(rotulo(ROTULO_CRONOGRAMA, "xpto", "?")).toBe("?");
    expect(rotulo(ROTULO_CRONOGRAMA, null)).toBe("");
  });
});
