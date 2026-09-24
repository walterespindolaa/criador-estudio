import { describe, it, expect } from "vitest";
import { esquemaFaltando, vazioOuErro } from "./erro-esquema";

// Só migration pendente vira vazio; rede caída sobe como erro.
describe("erro de esquema", () => {
  it("reconhece tabela/coluna/função que não existe", () => {
    expect(esquemaFaltando({ code: "42P01", message: "relation x does not exist" })).toBe(true);
    expect(esquemaFaltando({ code: "PGRST202", message: "Could not find the function" })).toBe(true);
    expect(esquemaFaltando({ message: "column y does not exist" })).toBe(true);
  });
  it("erro de rede ou permissão NÃO é esquema", () => {
    expect(esquemaFaltando({ message: "TypeError: Failed to fetch" })).toBe(false);
    expect(esquemaFaltando({ code: "42501", message: "permission denied" })).toBe(false);
  });
  it("vazioOuErro devolve o vazio só no caso de esquema", () => {
    expect(vazioOuErro({ code: "42P01", message: "does not exist" }, [])).toEqual([]);
    expect(() => vazioOuErro({ message: "Failed to fetch" }, [])).toThrow();
  });
});
