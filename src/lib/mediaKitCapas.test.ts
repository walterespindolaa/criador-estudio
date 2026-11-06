import { describe, expect, it } from "vitest";
import { capaValida, estiloCapa, lerMostrar, limparSlug, slugValido, slugDaVersao, linkDoContato } from "./mediaKitCapas";

describe("capas do media kit", () => {
  it("capa desconhecida vira o padrão Cria", () => {
    expect(capaValida("xyz")).toBe("cria");
    expect(capaValida(null)).toBe("cria");
    expect(capaValida("cria-3")).toBe("cria-3");
  });
  it("cor livre clara leva texto escuro, escura leva texto branco", () => {
    expect(estiloCapa("cor", "#FFCF03").texto).toBe("#0A0A0A");
    expect(estiloCapa("cor", "#1F2937").texto).toBe("#FFFFFF");
  });
  it("capas desenhadas usam o desenho do Criakut", () => {
    expect(estiloCapa("cria-4", null).desenho).toBe("cria-4");
    expect(estiloCapa("neutro", null).desenho).toBeNull();
  });
});

describe("o que aparece", () => {
  it("campo faltando fica ligado", () => {
    expect(lerMostrar({ valores: false })).toEqual({ numeros: true, audiencia: true, desempenho: true, conteudos: true, valores: false });
    expect(lerMostrar(null).numeros).toBe(true);
  });
});

describe("endereço do link", () => {
  it("limpa e valida", () => {
    expect(limparSlug("@Walter Espíndola!")).toBe("walter-espindola");
    expect(slugValido("walter")).toBe(true);
    expect(slugValido("w")).toBe(false);
    expect(slugValido("-walter")).toBe(false);
    expect(slugDaVersao("Marca de Moda")).toBe("marca-de-moda");
  });
});

describe("contato", () => {
  it("e-mail vira mailto e telefone vira WhatsApp", () => {
    expect(linkDoContato("a@b.com")).toMatch(/^mailto:a@b\.com/);
    expect(linkDoContato("(47) 99999-1234")).toMatch(/^https:\/\/wa\.me\/5547999991234/);
    expect(linkDoContato("fale comigo")).toBeNull();
  });
});
